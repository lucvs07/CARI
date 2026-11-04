-- Schema do núcleo do CARI (spec §5: Tipos e Tabelas).
-- RLS, RPCs e o trigger items -> lista ficam para migrations posteriores.

create extension if not exists unaccent with schema extensions;

-- Tipos
create type public.unit as enum ('kg', 'g', 'L', 'ml', 'un');
create type public.member_role as enum ('owner', 'member');

-- unaccent é STABLE; a forma de dois argumentos com o dicionário qualificado
-- não depende do search_path, então o wrapper pode ser declarado immutable.
create function public.normalize_name(text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, trim($1)))
$$;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Tabelas
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  last_household_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_last_household_id_fkey
  foreign key (last_household_id) references public.households (id) on delete set null;

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_id_idx on public.household_members (user_id);

create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  token text not null unique,
  created_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index household_invites_household_id_idx on public.household_invites (household_id);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  name_key text generated always as (public.normalize_name(name)) stored,
  quantity numeric(10,3) not null default 0 check (quantity >= 0),
  unit public.unit not null,
  category text not null default 'outros'
    check (category in ('hortifruti', 'carnes', 'laticinios', 'padaria', 'mercearia',
                        'bebidas', 'congelados', 'limpeza', 'higiene', 'outros')),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, name_key)
);

create table public.shopping_list_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  item_id uuid references public.items (id) on delete set null,
  name text not null check (char_length(trim(name)) between 1 and 80),
  quantity numeric(10,3),
  unit public.unit not null,
  category text not null default 'outros'
    check (category in ('hortifruti', 'carnes', 'laticinios', 'padaria', 'mercearia',
                        'bebidas', 'congelados', 'limpeza', 'higiene', 'outros')),
  checked boolean not null default false,
  checked_by uuid references public.profiles (id) on delete set null,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index shopping_list_entries_item_id_key
  on public.shopping_list_entries (item_id) where item_id is not null;
create index shopping_list_entries_household_id_idx
  on public.shopping_list_entries (household_id);

-- updated_at
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.households
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.household_invites
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.items
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.shopping_list_entries
  for each row execute function public.set_updated_at();

-- Profile criado no signup
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
