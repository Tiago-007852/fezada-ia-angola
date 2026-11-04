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
