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
  caseStateEnum,
  collectionStageEnum,
  currencyEnum,
  documentTypeEnum,
  financingListingStatusEnum,
  legalMatterStatusEnum,
  localeEnum,
  overrideStatusEnum,
  overrideTypeEnum,
  paymentStatusEnum,
  promiseStatusEnum,
  promiseTypeEnum,
  receivableStatusEnum,
  reminderChannelEnum,
  reminderStatusEnum,
  strategyTypeEnum,
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
    /** Hujjat tarkibining SHA-256 barmoq izi (yaratilganda DB trigger to'ldiradi) —
     * keyinchalik hujjat o'zgarmaganini tasdiqlash uchun. */
    contentHash: text("content_hash"),
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

/**
 * Kreditorlik — tenantning O'Z qarzi (u kimgadir qarzdor: xarid qilingan tovar/xizmat
 * uchun to'lanmagan hisob-faktura). Didox sinxronizatsiyasida "kiruvchi" (owner=0)
 * hujjatlar shu yerga tushadi — receivables'ga HECH QACHON qo'shilmaydi, aks holda
 * AI agent tenantning o'z yetkazib beruvchisiga xato ravishda da'vo/talabnoma yuboradi.
 * Faqat kuzatuv uchun (debit-kredit nazorati) — undiruv jarayoni ishlamaydi.
 */
export const payables = pgTable(
  "payables",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
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
    uniqueIndex("payables_tenant_number_uq").on(t.tenantId, t.number),
    index("payables_tenant_due_idx").on(t.tenantId, t.dueDate),
  ],
);

/** Yuridik ish (Legal Matter) — "Yuridik" ish rejimi uchun umumiy yuridik jarayon
 * (qarz undirishga bog'liq emas — debt_cases'dan butunlay mustaqil). Kontragent,
 * shartnoma va hujjatga bog'lanishi ixtiyoriy — sof huquqiy so'rov (masalan
 * shartnoma tekshiruvi) hech qaysi biriga ega bo'lmasligi mumkin. */
export const legalMatters = pgTable(
  "legal_matters",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    matterNumber: text("matter_number").notNull(),
    title: text("title").notNull(),
    /** "contract_review" | "litigation" | "consultation" | "compliance" | "other" — erkin matn, yangi turlar uchun migratsiya kerak emas. */
    type: text("type").notNull(),
    status: legalMatterStatusEnum("status").notNull().default("new"),
    /** "low" | "normal" | "high" | "urgent" */
    priority: text("priority").notNull().default("normal"),
    /** null | "low" | "medium" | "high" | "critical" */
    riskLevel: text("risk_level"),
    contractorId: uuid("contractor_id").references(() => contractors.id, { onDelete: "set null" }),
    contractId: uuid("contract_id").references(() => contracts.id, { onDelete: "set null" }),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    assignedUserId: uuid("assigned_user_id").references(() => users.id, { onDelete: "set null" }),
    description: text("description"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    /** Erkin qo'shimcha holat (AI omillar, tarix) — Phase 1'da yangi migratsiyasiz kengaytirish uchun. */
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("legal_matters_tenant_number_uq").on(t.tenantId, t.matterNumber),
    index("legal_matters_tenant_status_idx").on(t.tenantId, t.status),
    index("legal_matters_tenant_due_idx").on(t.tenantId, t.dueDate),
  ],
);

/** "AI Vazifalari" navbati — Yuridik AI Agent proaktiv aniqlagan harakat kerak bo'lgan
 * narsalar (muddat, yangi hujjat tahlili, shartnoma band muammosi). Mavjud debt-only
 * `agent_tasks`dan butunlay mustaqil — uni almashtirmaydi, unga tegilmaydi. */
export const legalAgentTasks = pgTable(
  "legal_agent_tasks",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** "urgent" (🔴 muddat) | "recommendation" (🟠 tavsiya) | "auto_check" (🔵 avtomatik tekshiruv) */
    category: text("category").notNull(),
    title: text("title").notNull(),
    /** AI'ning bir gaplik asosi — nega bu vazifa yaratildi. */
    reason: text("reason").notNull(),
    legalMatterId: uuid("legal_matter_id").references(() => legalMatters.id, { onDelete: "cascade" }),
    contractorId: uuid("contractor_id").references(() => contractors.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "cascade" }),
    /** "pending" | "done" | "dismissed" */
    status: text("status").notNull().default("pending"),
    /** Generator turi — bir xil sabab bo'yicha takror vazifa yaratilmasligi uchun (source, sourceKey) unique. */
    source: text("source").notNull(),
    sourceKey: text("source_key").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("legal_agent_tasks_source_uq").on(t.tenantId, t.source, t.sourceKey),
    index("legal_agent_tasks_tenant_status_idx").on(t.tenantId, t.status),
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

/**
 * "Va'da qilingan to'lov" (Promise-to-Pay) — qarzdor AI kelishuv (/pay/:id/negotiate)
 * orqali taklifni QABUL qilganda yoziladi. Kunlik worker muddati o'tgan-u to'lanmagan
 * va'dalarni "broken" deb belgilaydi va inson tasdig'i uchun override yaratadi
 * (strategiyani kuchaytirish tavsiyasi) — undiruv sikli shu orqali yopiladi.
 */
export const paymentPromises = pgTable(
  "payment_promises",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    receivableId: uuid("receivable_id")
      .notNull()
      .references(() => receivables.id, { onDelete: "cascade" }),
    type: promiseTypeEnum("type").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    status: promiseStatusEnum("status").notNull().default("pending"),
    offerText: text("offer_text").notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("promises_tenant_receivable_idx").on(t.tenantId, t.receivableId),
    index("promises_tenant_status_due_idx").on(t.tenantId, t.status, t.dueDate),
  ],
);

/**
 * Moliyalashtirish bozori (factoring marketplace) — mijoz DS-Score bilan tasdiqlangan
 * qarzini bank/NBKT xaridorlariga ko'rsatish uchun ro'yxatga qo'yadi. SmartLex bu yerda
 * pul yoki talab huquqini O'ZIGA OLMAYDI — faqat moslashtiradi (Ishonchli Reestr modeli).
 * Haqiqiy bitim (moliyalashtirish + talab tsessiyasi) platformadan tashqarida, xaridor
 * bilan to'g'ridan-to'g'ri amalga oshadi; matchedPartnerName/discount shuni qo'lda
 * (MC Legal tomonidan) qayd etish uchun.
 */
export const financingListings = pgTable(
  "financing_listings",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    receivableId: uuid("receivable_id")
      .notNull()
      .references(() => receivables.id, { onDelete: "cascade" }),
    status: financingListingStatusEnum("status").notNull().default("listed"),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: currencyEnum("currency").notNull(),
    /** Ro'yxatga qo'yilgan paytdagi risk-skor snapshoti (keyin o'zgarsa ham tarix saqlanadi). */
    riskScoreAtListing: integer("risk_score_at_listing").notNull(),
    suggestedDiscountBps: integer("suggested_discount_bps").notNull(),
    /** Sotuvchi o'zi so'ragan stavka (C2FO "Name Your Rate" — taklifni o'zgartirishi mumkin). */
    requestedDiscountBps: integer("requested_discount_bps"),
    matchedPartnerName: text("matched_partner_name"),
    matchedDiscountBps: integer("matched_discount_bps"),
    notes: text("notes"),
    matchedAt: timestamp("matched_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("financing_tenant_status_idx").on(t.tenantId, t.status),
    index("financing_tenant_receivable_idx").on(t.tenantId, t.receivableId),
  ],
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

/**
 * Audit log — har bir AI/foydalanuvchi/tizim harakati (majburiy, xavfsizlik).
 * O'ZGARTIRIB BO'LMAYDIGAN ZANJIR (immutable chain): recordHash/prevHash DB
 * trigger orqali avtomatik hisoblanadi (qarang rls.ts — compute_audit_hash).
 * Har yozuv o'zidan oldingi yozuv hash'iga bog'langan — birortasi orqadan
 * o'zgartirilsa, undan keyingi butun zanjir buziladi va tekshiruvda ko'rinadi.
 */
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
    /** Ushbu yozuvning SHA-256 hash'i (prevHash + tarkib) — DB trigger to'ldiradi. */
    recordHash: text("record_hash"),
    /** Tenant bo'yicha zanjirdagi oldingi yozuvning hash'i (birinchi yozuvda null). */
    prevHash: text("prev_hash"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_tenant_created_idx").on(t.tenantId, t.createdAt)],
);

/**
 * Zanjir "tashqi tasdig'i" (external anchoring) — davriy ravishda audit
 * zanjirining oxirgi (eng so'nggi) hash'i mustaqil, biz nazorat qilmaydigan
 * manbaga (Bitcoin blokcheyni, OpenTimestamps protokoli orqali, bepul)
 * yuboriladi. Shu bilan hatto bazamizga kirish huquqi bo'lgan odam ham
 * butun zanjirni qayta hisoblab, eski sanani "orqaga qaytarib" o'zgartira
 * olmaydi — chunki tashqi tasdiq mustaqil ravishda mavjud.
 */
export const chainAnchors = pgTable(
  "chain_anchors",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** Anchorlangan paytdagi zanjir uchi (auditLogs.recordHash, eng so'nggisi). */
    chainTipHash: text("chain_tip_hash").notNull(),
    /** OpenTimestamps .ots isboti (base64) — Bitcoin blokka tasdiqlanguncha vaqtinchalik. */
    otsProofBase64: text("ots_proof_base64"),
    /** pending — yuborilgan, hali Bitcoin blokida tasdiqlanmagan; confirmed — blokda tasdiqlangan; failed — yuborib bo'lmadi. */
    status: text("status").notNull().default("pending"),
    /** Tasdiqlangan Bitcoin blok balandligi (confirmed bo'lgach). */
    bitcoinBlockHeight: integer("bitcoin_block_height"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("chain_anchors_tenant_created_idx").on(t.tenantId, t.createdAt)],
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

/** Playbook bosqichi — Strategy Agent tomonidan yaratiladi. */
export interface PlaybookPhase {
  phase: number;
  name: string;
  durationDays: number;
  actions: { type: string; template?: string; channel?: string; eImzo?: boolean; aiCopilot?: boolean }[];
  conditions?: { proceedIf?: string; escalateIf?: string };
}

/** Playbook chiqish shartlari. */
export interface PlaybookExitCondition {
  if: string;
  action: string;
  generateReceipt?: boolean;
  after?: string;
}

/**
 * Qarz ishi (Debt Case Object) — avtonom undiruv OS ning markaziy obyekti.
 * Har receivable uchun bitta case (muddati o'tgan qarzlar avtomatik yaratiladi).
 */
export const debtCases = pgTable(
  "debt_cases",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    receivableId: uuid("receivable_id")
      .notNull()
      .references(() => receivables.id, { onDelete: "cascade" }),
    /** Masalan: 2026-0892 */
    caseNumber: text("case_number").notNull(),
    state: caseStateEnum("state").notNull().default("created"),
    /** DS-Score™ (0-100) — undirish ehtimoli va prioritet. */
    dsScore: integer("ds_score").notNull().default(0),
    /** 0..1 recovery probability */
    recoveryProbability: integer("recovery_probability").notNull().default(0),
    recommendedStrategy: strategyTypeEnum("recommended_strategy").notNull().default("standard"),
    recommendedChannels: jsonb("recommended_channels").$type<string[]>().notNull().default([]),
    optimalSettlementPct: integer("optimal_settlement_pct").notNull().default(85),
    estimatedRecoveryDays: integer("estimated_recovery_days").notNull().default(30),
    priorityRank: integer("priority_rank").notNull().default(999),
    currentPhase: integer("current_phase").notNull().default(1),
    /** DS-Score omillari (explainability). */
    scoreFactors: jsonb("score_factors").$type<{ label: string; impact: number }[]>().notNull().default([]),
    startedAt: timestamp("started_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("debt_cases_receivable_uq").on(t.receivableId),
    uniqueIndex("debt_cases_tenant_number_uq").on(t.tenantId, t.caseNumber),
    index("debt_cases_tenant_state_idx").on(t.tenantId, t.state),
    index("debt_cases_tenant_priority_idx").on(t.tenantId, t.priorityRank),
  ],
);

/** Recovery Playbook — Strategy Agent har case uchun yaratadi. */
export const recoveryPlaybooks = pgTable(
  "recovery_playbooks",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    debtCaseId: uuid("debt_case_id")
      .notNull()
      .references(() => debtCases.id, { onDelete: "cascade" }),
    strategyType: strategyTypeEnum("strategy_type").notNull(),
    phases: jsonb("phases").$type<PlaybookPhase[]>().notNull(),
    exitConditions: jsonb("exit_conditions").$type<PlaybookExitCondition[]>().notNull().default([]),
    currentPhase: integer("current_phase").notNull().default(1),
    version: integer("version").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("recovery_playbooks_case_uq").on(t.debtCaseId)],
);

/** Case voqealar jurnali — playbook progress va AI harakatlari. */
export const caseEvents = pgTable(
  "case_events",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    debtCaseId: uuid("debt_case_id")
      .notNull()
      .references(() => debtCases.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    actorType: actorTypeEnum("actor_type").notNull().default("ai_agent"),
    actorId: text("actor_id"),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("case_events_case_created_idx").on(t.debtCaseId, t.createdAt)],
);

/** AI tasdiq so'rovi — inson override interfeysi (settlement, sud, write-off). */
export const pendingOverrides = pgTable(
  "pending_overrides",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    debtCaseId: uuid("debt_case_id")
      .notNull()
      .references(() => debtCases.id, { onDelete: "cascade" }),
    type: overrideTypeEnum("type").notNull(),
    status: overrideStatusEnum("status").notNull().default("pending"),
    aiRecommendation: jsonb("ai_recommendation").$type<Record<string, unknown>>().notNull(),
    debtorMessage: text("debtor_message"),
    /** Auto-execute vaqti — null bo'lsa darhol tasdiq talab qilinadi. */
    autoExecuteAt: timestamp("auto_execute_at", { withTimezone: true }),
    decidedByUserId: uuid("decided_by_user_id").references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("pending_overrides_tenant_status_idx").on(t.tenantId, t.status)],
);
