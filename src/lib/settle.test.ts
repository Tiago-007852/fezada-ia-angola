import { describe, expect, it } from "vitest";
import { evaluateSelection, evaluateTicket } from "./settle.shared";

const now = new Date("2026-11-04T12:00:00Z");

describe("evaluateSelection", () => {
  it("resolve 1X2 em jogos terminados", () => {
    expect(evaluateSelection("1", { status: "FT", home: 2, away: 1 }, null, now)).toBe("win");
    expect(evaluateSelection("X", { status: "FT", home: 1, away: 1 }, null, now)).toBe("win");
    expect(evaluateSelection("2", { status: "FT", home: 2, away: 1 }, null, now)).toBe("lost");
  });
  it("mantém pendente se o jogo não acabou ou não há dados", () => {
    expect(evaluateSelection("1", { status: "1H", home: 1, away: 0 }, null, now)).toBe("pending");
    expect(evaluateSelection("1", undefined, null, now)).toBe("pending");
    expect(evaluateSelection("1", { status: "FT", home: null, away: null }, null, now)).toBe(
      "pending",
    );
  });
  it("anula jogos cancelados e adiados há mais de 3 dias", () => {
    expect(evaluateSelection("1", { status: "CANC", home: null, away: null }, null, now)).toBe(
      "void",
    );
    expect(
      evaluateSelection(
        "1",
        { status: "PST", home: null, away: null },
        "2026-11-03T12:00:00Z",
        now,
      ),
    ).toBe("pending");
    expect(
      evaluateSelection(
        "1",
        { status: "PST", home: null, away: null },
        "2026-10-20T12:00:00Z",
        now,
      ),
    ).toBe("void");
  });
});

describe("evaluateTicket", () => {
  it("perde assim que uma seleção perde", () => {
    expect(
      evaluateTicket(1000, [
        { odds: 2, result: "win" },
        { odds: 2, result: "lost" },
        { odds: 2, result: "pending" },
      ]),
    ).toEqual({ status: "lost" });
  });
  it("fica pendente enquanto houver seleções por decidir", () => {
    expect(
      evaluateTicket(1000, [
        { odds: 2, result: "win" },
        { odds: 2, result: "pending" },
      ]),
    ).toEqual({ status: "pending" });
  });
  it("ganha com imposto de 15% sobre o lucro", () => {
    expect(evaluateTicket(1000, [{ odds: 3, result: "win" }])).toEqual({
      status: "won",
      netReturn: 2700,
    });
  });
  it("seleção anulada conta odd 1", () => {
    expect(
      evaluateTicket(1000, [
        { odds: 2, result: "win" },
        { odds: 5, result: "void" },
      ]),
    ).toEqual({ status: "won", netReturn: 1850 });
  });
  it("devolve a stake se tudo foi anulado", () => {
    expect(evaluateTicket(1000, [{ odds: 2, result: "void" }])).toEqual({
      status: "void",
      netReturn: 1000,
    });
  });
});
