import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/i18n/config";
import { API_URL, TOKEN_COOKIE } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bank/komplayens PDF hisobotini backend'dan olib, brauzerga o'tkazadi (auth cookie'dan). */
export async function GET(): Promise<Response> {
  const store = await cookies();
  const token = store.get(TOKEN_COOKIE)?.value;
  const locale = store.get(LOCALE_COOKIE)?.value ?? "uz";

  const upstream = await fetch(`${API_URL}/api/audit/report`, {
    headers: { "X-Lang": locale, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    cache: "no-store",
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/pdf",
      "Content-Disposition": upstream.headers.get("Content-Disposition") ?? "attachment",
      "Cache-Control": "no-store",
    },
  });
}
