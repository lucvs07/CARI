create extension if not exists pgtap with schema extensions;

begin; select plan(6);
select has_table('public','items','items existe');
select is(public.normalize_name('  Leíte '), 'leite', 'normaliza acento/caixa/espaços');
select throws_ok($$insert into items(household_id,name,unit) values ('00000000-0000-0000-0000-0000000000a1','LEITE','L')$$, '23505', null, 'duplicata por name_key');
select throws_ok($$insert into items(household_id,name,unit) values ('00000000-0000-0000-0000-0000000000a1','   ','un')$$, '23514', null, 'nome só com espaços');
select throws_ok($$insert into items(household_id,name,unit) values ('00000000-0000-0000-0000-0000000000a1', repeat('a',81),'un')$$, '23514', null, 'nome > 80');
select ok(exists(select 1 from profiles p join auth.users u on u.id=p.id where u.email='ana@cari.test' and p.display_name is not null), 'profile criado por trigger');
select * from finish(); rollback;
