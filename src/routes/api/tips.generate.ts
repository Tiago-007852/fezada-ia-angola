import { createFileRoute } from "@tanstack/react-router";
import { authenticateUser } from "@/lib/access.server";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit.server";
import { generateTipTicket } from "@/lib/ai/tips.server";
import { createTicket } from "@/lib/tickets.server";
import { RiskLevel } from "@/lib/tips.shared";
import { totalOddsOf } from "@/lib/ticket.shared";

function todayISO(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export const Route = createFileRoute("/api/tips/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateUser(request, { requireActive: true });
        if (!auth.ok) return auth.response;
        const rl = rateLimit(`tips:${auth.userId}`, 6, 10 * 60_000);
        if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("IA não configurada", { status: 500 });

        let body: { risk?: string; stake?: number } = {};
        try {
          body = (await request.json()) as { risk?: string; stake?: number };
        } catch {
          body = {};
        }
        const risk = RiskLevel.safeParse(body.risk).success
          ? RiskLevel.parse(body.risk)
          : "equilibrado";
        const stake =
          Number.isFinite(body.stake) && Number(body.stake) > 0
            ? Math.min(Number(body.stake), 500_000)
            : 1000;
        const dateISO = todayISO();

        const generated = await generateTipTicket(request, apiKey, dateISO, risk);
        if ("error" in generated) return Response.json({ error: generated.error }, { status: 502 });

        const { tip, demo } = generated;

        if (demo) {
          // Modo demonstração: devolve a tese mas NÃO persiste bilhete (cotações de referência antiga).
          return Response.json({ demo: true, tip, ticket: null });
        }

        // Mapeia para odds reais e escolhe a melhor casa por seleção
        const byId = new Map(generated.candidates.map((c) => [c.fixtureId, c]));
        const selections = tip.selections.map((s) => {
          const m = byId.get(s.fixture_id);
          const odds = m?.availableOdds[s.pick] ?? 1;
          return {
            fixtureId: s.fixture_id,
            home: s.home,
            away: s.away,
            kickoff: m?.kickoffISO ?? dateISO,
            league: m?.league ?? "",
            pick: s.pick,
            odds,
          };
        });

        const totalOdds = totalOddsOf(selections);

        const createRes = await createTicket(
          auth.userId,
          {
            source: "ai",
            stake,
            risk,
            rationale: `${tip.rationale} ${tip.stake_advice}`.trim(),
            selections: selections.map((sel) => ({
              fixtureId: sel.fixtureId,
              home: sel.home,
              away: sel.away,
              kickoff: sel.kickoff,
              league: sel.league,
              pick: sel.pick,
              odds: sel.odds,
            })),
          },
          { trusted: true },
        );
        if (!createRes.ok)
          return Response.json(
            { error: createRes.error ?? "Falha ao guardar bilhete" },
            { status: 500 },
          );
        return Response.json({ demo, tip, ticket: createRes.ticket });
      },
    },
  },
});
