import { type ReminderChannel } from "./enums";

/** Valyuta kodi (ISO 4217). Hozircha O'zbekiston so'mi asosiy. */
export const CURRENCIES = ["UZS", "USD", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = "UZS";

/**
 * Pul miqdori — HAR DOIM eng kichik birlikda (tiyin/sent) butun son sifatida saqlanadi.
 * Suzuvchi nuqta (float) ishlatilmaydi. Serializatsiya uchun `minor` string bo'lishi mumkin
 * (katta summalar `bigint` chegarasidan oshmasligi uchun DB'da numeric/bigint).
 */
export interface Money {
  /** Eng kichik birlikdagi miqdor (masalan 1 so'm = 100 tiyin). */
  minor: bigint;
  currency: Currency;
}

/** Kontragent rekvizitlari (Didox/bank profilidan olinadi). */
export interface ContractorRequisites {
  name: string;
  /** STIR (INN) — soliq to'lovchi identifikatsiya raqami. */
  tin: string;
  legalAddress: string;
  bankAccount?: string;
  bankMfo?: string;
  phone?: string;
  email?: string;
}

/** Eslatma yuborish uchun aloqa kanali va manzili. */
export interface ContactPoint {
  channel: ReminderChannel;
  address: string; // telefon raqami, email yoki telegram id
}
