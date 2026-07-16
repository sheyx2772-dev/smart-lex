import { format } from "@lex/core";
import { type CollectionStage, type Locale, type Money } from "@lex/shared";

export interface ReminderTextInput {
  stage: Extract<CollectionStage, "soft_reminder" | "firm_reminder">;
  locale: Locale;
  debtorName: string;
  amount: Money;
  invoiceNumbers: string[];
  overdueDays: number;
  paymentLink?: string;
  /** Tenant sozlamalaridagi custom shablon (o'zgaruvchilar bilan). Bo'lsa shu ishlatiladi. */
  template?: string;
}

/** Shablon o'zgaruvchilarini almashtiradi: {debtor} {amount} {invoice} {days}. */
export function fillTemplate(
  template: string,
  vars: { debtor: string; amount: string; invoice: string; days: string | number },
): string {
  return template
    .replaceAll("{debtor}", vars.debtor)
    .replaceAll("{amount}", vars.amount)
    .replaceAll("{invoice}", vars.invoice)
    .replaceAll("{days}", String(vars.days));
}

/**
 * Qisqa eslatma matni (SMS/email/telegram). Deterministik — raqamlar chaqiruvchidan.
 * Custom shablon berilsa o'sha ishlatiladi, aks holda standart matn.
 * Bank ssenariysida `paymentLink` matn oxiriga qo'shiladi.
 */
export function generateReminderText(input: ReminderTextInput): string {
  const amount = format(input.amount);
  const invoices = input.invoiceNumbers.join(", ");
  const soft = input.stage === "soft_reminder";

  // Custom shablon (tenant sozlamasidan).
  if (input.template && input.template.trim()) {
    const base = fillTemplate(input.template, {
      debtor: input.debtorName,
      amount,
      invoice: invoices,
      days: input.overdueDays,
    });
    return input.paymentLink ? `${base} ${input.paymentLink}` : base;
  }

  const t: Record<Locale, string> = {
    uz: soft
      ? `Hurmatli ${input.debtorName}, ${invoices} bo'yicha ${amount} to'lov muddati yaqinlashmoqda. Iltimos, o'z vaqtida to'lang.`
      : `Hurmatli ${input.debtorName}, ${invoices} bo'yicha ${amount} to'lov muddati ${input.overdueDays} kun o'tdi. Iltimos, zudlik bilan to'lovni amalga oshiring.`,
    ru: soft
      ? `Уважаемый(ая) ${input.debtorName}, приближается срок оплаты ${amount} по ${invoices}. Просим оплатить своевременно.`
      : `Уважаемый(ая) ${input.debtorName}, оплата ${amount} по ${invoices} просрочена на ${input.overdueDays} дн. Просим срочно погасить задолженность.`,
    en: soft
      ? `Dear ${input.debtorName}, payment of ${amount} for ${invoices} is due soon. Please pay on time.`
      : `Dear ${input.debtorName}, payment of ${amount} for ${invoices} is ${input.overdueDays} days overdue. Please settle it urgently.`,
  };

  const base = t[input.locale];
  return input.paymentLink ? `${base} ${input.paymentLink}` : base;
}
