// Regras puras de liquidação (testáveis, sem I/O).
import { totalOddsOf } from "./ticket.shared";
import { netReturn } from "./odds";

export type SelResult = "win" | "lost" | "void" | "pending";

const FINISHED = ["FT", "AET", "PEN"];
const VOID_STATUSES = ["CANC", "ABD", "AWD", "WO"];
const POSTPONED_GRACE_MS = 3 * 24 * 3600_000;

export type FixtureOutcome = {
  status: string;
  home: number | null;
  away: number | null;
};

/** Resultado de uma seleção 1X2 dado o estado final do jogo. */
export function evaluateSelection(
  pick: string,
  f: FixtureOutcome | undefined,
  kickoff: string | null,
  now = new Date(),
): SelResult {
  if (!f) return "pending";
  if (VOID_STATUSES.includes(f.status)) return "void";
  if (f.status === "PST") {
    // Adiado: espera; se passar a margem, anula (devolve a stake).
    const k = kickoff ? new Date(kickoff).getTime() : NaN;
    return Number.isFinite(k) && now.getTime() - k > POSTPONED_GRACE_MS ? "void" : "pending";
  }
  if (!FINISHED.includes(f.status)) return "pending";
  if (f.home === null || f.away === null) return "pending";
  const win = pick === "1" ? f.home > f.away : pick === "X" ? f.home === f.away : f.away > f.home;
  return win ? "win" : "lost";
}

export type TicketOutcome =
  | { status: "pending" }
  | { status: "lost" }
  | { status: "void"; netReturn: number }
  | { status: "won"; netReturn: number };

/** Estado final do bilhete a partir do resultado de todas as seleções. Anuladas contam odd 1. */
export function evaluateTicket(
  stake: number,
  sels: { odds: number; result: SelResult }[],
): TicketOutcome {
  if (sels.some((s) => s.result === "lost")) return { status: "lost" };
  if (sels.some((s) => s.result === "pending")) return { status: "pending" };
  if (sels.length > 0 && sels.every((s) => s.result === "void"))
    return { status: "void", netReturn: stake };
  const total = totalOddsOf(
    sels.map((s) => ({ pick: "", odds: s.result === "void" ? 1 : s.odds })),
  );
  return { status: "won", netReturn: netReturn(stake, total).net };
}
