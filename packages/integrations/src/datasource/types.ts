import { type Currency, type DocumentType } from "@lex/shared";

/**
 * Tashqi (Didox/bank) manbadan olinadigan NORMALLASHTIRILGAN ma'lumot.
 * Document Agent shu DTO'larni domen bazasiga (kontragent/shartnoma/invoice) joylaydi.
 * Real Didox API kelganda faqat mock implementatsiya real bilan almashtiriladi —
 * interfeys o'zgarmaydi.
 */

export interface ExternalContractor {
  name: string;
  tin: string; // STIR
  legalAddress?: string;
  phone?: string;
  email?: string;
  telegramId?: string;
}

export interface ExternalContract {
  number: string;
  contractorTin: string;
  signedAt: string; // ISO
  penaltyDailyBps: number;
  penaltyCapBps?: number;
  didoxId?: string;
}

export interface ExternalInvoice {
  number: string;
  contractNumber: string;
  contractorTin: string;
  amountMinor: string; // bigint string (JSON xavfsiz)
  currency: Currency;
  issuedAt: string; // ISO
  dueDate: string; // ISO
  didoxId?: string;
}

export interface ExternalPayment {
  invoiceNumber: string;
  amountMinor: string; // bigint string
  paidAt: string; // ISO
}

export interface ExternalDocument {
  didoxId: string;
  type: DocumentType;
  title: string;
  contractNumber?: string;
  contractorTin?: string;
}

/** Bir tenant uchun tashqi manbadan sinxronlanadigan to'liq to'plam. */
export interface DataSourceSnapshot {
  contractors: ExternalContractor[];
  contracts: ExternalContract[];
  invoices: ExternalInvoice[];
  payments: ExternalPayment[];
  documents: ExternalDocument[];
}

/**
 * Qarz manbai adapteri. Tenant tipiga qarab tanlanadi:
 *  - company/marketplace/government => Didox
 *  - bank => bank kredit reyestri
 */
export interface DataSource {
  readonly name: string;
  /** Berilgan sanadan keyingi o'zgarishlarni oladi (incremental sync). */
  fetchSnapshot(since?: Date): Promise<DataSourceSnapshot>;
}
