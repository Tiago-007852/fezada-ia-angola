import { describe, expect, it } from "vitest";
import { bookingCode, netReturn, totalOdds } from "./odds";

describe("odds", () => {
  it("multiplies odds of an accumulator", () => {
    // Petro 2.10 x Benfica 2.30 on Elephant Bet
    expect(totalOdds([{ matchId: "g1", pick: "1" }, { matchId: "p1", pick: "1" }], "elephant")).toBeCloseTo(4.83);
  });

  it("taxes only the profit at 15%", () => {
    const r = netReturn(1000, 3);
    expect(r.gross).toBe(3000);
    expect(r.tax).toBe(300);
    expect(r.net).toBe(2700);
  });

  it("gives the same booking code for the same ticket and bookie prefix", () => {
    const s = [{ matchId: "g1", pick: "1" as const }];
    expect(bookingCode("premier", s)).toBe(bookingCode("premier", s));
    expect(bookingCode("bantu", s).startsWith("BT-")).toBe(true);
  });
});
