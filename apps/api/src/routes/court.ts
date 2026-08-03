import {
  buildSaveSuitPayload,
  CLAIM_STATEMENT_DOCUMENT_TYPE_ID,
  CourtClient,
  DEBT_RECOVERY_CLAIM_CATEGORY,
  DEFAULT_COURT_ID,
  defendantDetailsFromSoliq,
  lookupSoliqCompany,
} from "@lex/integrations";
import { approvalRequests, auditLogs, contractors, documents, users, withTenant } from "@lex/db";
import { ERROR_CODE, fail, ok } from "@lex/shared";
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";
import { env } from "../lib/env";
import { renderTextPdf } from "../lib/pdf";

export const courtRoutes = new Hono<{ Variables: Variables }>();

const CAN_MANAGE = new Set(["owner", "admin", "legal"]);
/** cabinet.sud.uz'ga topshirishni ishga tushirish — yuqori mas'uliyat, tor rol. */
const CAN_FILE = new Set(["owner", "admin", "legal"]);

/**
 * cabinet.sud.uz (E-SUD) sessiya tokeni — brauzer kengaytmasi One ID login'dan
 * keyin `sessionStorage['X-AUTH-TOKEN']`ni o'qib shu yerga jo'natadi (qarang:
 * apps/extension/src/capture-token.js). Token — jonli sessiya kredensiali,
 * shuning uchun javobda hech qachon qaytarilmaydi va log'ga yozilmaydi.
 */
courtRoutes.post("/court/token", async (c) => {
  const locale = c.get("locale");
  const { tenantId, userId } = c.get("auth");
  const body = (await c.req.json().catch(() => ({}))) as { token?: string };
  const token = String(body.token ?? "").trim();
  if (!token) return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale), 422);

  await withTenant(tenantId, (tx) =>
    tx.update(users).set({ courtAuthToken: token, courtAuthTokenAt: new Date() }).where(eq(users.id, userId)),
  );
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
  const body = (await c.req.json().catch(() => ({}))) as { entityId?: string };
  const entityId = String(body.entityId ?? "").trim();
  if (!entityId) return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale), 422);
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
    return { doc, appr, contractor, token: user.token };
  });

  if (loaded === null) return c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", locale), 404);
  if (loaded === "not_approved") return c.json(ok({ available: false, reason: "not_approved" }, "common.ok", locale));
  if (loaded === "not_connected") return c.json(ok({ available: false, reason: "not_connected" }, "common.ok", locale));
  const { doc, contractor, token } = loaded;

  try {
    const soliq = await lookupSoliqCompany(contractor.tin, env.soliqApiKey);
    const client = new CourtClient(token);
    const extracted = (doc.extracted ?? {}) as Record<string, unknown>;
    const pdf = await renderTextPdf(typeof extracted.body === "string" ? extracted.body : "", { title: doc.title });
    const upload = await client.uploadFile(pdf, `${doc.title.replace(/[^\w\-]+/g, "_").slice(0, 60)}.pdf`);

    const prepare = {
      entityId,
      uploadId: upload.id,
      defendant: { tin: contractor.tin, details: defendantDetailsFromSoliq(soliq) },
      preparedAt: new Date().toISOString(),
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
      | { entityId: string; uploadId: string; defendant: { tin: string; details: Record<string, unknown> } }
      | undefined;
    if (!prepare) return "not_prepared" as const;
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
      documents: [{ fileId: prepare.uploadId, typeId: CLAIM_STATEMENT_DOCUMENT_TYPE_ID }],
      invoiceResponses,
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
