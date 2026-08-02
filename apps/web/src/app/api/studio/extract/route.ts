import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/i18n/config";
import { API_URL, TOKEN_COOKIE } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fayldan matn ajratish proxy: klient {data(base64), mimeType} yuboradi, backend
 * (Gemini) matnni qaytaradi. httpOnly token serverда o'qiladi (JS'ga chiqmaydi).
 */
export async function POST(req: Request): Promise<Response> {
  const store = await cookies();
  const token = store.get(TOKEN_COOKIE)?.value;
  const locale = store.get(LOCALE_COOKIE)?.value ?? "uz";
  const body = await req.text();

  const upstream = await fetch(`${API_URL}/api/studio/extract`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Lang": locale,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
    cache: "no-store",
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
