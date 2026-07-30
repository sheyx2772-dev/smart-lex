import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/i18n/config";
import { API_URL, TOKEN_COOKIE } from "@/lib/api";

// Streaming yo'lini har doim dinamik ishlatamiz (cache yo'q).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Studio AI streaming-proxy: httpOnly `LEX_TOKEN` cookie serverda o'qiladi,
 * backend `/api/studio/ai/stream` ga Bearer bilan uzatiladi va oqim
 * (text/plain chunked) o'zgarishsiz brauzerga qaytariladi. Token JS'ga chiqmaydi.
 */
export async function POST(req: Request): Promise<Response> {
  const store = await cookies();
  const token = store.get(TOKEN_COOKIE)?.value;
  const locale = store.get(LOCALE_COOKIE)?.value ?? "uz";
  const body = await req.text();

  const upstream = await fetch(`${API_URL}/api/studio/ai/stream`, {
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
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
