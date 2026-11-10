create extension if not exists pgtap with schema extensions;

begin; select plan(26);

create temp table t_ctx (k text primary key, v text);
grant all on t_ctx to anon, authenticated;

-- 1. ping (keepalive): anon executa, mas continua sem ler tabelas
set local role anon;
select is(public.ping(), 1, 'anon executa ping()');
select throws_ok($$select * from public.items$$, '42501', null, 'anon segue sem ler items');
select throws_ok($$select * from public.households$$, '42501', null, 'anon segue sem ler households');
reset role;

-- 2. invite_preview
select tests.login_as('lucas@cari.test');
insert into t_ctx select 'tok', public.create_invite('00000000-0000-0000-0000-0000000000a1');
select tests.login_as('novo@cari.test');
select is(public.invite_preview((select v from t_ctx where k = 'tok')), 'Casa Lucas & Ana', 'token válido: nome da casa para quem ainda não é membro');
select is(public.invite_preview('nao-existe'), null, 'token inexistente: null');
select is(public.invite_preview(''), null, 'token vazio: null');
select tests.logout();
update household_invites set expires_at = now() - interval '1 second' where token = (select v from t_ctx where k = 'tok');
select tests.login_as('novo@cari.test');
select is(public.invite_preview((select v from t_ctx where k = 'tok')), null, 'token expirado: null');
select tests.logout();
update household_invites set expires_at = now() + interval '1 day', revoked_at = now() where token = (select v from t_ctx where k = 'tok');
select tests.login_as('novo@cari.test');
select is(public.invite_preview((select v from t_ctx where k = 'tok')), null, 'token revogado: null');
select tests.logout();
set local role anon;
select throws_ok($$select public.invite_preview('x')$$, '42501', null, 'anon não executa invite_preview');
reset role;

-- 3. handle_new_user: sem nome e sem e-mail; nome em branco cai para o e-mail
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000c1', 'authenticated', 'authenticated',
   null, '', '{}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000c2', 'authenticated', 'authenticated',
   'ze@cari.test', '', '{}', '{"full_name":"   "}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000c3', 'authenticated', 'authenticated',
   'bia@cari.test', '', '{}', '{"full_name":"  Bia Souza "}', now(), now(), '', '', '', '');
select is((select display_name from profiles where id = '00000000-0000-0000-0000-0000000000c1'), 'Usuário', 'sem e-mail e sem nome: Usuário');
select is((select display_name from profiles where id = '00000000-0000-0000-0000-0000000000c2'), 'ze', 'full_name em branco: parte local do e-mail');
select is((select display_name from profiles where id = '00000000-0000-0000-0000-0000000000c3'), 'Bia Souza', 'full_name aparado');

-- 4. updated_at usa o relógio, não o início da transação
update items set quantity = quantity where household_id = '00000000-0000-0000-0000-0000000000a1' and name = 'Leite';
select ok((select updated_at from items where household_id = '00000000-0000-0000-0000-0000000000a1' and name = 'Leite') > now(),
          'updated_at posterior ao início da transação (clock_timestamp)');

-- 5. intruso (sem casa) não lê nem escreve nas tabelas de a1
select tests.login_as('lucas@cari.test');
select lives_ok($$select public.create_invite('00000000-0000-0000-0000-0000000000a1')$$, 'owner gera um convite ativo');
select tests.login_as('intruso@cari.test');
select is_empty('select * from household_members', 'intruso não vê membros');
select throws_ok($$insert into household_members(household_id,user_id) values ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b3')$$, '42501', null, 'intruso não se insere em a1');
select is_empty($$update household_members set role = 'owner' where household_id = '00000000-0000-0000-0000-0000000000a1' returning 1$$, 'intruso não altera membros de a1');
select is_empty($$delete from household_members where household_id = '00000000-0000-0000-0000-0000000000a1' returning 1$$, 'intruso não remove membros de a1');
select is_empty('select * from household_invites', 'intruso não vê convites');
select throws_ok($$insert into household_invites(household_id,token,created_by) values ('00000000-0000-0000-0000-0000000000a1','tok-intruso','00000000-0000-0000-0000-0000000000b3')$$, '42501', null, 'intruso não cria convite em a1');
select is_empty($$update household_invites set revoked_at = null, expires_at = now() + interval '30 days' where household_id = '00000000-0000-0000-0000-0000000000a1' returning 1$$, 'intruso não altera convites de a1');
select is_empty($$delete from household_invites where household_id = '00000000-0000-0000-0000-0000000000a1' returning 1$$, 'intruso não apaga convites de a1');
select throws_ok($$insert into shopping_list_entries(household_id,name,unit,category) values ('00000000-0000-0000-0000-0000000000a1','Intruso','un','outros')$$, '42501', null, 'intruso não insere na lista de a1');
select is_empty($$update shopping_list_entries set checked = true where household_id = '00000000-0000-0000-0000-0000000000a1' returning 1$$, 'intruso não marca a lista de a1');
-- (select já coberto em rls.test.sql)
select is_empty($$delete from shopping_list_entries where household_id = '00000000-0000-0000-0000-0000000000a1' returning 1$$, 'intruso não apaga a lista de a1');
select is_empty($$delete from items where household_id = '00000000-0000-0000-0000-0000000000a1' returning 1$$, 'intruso não apaga items de a1');

select * from finish(); rollback;
