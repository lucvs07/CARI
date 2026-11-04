-- RLS por casa (spec §5: Regras no banco).
-- Inserts em households/household_members acontecem só via RPCs security definer
-- (create_household, accept_invite); por isso não há policy de insert nelas.

-- Helpers de pertencimento: security definer para não recursar nas policies
-- de household_members.
create function public.is_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household_id and user_id = auth.uid()
  )
$$;

create function public.is_owner(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household_id and user_id = auth.uid() and role = 'owner'
  )
$$;

revoke execute on function public.is_member(uuid), public.is_owner(uuid) from public, anon;
grant execute on function public.is_member(uuid), public.is_owner(uuid) to authenticated;

-- Produção: nenhuma tabela de public legível por anon (hoje e no futuro).
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.items enable row level security;
alter table public.shopping_list_entries enable row level security;

-- households (sem insert: create_household é security definer)
create policy households_select on public.households
  for select to authenticated using (public.is_member(id));
create policy households_update on public.households
  for update to authenticated
  using (public.is_member(id)) with check (public.is_member(id));
create policy households_delete on public.households
  for delete to authenticated using (public.is_member(id));

-- items
create policy items_select on public.items
  for select to authenticated using (public.is_member(household_id));
create policy items_insert on public.items
  for insert to authenticated with check (public.is_member(household_id));
create policy items_update on public.items
  for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy items_delete on public.items
  for delete to authenticated using (public.is_member(household_id));

-- shopping_list_entries
create policy entries_select on public.shopping_list_entries
  for select to authenticated using (public.is_member(household_id));
create policy entries_insert on public.shopping_list_entries
  for insert to authenticated with check (public.is_member(household_id));
create policy entries_update on public.shopping_list_entries
  for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy entries_delete on public.shopping_list_entries
  for delete to authenticated using (public.is_member(household_id));

-- household_members (sem insert: só via RPCs)
create policy members_select on public.household_members
  for select to authenticated using (public.is_member(household_id));
create policy members_update on public.household_members
  for update to authenticated
  using (public.is_owner(household_id)) with check (public.is_owner(household_id));
create policy members_delete on public.household_members
  for delete to authenticated
  using (user_id = auth.uid() or public.is_owner(household_id));

-- household_invites (leitura por token só dentro de accept_invite)
create policy invites_select on public.household_invites
  for select to authenticated using (public.is_owner(household_id));
create policy invites_insert on public.household_invites
  for insert to authenticated with check (public.is_owner(household_id));
create policy invites_update on public.household_invites
  for update to authenticated
  using (public.is_owner(household_id)) with check (public.is_owner(household_id));

-- profiles: o próprio e quem divide casa
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.household_members hm
      where hm.user_id = profiles.id and public.is_member(hm.household_id)
    )
  );
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
