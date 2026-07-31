import { NextResponse } from "next/server";

/**
 * One-ID (SSO) kirishni boshlaydi — brauzerni API serverning `/auth/oneid` yo'liga
 * yo'naltiradi (u yerdan sso.egov.uz sahifasiga). Redirect manzili brauzerdan
 * ochilishi kerak, shuning uchun ONEID_PUBLIC_API_URL (yoki NEXT_PUBLIC_API_URL)
 * ishlatiladi — ichki API_URL emas. Foydalanuvchi ikkinchi domenда (mas. lex-ai.uz)
 * bo'lsa, `?origin=` uzatiladi — token o'sha domenда cookie sifatida o'rnatilishi uchun.
 */
export function GET(req: Request) {
  const base = (process.env.ONEID_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? "http://localhost:3001").replace(/\/$/, "");
  const altOrigin = (process.env.ONEID_ALT_ORIGIN ?? "lex-ai.uz").toLowerCase();
  const primaryOrigin = (process.env.ONEID_ORIGIN ?? "lexai.com.uz").toLowerCase();
  const host = (req.headers.get("host") ?? "").toLowerCase();
  // Callback boshqa domenда bo'lgani uchun origin (qaysi web boshladi) doim uzatiladi.
  const origin = altOrigin && host.includes(altOrigin) ? altOrigin : primaryOrigin && host.includes(primaryOrigin) ? primaryOrigin : "";
  return NextResponse.redirect(`${base}/auth/oneid${origin ? `?origin=${encodeURIComponent(origin)}` : ""}`);
}
