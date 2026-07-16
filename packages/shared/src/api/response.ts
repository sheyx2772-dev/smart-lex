import { type Locale } from "../i18n/locales";
import { type MessageKey, t } from "../i18n/messages";

/**
 * Barcha backend action'lari uchun yagona javob formati.
 * `message` — foydalanuvchi tanlagan tildagi matn (i18n).
 * `data` — muvaffaqiyatli natija; `error` — mashina o'qiy oladigan xatolik kodi.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T | null;
  error: ApiError | null;
}

export interface ApiError {
  /** Barqaror mashina-kodi, masalan "NOT_FOUND", "VALIDATION_FAILED". */
  code: string;
  /** Ixtiyoriy maydon-daraja xatoliklari (forma validatsiyasi uchun). */
  fields?: Record<string, string>;
}

/** Muvaffaqiyatli javob. */
export function ok<T>(
  data: T,
  messageKey: MessageKey,
  locale: Locale,
  params?: Record<string, string | number>,
): ApiResponse<T> {
  return {
    success: true,
    message: t(messageKey, locale, params),
    data,
    error: null,
  };
}

/** Xatolik javobi. */
export function fail(
  code: string,
  messageKey: MessageKey,
  locale: Locale,
  options?: {
    fields?: Record<string, string>;
    params?: Record<string, string | number>;
  },
): ApiResponse<never> {
  return {
    success: false,
    message: t(messageKey, locale, options?.params),
    data: null,
    error: { code, fields: options?.fields },
  };
}

/** HTTP status ↔ standart xatolik kodlari. */
export const ERROR_CODE = {
  VALIDATION_FAILED: "VALIDATION_FAILED",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL: "INTERNAL",
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];
