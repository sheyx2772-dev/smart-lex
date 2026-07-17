import { type CollectionStep, calcRisk, daysBetween, dueCollectionSteps, DEFAULT_COLLECTION_STEPS, format, money } from "@lex/core";
import { agentTasks, approvalRequests, auditLogs, collectionRules, contractors, contracts, invoices, receivables, withTenant } from "@lex/db";
import { ERROR_CODE, fail, type CollectionStage, ok } from "@lex/shared";
import { and, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";

export const agentConsoleRoutes = new Hono<{ Variables: Variables }>();

const amount = (minor: bigint, currency: string) => ({ minor: minor.toString(), formatted: format(money(minor, currency)) });

/** Tenant collection siyosati (default) yoki standart qoidalar. */
async function tenantSteps(tx: Parameters<Parameters<typeof withTenant>[1]>[0]): Promise<CollectionStep[]> {
  const [rule] = await tx.select({ steps: collectionRules.steps }).from(collectionRules).where(eq(collectionRules.isDefault, true)).limit(1);
  const raw = (rule?.steps as CollectionStep[] | undefined) ?? null;
  return raw && raw.length ? raw : DEFAULT_COLLECTION_STEPS;
}

/** Bitta debitorlik uchun AI reasoning + tavsiya (deterministik, shaffof). */
function analyze(r: {
  outstandingMinor: bigint;
  penaltyMinor: bigint;
  invoiceAmount: bigint;
  overdueDays: number;
  agingBucket: string;
  executedStages: CollectionStage[];
  dueDate: Date;
  now: Date;
  steps: CollectionStep[];
}) {
  const outstandingRatio = r.invoiceAmount > 0n ? Number(r.outstandingMinor) / Number(r.invoiceAmount) : 1;
  const priorDemandCount = r.executedStages.includes("demand_letter") ? 1 : 0;
  const latePaymentCount = r.executedStages.filter((s) => s === "firm_reminder" || s === "soft_reminder").length;

  const risk = calcRisk({ maxOverdueDays: r.overdueDays, outstandingRatio, latePaymentCount, priorDemandCount });

  // Hozir muddati kelgan, bajarilmagan bosqich (darhol harakat).
  const due = dueCollectionSteps({ steps: r.steps, dueDate: r.dueDate, now: r.now, executedStages: r.executedStages });
  const next = due[due.length - 1] ?? null;

  // Keyingi rejalashtirilgan (hali muddati kelmagan) bosqich — agentning "reja"si.
  const executed = new Set(r.executedStages);
  const daysFromDue = daysBetween(r.dueDate, r.now);
  const upcoming = r.steps
    .filter((s) => !executed.has(s.stage))
    .filter((s) => daysFromDue < s.offsetDays)
    .sort((a, b) => a.offsetDays - b.offsetDays)[0] ?? null;

  return {
    riskScore: risk.score,
    riskBand: risk.band,
    factors: risk.factors.map((f) => ({ label: f.label, points: Math.round(f.points) })),
    outstandingRatio: Math.round(outstandingRatio * 100),
    done: r.executedStages,
    recommendation: next ? { stage: next.stage, requiresApproval: next.requiresApproval } : null,
    scheduled: upcoming
      ? { stage: upcoming.stage, requiresApproval: upcoming.requiresApproval, inDays: upcoming.offsetDays - daysFromDue }
      : null,
  };
}

/**
 * AI Agent Konsoli — har bir faol debitorlik uchun agentning "fikrlash izi":
 * ko'rgan faktlari, risk omillari, va tavsiya etgan keyingi harakati.
 */
agentConsoleRoutes.get("/agent/console", async (c) => {
  const { tenantId } = c.get("auth");
  const now = new Date();

  const data = await withTenant(tenantId, async (tx) => {
    const steps = await tenantSteps(tx);

    const rows = await tx
      .select({
        id: receivables.id,
        status: receivables.status,
        outstandingMinor: receivables.outstandingMinor,
        penaltyMinor: receivables.penaltyMinor,
        currency: receivables.currency,
        overdueDays: receivables.overdueDays,
        agingBucket: receivables.agingBucket,
        executedStages: receivables.executedStages,
        invoiceNumber: invoices.number,
        invoiceAmount: invoices.amountMinor,
        dueDate: invoices.dueDate,
        penaltyDailyBps: contracts.penaltyDailyBps,
        contractorName: contractors.name,
        contractorTin: contractors.tin,
        contractorId: contractors.id,
      })
      .from(receivables)
      .innerJoin(invoices, eq(receivables.invoiceId, invoices.id))
      .innerJoin(contractors, eq(receivables.contractorId, contractors.id))
      .leftJoin(contracts, eq(invoices.contractId, contracts.id))
      .where(sql`${receivables.status} <> 'paid'`)
      .orderBy(desc(receivables.overdueDays));

    // Har debitorlik uchun kutilayotgan tasdiqlar (agent tayyorlagan).
    const pending = await tx
      .select({ receivableId: approvalRequests.receivableId, type: approvalRequests.type })
      .from(approvalRequests)
      .where(eq(approvalRequests.status, "pending"));
    const pendingByRec = new Map<string, string>();
    for (const p of pending) if (p.receivableId) pendingByRec.set(p.receivableId, p.type);

    const currency = rows[0]?.currency ?? "UZS";

    const items = rows.map((r) => {
      const a = analyze({
        outstandingMinor: r.outstandingMinor,
        penaltyMinor: r.penaltyMinor,
        invoiceAmount: r.invoiceAmount,
        overdueDays: r.overdueDays,
        agingBucket: r.agingBucket,
        executedStages: (r.executedStages ?? []) as CollectionStage[],
        dueDate: r.dueDate,
        now,
        steps,
      });
      return {
        id: r.id,
        contractorId: r.contractorId,
        contractorName: r.contractorName,
        contractorTin: r.contractorTin,
        invoiceNumber: r.invoiceNumber,
        status: r.status,
        dueDate: r.dueDate,
        overdueDays: r.overdueDays,
        agingBucket: r.agingBucket,
        outstanding: amount(r.outstandingMinor, r.currency),
        penalty: amount(r.penaltyMinor, r.currency),
        invoiceAmount: amount(r.invoiceAmount, r.currency),
        penaltyDailyBps: r.penaltyDailyBps ?? 0,
        executedStages: (r.executedStages ?? []) as string[],
        pendingApproval: pendingByRec.get(r.id) ?? null,
        ...a,
      };
    });

    const summary = {
      analyzed: items.length,
      overdue: items.filter((i) => i.overdueDays > 0).length,
      needsAction: items.filter((i) => i.recommendation).length,
      needsApproval: items.filter((i) => i.recommendation?.requiresApproval || i.scheduled?.requiresApproval || i.pendingApproval).length,
      highRisk: items.filter((i) => i.riskBand === "high").length,
    };

    return { currency, summary, items };
  });

  return c.json(ok(data, "common.ok", c.get("locale")));
});

/**
 * Agentni ishga tushirish — barcha debitorliklarni qayta baholaydi (risk-skor yangilanadi),
 * har biri uchun audit yozadi. Deterministik va idempotent (pul/aging'ga tegmaydi — bu monitor ishi).
 */
agentConsoleRoutes.post("/agent/run", async (c) => {
  const { tenantId, userId } = c.get("auth");
  const now = new Date();

  const result = await withTenant(tenantId, async (tx) => {
    const steps = await tenantSteps(tx);
    const rows = await tx
      .select({
        id: receivables.id,
        outstandingMinor: receivables.outstandingMinor,
        penaltyMinor: receivables.penaltyMinor,
        overdueDays: receivables.overdueDays,
        agingBucket: receivables.agingBucket,
        executedStages: receivables.executedStages,
        riskScore: receivables.riskScore,
        invoiceAmount: invoices.amountMinor,
        dueDate: invoices.dueDate,
      })
      .from(receivables)
      .innerJoin(invoices, eq(receivables.invoiceId, invoices.id))
      .where(sql`${receivables.status} <> 'paid'`);

    let updated = 0;
    let needsAction = 0;
    for (const r of rows) {
      const a = analyze({
        outstandingMinor: r.outstandingMinor,
        penaltyMinor: r.penaltyMinor,
        invoiceAmount: r.invoiceAmount,
        overdueDays: r.overdueDays,
        agingBucket: r.agingBucket,
        executedStages: (r.executedStages ?? []) as CollectionStage[],
        dueDate: r.dueDate,
        now,
        steps,
      });
      if (a.recommendation) needsAction++;
      if (a.riskScore !== r.riskScore) {
        await tx.update(receivables).set({ riskScore: a.riskScore, lastEvaluatedAt: now }).where(eq(receivables.id, r.id));
        updated++;
      }
    }

    await tx.insert(auditLogs).values({
      tenantId,
      actorType: "ai_agent",
      actorId: userId,
      action: "agent.evaluated",
      entityType: "receivable",
      entityId: null,
      detail: { analyzed: rows.length, riskUpdated: updated, needsAction },
    });

    return { analyzed: rows.length, riskUpdated: updated, needsAction };
  });

  return c.json(ok(result, "common.ok", c.get("locale")));
});

// ─── Platformaga topshiriqlar (agent tasks) ─────────────────────────────────
const TASK_ACTIONS = new Set(["analyze", "score", "demand", "custom"]);
const CAN_TASK = new Set(["owner", "admin", "finance", "legal"]);

/** Topshiriqlar ro'yxati (qarzdor nomi bilan). */
agentConsoleRoutes.get("/agent/tasks", async (c) => {
  const { tenantId } = c.get("auth");
  const items = await withTenant(tenantId, (tx) =>
    tx
      .select({
        id: agentTasks.id,
        action: agentTasks.action,
        title: agentTasks.title,
        receivableId: agentTasks.receivableId,
        deadline: agentTasks.deadline,
        status: agentTasks.status,
        result: agentTasks.result,
        completedAt: agentTasks.completedAt,
        createdAt: agentTasks.createdAt,
        contractorName: contractors.name,
      })
      .from(agentTasks)
      .leftJoin(receivables, eq(agentTasks.receivableId, receivables.id))
      .leftJoin(contractors, eq(receivables.contractorId, contractors.id))
      .orderBy(desc(agentTasks.createdAt)),
  );
  return c.json(ok({ items }, "common.ok", c.get("locale")));
});

/** Topshiriq yaratish — platformaga ish biriktirish. */
agentConsoleRoutes.post("/agent/tasks", async (c) => {
  const locale = c.get("locale");
  const { tenantId, userId, role } = c.get("auth");
  if (!CAN_TASK.has(role)) return c.json(fail(ERROR_CODE.FORBIDDEN, "auth.forbidden", locale), 403);
  const body = (await c.req.json().catch(() => ({}))) as { action?: string; title?: string; receivableId?: string; deadline?: string };
  if (!body.action || !TASK_ACTIONS.has(body.action) || !body.title?.trim()) {
    return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale), 422);
  }
  const [task] = await withTenant(tenantId, (tx) =>
    tx
      .insert(agentTasks)
      .values({
        tenantId,
        action: body.action!,
        title: body.title!.trim(),
        receivableId: body.receivableId || null,
        deadline: body.deadline ? new Date(body.deadline) : null,
        createdByUserId: userId,
      })
      .returning(),
  );
  return c.json(ok(task, "common.created", locale));
});

/** Topshiriqni bajarish — platforma (agent) ishni deterministik amalga oshiradi. */
agentConsoleRoutes.post("/agent/tasks/:id/run", async (c) => {
  const locale = c.get("locale");
  const { tenantId, userId, role } = c.get("auth");
  if (!CAN_TASK.has(role)) return c.json(fail(ERROR_CODE.FORBIDDEN, "auth.forbidden", locale), 403);
  const id = c.req.param("id");
  const now = new Date();

  const out = await withTenant(tenantId, async (tx) => {
    const [task] = await tx.select().from(agentTasks).where(eq(agentTasks.id, id)).limit(1);
    if (!task) return { notFound: true as const };
    if (task.status === "done") return { task };

    let result = "";
    // Nishon debitorlik ma'lumoti (bo'lsa).
    const rec = task.receivableId
      ? (
          await tx
            .select({
              recId: receivables.id,
              outstandingMinor: receivables.outstandingMinor,
              penaltyMinor: receivables.penaltyMinor,
              overdueDays: receivables.overdueDays,
              agingBucket: receivables.agingBucket,
              executedStages: receivables.executedStages,
              riskScore: receivables.riskScore,
              currency: receivables.currency,
              invoiceAmount: invoices.amountMinor,
              invoiceNumber: invoices.number,
              dueDate: invoices.dueDate,
              contractorName: contractors.name,
              contractorTin: contractors.tin,
              contractNumber: contracts.number,
            })
            .from(receivables)
            .innerJoin(invoices, eq(receivables.invoiceId, invoices.id))
            .leftJoin(contractors, eq(receivables.contractorId, contractors.id))
            .leftJoin(contracts, eq(invoices.contractId, contracts.id))
            .where(eq(receivables.id, task.receivableId))
            .limit(1)
        )[0]
      : undefined;

    if (task.action === "score" && rec) {
      const outstandingRatio = rec.invoiceAmount > 0n ? Number(rec.outstandingMinor) / Number(rec.invoiceAmount) : 0;
      const risk = calcRisk({
        maxOverdueDays: rec.overdueDays,
        outstandingRatio,
        latePaymentCount: 0,
        priorDemandCount: (rec.executedStages ?? []).includes("demand_letter") ? 1 : 0,
      });
      await tx.update(receivables).set({ riskScore: risk.score, lastEvaluatedAt: now }).where(and(eq(receivables.id, rec.recId), eq(receivables.tenantId, tenantId)));
      result = `Risk qayta baholandi: ${risk.score}/100.`;
    } else if (task.action === "analyze" && rec) {
      const steps = await tenantSteps(tx);
      const a = analyze({
        outstandingMinor: rec.outstandingMinor,
        penaltyMinor: rec.penaltyMinor,
        invoiceAmount: rec.invoiceAmount,
        overdueDays: rec.overdueDays,
        agingBucket: rec.agingBucket,
        executedStages: (rec.executedStages ?? []) as CollectionStage[],
        dueDate: rec.dueDate,
        now,
        steps,
      });
      result = a.recommendation ? `Tavsiya: keyingi bosqich — ${a.recommendation.stage}. Risk: ${a.riskScore}/100.` : `Harakat talab etilmaydi. Risk: ${a.riskScore}/100.`;
    } else if (task.action === "demand" && rec) {
      result = [
        "TALABNOMA (loyiha)",
        `Qarzdor: ${rec.contractorName ?? "—"} (STIR ${rec.contractorTin ?? "—"})`,
        `Shartnoma: ${rec.contractNumber ?? "—"} · Faktura: ${rec.invoiceNumber}`,
        `Muddati o'tgan qarz: ${format(money(rec.outstandingMinor, rec.currency))}, kechikish ${rec.overdueDays} kun.`,
        "10 kun ichida to'lash talab qilinadi, aks holda sudga da'vo beriladi.",
      ].join("\n");
    } else {
      result = "Bajarildi.";
    }

    const [updated] = await tx
      .update(agentTasks)
      .set({ status: "done", result, completedAt: now })
      .where(and(eq(agentTasks.id, id), eq(agentTasks.tenantId, tenantId)))
      .returning();

    await tx.insert(auditLogs).values({
      tenantId,
      actorType: "ai_agent",
      actorId: userId,
      action: "agent.task_ran",
      entityType: "agent_task",
      entityId: id,
      detail: { action: task.action },
    });

    return { task: updated };
  });

  if ("notFound" in out) return c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", locale), 404);
  return c.json(ok(out.task, "common.updated", locale));
});
