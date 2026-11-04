import { netReturn } from "./odds";

export { netReturn };

export type PickCheck = { pick: string; odds: number };

/** Multiplica as odds das seleções de um bilhete. */
export function totalOddsOf(selections: PickCheck[]): number {
  if (selections.length === 0) return 0;
  return selections.reduce((acc, s) => acc * Math.max(0, s.odds), 1);
}

/** Valida que os picks do IA existem nas odds reais disponíveis; devolve as seleções válidas. */
export function validateAgainstAvailable<T extends { pick: string; odds: number }>(
  selections: T[],
  available: Record<string, number | undefined>,
): T[] {
  return selections.filter((s) => {
    const real = available[s.pick];
    return real !== undefined && real > 1;
  });
}
