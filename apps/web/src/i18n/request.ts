import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, LOCALE_COOKIE, locales, type AppLocale } from "./config";

/** Cookie'dan tilni oladi (URL prefiksiz). SSR uchun har so'rovda o'qiladi. */
export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value as AppLocale | undefined;
  const locale = cookieLocale && locales.includes(cookieLocale) ? cookieLocale : defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
