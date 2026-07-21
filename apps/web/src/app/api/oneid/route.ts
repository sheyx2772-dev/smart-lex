import { NextResponse } from "next/server";

/**
 * One-ID (SSO) kirishni boshlaydi — brauzerni API serverning `/auth/oneid` yo'liga
 * yo'naltiradi (u yerdan sso.egov.uz sahifasiga). Redirect manzili brauzerдан
 * ochilishi kerak, shuning uchun ONEID_PUBLIC_API_URL (yoki NEXT_PUBLIC_API_URL)
 * ishlatiladi — ichki API_URL emas.
 */
export function GET() {
  const base = (process.env.ONEID_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? "http://localhost:3001").replace(/\/$/, "");
  return NextResponse.redirect(`${base}/auth/oneid`);
}
