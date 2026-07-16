import { type ReminderChannel } from "@lex/shared";
import { type NotificationRequest, type NotificationResult, type Notifier } from "./types";

/**
 * Eskiz.uz real SMS provayderi.
 *
 * Auth: email+password → JWT token (~30 kun, xotirada keshlanadi), yoki to'g'ridan-to'g'ri token.
 * Yuborish: POST /message/sms/send (Bearer token).
 *
 * Kalit/parol bo'lmasa `createNotifier` mock'ga tushadi — shuning uchun bu adapter
 * faqat env sozlanganda ishga tushadi (Groq/Didox patterni).
 */
export interface EskizConfig {
  email?: string;
  password?: string;
  token?: string;
  from?: string;
  baseUrl?: string;
}

export class EskizNotifier implements Notifier {
  readonly channel: ReminderChannel = "sms";
  private static cachedToken: string | null = null;

  constructor(private readonly cfg: EskizConfig) {}

  private base(): string {
    return (this.cfg.baseUrl ?? "https://notify.eskiz.uz/api").replace(/\/$/, "");
  }

  private async getToken(): Promise<string> {
    if (this.cfg.token) return this.cfg.token;
    if (EskizNotifier.cachedToken) return EskizNotifier.cachedToken;
    const res = await fetch(`${this.base()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: this.cfg.email, password: this.cfg.password }),
    });
    const data = (await res.json().catch(() => ({}))) as { data?: { token?: string }; message?: string };
    const token = data?.data?.token;
    if (!token) throw new Error(`Eskiz auth failed: ${data?.message ?? res.status}`);
    EskizNotifier.cachedToken = token;
    return token;
  }

  async send(request: NotificationRequest): Promise<NotificationResult> {
    try {
      const phone = request.address.replace(/\D/g, ""); // 998XXXXXXXXX
      if (!phone) return { status: "failed", error: "empty phone" };
      const message = request.paymentLink ? `${request.body} ${request.paymentLink}` : request.body;
      const from = this.cfg.from ?? "4546";

      const doSend = (tk: string) =>
        fetch(`${this.base()}/message/sms/send`, {
          method: "POST",
          headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
          body: JSON.stringify({ mobile_phone: phone, message, from }),
        });

      let token = await this.getToken();
      let res = await doSend(token);
      if (res.status === 401) {
        // Token eskirdi — yangilaymiz.
        EskizNotifier.cachedToken = null;
        token = await this.getToken();
        res = await doSend(token);
      }
      const data = (await res.json().catch(() => ({}))) as { status?: string; id?: string | number; message?: string };
      if (res.ok && (data.status === "waiting" || data.status === "success" || data.id != null)) {
        return { status: "sent", providerId: data.id != null ? String(data.id) : undefined };
      }
      return { status: "failed", error: data.message ?? `HTTP ${res.status}` };
    } catch (e) {
      return { status: "failed", error: e instanceof Error ? e.message : "eskiz error" };
    }
  }
}
