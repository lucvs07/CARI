-- RPCs de casa e convite. Futuras funções não ficam executáveis por anon/public por padrão.
alter default privileges in schema public revoke execute on functions from anon, public;

create function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.households (name, created_by)
  values (p_name, v_uid)
  returning id into v_id;

  insert into public.household_members (household_id, user_id, role)
  values (v_id, v_uid, 'owner');

  update public.profiles set last_household_id = v_id where id = v_uid;

  return v_id;
end;
$$;

-- security invoker: depende das policies de household_invites (insert/update só owner).
create function public.create_invite(p_household_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_owner(p_household_id) then
    raise exception 'not_owner';
  end if;

  update public.household_invites
     set revoked_at = now()
   where household_id = p_household_id and revoked_at is null;

  v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');

  insert into public.household_invites (household_id, token, created_by, expires_at)
  values (p_household_id, v_token, v_uid, now() + interval '7 days');

  return v_token;
end;
$$;

create function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.household_invites;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_invite from public.household_invites where token = p_token;
  if not found or v_invite.revoked_at is not null then
    raise exception 'invite_invalid';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'invite_expired';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (v_invite.household_id, v_uid, 'member')
  on conflict (household_id, user_id) do nothing;

  update public.profiles set last_household_id = v_invite.household_id where id = v_uid;

  return v_invite.household_id;
end;
$$;

create function public.leave_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.member_role;
  v_members int;
  v_other_owners int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- serializa saídas concorrentes da mesma casa
  perform 1 from public.households where id = p_household_id for update;

  select role into v_role from public.household_members
   where household_id = p_household_id and user_id = v_uid;
  if not found then
    raise exception 'not_member';
  end if;

  select count(*) into v_members from public.household_members
   where household_id = p_household_id;

  if v_members = 1 then
    delete from public.households where id = p_household_id;
  else
    select count(*) into v_other_owners from public.household_members
     where household_id = p_household_id and role = 'owner' and user_id <> v_uid;
    if v_role = 'owner' and v_other_owners = 0 then
      raise exception 'last_owner';
    end if;
    delete from public.household_members
     where household_id = p_household_id and user_id = v_uid;
  end if;

  update public.profiles set last_household_id = null
   where id = v_uid and last_household_id = p_household_id;
end;
$$;

revoke execute on function public.create_household(text) from public, anon;
revoke execute on function public.create_invite(uuid) from public, anon;
revoke execute on function public.accept_invite(text) from public, anon;
revoke execute on function public.leave_household(uuid) from public, anon;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.create_invite(uuid) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.leave_household(uuid) to authenticated;
