import { type ReminderChannel } from "@lex/shared";
import { type Notifier, type NotificationRequest, type NotificationResult } from "./types";

/**
 * MOCK notifier — real SMS/email/telegram provayderlari ulanmaguncha.
 * Yuborilgan xabarlarni xotirada saqlaydi (test/E2E tekshiruvi uchun) va log qiladi.
 */
export class MockNotifier implements Notifier {
  static readonly outbox: (NotificationRequest & { at: string })[] = [];

  constructor(readonly channel: ReminderChannel) {}

  async send(request: NotificationRequest): Promise<NotificationResult> {
    MockNotifier.outbox.push({ ...request, at: new Date().toISOString() });
    const link = request.paymentLink ? ` [link: ${request.paymentLink}]` : "";
    console.log(`[notify:${this.channel}] -> ${request.address}: ${request.body}${link}`);
    return { status: "sent", providerId: `mock-${MockNotifier.outbox.length}` };
  }
}
