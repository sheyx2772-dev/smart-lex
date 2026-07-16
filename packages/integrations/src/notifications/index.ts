import { type ReminderChannel } from "@lex/shared";
import { EskizNotifier } from "./eskiz";
import { MockNotifier } from "./mock";
import { type Notifier } from "./types";

export * from "./types";
export { MockNotifier } from "./mock";
export { EskizNotifier } from "./eskiz";

/**
 * Kanal uchun mos notifier yaratadi.
 * - SMS: Eskiz kalitlari (ESKIZ_TOKEN yoki ESKIZ_EMAIL+ESKIZ_PASSWORD) sozlangan bo'lsa
 *   — REAL Eskiz.uz; aks holda mock.
 * - Boshqa kanallar (email/telegram/hybrid): hozircha mock (real provayder shu yerda ulanadi).
 */
export function createNotifier(channel: ReminderChannel): Notifier {
  if (channel === "sms" && (process.env.ESKIZ_TOKEN || (process.env.ESKIZ_EMAIL && process.env.ESKIZ_PASSWORD))) {
    return new EskizNotifier({
      email: process.env.ESKIZ_EMAIL,
      password: process.env.ESKIZ_PASSWORD,
      token: process.env.ESKIZ_TOKEN,
      from: process.env.SMS_FROM,
      baseUrl: process.env.ESKIZ_BASE_URL,
    });
  }
  return new MockNotifier(channel);
}
