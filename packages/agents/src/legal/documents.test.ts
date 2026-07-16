import { money } from "@lex/core";
import { describe, expect, it } from "vitest";
import { generateDemandLetter } from "./demand-letter";
import { generateLawsuit } from "./lawsuit";
import { generateReconciliationAct } from "./reconciliation";

describe("generateDemandLetter (talabnoma)", () => {
  const letter = generateDemandLetter({
    locale: "uz",
    creditor: { name: "ALFA TRADE", bankAccount: "2020...", bankMfo: "00014" },
    debtor: { name: "GLOBAL SNAB" },
    contractNumber: "SH-2026-001",
    invoiceNumbers: ["INV-1001"],
    principal: money(500_000_000n, "UZS"),
    penalty: money(11_250_000n, "UZS"),
    total: money(511_250_000n, "UZS"),
    overdueDays: 45,
    responseDeadlineDays: 10,
  });

  it("deterministik (template) generatsiya", () => {
    expect(letter.generatedBy).toBe("template");
  });
  it("qarzdor, shartnoma va aniq summalarni o'z ichiga oladi", () => {
    expect(letter.body).toContain("GLOBAL SNAB");
    expect(letter.body).toContain("SH-2026-001");
    expect(letter.body).toContain("5 000 000,00 UZS"); // asosiy qarz
    expect(letter.body).toContain("5 112 500,00 UZS"); // jami
    expect(letter.body).toContain("45");
  });
});

describe("generateReconciliationAct (akt-sverka)", () => {
  const act = generateReconciliationAct({
    locale: "uz",
    creditor: { name: "ALFA TRADE", tin: "301234567" },
    debtor: { name: "GLOBAL SNAB", tin: "305111222" },
    actNumber: "AS-2026-1",
    periodTo: new Date("2026-07-13"),
    openingBalance: money(0n, "UZS"),
    currency: "UZS",
    entries: [
      { date: new Date("2026-05-14"), docType: "invoice", docNumber: "INV-1001", debit: money(500_000_000n, "UZS") },
      { date: new Date("2026-06-25"), docType: "payment", docNumber: "—", credit: money(200_000_000n, "UZS") },
    ],
  });

  it("yakuniy saldoni to'g'ri hisoblaydi (debet - kredit)", () => {
    // 5 000 000 - 2 000 000 = 3 000 000 => 300 000 000 tiyin
    expect(act.closingBalanceMinor).toBe("300000000");
    expect(act.body).toContain("3 000 000,00 UZS");
  });
});

describe("generateLawsuit (da'vo arizasi)", () => {
  const suit = generateLawsuit({
    locale: "uz",
    court: "Toshkent sh. iqtisodiy sudi",
    plaintiff: { name: "ALFA TRADE", tin: "301234567" },
    defendant: { name: "GLOBAL SNAB", tin: "305111222", address: "Toshkent sh." },
    contractNumbers: ["SH-2026-001"],
    invoiceNumbers: ["INV-1001"],
    principal: money(300_000_000n, "UZS"),
    penalty: money(6_750_000n, "UZS"),
    total: money(306_750_000n, "UZS"),
    stateDuty: money(6_135_000n, "UZS"),
    overdueDays: 45,
  });

  it("deterministik va sud/STIR/summalarni saqlaydi", () => {
    expect(suit.generatedBy).toBe("template");
    expect(suit.body).toContain("Toshkent sh. iqtisodiy sudi");
    expect(suit.body).toContain("305111222"); // javobgar STIR
    expect(suit.body).toContain("3 000 000,00 UZS"); // asosiy qarz
    expect(suit.body).toContain("61 350,00 UZS"); // davlat boji
  });
});
