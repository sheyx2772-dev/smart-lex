import { describe, expect, it } from "vitest";
import { add, format, fromMajor, money, percentBps, subtract, toMinorString } from "./money";

describe("money", () => {
  it("bir xil valyutani qo'shadi", () => {
    expect(add(money(100_00n), money(50_00n)).minor).toBe(150_00n);
  });

  it("turli valyuta qo'shishda xato beradi", () => {
    expect(() => add(money(100n, "UZS"), money(100n, "USD"))).toThrow(/mismatch/i);
  });

  it("ayiradi (manfiy natija ham)", () => {
    expect(subtract(money(100n), money(150n)).minor).toBe(-50n);
  });

  it("basis point bo'yicha foizni floor bilan hisoblaydi", () => {
    // 1 000 000 tiyin ning 0.05% (5 bps) = 500 tiyin
    expect(percentBps(money(1_000_000n), 5).minor).toBe(500n);
    // floor: 333 ning 5 bps = 0.1665 -> 0
    expect(percentBps(money(333n), 5).minor).toBe(0n);
  });

  it("major -> minor to'g'ri masshtablaydi", () => {
    expect(fromMajor(1234.56).minor).toBe(123456n);
  });

  it("katta summani chiroyli formatlaydi", () => {
    expect(format(money(123456789n))).toBe("1 234 567,89 UZS");
    expect(format(money(-5000n))).toBe("-50,00 UZS");
  });

  it("bigint'ni string sifatida serializatsiya qiladi", () => {
    expect(toMinorString(money(99999999999999n))).toBe("99999999999999");
  });
});
