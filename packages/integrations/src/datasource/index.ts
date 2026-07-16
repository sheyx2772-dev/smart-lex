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

  // Didox oilasi (company / marketplace / government)
  const token = process.env.DIDOX_PARTNER_TOKEN;
  if (token) {
    return new DidoxDataSource({
      baseUrl: process.env.DIDOX_API_URL ?? "https://api-partners.didox.uz",
      token,
      authHeader: process.env.DIDOX_AUTH_HEADER,
      authScheme: process.env.DIDOX_AUTH_SCHEME,
    });
  }
  return new DidoxMockDataSource();
}
