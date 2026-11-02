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
- Odds, booking codes and live scores are demo data in `src/lib/odds.ts` / `src/lib/live.ts` until real feeds are connected.
