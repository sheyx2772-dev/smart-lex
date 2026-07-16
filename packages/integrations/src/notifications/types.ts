import { type ReminderChannel } from "@lex/shared";

export interface NotificationRequest {
  channel: ReminderChannel;
  /** Telefon / email / telegram id / pochta manzili. */
  address: string;
  body: string;
  /** Bank ssenariysi uchun to'lov linki (SMS ichida yuboriladi). */
  paymentLink?: string;
}

export interface NotificationResult {
  status: "sent" | "failed";
  /** Provayder tomonidan qaytarilgan xabar ID (kuzatuv uchun). */
  providerId?: string;
  error?: string;
}

/** Bitta kanal orqali xabar yuboruvchi. */
export interface Notifier {
  readonly channel: ReminderChannel;
  send(request: NotificationRequest): Promise<NotificationResult>;
}
