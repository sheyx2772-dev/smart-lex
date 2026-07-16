import { type DataSource, type DataSourceSnapshot } from "./types";

/**
 * Didox MOCK adapteri — real partner token kelmaguncha ishlatiladi (`USE_MOCKS=true`).
 * Deterministik namuna ma'lumot qaytaradi (kompaniya/marketplace ssenariysi).
 * Real adapter aynan shu `DataSource` interfeysini implement qiladi — almashtirish oson.
 */
export class DidoxMockDataSource implements DataSource {
  readonly name = "didox-mock";

  async fetchSnapshot(_since?: Date): Promise<DataSourceSnapshot> {
    const iso = (daysFromNow: number) => new Date(Date.now() + daysFromNow * 86_400_000).toISOString();
    return {
      contractors: [
        { name: "NEW SUPPLY MCHJ", tin: "310222333", legalAddress: "Toshkent sh., Yakkasaroy t.", phone: "+998901234567", email: "sales@newsupply.uz" },
      ],
      contracts: [
        { number: "SH-2026-100", contractorTin: "310222333", signedAt: iso(-40), penaltyDailyBps: 5, penaltyCapBps: 5000, didoxId: "didox-c-100" },
      ],
      invoices: [
        { number: "INV-9001", contractNumber: "SH-2026-100", contractorTin: "310222333", amountMinor: "750000000", currency: "UZS", issuedAt: iso(-35), dueDate: iso(-7), didoxId: "didox-i-9001" },
      ],
      payments: [],
      documents: [
        { didoxId: "didox-c-100", type: "contract", title: "Yetkazib berish shartnomasi SH-2026-100", contractNumber: "SH-2026-100", contractorTin: "310222333" },
        { didoxId: "didox-i-9001", type: "invoice", title: "Hisob-faktura INV-9001", contractNumber: "SH-2026-100", contractorTin: "310222333" },
      ],
    };
  }
}
