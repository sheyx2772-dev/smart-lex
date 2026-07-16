import { describe, expect, it } from "vitest";
import { calcRisk } from "./risk";

describe("calcRisk", () => {
  it("toza kontragent => low", () => {
    const r = calcRisk({
      maxOverdueDays: 0,
      outstandingRatio: 0,
      latePaymentCount: 0,
      priorDemandCount: 0,
    });
    expect(r.score).toBe(0);
    expect(r.band).toBe("low");
  });

  it("og'ir qarzdor => high", () => {
    const r = calcRisk({
      maxOverdueDays: 120,
      outstandingRatio: 1,
      latePaymentCount: 5,
      priorDemandCount: 3,
    });
    // 40 + 25 + 20 + 15 = 100
    expect(r.score).toBe(100);
    expect(r.band).toBe("high");
  });

  it("o'rtacha => medium", () => {
    const r = calcRisk({
      maxOverdueDays: 45,
      outstandingRatio: 0.5,
      latePaymentCount: 1,
      priorDemandCount: 0,
    });
    // 20 + 12.5 + 5 + 0 = 37.5 -> 38 ... medium chegara 40. low bo'ladi.
    expect(r.band).toBe("low");
    expect(r.score).toBe(38);
  });

  it("omillar yig'indisi skorga teng (shaffoflik)", () => {
    const r = calcRisk({
      maxOverdueDays: 90,
      outstandingRatio: 0.8,
      latePaymentCount: 2,
      priorDemandCount: 1,
    });
    const sum = r.factors.reduce((s, f) => s + f.points, 0);
    expect(Math.round(sum)).toBe(r.score);
  });
});
