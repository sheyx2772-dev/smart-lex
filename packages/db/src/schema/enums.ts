import {
  ACTOR_TYPES,
  APPROVAL_STATUSES,
  APPROVAL_TYPES,
  COLLECTION_STAGES,
  CURRENCIES,
  DOCUMENT_TYPES,
  LOCALES,
  PAYMENT_STATUSES,
  RECEIVABLE_STATUSES,
  REMINDER_CHANNELS,
  REMINDER_STATUSES,
  TENANT_TYPES,
  USER_ROLES,
} from "@lex/shared";
import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Drizzle pgEnum uchun readonly tuple'ni mutable tuple'ga aylantiradi, LEKIN literal
 * union tipini saqlaydi (ustunlar `string` emas, aniq union bo'lishi uchun).
 */
const tuple = <T extends readonly [string, ...string[]]>(v: T) =>
  [...v] as [T[number], ...T[number][]];

export const tenantTypeEnum = pgEnum("tenant_type", tuple(TENANT_TYPES));
export const userRoleEnum = pgEnum("user_role", tuple(USER_ROLES));
export const localeEnum = pgEnum("locale", tuple(LOCALES));
export const currencyEnum = pgEnum("currency", tuple(CURRENCIES));
export const documentTypeEnum = pgEnum("document_type", tuple(DOCUMENT_TYPES));
export const receivableStatusEnum = pgEnum("receivable_status", tuple(RECEIVABLE_STATUSES));
export const paymentStatusEnum = pgEnum("payment_status", tuple(PAYMENT_STATUSES));
export const reminderChannelEnum = pgEnum("reminder_channel", tuple(REMINDER_CHANNELS));
export const reminderStatusEnum = pgEnum("reminder_status", tuple(REMINDER_STATUSES));
export const collectionStageEnum = pgEnum("collection_stage", tuple(COLLECTION_STAGES));
export const approvalTypeEnum = pgEnum("approval_type", tuple(APPROVAL_TYPES));
export const approvalStatusEnum = pgEnum("approval_status", tuple(APPROVAL_STATUSES));
export const actorTypeEnum = pgEnum("actor_type", tuple(ACTOR_TYPES));
