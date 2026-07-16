import { approvalRequests, auditLogs, contractors, documents, withTenant } from "@lex/db";
import { ERROR_CODE, fail, ok } from "@lex/shared";
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";

export const courtRoutes = new Hono<{ Variables: Variables }>();

const CAN_MANAGE = new Set(["owner", "admin", "legal"]);
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
