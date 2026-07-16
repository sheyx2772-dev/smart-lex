import { describe, expect, it } from "vitest";
import { money } from "./money";
import { calcPenalty, totalDebt } from "./penalty";

const due = new Date("2026-01-01T00:00:00Z");

describe("calcPenalty", () => {
  it("muddat kelmagan bo'lsa penya 0", () => {
    const r = calcPenalty(money(10_000_000n), { dailyRateBps: 5 }, due, new Date("2025-12-20T00:00:00Z"));
    expect(r.days).toBe(0);
    expect(r.penalty.minor).toBe(0n);
  });

  it("kunlik stavka bo'yicha hisoblaydi", () => {
    // 10 000 000 tiyin, 0.05%/kun (5 bps), 10 kun => 5000 * 10 = 50 000 tiyin
    const now = new Date("2026-01-11T00:00:00Z");
    const r = calcPenalty(money(10_000_000n), { dailyRateBps: 5 }, due, now);
    expect(r.days).toBe(10);
    expect(r.penalty.minor).toBe(50_000n);
    expect(r.capped).toBe(false);
  });

  it("cap qo'llanganda cheklaydi", () => {
    // 100 kun * 5 bps/kun = 500 bps (5%). Cap 200 bps (2%) => cheklanadi.
    const now = new Date("2026-04-11T00:00:00Z"); // 100 kun
    const principal = money(10_000_000n);
    const r = calcPenalty(principal, { dailyRateBps: 5, capBps: 200 }, due, now);
    expect(r.capped).toBe(true);
    // cap = 2% of 10 000 000 = 200 000
    expect(r.penalty.minor).toBe(200_000n);
    expect(r.gross.minor).toBe(500_000n);
  });

  it("asosiy qarz 0 yoki manfiy bo'lsa penya 0", () => {
    const now = new Date("2026-02-01T00:00:00Z");
    expect(calcPenalty(money(0n), { dailyRateBps: 5 }, due, now).penalty.minor).toBe(0n);
  });
});

describe("totalDebt", () => {
  it("asosiy + penya + foizni qo'shadi", () => {
    const r = totalDebt(money(1_000_000n), money(50_000n), money(20_000n));
    expect(r.minor).toBe(1_070_000n);
  });
});
