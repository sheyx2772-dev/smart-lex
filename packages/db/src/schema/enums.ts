import {
  ACTOR_TYPES,
  APPROVAL_STATUSES,
  APPROVAL_TYPES,
  CASE_STATES,
  COLLECTION_STAGES,
  CURRENCIES,
  DOCUMENT_TYPES,
  LOCALES,
  OVERRIDE_STATUSES,
  OVERRIDE_TYPES,
  PAYMENT_STATUSES,
  PROMISE_STATUSES,
  PROMISE_TYPES,
  RECEIVABLE_STATUSES,
  REMINDER_CHANNELS,
  REMINDER_STATUSES,
  STRATEGY_TYPES,
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
export const caseStateEnum = pgEnum("case_state", tuple(CASE_STATES));
export const strategyTypeEnum = pgEnum("strategy_type", tuple(STRATEGY_TYPES));
export const overrideTypeEnum = pgEnum("override_type", tuple(OVERRIDE_TYPES));
export const overrideStatusEnum = pgEnum("override_status", tuple(OVERRIDE_STATUSES));
export const promiseTypeEnum = pgEnum("promise_type", tuple(PROMISE_TYPES));
export const promiseStatusEnum = pgEnum("promise_status", tuple(PROMISE_STATUSES));
