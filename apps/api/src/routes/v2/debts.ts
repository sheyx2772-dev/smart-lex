import { format, money } from "@lex/core";
import { contractors, debtCases, receivables, tenants, withTenant } from "@lex/db";
import { ERROR_CODE, fail, ok } from "@lex/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../../lib/context";
import { getCaseWithDetails, listAllCases, rerankCases, upsertDebtCase } from "../../lib/debt-case";

/**
 * SMARTLEX API v2 — Debt Case centric REST API (Kimi prompt spec).
 * Base: /api/v2/debts
 */
export const v2DebtRoutes = new Hono<{ Variables: Variables }>();

/** GET /api/v2/debts — faol qarz ishlar ro'yxati */
v2DebtRoutes.get("/debts", async (c) => {
  const { tenantId } = c.get("auth");
  const rows = await withTenant(tenantId, (tx) => listAllCases(tx, tenantId, 100));
  return c.json(
    ok(
      rows.map((r) => ({
        id: r.debtCase.id,
        caseNumber: r.debtCase.caseNumber,
        receivableId: r.debtCase.receivableId,
        debtorName: r.contractor.name,
        amountMinor: r.receivable.outstandingMinor.toString(),
        amountFormatted: format(money(r.receivable.outstandingMinor, r.receivable.currency)),
        dsScore: r.debtCase.dsScore,
        recoveryProbability: r.debtCase.recoveryProbability,
        strategy: r.debtCase.recommendedStrategy,
        state: r.debtCase.state,
        priorityRank: r.debtCase.priorityRank,
        overdueDays: r.receivable.overdueDays,
      })),
      "common.ok",
      c.get("locale"),
    ),
  );
});

/** GET /api/v2/debts/:id/score — DS-Score natijasi */
v2DebtRoutes.get("/debts/:id/score", async (c) => {
  const { tenantId } = c.get("auth");
  const id = c.req.param("id");
  const [row] = await withTenant(tenantId, (tx) =>
    tx.select().from(debtCases).where(and(eq(debtCases.id, id), eq(debtCases.tenantId, tenantId))).limit(1),
  );
  if (!row) return c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", c.get("locale")), 404);
  return c.json(
    ok(
      {
        dsScore: row.dsScore,
        recoveryProbability: row.recoveryProbability / 100,
        recommendedStrategy: row.recommendedStrategy,
        recommendedChannels: row.recommendedChannels,
        optimalSettlement: row.optimalSettlementPct / 100,
        estimatedRecoveryDays: row.estimatedRecoveryDays,
        priorityRank: row.priorityRank,
        factors: row.scoreFactors,
      },
      "common.ok",
      c.get("locale"),
    ),
  );
});

/** GET /api/v2/debts/:id/playbook — to'liq recovery playbook */
v2DebtRoutes.get("/debts/:id/playbook", async (c) => {
  const { tenantId } = c.get("auth");
  const id = c.req.param("id");
  const detail = await withTenant(tenantId, (tx) => getCaseWithDetails(tx, tenantId, id));
  if (!detail?.playbook) return c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", c.get("locale")), 404);
  return c.json(
    ok(
      {
        caseId: id,
        strategyType: detail.playbook.strategyType,
        currentPhase: detail.playbook.currentPhase,
        phases: detail.playbook.phases,
        exitConditions: detail.playbook.exitConditions,
        version: detail.playbook.version,
      },
      "common.ok",
      c.get("locale"),
    ),
  );
});

/** GET /api/v2/debts/:id/status — real-time holat */
v2DebtRoutes.get("/debts/:id/status", async (c) => {
  const { tenantId } = c.get("auth");
  const id = c.req.param("id");
  const detail = await withTenant(tenantId, (tx) => getCaseWithDetails(tx, tenantId, id));
  if (!detail) return c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", c.get("locale")), 404);
  return c.json(
    ok(
      {
        caseNumber: detail.debtCase.caseNumber,
        state: detail.debtCase.state,
        dsScore: detail.debtCase.dsScore,
        currentPhase: detail.debtCase.currentPhase,
        receivableStatus: detail.receivable?.status,
        outstandingMinor: detail.receivable?.outstandingMinor.toString(),
        pendingOverrides: detail.overrides.length,
        recentEvents: detail.events.slice(0, 5).map((e) => e.eventType),
      },
      "common.ok",
      c.get("locale"),
    ),
  );
});

/** POST /api/v2/debts/:id/rescore — DS-Score qayta hisoblash */
v2DebtRoutes.post("/debts/:id/rescore", async (c) => {
  const { tenantId } = c.get("auth");
  const id = c.req.param("id");

  const result = await withTenant(tenantId, async (tx) => {
    const detail = await getCaseWithDetails(tx, tenantId, id);
    if (!detail?.receivable || !detail.contractor) return null;

    const [tenantRow] = await tx.select().from(debtCases).where(eq(debtCases.id, id)).limit(1);
    if (!tenantRow) return null;

    await upsertDebtCase(tx, {
      tenantId,
      receivableId: detail.debtCase.receivableId,
      locale: "uz",
      creditorName: "Creditor",
      debtorName: detail.contractor.name,
      amountMajor: Number(detail.receivable.outstandingMinor) / 100,
      penaltyMajor: Number(detail.receivable.penaltyMinor) / 100,
      currency: detail.receivable.currency,
      overdueDays: detail.receivable.overdueDays,
      agingBucket: detail.receivable.agingBucket,
      riskScore: detail.receivable.riskScore,
      riskFactors: [],
      executedStages: detail.receivable.executedStages ?? [],
      availableChannels: ["sms", "email"],
    });
    await rerankCases(tx, tenantId);
    const [updated] = await tx.select().from(debtCases).where(eq(debtCases.id, id)).limit(1);
    return updated;
  });

  if (!result) return c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", c.get("locale")), 404);
  return c.json(ok({ dsScore: result.dsScore, priorityRank: result.priorityRank }, "common.ok", c.get("locale")));
});

/** POST /api/v2/batches/analyze — barcha overdue receivables uchun case yaratish */
v2DebtRoutes.post("/batches/analyze", async (c) => {
  const { tenantId } = c.get("auth");
  const body = (await c.req.json().catch(() => ({}))) as { aggressiveness?: "soft" | "normal" | "aggressive" };

  const synced = await withTenant(tenantId, async (tx) => {
    const [tenant] = await tx.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    if (!tenant) return 0;

    const recs = await tx
      .select()
      .from(receivables)
      .where(and(eq(receivables.tenantId, tenantId), eq(receivables.status, "overdue")));

    let n = 0;
    for (const rec of recs) {
      const [contractor] = await tx.select().from(contractors).where(eq(contractors.id, rec.contractorId)).limit(1);
      if (!contractor) continue;
      const channels: ("sms" | "email" | "telegram")[] = [];
      if (contractor.phone) channels.push("sms");
      if (contractor.email) channels.push("email");
      if (contractor.telegramId) channels.push("telegram");
      await upsertDebtCase(tx, {
        tenantId,
        receivableId: rec.id,
        locale: tenant.defaultLocale,
        creditorName: tenant.name,
        debtorName: contractor.name,
        amountMajor: Number(rec.outstandingMinor) / 100,
        penaltyMajor: Number(rec.penaltyMinor) / 100,
        currency: rec.currency,
        overdueDays: rec.overdueDays,
        agingBucket: rec.agingBucket,
        riskScore: rec.riskScore,
        riskFactors: [],
        executedStages: rec.executedStages ?? [],
        availableChannels: channels,
        aggressiveness: body.aggressiveness,
      });
      n++;
    }
    await rerankCases(tx, tenantId);
    return n;
  });

  return c.json(ok({ analyzed: synced }, "common.ok", c.get("locale")));
});
