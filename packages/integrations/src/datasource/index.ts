import { type TenantType } from "@lex/shared";
import { BankMockDataSource } from "./bank.mock";
import { DidoxMockDataSource } from "./didox.mock";
import { DidoxDataSource } from "./didox.real";
import { type DataSource } from "./types";

export * from "./types";
export { DidoxMockDataSource } from "./didox.mock";
export { DidoxDataSource } from "./didox.real";
export { BankMockDataSource } from "./bank.mock";

/**
 * Tenant tipiga qarab mos qarz-manbai adapterini tanlaydi.
 * - company/marketplace/government: DIDOX_PARTNER_TOKEN sozlangan bo'lsa — REAL Didox, aks holda mock.
 * - bank: bank kredit reyestri (hozircha mock).
 * Interfeys o'zgarmaydi — real token kelganda faqat adapter almashadi (SMS/Groq patterni).
 */
export function createDataSource(tenantType: TenantType): DataSource {
  if (tenantType === "bank") return new BankMockDataSource();

  // Didox oilasi (company / marketplace / government).
  // REAL adapter uchun ikkalasi ham kerak: partner token + user-key (ECP login natijasi).
  // user-key hozircha env orqali; keyinchalik har tenant sozlamasidan (E-IMZO login).
  const partnerToken = process.env.DIDOX_PARTNER_TOKEN;
  const userKey = process.env.DIDOX_USER_KEY;
  if (partnerToken && userKey) {
    return new DidoxDataSource({
      baseUrl: process.env.DIDOX_API_URL ?? "https://api2.didox.uz",
      partnerToken,
      userKey,
    });
  }
  return new DidoxMockDataSource();
}
