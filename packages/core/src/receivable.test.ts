import { describe, expect, it } from "vitest";
import { money } from "./money";
import { evaluateReceivable } from "./receivable";

const due = new Date("2026-01-01T00:00:00Z");

describe("evaluateReceivable", () => {
  it("to'liq to'langan => paid", () => {
    const s = evaluateReceivable({
      invoiced: money(1_000_000n),
      paid: money(1_000_000n),
      dueDate: due,
      now: new Date("2026-02-01T00:00:00Z"),
    });
    expect(s.status).toBe("paid");
    expect(s.outstanding.minor).toBe(0n);
  });

  it("muddat kelmagan, to'lanmagan => pending", () => {
    const s = evaluateReceivable({
      invoiced: money(1_000_000n),
      paid: money(0n),
      dueDate: due,
      now: new Date("2025-12-25T00:00:00Z"),
    });
    expect(s.status).toBe("pending");
    expect(s.agingBucket).toBe("current");
  });

  it("qisman to'langan, muddat kelmagan => partial", () => {
    const s = evaluateReceivable({
      invoiced: money(1_000_000n),
      paid: money(400_000n),
      dueDate: due,
      now: new Date("2025-12-25T00:00:00Z"),
    });
    expect(s.status).toBe("partial");
    expect(s.outstanding.minor).toBe(600_000n);
  });

  it("muddat o'tgan, qarz bor => overdue + aging", () => {
    const s = evaluateReceivable({
      invoiced: money(1_000_000n),
      paid: money(0n),
      dueDate: due,
      now: new Date("2026-02-10T00:00:00Z"), // 40 kun
    });
    expect(s.status).toBe("overdue");
    expect(s.overdueDays).toBe(40);
    expect(s.agingBucket).toBe("31_60");
  });

  it("ortiqcha to'lov => paid, outstanding manfiy emas", () => {
    const s = evaluateReceivable({
      invoiced: money(1_000_000n),
      paid: money(1_200_000n),
      dueDate: due,
      now: new Date("2026-02-01T00:00:00Z"),
    });
    expect(s.status).toBe("paid");
    expect(s.outstanding.minor).toBe(0n);
  });
});
