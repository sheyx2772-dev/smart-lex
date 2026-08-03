import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  actorTypeEnum,
  approvalStatusEnum,
  approvalTypeEnum,
  collectionStageEnum,
  currencyEnum,
  documentTypeEnum,
  localeEnum,
  paymentStatusEnum,
  receivableStatusEnum,
  reminderChannelEnum,
  reminderStatusEnum,
  tenantTypeEnum,
  userRoleEnum,
} from "./enums";

/** Umumiy ustunlar — barcha jadvallarda takrorlanadi. */
const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/** Tenant — multi-tenant izolyatsiyaning ildizi (o'zida tenant_id yo'q). */
export const tenants = pgTable("tenants", {
  id: id(),
  type: tenantTypeEnum("type").notNull(),
  name: text("name").notNull(),
  tin: text("tin").notNull(), // STIR
  legalAddress: text("legal_address"),
  bankAccount: text("bank_account"),
  bankMfo: text("bank_mfo"),
  phone: text("phone"),
  email: text("email"),
  defaultLocale: localeEnum("default_locale").notNull().default("uz"),
  /** Erkin konfiguratsiya: penya default, kanal yoqilishi, shablonlar (3 til). */
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const users = pgTable(
  "users",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    // One-ID (SSO) foydalanuvchilarida parol yo'q — shuning uchun nullable.
    passwordHash: text("password_hash"),
    fullName: text("full_name").notNull(),
    role: userRoleEnum("role").notNull().default("viewer"),
    locale: localeEnum("locale").notNull().default("uz"),
    isActive: boolean("is_active").notNull().default(true),
    // ── One-ID (sso.egov.uz) identifikatori ──
    oneidPin: text("oneid_pin"), // JShShIR (jismoniy shaxs PIN)
    oneidSub: text("oneid_sub"), // One-ID user_id (login)
    // ── cabinet.sud.uz (E-SUD) sessiya tokeni — kengaytma orqali olinadi ──
    // Jonli sessiya kredensiali: muddati tugaydi, 401 kelsa qayta ulanish kerak.
    courtAuthToken: text("court_auth_token"),
    courtAuthTokenAt: timestamp("court_auth_token_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("users_tenant_email_uq").on(t.tenantId, t.email),
    uniqueIndex("users_tenant_oneid_uq").on(t.tenantId, t.oneidPin),
  ],
);

/** Kontragent (qarzdor/hamkor) — Didox/bank profilidan olinadi. */
export const contractors = pgTable(
  "contractors",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tin: text("tin").notNull(), // STIR
    legalAddress: text("legal_address"),
    bankAccount: text("bank_account"),
    bankMfo: text("bank_mfo"),
    phone: text("phone"),
    email: text("email"),
    telegramId: text("telegram_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("contractors_tenant_tin_uq").on(t.tenantId, t.tin),
    index("contractors_tenant_idx").on(t.tenantId),
  ],
);

export const contracts = pgTable(
  "contracts",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    contractorId: uuid("contractor_id")
      .notNull()
      .references(() => contractors.id, { onDelete: "restrict" }),
    number: text("number").notNull(),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    currency: currencyEnum("currency").notNull().default("UZS"),
    /** Kunlik penya stavkasi (basis point). Masalan 5 = 0.05%/kun. */
    penaltyDailyBps: integer("penalty_daily_bps").notNull().default(0),
    /** Penya cap (basis point). null => cheksiz. */
    penaltyCapBps: integer("penalty_cap_bps"),
    /** Sud yurisdiksiyasi haqida shartnoma bandi (Faza 2 uchun). */
    jurisdictionNote: text("jurisdiction_note"),
    didoxId: text("didox_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("contracts_tenant_number_uq").on(t.tenantId, t.number),
    index("contracts_tenant_contractor_idx").on(t.tenantId, t.contractorId),
  ],
);

/** Hujjatlar ombori — S3/MinIO ref + Didox ID. */
export const documents = pgTable(
  "documents",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    type: documentTypeEnum("type").notNull(),
    contractId: uuid("contract_id").references(() => contracts.id, { onDelete: "set null" }),
    contractorId: uuid("contractor_id").references(() => contractors.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    s3Key: text("s3_key"),
    didoxId: text("didox_id"),
    /** OCR/tahlildan olingan strukturaviy ma'lumot. */
    extracted: jsonb("extracted").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("documents_tenant_type_idx").on(t.tenantId, t.type)],
);

export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id").references(() => contracts.id, { onDelete: "set null" }),
    contractorId: uuid("contractor_id")
      .notNull()
      .references(() => contractors.id, { onDelete: "restrict" }),
    number: text("number").notNull(),
    /** Summa eng kichik birlikda (tiyin). */
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: currencyEnum("currency").notNull().default("UZS"),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    didoxId: text("didox_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("invoices_tenant_number_uq").on(t.tenantId, t.number),
    index("invoices_tenant_due_idx").on(t.tenantId, t.dueDate),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: currencyEnum("currency").notNull().default("UZS"),
    status: paymentStatusEnum("status").notNull().default("received"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("payments_tenant_invoice_idx").on(t.tenantId, t.invoiceId)],
);

/**
 * Debitorlik snapshot — core.evaluateReceivable natijasi shu yerga yoziladi (cache).
 * Har invoice uchun bitta yozuv.
 */
export const receivables = pgTable(
  "receivables",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    contractorId: uuid("contractor_id")
      .notNull()
      .references(() => contractors.id, { onDelete: "restrict" }),
    status: receivableStatusEnum("status").notNull(),
    outstandingMinor: bigint("outstanding_minor", { mode: "bigint" }).notNull(),
    penaltyMinor: bigint("penalty_minor", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    currency: currencyEnum("currency").notNull().default("UZS"),
    overdueDays: integer("overdue_days").notNull().default(0),
    agingBucket: text("aging_bucket").notNull().default("current"),
    riskScore: integer("risk_score").notNull().default(0),
    /** Bajarilgan collection bosqichlari (takroran ishga tushmasligi uchun). */
    executedStages: jsonb("executed_stages").$type<string[]>().notNull().default([]),
    lastEvaluatedAt: timestamp("last_evaluated_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("receivables_invoice_uq").on(t.invoiceId),
    index("receivables_tenant_status_idx").on(t.tenantId, t.status),
  ],
);

/** Collection siyosati (tenant bo'yicha bosqichlar). */
export const collectionRules = pgTable("collection_rules", {
  id: id(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** CollectionStep[] JSON: [{ stage, offsetDays, requiresApproval }]. */
  steps: jsonb("steps").$type<unknown[]>().notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const reminders = pgTable(
  "reminders",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    receivableId: uuid("receivable_id")
      .notNull()
      .references(() => receivables.id, { onDelete: "cascade" }),
    stage: collectionStageEnum("stage").notNull(),
    channel: reminderChannelEnum("channel").notNull(),
    status: reminderStatusEnum("status").notNull().default("queued"),
    address: text("address").notNull(),
    body: text("body").notNull(),
    /** Bank ssenariysi uchun to'lov linki. */
    paymentLink: text("payment_link"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("reminders_tenant_receivable_idx").on(t.tenantId, t.receivableId)],
);

/** Rahbar tasdig'ini talab qiladigan huquqiy ahamiyatli qadamlar. */
export const approvalRequests = pgTable(
  "approval_requests",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    type: approvalTypeEnum("type").notNull(),
    status: approvalStatusEnum("status").notNull().default("pending"),
    receivableId: uuid("receivable_id").references(() => receivables.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    /** Tasdiqlanadigan tarkib (talabnoma matni, hisob-kitob va h.k.). */
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    decidedByUserId: uuid("decided_by_user_id").references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("approvals_tenant_status_idx").on(t.tenantId, t.status)],
);

/** Audit log — har bir AI/foydalanuvchi/tizim harakati (majburiy, xavfsizlik). */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    actorType: actorTypeEnum("actor_type").notNull(),
    actorId: text("actor_id"), // user id yoki agent nomi
    action: text("action").notNull(), // masalan "receivable.marked_overdue"
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_tenant_created_idx").on(t.tenantId, t.createdAt)],
);

/**
 * Platformaga (AI agentga) biriktirilgan topshiriqlar — foydalanuvchi agentga
 * ish beradi (tahlil, risk baholash, talabnoma tayyorlash...), muddat bilan.
 * Agent bajaradi va natijani yozadi.
 */
export const agentTasks = pgTable(
  "agent_tasks",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    action: text("action").notNull(), // analyze | score | demand | custom
    title: text("title").notNull(),
    receivableId: uuid("receivable_id").references(() => receivables.id, { onDelete: "set null" }),
    deadline: timestamp("deadline", { withTimezone: true }),
    status: text("status").notNull().default("pending"), // pending | done | failed
    result: text("result"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("agent_tasks_tenant_status_idx").on(t.tenantId, t.status)],
);
