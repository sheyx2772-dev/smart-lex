import { approvalRequests, auditLogs, contractors, documents, invoices, legalMatters, receivables, reminders, withTenant } from "@lex/db";
import { ERROR_CODE, fail, ok } from "@lex/shared";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";
import { decisionSchema, validate } from "../lib/validation";

export const approvalRoutes = new Hono<{ Variables: Variables }>();

const CAN_DECIDE = new Set(["owner", "admin", "legal"]);

/** Tasdiq navbati (AI Approvals). */
approvalRoutes.get("/", async (c) => {
  const { tenantId } = c.get("auth");
  const status = c.req.query("status") ?? "pending";

  const rows = await withTenant(tenantId, (tx) =>
    tx
      .select({
        id: approvalRequests.id,
        type: approvalRequests.type,
        status: approvalRequests.status,
        payload: approvalRequests.payload,
        createdAt: approvalRequests.createdAt,
        decidedAt: approvalRequests.decidedAt,
        contractorName: contractors.name,
        invoiceNumber: invoices.number,
        overdueDays: receivables.overdueDays,
      })
      .from(approvalRequests)
      .leftJoin(receivables, eq(approvalRequests.receivableId, receivables.id))
      .leftJoin(invoices, eq(receivables.invoiceId, invoices.id))
      .leftJoin(contractors, eq(receivables.contractorId, contractors.id))
      .where(eq(approvalRequests.status, status as "pending" | "approved" | "rejected"))
      .orderBy(desc(approvalRequests.createdAt)),
  );

  return c.json(ok(rows, "common.ok", c.get("locale")));
});

/** Tasdiqlash / rad etish (rahbar amali). */
approvalRoutes.post("/:id/decide", async (c) => {
  const locale = c.get("locale");
  const { tenantId, userId, role } = c.get("auth");

  if (!CAN_DECIDE.has(role)) {
    return c.json(fail(ERROR_CODE.FORBIDDEN, "auth.forbidden", locale), 403);
  }

  const parsed = validate(decisionSchema, await c.req.json().catch(() => null));
  if (!parsed.ok) {
    return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale, { fields: parsed.fields }), 422);
  }
  const id = c.req.param("id");

  const result = await withTenant(tenantId, async (tx) => {
    const [updated] = await tx
      .update(approvalRequests)
      .set({ status: parsed.data.decision, decidedByUserId: userId, decidedAt: new Date() })
      .where(and(eq(approvalRequests.id, id), eq(approvalRequests.status, "pending")))
      .returning();
    if (!updated) return null;

    await tx.insert(auditLogs).values({
      tenantId,
      actorType: "user",
      actorId: userId,
      action: `approval.${parsed.data.decision}`,
      entityType: "approval_request",
      entityId: id,
      detail: { type: updated.type },
    });

    // ── Tasdiqlangan talabnoma → tizim bajaradi: matnni saqlaydi, "yuboradi",
    //    bosqichni ilgarilatadi (AI-first oqim: odam tasdiqladi, tizim harakat qildi). ──
    const payload = (updated.payload ?? {}) as Record<string, unknown>;
    const editedBody = parsed.data.body ?? (typeof payload.body === "string" ? payload.body : "");

    if (parsed.data.decision === "approved" && updated.type === "demand_letter") {
      const sig = parsed.data.signature;
      // 1) Tahrirlangan matnni + (bo'lsa) E-IMZO imzosini hujjatga saqlaymiz.
      if (updated.documentId && (editedBody || sig)) {
        await tx
          .update(documents)
          .set({ extracted: { ...(payload as object), body: editedBody, ...(sig ? { signature: sig } : {}) } })
          .where(eq(documents.id, updated.documentId));
      }
      // E-IMZO imzosi qo'yilgan bo'lsa — audit (imzo metadatasi bilan).
      if (sig) {
        await tx.insert(auditLogs).values({
          tenantId,
          actorType: "user",
          actorId: userId,
          action: "document.signed",
          entityType: "document",
          entityId: updated.documentId,
          detail: { signer: sig.signerName, certSerial: sig.certSerial, provider: sig.provider },
        });
      }

      if (updated.receivableId) {
        const [rec] = await tx.select().from(receivables).where(eq(receivables.id, updated.receivableId)).limit(1);
        if (rec) {
          const [contractor] = await tx.select().from(contractors).where(eq(contractors.id, rec.contractorId)).limit(1);
          // 2) Talabnomani rasmiy kanal orqali "yuboramiz" (mock — jurnalga yoziladi).
          await tx.insert(reminders).values({
            tenantId,
            receivableId: rec.id,
            stage: "demand_letter",
            channel: "hybrid_post",
            status: "sent",
            address: contractor?.email ?? contractor?.phone ?? "—",
            body: editedBody,
            sentAt: new Date(),
          });
          // 3) Bosqichni ilgarilatamiz (takror yuborilmasligi uchun).
          const stages = new Set<string>(rec.executedStages ?? []);
          stages.add("demand_letter");
          await tx.update(receivables).set({ executedStages: [...stages] }).where(eq(receivables.id, rec.id));
          // 4) Audit: yuborildi.
          await tx.insert(auditLogs).values({
            tenantId,
            actorType: "system",
            actorId: "collection-agent",
            action: "demand.sent",
            entityType: "receivable",
            entityId: rec.id,
            detail: { channel: "hybrid_post", edited: Boolean(parsed.data.body) },
          });
        }
      }
    }

    // ── Tasdiqlangan yuridik ish amali → tegishli legal_matters yozuvini "topshirildi"
    //    bosqichiga o'tkazamiz (AI-first oqim: odam tasdiqladi, tizim holatni ilgarilatdi). ──
    if (parsed.data.decision === "approved" && updated.type === "matter_action") {
      const matterId = typeof payload.matterId === "string" ? payload.matterId : null;
      if (matterId) {
        await tx.update(legalMatters).set({ status: "filed" }).where(eq(legalMatters.id, matterId));
        await tx.insert(auditLogs).values({
          tenantId,
          actorType: "system",
          actorId: "legal-agent",
          action: "matter.filed",
          entityType: "legal_matter",
          entityId: matterId,
          detail: { via: "approval", approvalId: id },
        });
      }
    }

    return updated;
  });

  if (!result) {
    return c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", locale), 404);
  }
  return c.json(ok({ id: result.id, status: result.status }, "common.updated", locale));
});
