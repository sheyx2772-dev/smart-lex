import { z } from "zod";

/** Zod bilan validatsiya — muvaffaqiyatsizlikda maydon-daraja xatoliklar. */
export function validate<T>(
  schema: z.ZodType<T>,
  input: unknown,
): { ok: true; data: T } | { ok: false; fields: Record<string, string> } {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };

  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".") || "_";
    fields[path] ??= issue.message;
  }
  return { ok: false, fields };
}

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

/** E-IMZO imzosi (client tomonda qo'yilgan — server FAQAT saqlaydi/metadatani oladi). */
export const signatureSchema = z.object({
  pkcs7: z.string().max(100000),
  signerName: z.string().max(300),
  certSerial: z.string().max(200),
  signedAt: z.string(),
  provider: z.enum(["eimzo", "mock"]),
});

export const decisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  /** Rahbar tomonidan tahrirlangan hujjat matni (tasdiqlashdan oldin). */
  body: z.string().max(20000).optional(),
  signature: signatureSchema.optional(),
});

export const documentSignSchema = z.object({ signature: signatureSchema });

/** Sudga topshirish uchun tayyorlash — hujjat E-IMZO bilan mijoz tomonida imzolangan bo'lishi SHART. */
export const courtFilePrepareSchema = z.object({
  entityId: z.string().min(1),
  signature: signatureSchema,
});

/** Yangi shartnoma + invoice yaratish. Kontragent id yoki STIR bo'yicha berilishi mumkin. */
export const contractCreateSchema = z.object({
  contractorId: z.string().uuid().optional(),
  contractor: z
    .object({
      name: z.string().min(1),
      tin: z.string().min(1),
      legalAddress: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
    })
    .optional(),
  number: z.string().min(1),
  signedAt: z.string().optional(),
  penaltyDailyBps: z.number().int().nonnegative(),
  penaltyCapBps: z.number().int().nonnegative().optional(),
  invoice: z.object({
    number: z.string().min(1),
    amountMinor: z.union([z.string(), z.number()]),
    issuedAt: z.string(),
    dueDate: z.string(),
  }),
});

/** To'lov qayd etish. */
export const paymentSchema = z.object({
  amountMinor: z.union([z.string(), z.number()]),
  paidAt: z.string().optional(),
});

const LOCALE = z.enum(["uz", "ru", "en"]);
const ROLE = z.enum(["owner", "admin", "finance", "legal"]);

export const profileSchema = z.object({
  fullName: z.string().min(1).max(300),
  locale: LOCALE,
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(200),
});

export const companySchema = z.object({
  name: z.string().min(1).max(300),
  legalAddress: z.string().max(500).optional(),
  bankAccount: z.string().max(50).optional(),
  bankMfo: z.string().max(20).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().max(200).optional(),
  defaultLocale: LOCALE,
  settings: z.record(z.unknown()).optional(),
});

export const integrationsSchema = z.object({
  didoxToken: z.string().max(500).optional(),
  bankApiKey: z.string().max(500).optional(),
  eimzoSiteId: z.string().max(200).optional(),
  smsProvider: z.string().max(100).optional(),
  smsApiKey: z.string().max(500).optional(),
  telegramBotToken: z.string().max(500).optional(),
  telegramChatId: z.string().max(100).optional(),
  telegramTopicId: z.string().max(100).optional(),
});

export const didoxConnectSchema = z.object({
  pkcs7: z.string().min(1),
  signatureHex: z.string().min(1),
});

export const didoxPasswordConnectSchema = z.object({
  password: z.string().min(1).max(200),
});

export const docTemplatesSchema = z.object({
  demand_letter: z.string().max(20000).optional(),
  court_claim: z.string().max(20000).optional(),
  reconciliation_act: z.string().max(20000).optional(),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(300),
  role: ROLE,
  password: z.string().min(6).max(200),
});

export const updateUserSchema = z.object({
  role: ROLE.optional(),
  isActive: z.boolean().optional(),
});

export const collectionSchema = z.object({
  steps: z.array(
    z.object({
      stage: z.string(),
      offsetDays: z.number().int(),
      requiresApproval: z.boolean().optional(),
    }),
  ),
});
