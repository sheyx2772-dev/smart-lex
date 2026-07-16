import { type ApiResponse } from "@lex/shared";
import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/i18n/config";

const API_URL = process.env.API_URL ?? "http://localhost:3001";
export const TOKEN_COOKIE = "LEX_TOKEN";

/**
 * Server-komponentlar uchun backend chaqiruvi. Token (httpOnly cookie) va til (X-Lang)
 * avtomatik qo'shiladi. SSR-heavy yondashuv: ma'lumot server tomonda olinadi.
 */
export async function apiServer<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const store = await cookies();
  const token = store.get(TOKEN_COOKIE)?.value;
  const locale = store.get(LOCALE_COOKIE)?.value ?? "uz";

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Lang": locale,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  return (await res.json()) as ApiResponse<T>;
}

export { API_URL };
