-- Regras de estoque e lista (spec §5): trigger "acabou", finish_shopping e realtime.

-- Item que zerou entra na lista. Dispara para qualquer escritor (inclusive service role),
-- por isso added_by cai para updated_by quando não há auth.uid().
-- O índice único parcial em (item_id) impede a entrada duplicada.
create function public.items_to_list_when_empty()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.shopping_list_entries
    (household_id, item_id, name, quantity, unit, category, added_by)
  values
    (new.household_id, new.id, new.name, null, new.unit, new.category,
     coalesce(auth.uid(), new.updated_by))
  on conflict (item_id) where item_id is not null do nothing;
  return new;
end;
$$;

revoke execute on function public.items_to_list_when_empty() from public, anon;

create trigger items_to_list_when_empty
  after update on public.items
  for each row
  when (old.quantity > 0 and new.quantity = 0)
  execute function public.items_to_list_when_empty();

-- Finaliza a compra: soma as entradas marcadas ao estoque e as apaga, tudo ou nada.
-- p_entries = [{"entry_id": uuid, "quantity": number}], quantity > 0.
-- Security invoker: o RLS esconde entradas de outras casas (viram entry_invalid).
-- As entradas são travadas primeiro; uma chamada concorrente espera, não encontra mais
-- as linhas e recebe entry_invalid, sem somar em dobro.
-- Unidades são usadas como estão (sem conversão): entrada avulsa que casa com um item
-- existente soma na quantidade dele, qualquer que seja a unidade da entrada.
create function public.finish_shopping(p_household_id uuid, p_entries jsonb)
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_qtys numeric[];
  v_locked int;
  v_checked int;
  v_count int;
  r record;
begin
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' then
    raise exception 'entry_invalid';
  end if;

  begin
    select array_agg((e ->> 'entry_id')::uuid order by ord),
           array_agg((e ->> 'quantity')::numeric order by ord)
      into v_ids, v_qtys
      from jsonb_array_elements(p_entries) with ordinality as t(e, ord);
  exception when others then
    raise exception 'entry_invalid';
  end;

  v_count := coalesce(cardinality(v_ids), 0);
  if v_count = 0 then
    return 0;
  end if;

  if exists (select 1 from unnest(v_ids) as i where i is null)
     or exists (select 1 from unnest(v_qtys) as q where q is null or q <= 0)
     or (select count(distinct i) from unnest(v_ids) as i) <> v_count then
    raise exception 'entry_invalid';
  end if;

  select count(*), count(*) filter (where checked)
    into v_locked, v_checked
    from (
      select checked
        from public.shopping_list_entries
       where id = any (v_ids) and household_id = p_household_id
       order by id
         for update
    ) locked;

  if v_locked <> v_count or v_checked <> v_count then
    raise exception 'entry_invalid';
  end if;

  for r in
    select e.id, e.item_id, e.name, e.unit, e.category, i.qty
      from public.shopping_list_entries e
      join unnest(v_ids, v_qtys) as i(id, qty) on i.id = e.id
     where e.household_id = p_household_id
  loop
    if r.item_id is not null then
      update public.items
         set quantity = quantity + r.qty, updated_by = auth.uid()
       where id = r.item_id and household_id = p_household_id;
    else
      insert into public.items (household_id, name, quantity, unit, category, updated_by)
      values (p_household_id, r.name, r.qty, r.unit, r.category, auth.uid())
      on conflict (household_id, name_key)
        do update set quantity = public.items.quantity + excluded.quantity,
                      updated_by = excluded.updated_by;
    end if;
  end loop;

  delete from public.shopping_list_entries
   where id = any (v_ids) and household_id = p_household_id;

  return v_count;
end;
$$;

revoke execute on function public.finish_shopping(uuid, jsonb) from public, anon;
grant execute on function public.finish_shopping(uuid, jsonb) to authenticated;

-- Realtime (replica identity default: DELETE traz só a PK)
alter publication supabase_realtime add table public.items, public.shopping_list_entries;
