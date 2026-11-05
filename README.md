# Fezada IA Angola

Plataforma de apostas desportivas para Angola: chat com o "Camarada IA", palpites gerados por IA com odds reais do feed, comparador/criador de bilhetes em Kwanzas (com imposto), resultados ao vivo e acesso por subscrição ativada pelo admin.

Construído com [Lovable](https://lovable.dev) · TanStack Start + React 19 · Supabase · API-Sports · Vercel AI SDK.

## Arrancar

```sh
bun install        # (o projeto usa bun.lock)
cp .env.example .env   # preenche os valores
bun run dev
```

Scripts: `dev`, `build`, `lint`, `test`, `format`.

## Variáveis de ambiente

Ver `.env.example`. As de servidor (`SUPABASE_SERVICE_ROLE_KEY`, `API_SPORTS_KEY`, `LOVABLE_API_KEY`, `LOVABLE_CRON_SECRET`) nunca levam prefixo `VITE_` e nunca vão para o Git (`.env` está no `.gitignore`).

## Base de dados

A fonte de verdade para alterações novas é `supabase/migrations/`. Depois de aplicar `20261105000000_hardening.sql`, **regista o(s) admin(s)**:

```sql
insert into public.admin_emails (email) values ('o-teu-email@exemplo.com');
```

(Contas já existentes não mudam; isto só afeta quem se registar depois.) `drizzle/` guarda o esquema inicial de `profiles`/`user_roles`.

## Modelo de segurança

- Acesso gated por `profiles.status = 'active'` **e** `expires_at` no futuro (`src/lib/access.shared.ts`); só admins (`user_roles` + `has_role`) alteram `profiles`.
- `tickets` / `ticket_selections`: o cliente só **lê** (RLS). Criar e liquidar passa por `src/lib/tickets.server.ts` (service role), que valida jogos, hora de início e odds contra a API-Sports.
- `POST /api/tickets/settle`: utilizador autenticado liquida só os seus bilhetes; sem token exige `Authorization: Bearer $LOVABLE_CRON_SECRET`.
- `/api/chat`, `/api/tips/generate`, `/api/tickets`: autenticação + conta ativa + rate limit em memória (`src/lib/rate-limit.server.ts`).

## Liquidação agendada

`.github/workflows/settle-tickets.yml` chama o endpoint de liquidação a cada 15 min. Define os secrets `APP_URL` e `LOVABLE_CRON_SECRET` no repositório.

## Dados

- Live scores, jogos e odds: API-Sports (cache no servidor). Sem chave/falha, a UI mostra "indisponível" e nunca resultados falsos.
- As cotações de **Elephant Bet, Premier Bet e Bantu Bet** em `src/lib/odds.ts` são de demonstração (não há API pública dessas casas) e a UI assinala-o. Bilhetes guardados usam odds do feed (bookmaker de referência).

## Páginas legais

`/termos`, `/privacidade` e `/jogo-responsavel` são **rascunhos com campos por preencher** — têm de ser revistos por um jurista antes de publicar.

> [!IMPORTANT]
> Projeto ligado ao Lovable: evita reescrever o histórico publicado (force push, rebase, squash).
