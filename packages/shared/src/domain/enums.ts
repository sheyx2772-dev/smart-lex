/**
 * Domen enum'lari. DB (Drizzle), core hisob-kitob va agentlar shu qiymatlarga tayanadi.
 * `as const` massivlar Drizzle `pgEnum` va zod `z.enum` uchun to'g'ridan-to'g'ri ishlatiladi.
 */

/** Tenant tipi — qarz manbai adapteri va siyosati shunga bog'lanadi. */
export const TENANT_TYPES = ["company", "marketplace", "bank", "government"] as const;
export type TenantType = (typeof TENANT_TYPES)[number];

/** RBAC rollari. */
export const USER_ROLES = ["owner", "admin", "finance", "legal", "viewer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Didox / bank hujjat turlari. */
export const DOCUMENT_TYPES = [
  "contract", // shartnoma
  "supplementary_agreement", // qo'shimcha kelishuv
  "invoice", // hisob-faktura
  "act", // akt / bajarilgan ishlar dalolatnomasi
  "reconciliation_act", // solishtirma dalolatnoma (akt-sverka)
  "ttn", // yuk xati (tovar-transport nakladnoy)
  "demand_letter", // talabnoma
  "court_claim", // da'vo arizasi (Faza 2)
  "other",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** Debitorlik holati. */
export const RECEIVABLE_STATUSES = ["pending", "partial", "paid", "overdue", "written_off"] as const;
export type ReceivableStatus = (typeof RECEIVABLE_STATUSES)[number];

/** To'lov holati. */
export const PAYMENT_STATUSES = ["expected", "received", "reversed"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Qarzdorning "va'da qilingan to'lov" turi (AI kelishuv orqali qabul qilingan). */
export const PROMISE_TYPES = ["settlement", "installment"] as const;
export type PromiseType = (typeof PROMISE_TYPES)[number];

/**
 * Moliyalashtirish bozori (factoring marketplace) — sotuvchi (mijoz) qarzni bank/NBKT
 * xaridorlariga sotish uchun ro'yxatga qo'yadi. SmartLex talab yoki pulni O'ZIGA OLMAYDI —
 * faqat moslashtiradi; haqiqiy bitim (pul + talab tsessiyasi) platformadan tashqarida.
 */
export const FINANCING_LISTING_STATUSES = ["listed", "withdrawn", "matched", "completed"] as const;
export type FinancingListingStatus = (typeof FINANCING_LISTING_STATUSES)[number];

/** Va'da holati — muddat kelmaguncha "pending", to'lov qilinsa "kept", muddat o'tsa "broken". */
export const PROMISE_STATUSES = ["pending", "kept", "broken"] as const;
export type PromiseStatus = (typeof PROMISE_STATUSES)[number];

/** Eslatma kanallari. */
export const REMINDER_CHANNELS = ["sms", "email", "telegram", "hybrid_post"] as const;
export type ReminderChannel = (typeof REMINDER_CHANNELS)[number];

/** Eslatma yuborish holati. */
export const REMINDER_STATUSES = ["queued", "sent", "delivered", "failed"] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

/**
 * Collection bosqichlari — tenant siyosati (`CollectionRule`) shu bosqichlar bo'yicha
 * belgilanadi. Har bosqich muddatga (kun) va harakatga bog'lanadi.
 */
export const COLLECTION_STAGES = [
  "soft_reminder", // yumshoq eslatma (muddatdan oldin/keyin)
  "firm_reminder", // qat'iy eslatma
  "demand_letter", // rasmiy talabnoma (tasdiq talab qiladi)
  "court", // sud bosqichi (Faza 2, tasdiq talab qiladi)
] as const;
export type CollectionStage = (typeof COLLECTION_STAGES)[number];

/** Tasdiq turi (rahbar tasdig'i talab qiladigan huquqiy ahamiyatli qadamlar). */
export const APPROVAL_TYPES = ["demand_letter", "court_claim", "write_off"] as const;
export type ApprovalType = (typeof APPROVAL_TYPES)[number];

/** Tasdiq holati. */
export const APPROVAL_STATUSES = ["pending", "approved", "rejected"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

/** Audit log'da qayd etiladigan aktor turi. */
export const ACTOR_TYPES = ["user", "ai_agent", "system"] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

/** Qarz ishi (Debt Case) holati — avtonom undiruv OS state machine. */
export const CASE_STATES = [
  "created",
  "intake_complete",
  "scoring",
  "strategy_assigned",
  "pre_legal",
  "debtor_responded",
  "negotiation",
  "escalate",
  "legal",
  "court_filed",
  "judgment",
  "enforcement",
  "settled",
  "recovered",
  "closed",
  "written_off",
] as const;
export type CaseState = (typeof CASE_STATES)[number];

/** Undiruv strategiyasi turi (DS-Score natijasi). */
export const STRATEGY_TYPES = ["soft_escalation", "standard", "aggressive", "legal"] as const;
export type StrategyType = (typeof STRATEGY_TYPES)[number];

/** AI tasdiq so'rov turi (human override). */
export const OVERRIDE_TYPES = ["settlement", "court_filing", "write_off", "strategy_change"] as const;
export type OverrideType = (typeof OVERRIDE_TYPES)[number];

/** AI tasdiq so'rov holati. */
export const OVERRIDE_STATUSES = ["pending", "approved", "rejected", "auto_executed", "expired"] as const;
export type OverrideStatus = (typeof OVERRIDE_STATUSES)[number];
