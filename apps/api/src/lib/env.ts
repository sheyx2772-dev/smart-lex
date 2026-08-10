export const env = {
  port: Number(process.env.API_PORT ?? 3001),
  jwtSecret: process.env.JWT_SECRET ?? "change-me-in-production",
  webUrl: process.env.WEB_URL ?? "http://localhost:3000",

  /**
   * One-ID (sso.egov.uz) SSO. Ishlab chiqarish (prod) muhitida to'ldiriladi.
   * redirect_uri ro'yxatdan o'tgan qiymatga TENG bo'lishi shart (localhost mumkin emas).
   */
  oneid: {
    baseUrl: process.env.ONEID_BASE_URL ?? "https://sso.egov.uz/sso/oauth/Authorization.do",
    clientId: process.env.ONEID_CLIENT_ID ?? "",
    clientSecret: process.env.ONEID_CLIENT_SECRET ?? "",
    redirectUri: process.env.ONEID_REDIRECT_URI ?? "https://api.tijoraat.uz/auth/oneid/callback",
    scope: process.env.ONEID_SCOPE ?? "",
    // Muvaffaqiyatli kirishдан keyin foydalanuvchi qaytariladigan web sahifasi.
    postLoginRedirect: process.env.ONEID_POST_LOGIN_REDIRECT ?? (process.env.WEB_URL ?? "http://localhost:3000"),
    // LEX_TOKEN cookie'sini web bilan ulashish uchun domen (mas. ".tijoraat.uz"). Lokalда bo'sh.
    cookieDomain: process.env.COOKIE_DOMAIN ?? "",
    // Tashkilot mavjud, lekin foydalanuvchi yo'q bo'lsa — avtomatik yaratilsinmi?
    autoProvision: (process.env.ONEID_AUTO_PROVISION ?? "false") === "true",
    // "Tasdiqlangan foydalanuvchi" (ERI/Mobile-ID) shartmi — huquqiy oqim uchun.
    requireVerified: (process.env.ONEID_REQUIRE_VERIFIED ?? "false") === "true",
    // Faqat E-IMZO (ERI) bilan kirishga ruxsat (Mobile-ID/parol rad etiladi).
    requireEri: (process.env.ONEID_REQUIRE_ERI ?? "false") === "true",
    // Cross-domen handoff: callback boshqa domenда (mas. api.tijoraat.uz) bo'lса,
    // cookie'ni to'g'ridan o'rnата olmaydi — token KOD bilan mos web'ga topshiriladi.
    // primary — asosий domen (lexai.com.uz), alt — ikkinchi (lex-ai.uz).
    primaryOrigin: process.env.ONEID_ORIGIN ?? "",
    altOrigin: process.env.ONEID_ALT_ORIGIN ?? "",
    altWebUrl: process.env.ONEID_ALT_WEB_URL ?? "",
  },
  // Web login cookie nomi (web /api/session bilan bir xil).
  tokenCookie: process.env.TOKEN_COOKIE ?? "LEX_TOKEN",
  isProd: process.env.NODE_ENV === "production",
  // Platforma egasi (super-admin) tenant IDsi — admin panel faqat shunga ochiq.
  platformTenantId: process.env.PLATFORM_TENANT_ID ?? "",
  // my.soliq.uz remote-access API — javobgar reyestr ma'lumoti (Sud integratsiyasi fallback).
  soliqApiKey: process.env.SOLIQ_API_KEY ?? "",
  // Didox partner API — E-IMZO self-service ulanish uchun (settings.ts /didox/connect).
  didox: {
    apiUrl: process.env.DIDOX_API_URL ?? "https://stage.goodsign.biz",
    partnerToken: process.env.DIDOX_PARTNER_TOKEN ?? "",
  },
};

/**
 * Ishlab chiqarishda (NODE_ENV=production) majburiy sirlar haqiqatan o'rnatilganini
 * tekshiradi — ular yo'q/standart (ochiq) qiymatda bo'lsa server ISHGA TUSHMAYDI.
 * Sababi: JWT_SECRET standart bo'lib qolsa, HAR KIM istalgan foydalanuvchi/rol/tenant
 * uchun to'g'ri token yasab, autentifikatsiyani butunlay chetlab o'ta oladi — bu
 * "keyinroq foydalanish joyida xato beradi" emas, darhol to'xtatilishi shart muammo.
 */
export function validateEnv(): void {
  if (!env.isProd) return;
  const problems: string[] = [];
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "change-me-in-production") {
    problems.push("JWT_SECRET o'rnatilmagan yoki standart qiymatda qolgan");
  }
  if (!process.env.SECRETS_ENCRYPTION_KEY) {
    problems.push("SECRETS_ENCRYPTION_KEY o'rnatilmagan — tenant sirlarini (Click/Payme/Didox) shifrlab bo'lmaydi");
  }
  if (!process.env.DATABASE_URL) {
    problems.push("DATABASE_URL o'rnatilmagan");
  }
  if (problems.length > 0) {
    console.error("✗ Xavfsiz bo'lmagan konfiguratsiya bilan production'da ishga tushirish rad etildi:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
}
