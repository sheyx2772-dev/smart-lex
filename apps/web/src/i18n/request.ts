import { cookies } from "next/headers";
import { IntlErrorCode } from "next-intl";
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
    // Yetishmayotgan tarjima kaliti butun komponentni QULATMASIN.
    // Ilgari next-intl default holatда throw qilar edi va sahifa ishlamay qolardi.
    onError(error) {
      if (error.code === IntlErrorCode.MISSING_MESSAGE) {
        if (process.env.NODE_ENV === "development") {
          console.warn(`[i18n] Yetishmayotgan kalit: ${error.message}`);
        }
        return; // jim yutamiz — crash bo'lmaydi
      }
      console.error(error);
    },
    // Kalit topilmasa: xom throw o'rniga to'liq kalit yo'lini ko'rsatamiz.
    getMessageFallback({ key, namespace }) {
      return namespace ? `${namespace}.${key}` : key;
    },
  };
});
