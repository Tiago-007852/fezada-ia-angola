import { describe, expect, it } from "vitest";
import { isProfileActive, isProfileExpired } from "./access.shared";

const now = new Date("2026-11-04T12:00:00Z");

describe("isProfileActive", () => {
  it("só aceita contas ativas dentro da validade", () => {
    expect(isProfileActive({ status: "active", expires_at: "2026-12-01T00:00:00Z" }, now)).toBe(
      true,
    );
    expect(isProfileActive({ status: "active", expires_at: null }, now)).toBe(true);
    expect(isProfileActive({ status: "active", expires_at: "2026-11-01T00:00:00Z" }, now)).toBe(
      false,
    );
    expect(isProfileActive({ status: "pending" }, now)).toBe(false);
    expect(isProfileActive({ status: "blocked", expires_at: null }, now)).toBe(false);
    expect(isProfileActive(null, now)).toBe(false);
  });
  it("distingue expirado de pendente", () => {
    expect(isProfileExpired({ status: "active", expires_at: "2026-11-01T00:00:00Z" }, now)).toBe(
      true,
    );
    expect(isProfileExpired({ status: "pending" }, now)).toBe(false);
  });
});
