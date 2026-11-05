// Pipeline de palpites do Camarada IA:
//  1. recolhe contexto real (odds do dia + previsões/formas da API);
//  2. força estrutura com generateObject + Zod;
//  3. valida os picks contra as odds reais disponíveis;
//  4. devolve o bilhete pronto a persistir.

import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import {
  TIP_SCHEMA,
  type CandidateMatch,
  type RiskLevel,
  type TipOutput,
  pickAllowedOdds,
} from "@/lib/tips.shared";
import {
  fetchPrediction,
  fetchUpcomingOdds,
  fetchTeamForm,
  type UpcomingWithOdds,
} from "@/lib/feed.server";
import { MATCHES, netReturn } from "@/lib/odds";

/** Converte os jogos do feed real em candidatos (odds de referência = a melhor odd disponível). */
export function candidatesFromUpcoming(games: UpcomingWithOdds[], limit = 8): CandidateMatch[] {
  const out: CandidateMatch[] = [];
  for (const g of games) {
    const best: Record<"1" | "X" | "2", number | null> = { "1": null, X: null, "2": null };
    for (const b of g.odds) {
      if (b.home && (!best["1"] || b.home > best["1"])) best["1"] = b.home;
      if (b.draw && (!best.X || b.draw > best.X)) best.X = b.draw;
      if (b.away && (!best["2"] || b.away > best["2"])) best["2"] = b.away;
    }
    if (!best["1"] && !best.X && !best["2"]) continue;
    out.push({
      fixtureId: g.fixtureId,
      league: g.league,
      home: g.home,
      away: g.away,
      kickoffISO: g.kickoffISO,
      availableOdds: best,
    });
  }
  return out.slice(0, limit);
}

/** Fallback: usa os dados de demonstração se o feed real estiver indisponível (marcado como demo). */
export function demoCandidates(): CandidateMatch[] {
  return MATCHES.map((m) => ({
    fixtureId: m.id,
    league: m.league,
    home: m.home,
    away: m.away,
    kickoffISO: m.kickoff,
    availableOdds: { "1": null, X: null, "2": null },
  }));
}

type TipContext =
  | {
      kind: "real";
      matches: CandidateMatch[];
      predictions: {
        fixtureId: string;
        home: string;
        draw: string;
        away: string;
        advice: string;
      }[];
      forms: { fixtureId: string; home: string; away: string }[];
    }
  | { kind: "demo"; matches: CandidateMatch[] };

export async function buildTipContext(dateISO: string): Promise<TipContext> {
  try {
    const games = await fetchUpcomingOdds(dateISO);
    if (!games || games.length === 0) throw new Error("feed indisponível");
    const matches = candidatesFromUpcoming(games);
    if (matches.length === 0) throw new Error("sem odds reais");

    // Previsões + formas para os primeiros jogos (limita consumo de quota)
    const predictions: {
      fixtureId: string;
      home: string;
      draw: string;
      away: string;
      advice: string;
    }[] = [];
    const forms: { fixtureId: string; home: string; away: string }[] = [];
    const byId = new Map(games.map((g) => [g.fixtureId, g]));
    for (const m of matches.slice(0, 5)) {
      const g = byId.get(m.fixtureId);
      const pred = await fetchPrediction(m.fixtureId);
      if (pred) {
        predictions.push({
          fixtureId: m.fixtureId,
          home: String(pred.percentHome ?? "?"),
          draw: String(pred.percentDraw ?? "?"),
          away: String(pred.percentAway ?? "?"),
          advice: pred.advice ?? "",
        });
      }
      if (g) {
        const year = new Date(g.kickoffISO);
        const season = year.getMonth() < 6 ? year.getFullYear() - 1 : year.getFullYear();
        const [fh, fa] = await Promise.all([
          fetchTeamForm(Number(g.homeId), g.leagueId, season).catch(() => null),
          fetchTeamForm(Number(g.awayId), g.leagueId, season).catch(() => null),
        ]);
        forms.push({ fixtureId: m.fixtureId, home: fh ?? "n/d", away: fa ?? "n/d" });
      }
    }
    return { kind: "real", matches, predictions, forms };
  } catch {
    return { kind: "demo", matches: demoCandidates() };
  }
}

function buildPrompt(context: TipContext, risk: RiskLevel): string {
  const list = context.matches
    .map(
      (m) =>
        `[${m.fixtureId}] ${m.league} — ${m.home} vs ${m.away} (${m.kickoffISO}) — odds: 1=${m.availableOdds["1"]?.toFixed(2) ?? "n/d"}, X=${m.availableOdds.X?.toFixed(2) ?? "n/d"}, 2=${m.availableOdds["2"]?.toFixed(2) ?? "n/d"}`,
    )
    .join("\n");
  const preds =
    context.kind === "real" && context.predictions.length
      ? "\nPrevisões e formas da API-Sports:\n" +
        context.predictions
          .map(
            (p) =>
              `Jogo ${p.fixtureId}: casa ${p.home}% / empate ${p.draw}% / fora ${p.away}% — conselho: ${p.advice || "n/d"}`,
          )
          .join("\n") +
        "\n" +
        context.forms
          .filter((f) => f.home !== "n/d" || f.away !== "n/d")
          .map(
            (f) =>
              `Jogo ${f.fixtureId}: forma casa ${f.home} (V/vitória, E/empate, D/derrota) — fora ${f.away}`,
          )
          .join("\n")
      : "";
  const isDemo = context.kind === "demo";
  const maxOdds = risk === "seguro" ? 2.5 : risk === "equilibrado" ? 3.5 : 6;
  return [
    `Jogos disponíveis (1X2, melhor odd em cada pick):`,
    list,
    preds,
    isDemo
      ? "\nATENÇÃO: o feed de odds reais está indisponível neste momento. Monta um bilhete de DEMONSTRAÇÃO com os jogos acima (dados de referência antigos), explica isso claramente no rationale e avisa o utilizador para verificar as cotações atuais."
      : "",
    `\nNível de risco pedido: ${risk}. Odds máximas por pick: ${maxOdds}.`,
    "\nRegras obrigatórias:",
    "- Escolhe entre 2 e 5 seleções, só de jogos da lista acima, usando o fixtureId exato.",
    "- Só escolhe um pick cujas odds estejam disponíveis (não 'n/d') e compatíveis com o risco/${maxOdds}.",
    "- Justificativa de 1 frase, concreta (forma, H2H, classificação) — nada de vaguidade, nunca prometer ganhos garantidos.",
    "- Sugestão de stake em % da banca disponível (ex.: '2-4% da banca por bilhete'), nunca valores absolutos.",
    "- Nota final de jogo responsável.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Gera uma sugestão de bilhete com generateObject + Zod e devolve validada contra as odds disponíveis. */
export async function generateTipTicket(
  request: Request | null,
  apiKey: string,
  dateISO: string,
  risk: RiskLevel,
): Promise<{ tip: TipOutput; candidates: CandidateMatch[]; demo: boolean } | { error: string }> {
  const context = await buildTipContext(dateISO);
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey },
  });
  try {
    const result = await generateObject({
      model: provider.chat("openai/gpt-6-astra"),
      schema: TIP_SCHEMA,
      prompt: buildPrompt(context, risk),
      ...(request ? { abortSignal: request.signal } : {}),
    });
    const tip = TIP_SCHEMA.parse(result.object);
    // Validação dura: no modo real, os picks precisam de odds reais disponíveis dentro do risco pedido
    const byId = new Map(context.matches.map((m) => [m.fixtureId, m]));
    const valid = tip.selections.filter((s) => {
      const m = byId.get(s.fixture_id);
      if (!m) return false;
      const odds = m.availableOdds[s.pick];
      if (context.kind === "real") {
        if (odds === null || odds === undefined) return false;
        if (!pickAllowedOdds(risk, odds)) return false;
      }
      return true;
    });
    if (valid.length === 0)
      return {
        error: "Os picks do modelo não têm cotações disponíveis agora. Tenta novamente, camarada.",
      };
    tip.selections = valid as TipOutput["selections"];
    return { tip, candidates: context.matches, demo: context.kind === "demo" };
  } catch (e) {
    return { error: (e as Error).message || "Falha na geração do bilhete" };
  }
}

/** Cálculo final do bilhete para persistir: odds totais e retorno líquido em Kz (imposto de 15% sobre lucro). */
export function ticketMeta(picks: { odds: number }[], stake: number) {
  const totalOdds = picks.reduce((acc, s) => acc * s.odds, 1);
  const r = netReturn(stake, totalOdds);
  return { totalOdds, bookie: "Elephant Bet (referência)", netReturnKz: r.net };
}
