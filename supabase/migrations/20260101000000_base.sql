-- Schema base do Fezada IA para um projeto Supabase novo (fora do Lovable).
-- Idempotente: pode ser aplicado sobre uma base já existente sem falhar.
-- Ordem: esta migração, depois 20261104000000_tickets.sql e 20261105000000_hardening.sql.

-- Enums -------------------------------------------------------------------
do $$ begin
  create type public.account_status as enum ('pending', 'active', 'blocked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.app_role as enum ('admin', 'user');
exception when duplicate_object then null; end $$;

-- Perfis -------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  status public.account_status not null default 'pending',
  payment_confirmed boolean not null default false,
  activated_at timestamptz,
  created_at timestamptz not null default now()
);

-- Papéis -------------------------------------------------------------------
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null
);

create unique index if not exists user_roles_user_role_key on public.user_roles (user_id, role);
create index if not exists user_roles_user_idx on public.user_roles (user_id);
create index if not exists profiles_status_idx on public.profiles (status);

-- has_role: usada pelas políticas RLS. security definer para não expor user_roles.
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  );
$$;

-- Perfil + papel criados automaticamente no registo.
-- A versão com admin_emails é aplicada pela migração de hardening (mais recente).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, status, payment_confirmed, activated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    'pending',
    false,
    null
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS: perfis e papéis ------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

drop policy if exists "Utilizador vê o seu perfil" on public.profiles;
create policy "Utilizador vê o seu perfil"
  on public.profiles for select
  using (auth.uid() = id or public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admin atualiza perfis" on public.profiles;
create policy "Admin atualiza perfis"
  on public.profiles for update
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Utilizador vê os seus papéis" on public.user_roles;
create policy "Utilizador vê os seus papéis"
  on public.user_roles for select
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Clientes leem o seu perfil e (só admins, via política) atualizam-no.
-- Inserções vêm do trigger (security definer); papéis só o servidor altera.
revoke insert, delete on public.profiles from anon, authenticated;
revoke insert, update, delete on public.user_roles from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
