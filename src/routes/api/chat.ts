import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, tool, type UIMessage } from "ai";
import { z } from "zod/v4";
import type { Database } from "@/integrations/supabase/types";
import { MATCHES, BOOKIES } from "@/lib/odds";
import { generateTipTicket } from "@/lib/ai/tips.server";
import { createTicket } from "@/lib/tickets.server";

const SYSTEM_BASE = `És o "Camarada Fezada", o consultor de apostas desportivas da Fezada IA, feito para apostadores angolanos.
Tom: próximo, encorajador, inteligente, com linguajar angolano natural (ex.: "mano", "kota", "bué", "tá fixe", "bora", "fezada", "kumbú"), sem exagerar.
Escreve sempre em português de Angola. Valores em Kwanzas (Kz).
Conheces Girabola, Liga Portugal, Premier League, Champions League e competições africanas (CAF).
Ajudas a montar bilhetes, explicas cotações, gestão de banca e comparas Elephant Bet, Premier Bet e Bantu Bet.
Regras: nunca prometas ganhos garantidos; incentiva jogo responsável (apostar só o que pode perder, 18+). Respostas curtas e práticas, ótimas para telemóvel.
Tens a tool 'criar_palpite': quando o utilizador pedir uma fezada/bilhete ("monta-me um bilhete", "palpite"), chama-a informando o nível de risco ("seguro"|"equilibrado"|"arriscado") em vez de improvisares picks a cabeça; depois comenta o resultado. Não inventes cotações — o bilhete vem com odds reais do feed.
Cotações de referência desta semana (1X2, Elephant/Premier/Bantu):
${MATCHES.map((m) => `${m.league}: ${m.home} vs ${m.away} (${m.kickoff}) — ${BOOKIES.map((b) => `${b.name} ${m.odds[b.id]["1"]}/${m.odds[b.id].X}/${m.odds[b.id]["2"]}`).join("; ")}`).join("\n")}`;

function tipDateISO(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

async function buildSystem(): Promise<string> {
  try {
    const { fetchLiveScores } = await import("@/lib/live.server");
    const { games, demo } = await fetchLiveScores();
    if (demo) return `${SYSTEM_BASE}\n\nJogos em direto: neste momento o serviço de resultados ao vivo está indisponível; se te perguntarem por resultados em direto, diz que estão temporariamente indisponíveis e não inventes resultados.`;
    if (games.length === 0) return `${SYSTEM_BASE}\n\nJogos em direto: neste momento não há jogos a decorrer. Se te perguntarem por resultados ao vivo, diz que não há jogos a decorrer agora.`;
    const list = games.map((g) => `${g.league}: ${g.home} ${g.hs}-${g.as} ${g.away} (${g.minute}')`).join("\n");
    return `${SYSTEM_BASE}\n\nJogos a decorrer AGORA (resultados reais, em direto):\n${list}\nQuando te perguntarem por jogos em direto ou resultados, responde com estes dados reais; nunca inventes resultados.`;
  } catch {
    return SYSTEM_BASE;
  }
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Sessão em falta", { status: 401 });
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const sb = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}`, apikey: key } },
        });
        const { data: u } = await sb.auth.getUser(token);
        if (!u.user) return new Response("Sessão inválida", { status: 401 });
        const { data: profile } = await sb.from("profiles").select("status").eq("id", u.user.id).maybeSingle();
        if (profile?.status !== "active") return new Response("Conta ainda não ativada", { status: 403 });

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("IA não configurada", { status: 500 });
        const body = (await request.json()) as { messages?: UIMessage[] };
        if (!Array.isArray(body.messages)) return new Response("Pedido inválido", { status: 400 });
        const { streamGatewayChat } = await import("@/lib/ai/gateway.server");
        const tools = {
          criar_palpite: tool({
            description: "Cria um bilhete de aposta (palpite) para hoje, com odds reais do feed, e guarda-o na conta do utilizador.",
            inputSchema: z.object({
              risk: z.enum(["seguro", "equilibrado", "arriscado"]).describe("Nível de risco pedido pelo utilizador"),
            }),
            execute: async ({ risk }) => {
              try {
                const generated = await generateTipTicket(request, apiKey, tipDateISO(), risk);
                if ("error" in generated) return { ok: false, error: generated.error };
                const { tip, demo } = generated;
                if (demo) {
                  return { ok: true, demo: true, rationale: tip.rationale, stake_advice: tip.stake_advice, responsible_note: tip.responsible_note, selections: tip.selections };
                }
                const byId = new Map(generated.candidates.map((c) => [c.fixtureId, c]));
                const created = await createTicket(token, {
                  source: "ai",
                  stake: 1000,
                  risk,
                  rationale: tip.rationale,
                  selections: tip.selections.map((s) => {
                    const m = byId.get(s.fixture_id);
                    return {
                      fixtureId: s.fixture_id,
                      home: s.home,
                      away: s.away,
                      kickoff: m?.kickoffISO ?? new Date().toISOString(),
                      league: m?.league ?? "",
                      pick: s.pick,
                      odds: m?.availableOdds[s.pick] ?? 1,
                    };
                  }),
                });
                if (!created.ok) return { ok: false, error: created.error ?? "Falha ao guardar bilhete" };
                return { ok: true, demo: false, ticket: created.ticket };
              } catch (e) {
                return { ok: false, error: (e as Error).message ?? "Falha na geração do palpite" };
              }
            },
          }),
        };
        return streamGatewayChat(request, apiKey, await convertToModelMessages(body.messages), await buildSystem(), tools);
      },
    },
  },
});
