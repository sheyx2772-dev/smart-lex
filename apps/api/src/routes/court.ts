import {
  buildSaveSuitPayload,
  CLAIM_STATEMENT_DOCUMENT_TYPE_ID,
  CourtClient,
  DEBT_RECOVERY_CLAIM_CATEGORY,
  DEFAULT_COURT_ID,
  defendantDetailsFromSoliq,
  lookupSoliqCompany,
  OTHER_DOCUMENTS_TYPE_ID,
  TALABNOMA_DOCUMENT_TYPE_ID,
} from "@lex/integrations";
import { approvalRequests, auditLogs, contractors, documents, users, withTenant } from "@lex/db";
import { ERROR_CODE, fail, ok } from "@lex/shared";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";
import { env } from "../lib/env";
import { saveCourtToken } from "../lib/court-token";
import { renderTextPdf } from "../lib/pdf";
import { courtFilePrepareSchema, validate } from "../lib/validation";

export const courtRoutes = new Hono<{ Variables: Variables }>();

/**
 * Hozircha AVTOMATIK biriktirilMAYDIGAN dalolat hujjatlari — asl fayllar bizning
 * tizimda saqlanmaydi (faqat Didox havolasi bor, haqiqiy kontent yo'q). Bular
 * cabinet.sud.uz'da QO'LDA biriktirilishi kerak (checklist orqali ogohlantiriladi).
 * Alohida vazifa: Didox'dan asl faylni yuklab olish integratsiyasi qurilgach,
 * bu ro'yxat avtomatik biriktirishga o'tkaziladi.
 */
const MANUAL_EVIDENCE_TYPES = ["contract", "invoice", "ttn", "reconciliation_act", "advocate_order"] as const;

const CAN_MANAGE = new Set(["owner", "admin", "legal"]);
/** cabinet.sud.uz'ga topshirishni ishga tushirish — yuqori mas'uliyat, tor rol. */
const CAN_FILE = new Set(["owner", "admin", "legal"]);

/**
 * cabinet.sud.uz (E-SUD) sessiya tokeni — bookmarklet cabinet.sud.uz'da bosilganda
 * sessionStorage'dan o'qib, URL fragment orqali shu domenimizga qaytaradi; sahifa
 * shu yerga POST qiladi (qarang apps/web/src/components/court/sud-filing-flow.tsx).
 * Token — jonli sessiya kredensiali, shuning uchun javobda hech qachon
 * qaytarilmaydi va log'ga yozilmaydi.
 */
courtRoutes.post("/court/token", async (c) => {
  const locale = c.get("locale");
  const { tenantId, userId } = c.get("auth");
  const body = (await c.req.json().catch(() => ({}))) as { token?: string };
  const token = String(body.token ?? "").trim();
  if (!token) return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale), 422);

  await saveCourtToken(tenantId, userId, token);
  return c.json(ok({ connected: true }, "common.ok", locale));
});

/** Ulanish holatini tekshirish (token bor/yo'q — qiymatini o'zini hech qachon qaytarmaydi). */
courtRoutes.get("/court/token", async (c) => {
  const locale = c.get("locale");
  const { tenantId, userId } = c.get("auth");
  const [row] = await withTenant(tenantId, (tx) =>
    tx.select({ at: users.courtAuthTokenAt }).from(users).where(eq(users.id, userId)).limit(1),
  );
  return c.json(ok({ connected: !!row?.at, at: row?.at ?? null }, "common.ok", locale));
});

/** Foydalanuvchi token bilan qaysi shaxs/tashkilotlar nomidan da'vogar bo'la olishi (cabinet.sud.uz /user/entities). */
courtRoutes.get("/court/:id/file/entities", async (c) => {
  const locale = c.get("locale");
  const { tenantId, userId, role } = c.get("auth");
  if (!CAN_FILE.has(role)) return c.json(fail(ERROR_CODE.FORBIDDEN, "auth.forbidden", locale), 403);

  const [row] = await withTenant(tenantId, (tx) => tx.select({ token: users.courtAuthToken }).from(users).where(eq(users.id, userId)).limit(1));
  if (!row?.token) return c.json(ok({ available: false, reason: "not_connected" }, "common.ok", locale));

  try {
    const entities = await new CourtClient(row.token).getEntities();
    return c.json(ok({ available: true, entities }, "common.ok", locale));
  } catch (e) {
    return c.json(ok({ available: false, reason: "sud_error", detail: String((e as Error)?.message ?? e).slice(0, 300) }, "common.ok", locale));
  }
});

/**
 * 1-qadam: hujjatni tayyorlaydi — javobgar reyestr ma'lumoti (Soliq), da'vo arizasi
 * PDF'i va uni cabinet.sud.uz'ga yuklash. HALI hech narsa qaytarib bo'lmaydigan
 * darajada YUBORILMAYDI (generate-invoices/save-suit bu yerda chaqirilmaydi).
 * Natija documents.extracted.courtFilingPrepare'da saqlanadi — submit shuni o'qiydi.
 */
courtRoutes.post("/court/:id/file/prepare", async (c) => {
  const locale = c.get("locale");
  const { tenantId, userId, role } = c.get("auth");
  if (!CAN_FILE.has(role)) return c.json(fail(ERROR_CODE.FORBIDDEN, "auth.forbidden", locale), 403);
  const id = c.req.param("id");
  const parsed = validate(courtFilePrepareSchema, await c.req.json().catch(() => null));
  if (!parsed.ok) return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale, { fields: parsed.fields }), 422);
  const { entityId, signature } = parsed.data;
  if (!env.soliqApiKey) return c.json(ok({ available: false, reason: "soliq_not_configured" }, "common.ok", locale));

  const loaded = await withTenant(tenantId, async (tx) => {
    const [doc] = await tx.select().from(documents).where(eq(documents.id, id)).limit(1);
    if (!doc || doc.type !== "court_claim" || !doc.contractorId) return null;
    const [appr] = await tx.select().from(approvalRequests).where(eq(approvalRequests.documentId, id)).limit(1);
    if (!appr || appr.status !== "approved") return "not_approved" as const;
    const [contractor] = await tx.select().from(contractors).where(eq(contractors.id, doc.contractorId)).limit(1);
    if (!contractor) return null;
    const [user] = await tx.select({ token: users.courtAuthToken }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user?.token) return "not_connected" as const;
    // Talabnoma — shu qarzdor uchun eng so'nggi yaratilgan demand_letter (bo'lsa).
    const [demandLetter] = await tx
      .select({ id: documents.id, title: documents.title, extracted: documents.extracted })
      .from(documents)
      .where(and(eq(documents.contractorId, doc.contractorId), eq(documents.type, "demand_letter")))
      .orderBy(desc(documents.createdAt))
      .limit(1);
    // Shu qarzdor uchun QAYSI dalolat hujjatlari umuman MAVJUD (kontent bormi yo'qmi
    // qat'i nazar) — checklist faqat HAQIQATAN mavjud, lekin avtomatik biriktirilmagan
    // turlarni ko'rsatsin, bo'sh ro'yxatni "yetishmayapti" deb ko'rsatmasin.
    const evidenceDocs = await tx
      .select({ type: documents.type })
      .from(documents)
      .where(
        and(
          eq(documents.contractorId, doc.contractorId),
          inArray(documents.type, ["contract", "invoice", "ttn", "reconciliation_act"]),
        ),
      );
    const existingEvidenceTypes = [...new Set(evidenceDocs.map((d) => d.type))];
    return { doc, appr, contractor, token: user.token, demandLetter, existingEvidenceTypes };
  });

  if (loaded === null) return c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", locale), 404);
  if (loaded === "not_approved") return c.json(ok({ available: false, reason: "not_approved" }, "common.ok", locale));
  if (loaded === "not_connected") return c.json(ok({ available: false, reason: "not_connected" }, "common.ok", locale));
  const { doc, contractor, token, demandLetter, existingEvidenceTypes } = loaded;

  try {
    const soliq = await lookupSoliqCompany(contractor.tin, env.soliqApiKey);
    const client = new CourtClient(token);
    const extracted = (doc.extracted ?? {}) as Record<string, unknown>;
    const claimBody = typeof extracted.body === "string" ? extracted.body : "";

    // 1) Da'vo arizasi — E-IMZO tasdig'i matn sifatida qo'shilib, PDF qilinib yuklanadi.
    //    (IPK 149/155-modda: imzosiz ariza qaytariladi — shuning uchun imzo MAJBURIY.)
    const signedNote =
      `\n\n— — —\nUshbu hujjat elektron raqamli imzo (E-IMZO) bilan tasdiqlangan.\n` +
      `Imzolovchi: ${signature.signerName}\nSertifikat: ${signature.certSerial}\nSana: ${signature.signedAt}`;
    const claimPdf = await renderTextPdf(claimBody + signedNote, { title: doc.title });
    const claimUpload = await client.uploadFile(claimPdf, `${doc.title.replace(/[^\w\-]+/g, "_").slice(0, 60)}.pdf`);

    // 2) Imzo tasdiqnomasi — pkcs7 bloki alohida hujjat sifatida (mustaqil tekshirish uchun).
    const sigCertText =
      `E-IMZO TASDIQNOMASI\n\nHujjat: ${doc.title}\nImzolovchi: ${signature.signerName}\n` +
      `Sertifikat raqami: ${signature.certSerial}\nImzolangan vaqt: ${signature.signedAt}\n` +
      `Provayder: ${signature.provider}\n\nPKCS7 (base64):\n${signature.pkcs7}`;
    const sigPdf = await renderTextPdf(sigCertText, { title: "E-IMZO tasdiqnomasi" });
    const sigUpload = await client.uploadFile(sigPdf, `eimzo_tasdiqnoma_${doc.id.slice(0, 8)}.pdf`);

    // 3) Talabnoma — mavjud va matni bo'lsa.
    let demandUpload: { id: string } | null = null;
    if (demandLetter) {
      const dExtracted = (demandLetter.extracted ?? {}) as Record<string, unknown>;
      const demandBody = typeof dExtracted.body === "string" ? dExtracted.body : "";
      if (demandBody) {
        const demandPdf = await renderTextPdf(demandBody, { title: demandLetter.title });
        demandUpload = await client.uploadFile(demandPdf, `talabnoma_${demandLetter.id.slice(0, 8)}.pdf`);
      }
    }

    const attachedDocuments: { fileId: string; typeId: string }[] = [
      { fileId: claimUpload.id, typeId: CLAIM_STATEMENT_DOCUMENT_TYPE_ID },
      { fileId: sigUpload.id, typeId: OTHER_DOCUMENTS_TYPE_ID },
    ];
    if (demandUpload) attachedDocuments.push({ fileId: demandUpload.id, typeId: TALABNOMA_DOCUMENT_TYPE_ID });

    // Faqat HAQIQATAN mavjud (lekin avtomatik biriktirilmagan) turlarni ko'rsatamiz —
    // bo'lmagan hujjat uchun "yetishmayapti" deb yolg'on ogohlantirish bermaslik uchun.
    const manualEvidenceNeeded = MANUAL_EVIDENCE_TYPES.filter(
      (t) => t === "advocate_order" || existingEvidenceTypes.includes(t),
    );
    const checklist = {
      claimSigned: true,
      signatureCertAttached: true,
      talabnomaAttached: Boolean(demandUpload),
      manualEvidenceNeeded,
    };

    const prepare = {
      entityId,
      documents: attachedDocuments,
      defendant: { tin: contractor.tin, details: defendantDetailsFromSoliq(soliq) },
      preparedAt: new Date().toISOString(),
      checklist,
    };
    await withTenant(tenantId, (tx) =>
      tx.update(documents).set({ extracted: { ...extracted, courtFilingPrepare: prepare } }).where(eq(documents.id, id)),
    );

    return c.json(
      ok(
        {
          available: true,
          summary: {
            claimantEntityId: entityId,
            defendantName: contractor.name,
            defendantTin: contractor.tin,
            documentUploaded: true,
          },
          checklist,
        },
        "common.ok",
        locale,
      ),
    );
  } catch (e) {
    return c.json(ok({ available: false, reason: "sud_error", detail: String((e as Error)?.message ?? e).slice(0, 300) }, "common.ok", locale));
  }
});

/**
 * 2-qadam (QAYTARIB BO'LMAYDIGAN): hisob-fakturalarni generatsiya qilib (jonli,
 * bir martalik), to'liq payload'ni yig'ib, cabinet.sud.uz'ga TOPSHIRADI. Frontend
 * bu chaqiruvdan OLDIN foydalanuvchiga xulosani ko'rsatib, aniq tasdiq olishi SHART
 * (SKILL.md: "Non-negotiable safety rule").
 */
courtRoutes.post("/court/:id/file/submit", async (c) => {
  const locale = c.get("locale");
  const { tenantId, userId, role } = c.get("auth");
  if (!CAN_FILE.has(role)) return c.json(fail(ERROR_CODE.FORBIDDEN, "auth.forbidden", locale), 403);
  const id = c.req.param("id");

  const loaded = await withTenant(tenantId, async (tx) => {
    const [doc] = await tx.select().from(documents).where(eq(documents.id, id)).limit(1);
    if (!doc) return null;
    const [appr] = await tx.select().from(approvalRequests).where(eq(approvalRequests.documentId, id)).limit(1);
    if (!appr) return null;
    const [user] = await tx.select({ token: users.courtAuthToken }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user?.token) return "not_connected" as const;
    const extracted = (doc.extracted ?? {}) as Record<string, unknown>;
    const prepare = extracted.courtFilingPrepare as
      | {
          entityId: string;
          documents: { fileId: string; typeId: string }[];
          defendant: { tin: string; details: Record<string, unknown> };
        }
      | undefined;
    if (!prepare || !Array.isArray(prepare.documents) || prepare.documents.length === 0) return "not_prepared" as const;
    return { doc, appr, token: user.token, prepare, extracted };
  });

  if (loaded === null) return c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", locale), 404);
  if (loaded === "not_connected") return c.json(ok({ available: false, reason: "not_connected" }, "common.ok", locale));
  if (loaded === "not_prepared") return c.json(ok({ available: false, reason: "not_prepared" }, "common.ok", locale));
  const { appr, token, prepare, extracted } = loaded;
  const payload = (appr.payload ?? {}) as Record<string, unknown>;
  const stateDutyMinor = BigInt(String(payload.stateDutyMinor ?? "0"));
  const principalMinor = BigInt(String(payload.principalMinor ?? "0"));
  const penaltyMinor = BigInt(String(payload.penaltyMinor ?? "0"));

  try {
    const client = new CourtClient(token);
    const invoiceResponses = await client.generateInvoices(prepare.entityId, DEFAULT_COURT_ID, [
      { amount_type: "STATE", amount: Number(stateDutyMinor / 100n) },
    ]);

    const savePayload = buildSaveSuitPayload({
      courtId: DEFAULT_COURT_ID,
      categoryId: DEBT_RECOVERY_CLAIM_CATEGORY.categoryId,
      subCategoryId: DEBT_RECOVERY_CLAIM_CATEGORY.subCategoryId,
      claimantEntityId: prepare.entityId,
      defendant: { tin: prepare.defendant.tin, entity_details: prepare.defendant.details },
      documents: prepare.documents,
      invoices: invoiceResponses.map((response) => ({ type: "STATE" as const, response })),
      claimAmount: { amount: (Number(principalMinor) / 100).toFixed(2), forfeit: (Number(penaltyMinor) / 100).toFixed(2), currency_id: "UZS" },
      claimAmountParts: [
        { amount: (Number(principalMinor) / 100).toFixed(2), amount_type: "DEPT" },
        { amount: (Number(penaltyMinor) / 100).toFixed(2), amount_type: "PENALTY" },
      ],
      stateDutyAmount: Number(stateDutyMinor / 100n),
    });

    const result = await client.submitSaveSuit(savePayload);

    await withTenant(tenantId, async (tx) => {
      await tx
        .update(documents)
        .set({ extracted: { ...extracted, courtStatus: "submitted", sudCaseId: result.case_id, courtFilingPrepare: undefined } })
        .where(eq(documents.id, id));
      await tx.insert(auditLogs).values({
        tenantId,
        actorType: "user",
        actorId: userId,
        action: "court.filed_via_api",
        entityType: "document",
        entityId: id,
        detail: { caseId: result.case_id },
      });
    });

    return c.json(ok({ available: true, caseId: result.case_id }, "common.ok", locale));
  } catch (e) {
    return c.json(ok({ available: false, reason: "sud_error", detail: String((e as Error)?.message ?? e).slice(0, 300) }, "common.ok", locale));
  }
});

/** Topshirish holatlari (Part 8 §9). */
export const COURT_STATUSES = ["draft", "ready", "submitted", "accepted", "returned", "correction", "completed"] as const;
type CourtStatus = (typeof COURT_STATUSES)[number];

/** Sud da'volari (court_claim hujjatlari) — topshirish navbati + holat kuzatuvi. */
courtRoutes.get("/court", async (c) => {
  const { tenantId } = c.get("auth");

  const rows = await withTenant(tenantId, (tx) =>
    tx
      .select({
        id: documents.id,
        title: documents.title,
        extracted: documents.extracted,
        createdAt: documents.createdAt,
        contractorName: contractors.name,
        contractorTin: contractors.tin,
        contractorId: contractors.id,
        approvalStatus: approvalRequests.status,
        payload: approvalRequests.payload,
      })
      .from(documents)
      .leftJoin(contractors, eq(documents.contractorId, contractors.id))
      .leftJoin(approvalRequests, eq(approvalRequests.documentId, documents.id))
      .where(eq(documents.type, "court_claim"))
      .orderBy(desc(documents.createdAt)),
  );

  const items = rows.map((r) => {
    const ex = (r.extracted ?? {}) as Record<string, unknown>;
    const pl = (r.payload ?? {}) as Record<string, unknown>;
    const status: CourtStatus = (ex.courtStatus as CourtStatus) ?? (r.approvalStatus === "approved" ? "ready" : "draft");
    return {
      id: r.id,
      title: r.title,
      body: typeof ex.body === "string" ? ex.body : "",
      status,
      approvalStatus: r.approvalStatus ?? "pending",
      createdAt: r.createdAt,
      contractorName: r.contractorName,
      contractorTin: r.contractorTin,
      contractorId: r.contractorId,
      court: typeof pl.court === "string" ? pl.court : "",
      total: typeof pl.totalMinor === "string" ? pl.totalMinor : "0",
      stateDuty: typeof pl.stateDutyMinor === "string" ? pl.stateDutyMinor : "0",
      currency: typeof pl.currency === "string" ? pl.currency : "UZS",
    };
  });

  return c.json(ok({ items, total: items.length }, "common.ok", c.get("locale")));
});

/** Topshirish holatini o'zgartirish (odam cabinet.sud.uz bilan ishlagach). */
courtRoutes.post("/court/:id/status", async (c) => {
  const locale = c.get("locale");
  const { tenantId, userId, role } = c.get("auth");
  if (!CAN_MANAGE.has(role)) return c.json(fail(ERROR_CODE.FORBIDDEN, "auth.forbidden", locale), 403);
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { status?: string };
  const status = body.status as CourtStatus;
  if (!COURT_STATUSES.includes(status)) return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale), 422);

  const done = await withTenant(tenantId, async (tx) => {
    const [doc] = await tx.select({ id: documents.id, extracted: documents.extracted }).from(documents).where(eq(documents.id, id)).limit(1);
    if (!doc) return false;
    await tx.update(documents).set({ extracted: { ...((doc.extracted ?? {}) as object), courtStatus: status } }).where(eq(documents.id, id));
    await tx.insert(auditLogs).values({
      tenantId,
      actorType: "user",
      actorId: userId,
      action: "court.status_changed",
      entityType: "document",
      entityId: id,
      detail: { status },
    });
    return true;
  });

  if (!done) return c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", locale), 404);
  return c.json(ok({ status }, "common.updated", locale));
});
