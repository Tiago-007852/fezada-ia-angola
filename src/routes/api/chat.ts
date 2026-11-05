import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, tool, type UIMessage } from "ai";
import { z } from "zod/v4";
import { authenticateUser } from "@/lib/access.server";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit.server";
import { generateTipTicket } from "@/lib/ai/tips.server";
import { aiApiKey } from "@/lib/ai/gateway.server";
import { createTicket } from "@/lib/tickets.server";

const SYSTEM_BASE = `És o "Camarada Fezada", o consultor de apostas desportivas da Fezada IA, feito para apostadores angolanos.
Tom: próximo, encorajador, inteligente, com linguajar angolano natural (ex.: "mano", "kota", "bué", "tá fixe", "bora", "fezada", "kumbú"), sem exagerar.
Escreve sempre em português de Angola. Valores em Kwanzas (Kz).
Conheces Girabola, Liga Portugal, Premier League, Champions League e competições africanas (CAF).
Ajudas a montar bilhetes, explicas cotações, gestão de banca e comparas Elephant Bet, Premier Bet e Bantu Bet.
Regras: nunca prometas ganhos garantidos; incentiva jogo responsável (apostar só o que pode perder, 18+). Respostas curtas e práticas, ótimas para telemóvel.
Tens a tool 'criar_palpite': quando o utilizador pedir uma fezada/bilhete ("monta-me um bilhete", "palpite"), chama-a informando o nível de risco ("seguro"|"equilibrado"|"arriscado") em vez de improvisares picks a cabeça; depois comenta o resultado. Não inventes cotações — o bilhete vem com odds reais do feed.
Não tens cotações em memória: nunca cites odds de cabeça. Para odds reais usa a tool 'criar_palpite' ou manda o utilizador ao Comparador da app, e lembra que as cotações mudam até ao apito inicial.`;

function tipDateISO(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

async function buildSystem(): Promise<string> {
  try {
    const { fetchLiveScores } = await import("@/lib/live.server");
    const { games, demo } = await fetchLiveScores();
    if (demo)
      return `${SYSTEM_BASE}\n\nJogos em direto: neste momento o serviço de resultados ao vivo está indisponível; se te perguntarem por resultados em direto, diz que estão temporariamente indisponíveis e não inventes resultados.`;
    if (games.length === 0)
      return `${SYSTEM_BASE}\n\nJogos em direto: neste momento não há jogos a decorrer. Se te perguntarem por resultados ao vivo, diz que não há jogos a decorrer agora.`;
    const list = games
      .map((g) => `${g.league}: ${g.home} ${g.hs}-${g.as} ${g.away} (${g.minute}')`)
      .join("\n");
    return `${SYSTEM_BASE}\n\nJogos a decorrer AGORA (resultados reais, em direto):\n${list}\nQuando te perguntarem por jogos em direto ou resultados, responde com estes dados reais; nunca inventes resultados.`;
  } catch {
    return SYSTEM_BASE;
  }
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateUser(request, { requireActive: true });
        if (!auth.ok) return auth.response;
        const rl = rateLimit(`chat:${auth.userId}`, 20, 60_000);
        if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

        const apiKey = aiApiKey();
        if (!apiKey) return new Response("IA não configurada", { status: 500 });
        const raw = await request.text();
        if (raw.length > 60_000) return new Response("Conversa demasiado longa", { status: 413 });
        let body: { messages?: UIMessage[] };
        try {
          body = JSON.parse(raw) as { messages?: UIMessage[] };
        } catch {
          return new Response("Pedido inválido", { status: 400 });
        }
        if (
          !Array.isArray(body.messages) ||
          body.messages.length === 0 ||
          body.messages.length > 60
        )
          return new Response("Pedido inválido", { status: 400 });
        const { streamGatewayChat } = await import("@/lib/ai/gateway.server");
        const tools = {
          criar_palpite: tool({
            description:
              "Cria um bilhete de aposta (palpite) para hoje, com odds reais do feed, e guarda-o na conta do utilizador.",
            inputSchema: z.object({
              risk: z
                .enum(["seguro", "equilibrado", "arriscado"])
                .describe("Nível de risco pedido pelo utilizador"),
            }),
            execute: async ({ risk }) => {
              try {
                const generated = await generateTipTicket(request, apiKey, tipDateISO(), risk);
                if ("error" in generated) return { ok: false, error: generated.error };
                const { tip, demo } = generated;
                if (demo) {
                  return {
                    ok: true,
                    demo: true,
                    rationale: tip.rationale,
                    stake_advice: tip.stake_advice,
                    responsible_note: tip.responsible_note,
                    selections: tip.selections,
                  };
                }
                const byId = new Map(generated.candidates.map((c) => [c.fixtureId, c]));
                const created = await createTicket(
                  auth.userId,
                  {
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
                  },
                  { trusted: true },
                );
                if (!created.ok)
                  return { ok: false, error: created.error ?? "Falha ao guardar bilhete" };
                return { ok: true, demo: false, ticket: created.ticket };
              } catch (e) {
                return { ok: false, error: (e as Error).message ?? "Falha na geração do palpite" };
              }
            },
          }),
        };
        return streamGatewayChat(
          request,
          apiKey,
          await convertToModelMessages(body.messages),
          await buildSystem(),
          tools,
        );
      },
    },
  },
});
