/**
 * Qo'llab-quvvatlanadigan tillar. Butun tizim (front + back) shu ro'yxatga tayanadi.
 */
export const LOCALES = ["uz", "ru", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "uz";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * HTTP header'dan (`X-Lang` yoki `Accept-Language`) tilni ajratadi.
 * Noto'g'ri/bo'sh bo'lsa DEFAULT_LOCALE qaytadi.
 *
 * @example parseLocale("ru")                 -> "ru"
 * @example parseLocale("en-US,en;q=0.9")     -> "en"
 * @example parseLocale(null)                 -> "uz"
 */
export function parseLocale(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;

  const candidates = header
    .split(",")
    .map((part) => part.split(";")[0]?.trim().slice(0, 2).toLowerCase())
    .filter((code): code is string => Boolean(code));

  for (const code of candidates) {
    if (isLocale(code)) return code;
  }
  return DEFAULT_LOCALE;
}
