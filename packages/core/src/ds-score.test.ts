import { calcDsScore } from "./ds-score";
import { describe, expect, it } from "vitest";

describe("calcDsScore", () => {
  it("returns higher score for fresh low-risk debt", () => {
    const result = calcDsScore({
      risk: { score: 20, band: "low", factors: [] },
      overdueDays: 10,
      amountMajor: 5_000_000,
      currency: "UZS",
      executedStageCount: 0,
    });
    expect(result.dsScore).toBeGreaterThan(50);
    expect(result.recommendedStrategy).toBe("soft_escalation");
  });

  it("recommends legal strategy for high risk old debt", () => {
    const result = calcDsScore({
      risk: { score: 75, band: "high", factors: [] },
      overdueDays: 120,
      amountMajor: 50_000_000,
      currency: "UZS",
      executedStageCount: 4,
    });
    expect(result.recommendedStrategy).toBe("legal");
    expect(result.recoveryProbability).toBeLessThan(0.5);
  });
});
