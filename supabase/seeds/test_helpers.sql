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
  delete from public.shopping_list_entries where household_id = c_house;
  delete from public.items where household_id = c_house;
  delete from public.household_invites where household_id = c_house;
  delete from public.household_members where household_id = c_house;

  insert into public.household_members (household_id, user_id, role) values
    (c_house, c_lucas, 'owner'),
    (c_house, c_ana, 'member');

  insert into public.items (household_id, name, quantity, unit, category, updated_by) values
    (c_house, 'Leite',           2,   'L',  'laticinios', c_lucas),
    (c_house, 'Iogurte',         0,   'un', 'laticinios', c_lucas),
    (c_house, 'Arroz',           0,   'kg', 'mercearia',  c_lucas),
    (c_house, 'Feijão',          1,   'kg', 'mercearia',  c_lucas),
    (c_house, 'Macarrão',        2,   'un', 'mercearia',  c_lucas),
    (c_house, 'Ovos',            6,   'un', 'laticinios', c_lucas),
    (c_house, 'Pão de forma',    1,   'un', 'padaria',    c_lucas),
    (c_house, 'Banana',          6,   'un', 'hortifruti', c_lucas),
    (c_house, 'Tomate',          0.5, 'kg', 'hortifruti', c_lucas),
    (c_house, 'Frango',          1,   'kg', 'carnes',     c_lucas),
    (c_house, 'Água',            6,   'L',  'bebidas',    c_lucas),
    (c_house, 'Detergente',      0,   'un', 'limpeza',    c_lucas),
    (c_house, 'Sabão em pó',     1,   'un', 'limpeza',    c_lucas),
    (c_house, 'Papel higiênico', 4,   'un', 'higiene',    c_lucas),
    (c_house, 'Pasta de dente',  1,   'un', 'higiene',    c_lucas);

  -- entradas ligadas ao estoque
  insert into public.shopping_list_entries
    (household_id, item_id, name, quantity, unit, category, checked, added_by)
  select c_house, i.id, i.name, e.quantity, i.unit, i.category, false, c_ana
  from (values ('Arroz', 2::numeric), ('Iogurte', null::numeric), ('Detergente', 1::numeric))
       as e(name, quantity)
  join public.items i
    on i.household_id = c_house and i.name_key = public.normalize_name(e.name);

  -- entradas avulsas
  insert into public.shopping_list_entries
    (household_id, item_id, name, quantity, unit, category, checked, added_by) values
    (c_house, null, 'Azeite',  1,    'un', 'mercearia',  false, c_ana),
    (c_house, null, 'Sorvete', null, 'un', 'congelados', false, c_ana);

  -- última casa visitada
  update public.profiles set last_household_id = c_house where id in (c_lucas, c_ana);
  update public.profiles set last_household_id = null where id not in (c_lucas, c_ana);
end;
$$;
