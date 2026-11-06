# Deploy: Supabase próprio + Vercel

Este projeto deixa de depender do Supabase gerido pelo Lovable e passa a ser
publicado na Vercel. Segue pela ordem — cada passo depende do anterior.

## 1. Criar o projeto Supabase

1. Em https://supabase.com → **New project** (região mais próxima: `eu-west` / `eu-central`).
2. Guarda a password da base de dados.
3. Em **Project Settings → API** copia:
   - **Project URL** → `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - **Publishable key** (`sb_publishable_...`) → `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY`
   - **Secret key** (`sb_secret_...`, ou a antiga `service_role`) → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Criar o schema

Opção A — CLI (recomendada):

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

Opção B — SQL Editor: corre, por esta ordem, o conteúdo de
`supabase/migrations/20260101000000_base.sql`,
`supabase/migrations/20261104000000_tickets.sql` e
`supabase/migrations/20261105000000_hardening.sql`.

A primeira migração cria `profiles`, `user_roles`, `has_role` e o trigger
`on_auth_user_created` (todo o registo fica `pending` até um admin ativar).

## 3. Configurar o admin

A partir da migração de hardening, o admin é definido pela tabela `admin_emails`.
Sem este insert, nenhuma conta fica admin:

```sql
insert into public.admin_emails (email) values ('o-teu-email@exemplo.com');
```

Depois regista-te com esse email (ou, se a conta já existir):

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where lower(email) = 'o-teu-email@exemplo.com'
on conflict (user_id, role) do nothing;

update public.profiles set status = 'active', payment_confirmed = true, activated_at = now()
where id = (select id from auth.users where lower(email) = 'o-teu-email@exemplo.com');
```

## 4. Auth no Supabase

Em **Authentication → URL Configuration**:

- **Site URL**: `https://<o-teu-dominio-vercel>` (ex.: `https://fezada-ia.vercel.app`)
- **Redirect URLs**: acrescenta
  - `https://<o-teu-dominio>/auth`
  - `https://<o-teu-dominio>/reset-password`
  - `http://localhost:3000/auth` e `http://localhost:3000/reset-password` (desenvolvimento)

Login com Google (opcional): **Authentication → Providers → Google**, ativa e cola
o Client ID/Secret de https://console.cloud.google.com (Authorized redirect URI:
`https://<ref>.supabase.co/auth/v1/callback`). Sem isto, o botão "Continuar com o
Google" devolve erro — o login por email/password funciona independentemente.

Email/confirmação: em **Authentication → Email**, confirma que "Confirm email"
está ligado para produção.

## 5. Deploy na Vercel

1. **Add New → Project** e importa `Tiago-007852/fezada-ia-angola`.
2. Framework preset: **Other** (o `vercel.json` já define `bun install` + `bun run build`;
   o build usa Nitro com o preset `vercel` e escreve `.vercel/output`).
3. **Environment Variables** (Production e Preview) — ver `.env.example`:
   - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (e `VITE_SUPABASE_PROJECT_ID`)
   - `API_SPORTS_KEY`
   - `AI_API_KEY` (+ `AI_GATEWAY_URL` e `AI_MODEL` se não usares o gateway do Lovable)
   - `CRON_SECRET` (gera, por exemplo, com `openssl rand -hex 32`)
4. **Deploy**. Node 22 é usado automaticamente; não é preciso mais configuração.

## 6. Cron de liquidação

O `POST /api/tickets/settle` com `Authorization: Bearer <CRON_SECRET>` liquida os
bilhetes de todos os utilizadores. O workflow `.github/workflows/settle-tickets.yml`
corre a cada 15 minutos.

No GitHub → **Settings → Secrets and variables → Actions** cria:

- `APP_URL` — `https://<o-teu-dominio-vercel>` (sem barra final)
- `CRON_SECRET` — o mesmo valor definido na Vercel

(Alternativa: Vercel Cron, mas o plano Hobby só permite uma execução por dia.)

## 7. Verificação pós-deploy

- `/` e `/auth` abrem sem erros de consola.
- Registo cria conta `pending`; ativação pelo painel `/admin` dura 30 dias.
- Criar um bilhete persiste em `tickets` (a escrita é feita pelo servidor com a secret key).
- `curl -X POST https://<dominio>/api/tickets/settle -H "Authorization: Bearer $CRON_SECRET"`
  devolve `{"settled": n}` e 401 sem o segredo.
- Sem `API_SPORTS_KEY` o feed mostra "indisponível" (por design, nunca resultados inventados).
- Sem `AI_API_KEY` o chat devolve "IA não configurada".

## Problemas comuns

**`Falhou ao executar 'removeChild' em 'Node'` ao correr o SQL no painel**
Não é um erro de SQL: é o dashboard a ser quebrado pelo Chrome Translate ou por
uma extensão de browser. Resolve assim:

1. No Chrome, clica com o botão direito na página → **Nunca traduzir este site**
   (ou desativa a tradução automática em `chrome://settings/languages`).
2. Abre o Supabase numa janela **anónima** (extensões desligadas) ou noutro browser.
3. Recarrega, cola o SQL e corre com **Ctrl+Enter** em vez de Enter.

Alternativa sem o editor web (na tua máquina, dentro do repo):

```bash
npx supabase link --project-ref <ref>
npx supabase db push      # aplica as 3 migrações por ordem e pede a password
```

Se o editor continuar a falhar, corre os ficheiros de `supabase/migrations/` um a
um, pela ordem `20260101000000_base` → `20261104000000_tickets` → `20261105000000_hardening`.

## Notas

- As migrações são idempotentes, mas aplica-as **só** ao projeto novo: numa base antiga
  podem coexistir políticas RLS antigas.
- O pacote `@lovable.dev/vite-tanstack-config` mantém-se apenas como configuração de
  build (Vite + Nitro). Pode ser substituído mais tarde por plugins explícitos.
- `src/lib/lovable-error-reporting.ts` degrada para no-op fora do Lovable.
