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
