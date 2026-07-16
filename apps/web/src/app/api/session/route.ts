import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/i18n/config";
import { API_URL, TOKEN_COOKIE } from "@/lib/api";

/** Login — backendga so'rov yuboradi, tokenni httpOnly cookie'ga yozadi. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const store = await cookies();
  const locale = store.get(LOCALE_COOKIE)?.value ?? "uz";

  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Lang": locale },
    body: JSON.stringify(body),
  });
  const data = await res.json();

  if (!res.ok || !data.success) {
    return NextResponse.json(data, { status: res.status });
  }

  store.set(TOKEN_COOKIE, data.data.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return NextResponse.json({ success: true, message: data.message, data: { user: data.data.user }, error: null });
}

/** Logout — cookie'ni tozalaydi. */
export async function DELETE() {
  const store = await cookies();
  store.delete(TOKEN_COOKIE);
  return NextResponse.json({ success: true, message: "ok", data: null, error: null });
}
