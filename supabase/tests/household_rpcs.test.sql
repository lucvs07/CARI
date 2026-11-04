create extension if not exists pgtap with schema extensions;

begin; select plan(19);

-- 1. create_household
select tests.login_as('intruso@cari.test');
create temp table t_ctx (k text primary key, v text);
grant all on t_ctx to authenticated;
insert into t_ctx select 'own_house', public.create_household('Casa do Intruso')::text;
select isnt((select v from t_ctx where k = 'own_house'), null, 'create_household retorna id');
select is((select role::text from household_members where household_id = (select v::uuid from t_ctx where k = 'own_house') and user_id = auth.uid()), 'owner', 'criador vira owner');
select is((select last_household_id::text from profiles where id = auth.uid()), (select v from t_ctx where k = 'own_house'), 'last_household_id atualizado');
select throws_ok($$select public.create_household('')$$, null, null, 'nome vazio é rejeitado');

-- 2. create_invite (owner), duas vezes
select tests.login_as('lucas@cari.test');
select lives_ok($$select public.create_invite('00000000-0000-0000-0000-0000000000a1')$$, 'owner cria convite');
select lives_ok($$select public.create_invite('00000000-0000-0000-0000-0000000000a1')$$, 'owner cria convite de novo');
select is((select count(*)::int from household_invites where household_id = '00000000-0000-0000-0000-0000000000a1' and revoked_at is null), 1, 'só 1 convite ativo');
select is((select length(token) from household_invites where household_id = '00000000-0000-0000-0000-0000000000a1' and revoked_at is null), 43, 'token tem 43 caracteres');
select is((select count(*)::int from household_invites where household_id = '00000000-0000-0000-0000-0000000000a1' and revoked_at is null and expires_at > now() + interval '6 days'), 1, 'convite expira em ~7 dias');

-- 3. member não cria convite
select tests.login_as('ana@cari.test');
select throws_ok($$select public.create_invite('00000000-0000-0000-0000-0000000000a1')$$, null, null, 'member não cria convite');

-- 4. accept_invite
select tests.login_as('lucas@cari.test');
insert into t_ctx select 'tok', token from household_invites where household_id = '00000000-0000-0000-0000-0000000000a1' and revoked_at is null;
select tests.login_as('intruso@cari.test');
select is(public.accept_invite((select v from t_ctx where k = 'tok'))::text, '00000000-0000-0000-0000-0000000000a1', 'accept_invite retorna a casa');
select lives_ok($$select public.accept_invite((select v from t_ctx where k = 'tok'))$$, 'accept_invite repetido não dá erro');
select is((select count(*)::int from household_members where household_id = '00000000-0000-0000-0000-0000000000a1' and user_id = auth.uid()), 1, 'sem duplicar membro');

-- 5. tokens inválidos
select throws_ok($$select public.accept_invite('nao-existe')$$, 'P0001', 'invite_invalid', 'token inexistente');
select tests.logout();
update household_invites set revoked_at = now() where token = (select v from t_ctx where k = 'tok');
select tests.login_as('novo@cari.test');
select throws_ok($$select public.accept_invite((select v from t_ctx where k = 'tok'))$$, 'P0001', 'invite_invalid', 'token revogado');
select tests.logout();
insert into household_invites(household_id, token, created_by, expires_at) values ('00000000-0000-0000-0000-0000000000a1', 'tok-expirado', '00000000-0000-0000-0000-0000000000b1', now() - interval '1 day');
select tests.login_as('novo@cari.test');
select throws_ok($$select public.accept_invite('tok-expirado')$$, 'P0001', 'invite_expired', 'token expirado');

-- 6. último owner com outros membros
select tests.login_as('lucas@cari.test');
select throws_ok($$select public.leave_household('00000000-0000-0000-0000-0000000000a1')$$, 'P0001', 'last_owner', 'único owner não sai');

-- 7. último membro: a casa some
select tests.login_as('intruso@cari.test');
select lives_ok($$select public.leave_household((select v::uuid from t_ctx where k = 'own_house'))$$, 'último membro sai');
select tests.logout();
select is_empty($$select 1 from public.households where id = (select v::uuid from t_ctx where k = 'own_house')$$, 'casa apagada');

select * from finish(); rollback;
