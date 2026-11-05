create extension if not exists pgtap with schema extensions;

begin; select plan(23);

-- fixture de outra casa (como superusuário) para o teste de FK composta
insert into households (id, name) values ('00000000-0000-0000-0000-0000000000a9', 'Outra casa');
insert into items (id, household_id, name, quantity, unit)
  values ('00000000-0000-0000-0000-0000000000c9', '00000000-0000-0000-0000-0000000000a9', 'Cafe', 1, 'un');

select tests.login_as('ana@cari.test');
create temp table t_ctx (k text primary key, v text);
grant all on t_ctx to authenticated;

-- 1. trigger "acabou"
update items set quantity = 0 where name = 'Leite';
select is((select count(*)::int from shopping_list_entries e join items i on i.id = e.item_id where i.name = 'Leite' and e.quantity is null), 1, 'zerar o Leite cria 1 entrada com quantity nula');
select is((select e.added_by from shopping_list_entries e join items i on i.id = e.item_id where i.name = 'Leite'), auth.uid(), 'added_by = quem zerou');
update items set quantity = 2 where name = 'Leite';
update items set quantity = 0 where name = 'Leite';
update items set quantity = 2 where name = 'Leite';
update items set quantity = 0 where name = 'Leite';
select is((select count(*)::int from shopping_list_entries e join items i on i.id = e.item_id where i.name = 'Leite'), 1, 'zerar de novo não duplica a entrada');

-- 2. finish_shopping: ligada + avulsa
insert into t_ctx select 'leite', e.id::text from shopping_list_entries e join items i on i.id = e.item_id where i.name = 'Leite';
update shopping_list_entries set checked = true, checked_by = auth.uid() where id = (select v::uuid from t_ctx where k = 'leite');
insert into shopping_list_entries (household_id, name, quantity, unit, checked, checked_by, added_by)
  values ('00000000-0000-0000-0000-0000000000a1', 'Fermento', 1, 'un', true, auth.uid(), auth.uid());
insert into t_ctx select 'fermento', id::text from shopping_list_entries where name = 'Fermento';
insert into t_ctx select 'payload', jsonb_build_array(
  jsonb_build_object('entry_id', (select v from t_ctx where k = 'leite'), 'quantity', 2),
  jsonb_build_object('entry_id', (select v from t_ctx where k = 'fermento'), 'quantity', 1))::text;
select is(public.finish_shopping('00000000-0000-0000-0000-0000000000a1', (select v::jsonb from t_ctx where k = 'payload')), 2, 'retorna 2');
select is((select quantity from items where name = 'Leite'), 2.000::numeric, 'Leite = 2');
select is((select quantity from items where name = 'Fermento'), 1.000::numeric, 'item Fermento criado com 1');
select is((select count(*)::int from shopping_list_entries where id::text in ((select v from t_ctx where k = 'leite'), (select v from t_ctx where k = 'fermento'))), 0, 'as duas entradas foram apagadas');
select is((select updated_by from items where name = 'Fermento'), auth.uid(), 'updated_by do item criado');

-- 3. avulsa em minúsculo soma no item existente
insert into shopping_list_entries (household_id, name, quantity, unit, checked, checked_by, added_by)
  values ('00000000-0000-0000-0000-0000000000a1', 'leite', 1, 'L', true, auth.uid(), auth.uid());
select is(public.finish_shopping('00000000-0000-0000-0000-0000000000a1',
  (select jsonb_build_array(jsonb_build_object('entry_id', id, 'quantity', 1)) from shopping_list_entries where name = 'leite')), 1, 'soma avulsa retorna 1');
select is((select quantity from items where name = 'Leite'), 3.000::numeric, 'Leite vira 3');
select is((select count(*)::int from items where household_id = '00000000-0000-0000-0000-0000000000a1' and name_key = 'leite'), 1, 'sem item novo');

-- 4. segunda chamada com os mesmos ids (dois celulares)
select throws_ok($$select public.finish_shopping('00000000-0000-0000-0000-0000000000a1', (select v::jsonb from t_ctx where k = 'payload'))$$,
  'P0001', 'entry_invalid', 'repetir os mesmos entry_ids dá entry_invalid');
select is((select quantity from items where name = 'Leite'), 3.000::numeric, 'e não soma em dobro');

-- 5. entrada não marcada aborta tudo
insert into shopping_list_entries (household_id, name, quantity, unit, checked, checked_by, added_by)
  values ('00000000-0000-0000-0000-0000000000a1', 'Sal', 1, 'kg', true, auth.uid(), auth.uid());
insert into shopping_list_entries (household_id, name, quantity, unit, added_by)
  values ('00000000-0000-0000-0000-0000000000a1', 'Pimenta', 1, 'g', auth.uid());
insert into t_ctx select 'sal', id::text from shopping_list_entries where name = 'Sal';
insert into t_ctx select 'pimenta', id::text from shopping_list_entries where name = 'Pimenta';
select throws_ok($$select public.finish_shopping('00000000-0000-0000-0000-0000000000a1', jsonb_build_array(
  jsonb_build_object('entry_id', (select v from t_ctx where k = 'sal'), 'quantity', 1),
  jsonb_build_object('entry_id', (select v from t_ctx where k = 'pimenta'), 'quantity', 1)))$$,
  'P0001', 'entry_invalid', 'entrada não marcada dá entry_invalid');
select is((select count(*)::int from items where name = 'Sal') + (select count(*)::int from shopping_list_entries where name = 'Sal'), 1, 'nada mudou (sem item Sal, entrada Sal intacta)');

-- 6. quantidade 0
select throws_ok($$select public.finish_shopping('00000000-0000-0000-0000-0000000000a1',
  jsonb_build_array(jsonb_build_object('entry_id', (select v from t_ctx where k = 'sal'), 'quantity', 0)))$$,
  'P0001', 'entry_invalid', 'quantity 0 dá entry_invalid');

-- 6b. NaN
select throws_ok($$select public.finish_shopping('00000000-0000-0000-0000-0000000000a1',
  jsonb_build_array(jsonb_build_object('entry_id', (select v from t_ctx where k = 'sal'), 'quantity', 'NaN')))$$,
  'P0001', 'entry_invalid', 'quantity "NaN" dá entry_invalid');
select is((select quantity from items where name = 'Leite'), 3.000::numeric, 'Leite intacto');
select throws_ok($$update items set quantity = 'NaN' where name = 'Leite'$$, '23514', null, 'item não aceita NaN');
select throws_ok($$insert into shopping_list_entries (household_id, name, quantity, unit)
  values ('00000000-0000-0000-0000-0000000000a1', 'Nan', 'NaN', 'un')$$, '23514', null, 'entrada não aceita NaN');

-- 7. Intruso não enxerga entradas da casa
select tests.login_as('intruso@cari.test');
select throws_ok($$select public.finish_shopping('00000000-0000-0000-0000-0000000000a1',
  jsonb_build_array(jsonb_build_object('entry_id', (select v from t_ctx where k = 'sal'), 'quantity', 1)))$$,
  'P0001', 'entry_invalid', 'não membro recebe entry_invalid');

-- 8. FK composta: item de outra casa
select tests.login_as('ana@cari.test');
select throws_ok($$insert into shopping_list_entries (household_id, item_id, name, unit)
  values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c9', 'Cafe', 'un')$$,
  '23503', null, 'entrada não pode ligar a item de outra casa');

-- on delete set null só zera item_id
select tests.logout();
insert into shopping_list_entries (id, household_id, item_id, name, unit)
  values ('00000000-0000-0000-0000-0000000000d9', '00000000-0000-0000-0000-0000000000a9', '00000000-0000-0000-0000-0000000000c9', 'Cafe', 'un');
delete from items where id = '00000000-0000-0000-0000-0000000000c9';
select is((select household_id::text || coalesce(item_id::text, '-') from shopping_list_entries where id = '00000000-0000-0000-0000-0000000000d9'), '00000000-0000-0000-0000-0000000000a9-', 'apagar o item zera só item_id');

select * from finish();
rollback;
