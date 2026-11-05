-- =============================================================================
-- FEZADA IA — setup completo para um projeto Supabase NOVO
-- Cola este ficheiro inteiro em: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Cria: enums, profiles, user_roles, has_role, trigger de registo, bilhetes,
-- admin_emails e todo o RLS. No fim, define o teu email de admin (ver rodapé).
-- =============================================================================

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


-- Bilhetes de aposta criados pelo utilizador (manual) ou pelo Camarada IA (ai).
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null default 'manual' check (source in ('manual', 'ai')),
  risk text,
  rationale text,
  stake numeric not null default 0 check (stake >= 0),
  total_odds numeric,
  bookie text,
  net_return numeric,
  status text not null default 'pending' check (status in ('pending', 'won', 'lost', 'void')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

alter table public.tickets enable row level security;

create policy "Utilizador vê os seus bilhetes"
  on public.tickets for select
  using (auth.uid() = user_id);

create policy "Utilizador cria os seus bilhetes"
  on public.tickets for insert
  with check (auth.uid() = user_id);

create policy "Utilizador atualiza os seus bilhetes"
  on public.tickets for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists tickets_user_created_idx on public.tickets (user_id, created_at desc);

create table if not exists public.ticket_selections (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  fixture_id bigint not null,
  home text not null,
  away text not null,
  kickoff timestamptz,
  league text,
  market text not null default '1X2',
  pick text not null,
  odds numeric not null check (odds > 0),
  result text check (result in ('win', 'lost', 'pending'))
);

alter table public.ticket_selections enable row level security;

create policy "Só o dono vê seleções do bilhete"
  on public.ticket_selections for select
  using (exists (select 1 from public.tickets t where t.id = ticket_id and t.user_id = auth.uid()));

create policy "Só o dono insere seleções do bilhete"
  on public.ticket_selections for insert
  with check (exists (select 1 from public.tickets t where t.id = ticket_id and t.user_id = auth.uid()));

create policy "Só o dono atualiza seleções do bilhete"
  on public.ticket_selections for update
  using (exists (select 1 from public.tickets t where t.id = ticket_id and t.user_id = auth.uid()))
  with check (exists (select 1 from public.tickets t where t.id = ticket_id and t.user_id = auth.uid()));

create index if not exists ticket_selections_ticket_idx on public.ticket_selections (ticket_id);


-- Endurecimento de segurança e lacunas de produto.
-- 1) Bilhetes só são criados/liquidados pelo servidor (service role); o utilizador só lê.
-- 2) Estado 'void' nas seleções (jogos cancelados/adiados).
-- 3) Validade da subscrição (profiles.expires_at).
-- 4) Email do admin deixa de estar fixo no código: vem da tabela admin_emails.

-- 1) Remove escrita direta do cliente nos bilhetes ------------------------------------
drop policy if exists "Utilizador cria os seus bilhetes" on public.tickets;
drop policy if exists "Utilizador atualiza os seus bilhetes" on public.tickets;
drop policy if exists "Só o dono insere seleções do bilhete" on public.ticket_selections;
drop policy if exists "Só o dono atualiza seleções do bilhete" on public.ticket_selections;

revoke insert, update, delete on public.tickets from anon, authenticated;
revoke insert, update, delete on public.ticket_selections from anon, authenticated;
grant select on public.tickets, public.ticket_selections to authenticated;

-- 2) Seleções anuladas ------------------------------------------------------------------
alter table public.ticket_selections drop constraint if exists ticket_selections_result_check;
alter table public.ticket_selections
  add constraint ticket_selections_result_check
  check (result in ('win', 'lost', 'pending', 'void'));

alter table public.ticket_selections drop constraint if exists ticket_selections_pick_check;
alter table public.ticket_selections
  add constraint ticket_selections_pick_check check (pick in ('1', 'X', '2')) not valid;

alter table public.tickets drop constraint if exists tickets_stake_max_check;
alter table public.tickets
  add constraint tickets_stake_max_check check (stake <= 500000) not valid;

-- 3) Validade da subscrição -------------------------------------------------------------
alter table public.profiles add column if not exists expires_at timestamptz;

-- Quem já estava ativo continua ativo por 30 dias a partir de agora.
update public.profiles
   set expires_at = now() + interval '30 days'
 where status = 'active' and expires_at is null
   and not exists (select 1 from public.user_roles r where r.user_id = profiles.id and r.role = 'admin');

-- 4) Admins configuráveis ---------------------------------------------------------------
create table if not exists public.admin_emails (
  email text primary key
);
alter table public.admin_emails enable row level security;
revoke all on public.admin_emails from anon, authenticated;
-- Sem políticas: só o service role / SQL editor lê e escreve.
-- Depois de aplicar, regista o(s) admin(s):
--   insert into public.admin_emails (email) values ('o-teu-email@exemplo.com');

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare is_admin boolean := exists (
  select 1 from public.admin_emails a where lower(a.email) = lower(new.email)
);
begin
  insert into public.profiles (id, email, full_name, status, payment_confirmed, activated_at)
  values (new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    case when is_admin then 'active'::public.account_status else 'pending'::public.account_status end,
    is_admin, case when is_admin then now() end);
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  if is_admin then insert into public.user_roles (user_id, role) values (new.id, 'admin'); end if;
  return new;
end $$;

-- =============================================================================
-- PASSO FINAL (obrigatorio): define o(s) admin(s)
-- Descomenta, troca o email e corre esta parte num novo query:
--
-- insert into public.admin_emails (email) values ('o-teu-email@exemplo.com')
--   on conflict (email) do nothing;
--
-- Se a conta ja existir, da-lhe o papel e ativa-a:
-- insert into public.user_roles (user_id, role)
-- select id, 'admin' from auth.users where lower(email) = 'o-teu-email@exemplo.com'
-- on conflict (user_id, role) do nothing;
-- update public.profiles set status = 'active', payment_confirmed = true, activated_at = now()
-- where id = (select id from auth.users where lower(email) = 'o-teu-email@exemplo.com');
-- =============================================================================
