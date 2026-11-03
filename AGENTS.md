<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Fezada IA
- Account access is gated by `profiles.status` (pending/active/blocked); only admins (via `user_roles` + `has_role`) may update it — keeps paid access server-enforced.
- Admin role is granted by the `handle_new_user` trigger for the configured admin email — no client-side admin checks.
- AI chat streams from `/api/chat`, which verifies the bearer token and active status before calling the gateway.
- Odds and booking codes are demo data in `src/lib/odds.ts` until a real feed is connected.
- Live scores come from API-Sports (`API_SPORTS_KEY` secret) via the `getLiveScores` server fn (`src/lib/live.server.ts`), cached 45s server-side and refetched every 30s by `useLiveScores`; on key/API failure the UI shows an "indisponível" notice, never fake scores.
