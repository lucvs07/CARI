-- Seed local/E2E. Roda como superusuário, depois de seeds/test_helpers.sql.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated',
   'lucas@cari.test', '', now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Lucas"}', now(), now(),
   '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000b2', 'authenticated', 'authenticated',
   'ana@cari.test', '', now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Ana"}', now(), now(),
   '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000b3', 'authenticated', 'authenticated',
   'intruso@cari.test', '', now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Intruso"}', now(), now(),
   '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000b4', 'authenticated', 'authenticated',
   'novo@cari.test', '', now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Novo"}', now(), now(),
   '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000b5', 'authenticated', 'authenticated',
   'convidado@cari.test', '', now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Convidado"}', now(), now(),
   '', '', '', '');

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(), now(), now()
from auth.users u;

insert into public.households (id, name, created_by)
values ('00000000-0000-0000-0000-0000000000a1', 'Casa Lucas & Ana', '00000000-0000-0000-0000-0000000000b1');

select tests.reset_fixture();
