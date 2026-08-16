import { studioReply } from "@lex/agents";
import { approvalRequests, auditLogs, contractors, legalAgentTasks, legalMatters, withTenant } from "@lex/db";
import { ERROR_CODE, fail, ok } from "@lex/shared";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";

/** "AI Vazifalari" navbati — apps/worker/src/legal-tasks.ts to'ldiradi (fon jarayoni),
 * bu yerda faqat o'qish + "Tasdiqlash"/"Agent ishlasin" amallari. */
export const legalTaskRoutes = new Hono<{ Variables: Variables }>();

const CATEGORY_RANK: Record<string, number> = { urgent: 0, recommendation: 1, auto_check: 2 };

legalTaskRoutes.get("/legal/tasks", async (c) => {
  const { tenantId } = c.get("auth");
  const locale = c.get("locale");

  const rows = await withTenant(tenantId, (tx) =>
    tx
      .select({
        id: legalAgentTasks.id,
        category: legalAgentTasks.category,
        title: legalAgentTasks.title,
        reason: legalAgentTasks.reason,
        legalMatterId: legalAgentTasks.legalMatterId,
        contractorId: legalAgentTasks.contractorId,
        documentId: legalAgentTasks.documentId,
        createdAt: legalAgentTasks.createdAt,
        contractorName: contractors.name,
        matterTitle: legalMatters.title,
      })
      .from(legalAgentTasks)
      .leftJoin(contractors, eq(legalAgentTasks.contractorId, contractors.id))
      .leftJoin(legalMatters, eq(legalAgentTasks.legalMatterId, legalMatters.id))
      .where(eq(legalAgentTasks.status, "pending"))
      .orderBy(desc(legalAgentTasks.createdAt))
      .limit(30),
  );

  rows.sort((a, b) => (CATEGORY_RANK[a.category] ?? 9) - (CATEGORY_RANK[b.category] ?? 9));
  return c.json(ok(rows, "common.ok", locale));
});

/** Vazifani "bajarildi" deb belgilaydi — foydalanuvchi tekshirib chiqqach. */
legalTaskRoutes.post("/legal/tasks/:id/resolve", async (c) => {
  const { tenantId, userId } = c.get("auth");
  const locale = c.get("locale");
  const id = c.req.param("id");

  const done = await withTenant(tenantId, async (tx) => {
    const [updated] = await tx
      .update(legalAgentTasks)
      .set({ status: "done" })
      .where(and(eq(legalAgentTasks.id, id), eq(legalAgentTasks.status, "pending")))
      .returning({ id: legalAgentTasks.id });
    if (!updated) return false;
    await tx.insert(auditLogs).values({ tenantId, actorType: "user", actorId: userId, action: "legal_task.resolved", entityType: "legal_agent_task", entityId: id });
    return true;
  });

  if (!done) return c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", locale), 404);
  return c.json(ok({ resolved: true }, "common.updated", locale));
});

/** "Agent ishlasin" — muddat (urgent) vazifasi uchun AI qisqa xat/eslatma qoralamasini
 * tayyorlaydi va Tasdiqlar bo'limiga qo'yadi (o'zi yubormaydi — inson tasdig'i shart). */
legalTaskRoutes.post("/legal/tasks/:id/agent-run", async (c) => {
  const { tenantId } = c.get("auth");
  const locale = c.get("locale");
  const id = c.req.param("id");

  const result = await withTenant(tenantId, async (tx) => {
    const [task] = await tx.select().from(legalAgentTasks).where(and(eq(legalAgentTasks.id, id), eq(legalAgentTasks.status, "pending"))).limit(1);
    if (!task) return null;

    const draft = await studioReply({
      locale,
      instruction: `Ushbu yuridik ish bo'yicha muddat masalasi yuzasidan qisqa, professional ichki eslatma/xat matnini tuz: "${task.title}". Sabab: ${task.reason}. Kimga yuborilishi va aniq amal (masalan sudga topshirish, kontragentga xabar berish) haqida taklif ber.`,
      document: "",
    });

    const [appr] = await tx
      .insert(approvalRequests)
      .values({
        tenantId,
        type: "matter_action",
        payload: { matterId: task.legalMatterId, body: draft, note: task.reason, source: "ai_agent" },
      })
      .returning({ id: approvalRequests.id });

    await tx.update(legalAgentTasks).set({ status: "done" }).where(eq(legalAgentTasks.id, id));
    await tx.insert(auditLogs).values({
      tenantId,
      actorType: "ai_agent",
      actorId: "legal-agent",
      action: "legal_task.agent_run",
      entityType: "legal_agent_task",
      entityId: id,
      detail: { approvalId: appr?.id },
    });

    return { draft, approvalId: appr?.id ?? null };
  });

  if (!result) return c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", locale), 404);
  return c.json(ok(result, "common.updated", locale));
});
