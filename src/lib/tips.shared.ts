// Schema e helpers partilhados entre a pipeline de palpites (server) e a validação/entrega (client + chat tool).
import { z } from "zod/v4";

export const RiskLevel = z.enum(["seguro", "equilibrado", "arriscado"]);
export type RiskLevel = z.infer<typeof RiskLevel>;

export const TIP_SCHEMA = z.object({
  selections: z
    .array(
      z.object({
        fixture_id: z.string().describe("ID do jogo (fixtureId) fornecido no contexto"),
        home: z.string(),
        away: z.string(),
        pick: z.enum(["1", "X", "2"]),
        confidence: z.number().int().min(1).max(5).describe("1 = baixa, 5 = alta"),
        reason: z
          .string()
          .max(220)
          .describe("Justificativa curta e concreta, em português de Angola"),
      }),
    )
    .min(2)
    .max(5),
  rationale: z.string().max(320).describe("Resumo da tese do bilhete, em português de Angola"),
  stake_advice: z
    .string()
    .max(160)
    .describe("Sugestão de gestão de banca em % do valor disponível, nunca valores absolutos"),
  responsible_note: z.string().max(160).describe("Nota de jogo responsável"),
});
export type TipOutput = z.infer<typeof TIP_SCHEMA>;

/** As odds conhecidas (por pick) para um jogo dado o bookie escolhido. */
export type CandidateMatch = {
  fixtureId: string;
  league: string;
  home: string;
  away: string;
  kickoffISO: string;
  availableOdds: Record<"1" | "X" | "2", number | null>;
};

export const pickLabel: Record<string, string> = {
  "1": "Casa vence",
  X: "Empate",
  "2": "Fora vence",
};

export const riskCounts: Record<
  RiskLevel,
  { min: number; max: number; maxConfidenceAllowed: number; maxOdds: number }
> = {
  seguro: { min: 2, max: 3, maxConfidenceAllowed: 4, maxOdds: 2.5 },
  equilibrado: { min: 2, max: 4, maxConfidenceAllowed: 5, maxOdds: 3.5 },
  arriscado: { min: 3, max: 5, maxConfidenceAllowed: 5, maxOdds: 6 },
};

/** Segunda barreira de validação: os picks do IA precisam de odds reais dentro do risco pedido. */
export function pickAllowedOdds(risk: RiskLevel, odds: number): boolean {
  return odds <= riskCounts[risk].maxOdds;
}
