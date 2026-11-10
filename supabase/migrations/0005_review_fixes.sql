-- Correções da revisão final do núcleo (0001–0004 congeladas).

-- Keepalive: anon não lê nenhuma tabela (0002), então o ping do workflow precisa de uma RPC própria.
-- security invoker: não toca em tabela nenhuma, só prova que a API e o banco respondem.
create function public.ping()
returns int
language sql
stable
security invoker
set search_path = ''
as 'select 1';

revoke execute on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;

-- updated_at com o relógio de parede: now() é o início da transação, e duas escritas da mesma
-- transação (ou uma transação longa) gravariam um instante anterior ao de escritas já confirmadas.
-- O cliente usa updated_at para descartar ecos atrasados do Realtime.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

-- Nome do perfil no cadastro: nome vazio ou e-mail ausente (ex.: provedor sem e-mail) não pode
-- gerar display_name vazio/nulo.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Usuário'
    )
  );
  return new;
end;
$$;

-- Prévia do convite ("Entrar na casa X?"): só o nome da casa, e só para um token válido.
-- security definer: quem ainda não é membro não lê household_invites nem households.
create function public.invite_preview(p_token text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select h.name
    from public.household_invites i
    join public.households h on h.id = i.household_id
   where i.token = p_token
     and i.revoked_at is null
     and i.expires_at > now()
$$;

revoke execute on function public.invite_preview(text) from public, anon;
grant execute on function public.invite_preview(text) to authenticated;
