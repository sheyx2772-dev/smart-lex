import { phaseProgress } from "@lex/agents";
import { format, money } from "@lex/core";
import {
  caseEvents,
  contractors,
  debtCases,
  payments,
  pendingOverrides,
  receivables,
  tenants,
  withTenant,
} from "@lex/db";
import { ERROR_CODE, fail, ok } from "@lex/shared";
import { and, desc, eq, ne } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";
import { getCaseWithDetails, listActiveCases, logCaseEvent, rerankCases, upsertDebtCase } from "../lib/debt-case";

/**
 * Command Center — avtonom undiruv OS boshqaruv paneli.
 */
export const commandCenterRoutes = new Hono<{ Variables: Variables }>();

commandCenterRoutes.get("/command-center", async (c) => {
  const { tenantId } = c.get("auth");

  const data = await withTenant(tenantId, async (tx) => {
    const [t] = await tx.select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    const agent = (t?.settings as Record<string, unknown> | undefined)?.agent as { mode?: string } | undefined;
    const mode = agent?.mode ?? "suggest";

    const caseRows = await tx
      .select({ debtCase: debtCases, receivable: receivables })
      .from(debtCases)
      .innerJoin(receivables, eq(receivables.id, debtCases.receivableId))
      .where(and(eq(debtCases.tenantId, tenantId), ne(debtCases.state, "closed")));

    let totalOutstanding = 0n;
    let dsSum = 0;
    let recSum = 0;
    for (const row of caseRows) {
      totalOutstanding += row.receivable.outstandingMinor;
      dsSum += row.debtCase.dsScore;
      recSum += row.debtCase.recoveryProbability;
    }
    const activeCases = caseRows.length;

    const priorityQueue = await listActiveCases(tx, tenantId, 10);

    const overrides = await tx
      .select()
      .from(pendingOverrides)
      .where(and(eq(pendingOverrides.tenantId, tenantId), eq(pendingOverrides.status, "pending")))
      .orderBy(desc(pendingOverrides.createdAt))
      .limit(10);

    const recentEvents = await tx
      .select()
      .from(caseEvents)
      .where(eq(caseEvents.tenantId, tenantId))
      .orderBy(desc(caseEvents.createdAt))
      .limit(30);

    const insights: string[] = [];
    const avgRecovery = activeCases ? Math.round(recSum / activeCases) : 0;
    if (avgRecovery < 50) insights.push("Portfel undirish ehtimoli past — yumshoq kelishuv takliflarini ko'rib chiqing");
    if (activeCases > 0 && dsSum / activeCases >= 70)
      insights.push(`${activeCases} ta faol ish — yuqori DS-Score bilan tez undirish mumkin`);
    if (overrides.length > 0) insights.push(`${overrides.length} ta AI tasdiq so'rovi kutilmoqda`);

    const topPriority = priorityQueue.map((row) => {
      const pb = row.debtCase;
      const channels = (pb.recommendedChannels as string[]).slice(0, 2).join("+") || "SMS";
      return {
        rank: pb.priorityRank,
        caseId: pb.id,
        caseNumber: pb.caseNumber,
        debtorName: row.contractor.name,
        amountMinor: row.receivable.outstandingMinor.toString(),
        amountFormatted: format(money(row.receivable.outstandingMinor, row.receivable.currency)),
        overdueDays: row.receivable.overdueDays,
        estimatedDays: pb.estimatedRecoveryDays,
        dsScore: pb.dsScore,
        recoveryProbability: pb.recoveryProbability,
        strategy: pb.recommendedStrategy,
        channels,
        state: pb.state,
        currentPhase: pb.currentPhase,
      };
    });

    const payRows = await tx.select().from(payments).where(eq(payments.status, "received"));
    let recoveredVal = 0n;
    for (const p of payRows) recoveredVal += p.amountMinor;
    const outstandingVal = totalOutstanding;
    const recoveryRate =
      recoveredVal + outstandingVal > 0n ? Math.round((Number(recoveredVal) / Number(recoveredVal + outstandingVal)) * 100) : null;

    return {
      agentStatus: {
        mode,
        label: mode === "auto" ? "TO'LIQ AVTONOM" : mode === "suggest" ? "TAKLIF REJIMI" : "O'CHIRILGAN",
        humanApprovalsRequired: overrides.length,
      },
      portfolio: {
        activeOutstandingMinor: totalOutstanding.toString(),
        activeOutstandingFormatted: format(money(totalOutstanding, "UZS")),
        activeCases,
        avgDsScore: activeCases ? Math.round(dsSum / activeCases) : 0,
        successRate: avgRecovery,
        recoveryRate,
      },
      topPriority,
      pendingOverrides: overrides.map((o) => ({
        id: o.id,
        type: o.type,
        debtCaseId: o.debtCaseId,
        debtorMessage: o.debtorMessage,
        aiRecommendation: o.aiRecommendation,
        autoExecuteAt: o.autoExecuteAt?.toISOString() ?? null,
      })),
      insights,
      recentEvents: recentEvents.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        debtCaseId: e.debtCaseId,
        detail: e.detail,
        createdAt: e.createdAt?.toISOString() ?? null,
      })),
    };
  });

  return c.json(ok(data, "common.ok", c.get("locale")));
});

commandCenterRoutes.get("/command-center/cases/:id", async (c) => {
  const { tenantId } = c.get("auth");
  const caseId = c.req.param("id");

  const detail = await withTenant(tenantId, async (tx) => getCaseWithDetails(tx, tenantId, caseId));
  if (!detail) return c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", c.get("locale")), 404);

  const { debtCase, playbook, events, overrides, contractor, invoice, receivable } = detail;
  const totalPhases = playbook?.phases.length ?? 1;
  const progress = phaseProgress(debtCase.currentPhase, totalPhases);

  return c.json(
    ok(
      {
        case: {
          id: debtCase.id,
          number: debtCase.caseNumber,
          state: debtCase.state,
          dsScore: debtCase.dsScore,
          recoveryProbability: debtCase.recoveryProbability,
          optimalSettlementPct: debtCase.optimalSettlementPct,
          estimatedRecoveryDays: debtCase.estimatedRecoveryDays,
          scoreFactors: debtCase.scoreFactors,
          receivableId: debtCase.receivableId,
        },
        debtor: contractor ? { name: contractor.name, tin: contractor.tin } : null,
        debt: receivable
          ? {
              outstandingMinor: receivable.outstandingMinor.toString(),
              formatted: format(money(receivable.outstandingMinor, receivable.currency)),
              overdueDays: receivable.overdueDays,
              invoiceNumber: invoice?.number,
            }
          : null,
        playbook: playbook
          ? {
              strategyType: playbook.strategyType,
              currentPhase: playbook.currentPhase,
              progress,
              phases: playbook.phases,
              exitConditions: playbook.exitConditions,
            }
          : null,
        events: events.map((e) => ({
          eventType: e.eventType,
          detail: e.detail,
          createdAt: e.createdAt?.toISOString(),
        })),
        pendingOverrides: overrides,
      },
      "common.ok",
      c.get("locale"),
    ),
  );
});

commandCenterRoutes.post("/command-center/overrides/:id/decide", async (c) => {
  const { tenantId, userId, role } = c.get("auth");
  if (role !== "owner" && role !== "admin" && role !== "legal") {
    return c.json({ success: false, data: null, error: "forbidden", message: "faqat rahbar" }, 403);
  }
  const overrideId = c.req.param("id");
  const raw = (await c.req.json().catch(() => ({}))) as { decision?: unknown };
  if (raw.decision !== "approved" && raw.decision !== "rejected") {
    return c.json({ success: false, data: null, error: "validation_failed", message: "decision noto'g'ri" }, 422);
  }
  const body = { decision: raw.decision };

  await withTenant(tenantId, async (tx) => {
    const [o] = await tx.select().from(pendingOverrides).where(eq(pendingOverrides.id, overrideId)).limit(1);
    if (!o) return;
    await tx
      .update(pendingOverrides)
      .set({
        status: body.decision === "approved" ? "approved" : "rejected",
        decidedByUserId: userId,
        decidedAt: new Date(),
      })
      .where(eq(pendingOverrides.id, overrideId));
    await logCaseEvent(tx, tenantId, o.debtCaseId, `override.${body.decision}`, { overrideId });
  });

  return c.json(ok({ decided: body.decision }, "common.ok", c.get("locale")));
});
