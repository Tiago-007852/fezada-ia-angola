import { beforeEach, describe, expect, it } from "vitest";
import { rateLimit, resetRateLimits } from "./rate-limit.server";

describe("rateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("bloqueia depois do limite e devolve Retry-After", () => {
    expect(rateLimit("a", 2, 1000, 0).ok).toBe(true);
    expect(rateLimit("a", 2, 1000, 100).ok).toBe(true);
    const r = rateLimit("a", 2, 1000, 200);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retryAfterSec).toBe(1);
  });
  it("liberta quando a janela passa e isola chaves", () => {
    rateLimit("a", 1, 1000, 0);
    expect(rateLimit("b", 1, 1000, 10).ok).toBe(true);
    expect(rateLimit("a", 1, 1000, 1500).ok).toBe(true);
  });
});
