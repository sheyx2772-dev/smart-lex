import { describe, expect, it } from "vitest";
import { DEFAULT_COLLECTION_STEPS, dueCollectionSteps } from "./collection";

const due = new Date("2026-01-01T00:00:00Z");

describe("dueCollectionSteps", () => {
  it("muddatdan 5 kun oldin yumshoq eslatma ishga tushadi", () => {
    const steps = dueCollectionSteps({
      steps: DEFAULT_COLLECTION_STEPS,
      dueDate: due,
      now: new Date("2025-12-27T00:00:00Z"), // -5 kun
      executedStages: [],
    });
    expect(steps.map((s) => s.stage)).toEqual(["soft_reminder"]);
  });

  it("bajarilgan bosqichni qайta qaytarmaydi", () => {
    const steps = dueCollectionSteps({
      steps: DEFAULT_COLLECTION_STEPS,
      dueDate: due,
      now: new Date("2026-01-02T00:00:00Z"), // +1 kun
      executedStages: ["soft_reminder", "firm_reminder"],
    });
    expect(steps).toHaveLength(0);
  });

  it("cron kechiksa bir nechta muddati kelgan bosqichni tartibda qaytaradi", () => {
    const steps = dueCollectionSteps({
      steps: DEFAULT_COLLECTION_STEPS,
      dueDate: due,
      now: new Date("2026-03-15T00:00:00Z"), // +73 kun
      executedStages: [],
    });
    expect(steps.map((s) => s.stage)).toEqual([
      "soft_reminder",
      "firm_reminder",
      "demand_letter",
      "court",
    ]);
  });

  it("talabnoma va sud tasdiq talab qiladi", () => {
    const steps = dueCollectionSteps({
      steps: DEFAULT_COLLECTION_STEPS,
      dueDate: due,
      now: new Date("2026-02-05T00:00:00Z"), // +35 kun
      executedStages: ["soft_reminder", "firm_reminder"],
    });
    expect(steps.map((s) => s.stage)).toEqual(["demand_letter"]);
    expect(steps[0]?.requiresApproval).toBe(true);
  });
});
