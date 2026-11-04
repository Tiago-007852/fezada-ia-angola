import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
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
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Sessão em falta", { status: 401 });
        const url = process.env["SUPABASE_URL"];
        const pub = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !pub) return new Response("Supabase não configurado", { status: 500 });
        const sb = createClient<Database>(url, pub, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: u } = await sb.auth.getUser(token);
        if (!u.user) return new Response("Sessão inválida", { status: 401 });
        const { data: profile } = await sb.from("profiles").select("status").eq("id", u.user.id).maybeSingle();
        if (profile?.status !== "active") return new Response("Conta ainda não ativada", { status: 403 });

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("IA não configurada", { status: 500 });

        let body: { risk?: string; stake?: number } = {};
        try {
          body = (await request.json()) as { risk?: string; stake?: number };
        } catch {
          body = {};
        }
        const risk = RiskLevel.safeParse(body.risk).success ? RiskLevel.parse(body.risk) : "equilibrado";
        const stake = body.stake && body.stake > 0 ? Math.min(body.stake, 500_000) : 1000;
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

        const createRes = await createTicket(token, {
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
        });
        if (!createRes.ok) return Response.json({ error: createRes.error ?? "Falha ao guardar bilhete" }, { status: 500 });
        return Response.json({ demo, tip, ticket: createRes.ticket });
      },
    },
  },
});
