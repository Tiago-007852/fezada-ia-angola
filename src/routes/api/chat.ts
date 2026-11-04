import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, type UIMessage } from "ai";
import type { Database } from "@/integrations/supabase/types";
import { MATCHES, BOOKIES } from "@/lib/odds";

const SYSTEM_BASE = `És o "Camarada Fezada", o consultor de apostas desportivas da Fezada IA, feito para apostadores angolanos.
Tom: próximo, encorajador, inteligente, com linguajar angolano natural (ex.: "mano", "kota", "bué", "tá fixe", "bora", "fezada", "kumbú"), sem exagerar.
Escreve sempre em português de Angola. Valores em Kwanzas (Kz).
Conheces Girabola, Liga Portugal, Premier League, Champions League e competições africanas (CAF).
Ajudas a montar bilhetes, explicas cotações, gestão de banca e comparas Elephant Bet, Premier Bet e Bantu Bet.
Regras: nunca prometas ganhos garantidos; incentiva jogo responsável (apostar só o que pode perder, 18+). Respostas curtas e práticas, ótimas para telemóvel.
Cotações de referência desta semana (1X2, Elephant/Premier/Bantu):
${MATCHES.map((m) => `${m.league}: ${m.home} vs ${m.away} (${m.kickoff}) — ${BOOKIES.map((b) => `${b.name} ${m.odds[b.id]["1"]}/${m.odds[b.id].X}/${m.odds[b.id]["2"]}`).join("; ")}`).join("\n")}`;

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
        return streamGatewayChat(request, apiKey, await convertToModelMessages(body.messages), await buildSystem());
      },
    },
  },
});
