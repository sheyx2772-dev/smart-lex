import { DEFAULT_LOCALE, type Locale } from "./locales";

/**
 * Backend xabarlari katalogi. Har action tarjima qilingan `message` qaytaradi.
 * Har kalit uchun 3 til majburiy (uz/ru/en) — tip darajasida kafolatlanadi.
 *
 * Foydalanish: `t("auth.invalid_credentials", locale)`.
 * Parametrli xabar: `t("receivable.overdue_days", locale, { days: 5 })`
 * (matn ichida `{days}` almashtiriladi).
 */
type Translations = Record<Locale, string>;

export const MESSAGES = {
  // ── Umumiy ──────────────────────────────────────────────
  "common.ok": {
    uz: "Muvaffaqiyatli",
    ru: "Успешно",
    en: "Success",
  },
  "common.created": {
    uz: "Muvaffaqiyatli yaratildi",
    ru: "Успешно создано",
    en: "Created successfully",
  },
  "common.updated": {
    uz: "Muvaffaqiyatli yangilandi",
    ru: "Успешно обновлено",
    en: "Updated successfully",
  },
  "common.deleted": {
    uz: "Muvaffaqiyatli o'chirildi",
    ru: "Успешно удалено",
    en: "Deleted successfully",
  },
  "common.not_found": {
    uz: "Topilmadi",
    ru: "Не найдено",
    en: "Not found",
  },
  "common.internal_error": {
    uz: "Ichki xatolik yuz berdi",
    ru: "Произошла внутренняя ошибка",
    en: "An internal error occurred",
  },
  "integrations.didox_reconnect": {
    uz: "Didox ulanishi muddati tugagan yoki kalit yaroqsiz. Sozlamalar → Didox'ga ulanish orqali kalitni yangilang.",
    ru: "Сессия Didox истекла или ключ недействителен. Обновите ключ в Настройки → Подключить Didox.",
    en: "Didox session expired or key is invalid. Reconnect via Settings → Connect Didox.",
  },
  "integrations.didox_connected": {
    uz: "Didox'ga muvaffaqiyatli ulandi",
    ru: "Успешно подключено к Didox",
    en: "Connected to Didox successfully",
  },
  "integrations.didox_connect_failed": {
    uz: "Didox'ga ulanib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.",
    ru: "Не удалось подключиться к Didox. Повторите попытку позже.",
    en: "Could not connect to Didox. Please try again later.",
  },
  "integrations.didox_tin_missing": {
    uz: "Kompaniya STIR raqami sozlanmagan — avval Kompaniya bo'limida to'ldiring.",
    ru: "Не указан ИНН компании — сначала заполните раздел «Компания».",
    en: "Company TIN is not set — fill it in the Company section first.",
  },
  "integrations.didox_not_configured": {
    uz: "Didox partner integratsiyasi hali sozlanmagan",
    ru: "Партнёрская интеграция Didox ещё не настроена",
    en: "Didox partner integration is not configured yet",
  },
  "common.validation_failed": {
    uz: "Ma'lumotlar noto'g'ri",
    ru: "Ошибка валидации данных",
    en: "Validation failed",
  },

  // ── Auth ────────────────────────────────────────────────
  "auth.unauthorized": {
    uz: "Avtorizatsiya talab qilinadi",
    ru: "Требуется авторизация",
    en: "Authorization required",
  },
  "auth.forbidden": {
    uz: "Ruxsat yo'q",
    ru: "Доступ запрещён",
    en: "Access forbidden",
  },
  "auth.invalid_credentials": {
    uz: "Login yoki parol noto'g'ri",
    ru: "Неверный логин или пароль",
    en: "Invalid login or password",
  },
  "auth.login_success": {
    uz: "Tizimga muvaffaqiyatli kirdingiz",
    ru: "Вы успешно вошли в систему",
    en: "Logged in successfully",
  },

  // ── Debitorlik / Receivable ─────────────────────────────
  "receivable.overdue": {
    uz: "To'lov muddati o'tgan",
    ru: "Срок оплаты просрочен",
    en: "Payment is overdue",
  },
  "receivable.overdue_days": {
    uz: "To'lov muddati {days} kun o'tgan",
    ru: "Срок оплаты просрочен на {days} дн.",
    en: "Payment is overdue by {days} days",
  },
  "receivable.paid": {
    uz: "To'lov amalga oshirilgan",
    ru: "Оплата произведена",
    en: "Payment completed",
  },

  // ── Eslatma / Collection ────────────────────────────────
  "reminder.sent": {
    uz: "Eslatma yuborildi",
    ru: "Напоминание отправлено",
    en: "Reminder sent",
  },
  "reminder.queued": {
    uz: "Eslatma navbatga qo'yildi",
    ru: "Напоминание поставлено в очередь",
    en: "Reminder queued",
  },

  // ── Talabnoma / Legal ───────────────────────────────────
  "demand.generated": {
    uz: "Talabnoma tayyorlandi va tasdiqlash kutmoqda",
    ru: "Претензия сформирована и ожидает подтверждения",
    en: "Demand letter generated and awaiting approval",
  },
  "demand.approved": {
    uz: "Talabnoma tasdiqlandi",
    ru: "Претензия подтверждена",
    en: "Demand letter approved",
  },

  // ── Tasdiq / Approval ───────────────────────────────────
  "approval.pending": {
    uz: "Tasdiqlash kutilmoqda",
    ru: "Ожидает подтверждения",
    en: "Awaiting approval",
  },
} as const satisfies Record<string, Translations>;

export type MessageKey = keyof typeof MESSAGES;

/**
 * Xabar kalitini tanlangan tilga tarjima qiladi va `{param}` o'rinbosarlarni to'ldiradi.
 * Til topilmasa DEFAULT_LOCALE ishlatiladi.
 */
export function t(
  key: MessageKey,
  locale: Locale = DEFAULT_LOCALE,
  params?: Record<string, string | number>,
): string {
  const entry = MESSAGES[key];
  let text: string = entry[locale] ?? entry[DEFAULT_LOCALE];

  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}
