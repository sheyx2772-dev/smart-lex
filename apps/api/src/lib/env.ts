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
    // Ikkinchi domen (cross-domen handoff): callback api.lexai.com.uz'da bo'ladi,
    // lekin origin shu bo'lsa token KOD bilan altWebUrl web'iga topshiriladi.
    altOrigin: process.env.ONEID_ALT_ORIGIN ?? "",
    altWebUrl: process.env.ONEID_ALT_WEB_URL ?? "",
  },
  // Web login cookie nomi (web /api/session bilan bir xil).
  tokenCookie: process.env.TOKEN_COOKIE ?? "LEX_TOKEN",
  isProd: process.env.NODE_ENV === "production",
};
