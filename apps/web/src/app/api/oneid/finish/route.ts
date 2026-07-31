import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_URL, TOKEN_COOKIE } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One-ID cross-domen handoff yakuni (ikkinchi domen, mas. lex-ai.uz).
 * API callback (api.lexai.com.uz) tokenni bu domenда cookie qila olmagani uchun
 * bir martalik `code` yuboradi — biz uni API'да tokenga almashtirib, shu domenда
 * host-only cookie o'rnatamiz va /agent ga yo'naltiramiz.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const fail = () => NextResponse.redirect(new URL("/login?oneid_error=exchange_failed", req.url));
  if (!code) return fail();
  try {
    const res = await fetch(`${API_URL}/auth/oneid/otc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as { data?: { token?: string } } | null;
    const token = data?.data?.token;
    if (!res.ok || !token) return fail();

    const store = await cookies();
    store.set(TOKEN_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return NextResponse.redirect(new URL("/agent", req.url));
  } catch {
    return fail();
  }
}
