import { describe, expect, it } from "vitest";
import { calcStateDuty, determineCourt } from "./legal";

describe("calcStateDuty (davlat boji)", () => {
  it("default 2% ni to'g'ri hisoblaydi", () => {
    // 3 067 500 so'm = 306 750 000 tiyin; 2% = 6 135 000 tiyin (61 350 so'm)
    expect(calcStateDuty(306_750_000n).dutyMinor).toBe(6_135_000n);
    expect(calcStateDuty(306_750_000n).rateBps).toBe(200);
  });

  it("sozlangan stavkani hisoblaydi", () => {
    // 10 000 000 tiyin ning 3% (300 bps) = 300 000 tiyin
    expect(calcStateDuty(10_000_000n, { rateBps: 300 }).dutyMinor).toBe(300_000n);
  });

  it("minimal chegarani qo'llaydi", () => {
    // raw = 100 * 2% = 2 tiyin; min 5000 => 5000
    expect(calcStateDuty(100n, { minMinor: 5_000n }).dutyMinor).toBe(5_000n);
  });

  it("nol da'voda nol boj", () => {
    expect(calcStateDuty(0n).dutyMinor).toBe(0n);
  });
});

describe("determineCourt (sud aniqlash)", () => {
  it("manzildan hududni ajratadi va iqtisodiy sudni beradi", () => {
    const r = determineCourt("Toshkent sh., Chilonzor t., 12-uy");
    expect(r.type).toBe("economic");
    expect(r.region).toBe("Toshkent sh.");
    expect(r.name).toBe("Toshkent sh. iqtisodiy sudi");
  });

  it("manzil yo'q bo'lsa xato bermaydi", () => {
    expect(determineCourt(null).region).toBe("—");
    expect(determineCourt(undefined).type).toBe("economic");
  });
});
