import { type DataSource, type DataSourceSnapshot } from "./types";

/**
 * Bank MOCK adapteri — kredit qarzdorlar reyestri ssenariysi (`bank` tenant tipi).
 * Real bank core-banking integratsiyasi kelganda almashtiriladi.
 */
export class BankMockDataSource implements DataSource {
  readonly name = "bank-mock";

  async fetchSnapshot(_since?: Date): Promise<DataSourceSnapshot> {
    const iso = (daysFromNow: number) => new Date(Date.now() + daysFromNow * 86_400_000).toISOString();
    return {
      contractors: [
        { name: "Qarzdor mijoz — Sardor Aliyev", tin: "51234567890123", phone: "+998935556677" },
      ],
      contracts: [
        { number: "KREDIT-2026-777", contractorTin: "51234567890123", signedAt: iso(-200), penaltyDailyBps: 10, penaltyCapBps: 10000, didoxId: undefined },
      ],
      invoices: [
        // Oylik to'lov grafigi — muddati o'tgan bo'lak
        { number: "KRED-INV-777-06", contractNumber: "KREDIT-2026-777", contractorTin: "51234567890123", amountMinor: "150000000", currency: "UZS", issuedAt: iso(-40), dueDate: iso(-12) },
      ],
      payments: [],
      documents: [],
    };
  }
}
