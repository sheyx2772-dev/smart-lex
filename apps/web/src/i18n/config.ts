export const locales = ["uz", "ru", "en"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "uz";

/** Til tanlovi shu cookie'da saqlanadi (URL prefiksiz — ichki ilova uchun toza). */
export const LOCALE_COOKIE = "LEX_LOCALE";

export const localeNames: Record<AppLocale, string> = {
  uz: "O'zbekcha",
  ru: "Русский",
  en: "English",
};
