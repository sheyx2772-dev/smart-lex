import { type SoliqCompanyInfo } from "./soliq";

/**
 * case_participants[1] (DEFENDANT) uchun `entity_details` — Soliq javobidan qurilgan.
 *
 * BILINGAN KAMCHILIK: haqiqiy, muvaffaqiyatli topshirilgan payload'da ko'ringan
 * ba'zi maydonlar (ministry_stat_id, ownership_type_id, organization_form_id,
 * district_id, region_id, bank_id) sud.uz'ning O'Z ICHKI ma'lumotnoma jadval
 * UUID'lari — Soliq reyestrida yo'q. Bu yerda ataylab qoldirilmoqda (soxta
 * qiymat o'ylab topilmaydi); agar save-suit shu maydonlarsiz rad etsa, ularni
 * sud.uz'ning o'z tashkilot-qidiruv endpointidan (hali tasdiqlanmagan) yoki
 * qo'lda kiritishdan olish kerak bo'ladi — qarang SKILL.md 3-qadam.
 */
export function defendantDetailsFromSoliq(info: SoliqCompanyInfo): Record<string, unknown> {
  const c = info.company;
  const addr = info.companyBillingAddress;
  const director = info.director;
  return {
    is_current: true,
    entity_type: "ORGANIZATION",
    citizenship: "UZB_CITIZEN",
    details: {
      company: {
        name: c.name,
        shortName: c.shortName ?? c.name,
        tin: c.tin,
        registrationDate: c.registrationDate,
        registrationNumber: c.registrationNumber,
      },
      companyBillingAddress: { countryCode: 860, streetName: addr?.streetName ?? c.streetName },
      director: director
        ? {
            lastName: director.lastName,
            firstName: director.firstName,
            middleName: director.middleName,
          }
        : undefined,
    },
    short_name: c.shortName ?? c.name,
    name: c.name,
    director: director ? [director.lastName, director.firstName, director.middleName].filter(Boolean).join(" ") : undefined,
    registry_date: c.registrationDate,
    registry_number: c.registrationNumber,
    address: addr?.streetName ?? c.streetName,
  };
}
