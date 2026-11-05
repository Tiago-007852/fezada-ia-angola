export type Bookie = "elephant" | "premier" | "bantu";
export const BOOKIES: { id: Bookie; name: string; prefix: string }[] = [
  { id: "elephant", name: "Elephant Bet", prefix: "EB" },
  { id: "premier", name: "Premier Bet", prefix: "PB" },
  { id: "bantu", name: "Bantu Bet", prefix: "BT" },
];

export type Pick = "1" | "X" | "2";
export type Match = {
  id: string;
  league: string;
  home: string;
  away: string;
  kickoff: string;
  odds: Record<Bookie, Record<Pick, number>>;
};

// Cotações de demonstração (mercado 1X2). Substituir por feed real quando disponível.
export const MATCHES: Match[] = [
  m(
    "g1",
    "Girabola",
    "Petro de Luanda",
    "1º de Agosto",
    "Sáb 16:00",
    [2.1, 3.0, 3.4],
    [2.05, 3.1, 3.5],
    [2.15, 2.95, 3.3],
  ),
  m(
    "g2",
    "Girabola",
    "Sagrada Esperança",
    "Interclube",
    "Dom 15:00",
    [1.85, 3.2, 4.2],
    [1.9, 3.15, 4.0],
    [1.8, 3.3, 4.4],
  ),
  m(
    "p1",
    "Liga Portugal",
    "Benfica",
    "Sporting",
    "Sáb 20:30",
    [2.3, 3.4, 2.9],
    [2.35, 3.3, 2.85],
    [2.25, 3.45, 3.0],
  ),
  m(
    "p2",
    "Liga Portugal",
    "FC Porto",
    "Braga",
    "Dom 18:00",
    [1.7, 3.8, 4.6],
    [1.72, 3.7, 4.5],
    [1.68, 3.9, 4.8],
  ),
  m(
    "e1",
    "Premier League",
    "Arsenal",
    "Liverpool",
    "Sáb 17:30",
    [2.4, 3.5, 2.8],
    [2.45, 3.4, 2.75],
    [2.38, 3.55, 2.9],
  ),
  m(
    "e2",
    "Premier League",
    "Man City",
    "Chelsea",
    "Dom 16:30",
    [1.55, 4.2, 5.5],
    [1.58, 4.1, 5.3],
    [1.53, 4.3, 5.8],
  ),
  m(
    "c1",
    "Champions League",
    "Real Madrid",
    "Bayern",
    "Ter 20:00",
    [2.2, 3.6, 3.1],
    [2.18, 3.65, 3.15],
    [2.25, 3.5, 3.0],
  ),
  m(
    "a1",
    "CAF Champions League",
    "Al Ahly",
    "Petro de Luanda",
    "Sex 19:00",
    [1.65, 3.5, 5.2],
    [1.62, 3.6, 5.4],
    [1.7, 3.4, 5.0],
  ),
];

function m(
  id: string,
  league: string,
  home: string,
  away: string,
  kickoff: string,
  e: number[],
  p: number[],
  b: number[],
): Match {
  const t = (a: number[]) => ({ "1": a[0] ?? 0, X: a[1] ?? 0, "2": a[2] ?? 0 });
  return { id, league, home, away, kickoff, odds: { elephant: t(e), premier: t(p), bantu: t(b) } };
}

export type Selection = { matchId: string; pick: Pick };

export function totalOdds(
  selections: Selection[],
  bookie: Bookie,
  matches: Match[] = MATCHES,
): number {
  if (selections.length === 0) return 0;
  return selections.reduce((acc, s) => {
    const match = matches.find((x) => x.id === s.matchId);
    return match ? acc * match.odds[bookie][s.pick] : acc;
  }, 1);
}

/** Imposto sobre prémios de jogo em Angola (assumido 15% sobre o lucro, configurável). */
export const TAX_RATE = 0.15;

export function netReturn(stake: number, odds: number, taxRate = TAX_RATE) {
  if (stake <= 0 || odds <= 0) return { gross: 0, profit: 0, tax: 0, net: 0 };
  const gross = stake * odds;
  const profit = Math.max(0, gross - stake);
  const tax = profit * taxRate;
  return { gross, profit, tax, net: gross - tax };
}

export function bestBookie(selections: Selection[]): Bookie | null {
  if (selections.length === 0) return null;
  return BOOKIES.map((b) => b.id).reduce((best, id) =>
    totalOdds(selections, id) > totalOdds(selections, best) ? id : best,
  );
}

/** Código de reserva simulado e determinístico para o mesmo bilhete. */
export function bookingCode(bookie: Bookie, selections: Selection[]): string {
  const prefix = BOOKIES.find((b) => b.id === bookie)!.prefix;
  const key =
    selections
      .map((s) => s.matchId + s.pick)
      .sort()
      .join("|") + bookie;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[h % chars.length];
    h = Math.floor(h / chars.length) || (h ^ 0x9e3779b9) >>> 0;
  }
  return `${prefix}-${code}`;
}

export const kz = (n: number) =>
  new Intl.NumberFormat("pt-AO", { maximumFractionDigits: 0 }).format(Math.round(n)) + " Kz";
