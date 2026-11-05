-- Helpers de teste (somente ambiente local; carregados antes de seed.sql).
create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

create or replace function tests.login_as(p_email text)
returns void
language plpgsql
as $$
declare
  v_id uuid;
begin
  -- permite trocar de usuário sem logout(): volta ao dono antes de consultar auth.users
  reset role;
  perform set_config('request.jwt.claims', '', true);
  select id into v_id from auth.users where email = p_email;
  if v_id is null then
    raise exception 'usuário % não existe', p_email;
  end if;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_id, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;
end;
$$;

create or replace function tests.logout()
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Restaura a casa a1 ao estado exato do seed e apaga todas as outras casas.
-- Única fonte dos dados de fixture; chamada por seed.sql e pelos testes E2E.
create or replace function tests.reset_fixture()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_house constant uuid := '00000000-0000-0000-0000-0000000000a1';
  c_lucas constant uuid := '00000000-0000-0000-0000-0000000000b1';
  c_ana   constant uuid := '00000000-0000-0000-0000-0000000000b2';
begin
  -- limpa tudo que não é da casa a1 (cascata remove membros, itens, entradas, convites)
  update public.profiles set last_household_id = null
    where last_household_id is distinct from c_house;
  delete from public.households where id <> c_house;

  update public.households
    set name = 'Casa Lucas & Ana', created_by = c_lucas
    where id = c_house;

  update public.profiles set avatar_url = null;
  update public.profiles p set display_name = v.display_name
    from (values
      (c_lucas, 'Lucas'),
      (c_ana, 'Ana'),
      ('00000000-0000-0000-0000-0000000000b3'::uuid, 'Intruso'),
      ('00000000-0000-0000-0000-0000000000b4'::uuid, 'Novo'),
      ('00000000-0000-0000-0000-0000000000b5'::uuid, 'Convidado')
    ) as v(id, display_name)
    where p.id = v.id;

  -- reseta a1
  delete from public.household_invites where household_id = c_house;
  -- members antes dos owners, para não acionar guard_last_owner
  delete from public.household_members where household_id = c_house and role = 'member';
  delete from public.household_members where household_id = c_house;

  insert into public.household_members (household_id, user_id, role) values
    (c_house, c_lucas, 'owner'),
    (c_house, c_ana, 'member');

  /*
   * Itens e entradas estão na publicação do Realtime: cada linha escrita vira um evento para cada
   * assinatura da casa. Apagar e recriar tudo a cada teste estourava o limite de eventos do Realtime
   * local (100/s na média de 60 s), que então descarta TODOS os eventos da casa por dezenas de
   * segundos. Por isso o reset só toca as linhas que diferem do seed (diferença mínima).
   */
  create temporary table if not exists fixture_items (
    name text, quantity numeric, unit public.unit, category text
  ) on commit drop;
  truncate pg_temp.fixture_items;
  insert into pg_temp.fixture_items values
    ('Leite',           2,   'L',  'laticinios'),
    ('Iogurte',         0,   'un', 'laticinios'),
    ('Arroz',           0,   'kg', 'mercearia'),
    ('Feijão',          1,   'kg', 'mercearia'),
    ('Macarrão',        2,   'un', 'mercearia'),
    ('Ovos',            6,   'un', 'laticinios'),
    ('Pão de forma',    1,   'un', 'padaria'),
    ('Banana',          6,   'un', 'hortifruti'),
    ('Tomate',          0.5, 'kg', 'hortifruti'),
    ('Frango',          1,   'kg', 'carnes'),
    ('Água',            6,   'L',  'bebidas'),
    ('Detergente',      0,   'un', 'limpeza'),
    ('Sabão em pó',     1,   'un', 'limpeza'),
    ('Papel higiênico', 4,   'un', 'higiene'),
    ('Pasta de dente',  1,   'un', 'higiene');

  delete from public.items i
    where i.household_id = c_house
      and not exists (
        select 1 from pg_temp.fixture_items f where public.normalize_name(f.name) = i.name_key
      );

  update public.items i
    set name = f.name, quantity = f.quantity, unit = f.unit, category = f.category, updated_by = c_lucas
    from pg_temp.fixture_items f
    where i.household_id = c_house
      and i.name_key = public.normalize_name(f.name)
      and (i.name, i.quantity, i.unit, i.category, i.updated_by)
          is distinct from (f.name, f.quantity, f.unit, f.category, c_lucas);

  insert into public.items (household_id, name, quantity, unit, category, updated_by)
  select c_house, f.name, f.quantity, f.unit, f.category, c_lucas
  from pg_temp.fixture_items f
  where not exists (
    select 1 from public.items i
    where i.household_id = c_house and i.name_key = public.normalize_name(f.name)
  );

  -- entradas: ligadas ao estoque (Arroz, Iogurte, Detergente) e avulsas (Azeite, Sorvete)
  create temporary table if not exists fixture_entries (
    item_id uuid, name text, quantity numeric, unit public.unit, category text
  ) on commit drop;
  truncate pg_temp.fixture_entries;
  insert into pg_temp.fixture_entries
  select i.id, i.name, e.quantity, i.unit, i.category
  from (values ('Arroz', 2::numeric), ('Iogurte', null::numeric), ('Detergente', 1::numeric))
       as e(name, quantity)
  join public.items i
    on i.household_id = c_house and i.name_key = public.normalize_name(e.name);
  insert into pg_temp.fixture_entries values
    (null, 'Azeite',  1,    'un', 'mercearia'),
    (null, 'Sorvete', null, 'un', 'congelados');

  delete from public.shopping_list_entries s
    where s.household_id = c_house
      and not exists (
        select 1 from pg_temp.fixture_entries f
        where (s.item_id, s.name, s.quantity, s.unit, s.category, s.checked, s.checked_by, s.added_by)
              is not distinct from (f.item_id, f.name, f.quantity, f.unit, f.category, false, null::uuid, c_ana)
      );

  insert into public.shopping_list_entries
    (household_id, item_id, name, quantity, unit, category, checked, added_by)
  select c_house, f.item_id, f.name, f.quantity, f.unit, f.category, false, c_ana
  from pg_temp.fixture_entries f
  where not exists (
    select 1 from public.shopping_list_entries s
    where s.household_id = c_house
      and (s.item_id, s.name, s.quantity, s.unit, s.category, s.checked, s.checked_by, s.added_by)
          is not distinct from (f.item_id, f.name, f.quantity, f.unit, f.category, false, null::uuid, c_ana)
  );

  -- última casa visitada
  update public.profiles set last_household_id = c_house where id in (c_lucas, c_ana);
  update public.profiles set last_household_id = null where id not in (c_lucas, c_ana);
end;
$$;

-- O default global não dá mais EXECUTE ao PUBLIC (0003): os helpers precisam de grant explícito.
grant execute on all functions in schema tests to anon, authenticated;
