import {
  approvalRequests,
  auditLogs,
  contractors,
  contracts,
  documents,
  legalAgentTasks,
  legalMatters,
  withTenant,
} from "@lex/db";
import { ERROR_CODE, fail, LEGAL_MATTER_STATUSES, ok } from "@lex/shared";
import { and, desc, eq, ilike, inArray, isNotNull, lte, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";
import { generateMatterNumber } from "../lib/legal-matters";
import { pageMeta, pageParams } from "../lib/pagination";

/** "Ish" (Legal Matter) — Yuridik panelning markaziy ob'ekti. Kontragentdan mustaqil:
 * ish kontragentga, shartnomaga yoki hujjatga bog'lanishi mumkin, lekin bog'lanmasa
 * ham mavjud bo'la oladi (masalan sof huquqiy xulosa so'rovi). */
export const legalMatterRoutes = new Hono<{ Variables: Variables }>();

/** Ro'yxat — filtr: all (yopilmagan hammasi) | mine | due (7 kun ichida) | risk (yuqori/kritik). */
legalMatterRoutes.get("/legal/matters", async (c) => {
  const { tenantId, userId } = c.get("auth");
  const locale = c.get("locale");
  const filter = c.req.query("filter") ?? "";
  const { page, pageSize, limit, offset } = pageParams(c);

  const data = await withTenant(tenantId, async (tx) => {
    const weekAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const conds = [ne(legalMatters.status, "closed")];
    if (filter === "mine") conds.push(eq(legalMatters.assignedUserId, userId));
    if (filter === "due") conds.push(isNotNull(legalMatters.dueDate));
    if (filter === "due") conds.push(lte(legalMatters.dueDate, weekAhead));
    if (filter === "risk") conds.push(inArray(legalMatters.riskLevel, ["high", "critical"]));
    const where = and(...conds);

    const [countRow] = await tx.select({ n: sql<number>`count(*)::int` }).from(legalMatters).where(where);
    const rows = await tx
      .select({
        id: legalMatters.id,
        matterNumber: legalMatters.matterNumber,
        title: legalMatters.title,
        type: legalMatters.type,
        status: legalMatters.status,
        priority: legalMatters.priority,
        riskLevel: legalMatters.riskLevel,
        dueDate: legalMatters.dueDate,
        contractorName: contractors.name,
        updatedAt: legalMatters.updatedAt,
      })
      .from(legalMatters)
      .leftJoin(contractors, eq(legalMatters.contractorId, contractors.id))
      .where(where)
      .orderBy(desc(legalMatters.updatedAt))
      .limit(limit)
      .offset(offset);

    return { items: rows, ...pageMeta(countRow?.n ?? 0, page, pageSize) };
  });

  return c.json(ok(data, "common.ok", locale));
});

/** Bitta ishning to'liq kesimi — Matter Workspace uchun. */
legalMatterRoutes.get("/legal/matters/:id", async (c) => {
  const { tenantId } = c.get("auth");
  const locale = c.get("locale");
  const id = c.req.param("id");

  const data = await withTenant(tenantId, async (tx) => {
    const [matter] = await tx
      .select({
        id: legalMatters.id,
        matterNumber: legalMatters.matterNumber,
        title: legalMatters.title,
        type: legalMatters.type,
        status: legalMatters.status,
        priority: legalMatters.priority,
        riskLevel: legalMatters.riskLevel,
        description: legalMatters.description,
        dueDate: legalMatters.dueDate,
        closedAt: legalMatters.closedAt,
        createdAt: legalMatters.createdAt,
        contractorId: legalMatters.contractorId,
        contractorName: contractors.name,
        contractorTin: contractors.tin,
        contractorPhone: contractors.phone,
        contractorEmail: contractors.email,
        contractId: legalMatters.contractId,
        contractNumber: contracts.number,
      })
      .from(legalMatters)
      .leftJoin(contractors, eq(legalMatters.contractorId, contractors.id))
      .leftJoin(contracts, eq(legalMatters.contractId, contracts.id))
      .where(eq(legalMatters.id, id))
      .limit(1);
    if (!matter) return null;

    const docs = matter.contractorId
      ? await tx
          .select({ id: documents.id, type: documents.type, title: documents.title, createdAt: documents.createdAt, extracted: documents.extracted })
          .from(documents)
          .where(eq(documents.contractorId, matter.contractorId))
          .orderBy(desc(documents.createdAt))
          .limit(50)
      : [];

    const approvals = await tx
      .select({ id: approvalRequests.id, type: approvalRequests.type, status: approvalRequests.status, payload: approvalRequests.payload, createdAt: approvalRequests.createdAt, decidedAt: approvalRequests.decidedAt })
      .from(approvalRequests)
      .where(sql`${approvalRequests.payload}->>'matterId' = ${id}`)
      .orderBy(desc(approvalRequests.createdAt));

    const tasks = await tx
      .select({ id: legalAgentTasks.id, category: legalAgentTasks.category, title: legalAgentTasks.title, reason: legalAgentTasks.reason, status: legalAgentTasks.status, createdAt: legalAgentTasks.createdAt })
      .from(legalAgentTasks)
      .where(eq(legalAgentTasks.legalMatterId, id))
      .orderBy(desc(legalAgentTasks.createdAt));

    const activity = await tx
      .select({ id: auditLogs.id, actorType: auditLogs.actorType, action: auditLogs.action, detail: auditLogs.detail, createdAt: auditLogs.createdAt })
      .from(auditLogs)
      .where(eq(auditLogs.entityId, id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(40);

    return { matter, documents: docs, approvals, tasks, activity };
  });

  if (!data) return c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", locale), 404);
  return c.json(ok(data, "common.ok", locale));
});

/** Qo'lda yangi ish yaratish (AI orqali yaratish uchun — legal-agent.ts'dagi createMatter asbobi). */
legalMatterRoutes.post("/legal/matters", async (c) => {
  const { tenantId, userId } = c.get("auth");
  const locale = c.get("locale");
  const body = (await c.req.json().catch(() => ({}))) as { title?: string; type?: string; contractorName?: string; description?: string };
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale), 422);
  const type = typeof body.type === "string" && body.type.trim() ? body.type.trim() : "other";
  const contractorName = typeof body.contractorName === "string" ? body.contractorName.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : null;

  const result = await withTenant(tenantId, async (tx) => {
    let contractorId: string | null = null;
    if (contractorName) {
      const [row] = await tx.select({ id: contractors.id }).from(contractors).where(ilike(contractors.name, `%${contractorName}%`)).limit(1);
      contractorId = row?.id ?? null;
    }
    const matterNumber = await generateMatterNumber(tx);
    const [ins] = await tx
      .insert(legalMatters)
      .values({ tenantId, matterNumber, title, type, contractorId, assignedUserId: userId, description, status: "new" })
      .returning();
    await tx.insert(auditLogs).values({ tenantId, actorType: "user", actorId: userId, action: "legal_matter.created", entityType: "legal_matter", entityId: ins!.id, detail: { title, matterNumber } });
    return ins;
  });

  return c.json(ok(result, "common.created", locale));
});

/** Holat/ustuvorlik/mas'ul shaxsni yangilash. */
legalMatterRoutes.patch("/legal/matters/:id", async (c) => {
  const { tenantId, userId } = c.get("auth");
  const locale = c.get("locale");
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { status?: string; priority?: string; assignedUserId?: string };

  const patch: Record<string, unknown> = {};
  if (typeof body.status === "string" && (LEGAL_MATTER_STATUSES as readonly string[]).includes(body.status)) {
    patch.status = body.status;
    if (body.status === "closed") patch.closedAt = new Date();
  }
  if (typeof body.priority === "string") patch.priority = body.priority;
  if (typeof body.assignedUserId === "string") patch.assignedUserId = body.assignedUserId;
  if (Object.keys(patch).length === 0) return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale), 422);

  const done = await withTenant(tenantId, async (tx) => {
    const [updated] = await tx.update(legalMatters).set(patch).where(eq(legalMatters.id, id)).returning({ id: legalMatters.id });
    if (!updated) return false;
    await tx.insert(auditLogs).values({ tenantId, actorType: "user", actorId: userId, action: "legal_matter.updated", entityType: "legal_matter", entityId: id, detail: patch });
    return true;
  });

  if (!done) return c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", locale), 404);
  return c.json(ok({ updated: true }, "common.updated", locale));
});

/** Hujjat tayyorlash panelida tuzilgan loyihani Tasdiqlar bo'limiga yuboradi (queueApproval AI asbobi bilan bir xil mantiq, foydalanuvchi tomonidan boshlangan). */
legalMatterRoutes.post("/legal/matters/:id/draft-approval", async (c) => {
  const { tenantId, userId } = c.get("auth");
  const locale = c.get("locale");
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { body?: string; note?: string; docType?: string };
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale), 422);
  const note = typeof body.note === "string" ? body.note.trim() : "";
  const docType = typeof body.docType === "string" ? body.docType.trim() : "";

  const result = await withTenant(tenantId, async (tx) => {
    const [matter] = await tx.select({ id: legalMatters.id }).from(legalMatters).where(eq(legalMatters.id, id)).limit(1);
    if (!matter) return null;
    const [ins] = await tx
      .insert(approvalRequests)
      .values({ tenantId, type: "matter_action", payload: { matterId: id, body: text, note, docType, source: "studio" } })
      .returning({ id: approvalRequests.id });
    await tx.insert(auditLogs).values({ tenantId, actorType: "user", actorId: userId, action: "legal_matter.draft_submitted", entityType: "legal_matter", entityId: id, detail: { docType, approvalId: ins!.id } });
    return ins;
  });

  if (!result) return c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", locale), 404);
  return c.json(ok({ queued: true, id: result.id }, "common.created", locale));
});
