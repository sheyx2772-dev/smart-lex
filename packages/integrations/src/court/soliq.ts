/**
 * my.soliq.uz remote-access API — TIN bo'yicha yagona tashkilot ma'lumoti.
 * Javobgar reyestr ma'lumoti uchun FALLBACK manba (asosiysi — shartnoma matni).
 * Kalit VPS'dan ham ishlaydi (IP-cheklov yo'q, empirik tekshirilgan 2026-08-03) —
 * faqat SOLIQ_API_KEY talab qiladi.
 */

export interface SoliqCompanyInfo {
  company: {
    tin: string;
    name: string;
    shortName?: string;
    registrationDate?: string;
    registrationNumber?: string;
    streetName?: string;
    [k: string]: unknown;
  };
  companyBillingAddress?: { region?: string; district?: string; streetName?: string; [k: string]: unknown };
  director: { lastName: string; firstName: string; middleName?: string } | null;
  accountant: { lastName: string; firstName: string; middleName?: string } | null;
}

/** `type=full` — bu API'da qabul qilinadigan YAGONA qiymat; boshqasi 400 qaytaradi. */
function soliqUrl(tin: string): string {
  return `https://my.soliq.uz/api/remote-access-api/company/info/${encodeURIComponent(tin)}?type=full`;
}

/** Noma'lum TIN uchun HTTP xatosi bilan throw qiladi (bo'sh/null qaytarmaydi). */
export async function lookupSoliqCompany(tin: string, apiKey: string): Promise<SoliqCompanyInfo> {
  const res = await fetch(soliqUrl(tin), { headers: { "X-API-KEY": apiKey } });
  if (!res.ok) throw new Error(`lookupSoliqCompany(${tin}): HTTP ${res.status} — ${await res.text()}`);
  return res.json() as Promise<SoliqCompanyInfo>;
}
