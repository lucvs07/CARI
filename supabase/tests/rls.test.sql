create extension if not exists pgtap with schema extensions;

begin; select plan(23);

-- anon: nada legível
set local role anon;
select throws_ok($$select * from items$$, '42501', null, 'anon não lê items');
select throws_ok($$select * from profiles$$, '42501', null, 'anon não lê profiles');
select throws_ok($$select * from households$$, '42501', null, 'anon não lê households');

-- intruso (sem casa)
select tests.login_as('intruso@cari.test');
select is_empty('select * from items', 'intruso não vê items');
select is_empty('select * from shopping_list_entries', 'intruso não vê lista');
select is_empty('select * from households', 'intruso não vê casas');
select throws_ok($$insert into items(household_id,name,unit) values ('00000000-0000-0000-0000-0000000000a1','Intruso','un')$$, '42501', null, 'intruso não insere item em a1');
select is_empty($$update items set quantity = 9 where household_id = '00000000-0000-0000-0000-0000000000a1' returning 1$$, 'intruso não atualiza items de a1');

-- ana (member), trocando de usuário sem logout
select tests.login_as('ana@cari.test');
select isnt_empty('select * from items', 'ana vê items');
select lives_ok($$insert into items(household_id,name,unit) values ('00000000-0000-0000-0000-0000000000a1','Café','un')$$, 'ana insere item');
select is_empty('select * from household_invites', 'member não vê convites');
select isnt_empty('select * from household_members', 'ana vê membros da casa');
select is_empty($$update household_members set role = 'owner' returning 1$$, 'member não altera role');
select is((select count(*)::int from profiles), 2, 'ana vê 2 profiles (ela e Lucas)');
select is_empty($$select 1 from profiles where display_name = 'Intruso'$$, 'ana não vê o Intruso');
select is_empty($$update profiles set display_name = 'X' where id = '00000000-0000-0000-0000-0000000000b1' returning 1$$, 'ana não edita profile alheio');
select is_empty($$delete from household_members where user_id = '00000000-0000-0000-0000-0000000000b1' returning 1$$, 'member não remove owner');
select throws_ok($$insert into household_members(household_id,user_id) values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b3')$$, '42501', null, 'sem insert direto em household_members');
select throws_ok($$insert into households(name) values ('Nova')$$, '42501', null, 'sem insert direto em households');
select isnt_empty($$delete from household_members where user_id = '00000000-0000-0000-0000-0000000000b2' returning 1$$, 'ana sai da casa (delete próprio)');

-- lucas (owner) remove a Ana: por último
select tests.logout();
select tests.reset_fixture();
select tests.login_as('lucas@cari.test');
select lives_ok($$insert into household_invites(household_id,token,created_by) values ('00000000-0000-0000-0000-0000000000a1','tok-teste','00000000-0000-0000-0000-0000000000b1')$$, 'owner cria convite');
select isnt_empty('select * from household_invites', 'owner lê convites');
select isnt_empty($$delete from household_members where user_id = '00000000-0000-0000-0000-0000000000b2' returning 1$$, 'owner remove a Ana');

select * from finish(); rollback;
