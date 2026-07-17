import { type AgingBucket, calcPenalty, calcRisk, evaluateReceivable, format, money } from "@lex/core";
import {
  auditLogs,
  contractors,
  contracts,
  invoices,
  payments,
  receivables,
  reminders,
  withTenant,
} from "@lex/db";
import { ERROR_CODE, fail, ok, type ReceivableStatus } from "@lex/shared";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";
import { pageMeta, pageParams } from "../lib/pagination";
import { paymentSchema, validate } from "../lib/validation";

export const receivableRoutes = new Hono<{ Variables: Variables }>();

const amount = (minor: bigint, currency: string) => ({
  minor: minor.toString(),
  formatted: format(money(minor, currency)),
});

/** Dashboard/Receivables agregatlari (diagramma uchun). */
receivableRoutes.get("/receivables/summary", async (c) => {
  const { tenantId } = c.get("auth");
  const rows = await withTenant(tenantId, (tx) =>
    tx
      .select({
        status: receivables.status,
        outstandingMinor: receivables.outstandingMinor,
        penaltyMinor: receivables.penaltyMinor,
        currency: receivables.currency,
        agingBucket: receivables.agingBucket,
        riskScore: receivables.riskScore,
      })
      .from(receivables),
  );

  const byStatus: Record<ReceivableStatus, number> = {
    pending: 0, partial: 0, paid: 0, overdue: 0, written_off: 0,
  };
  const byAging: Record<AgingBucket, bigint> = {
    current: 0n, "1_30": 0n, "31_60": 0n, "61_90": 0n, "90_plus": 0n,
  };
  let totalOutstanding = 0n;
  let totalPenalty = 0n;
  let highRisk = 0;
  const currency = rows[0]?.currency ?? "UZS";

  for (const r of rows) {
    byStatus[r.status]++;
    byAging[r.agingBucket as AgingBucket] = (byAging[r.agingBucket as AgingBucket] ?? 0n) + r.outstandingMinor;
    totalOutstanding += r.outstandingMinor;
    totalPenalty += r.penaltyMinor;
    if (r.riskScore >= 70) highRisk++;
  }

  const agingSerialized = Object.fromEntries(
    Object.entries(byAging).map(([k, v]) => [k, amount(v, currency)]),
  );

  return c.json(
    ok(
      {
        total: rows.length,
        byStatus,
        aging: agingSerialized,
        totalOutstanding: amount(totalOutstanding, currency),
        totalPenalty: amount(totalPenalty, currency),
        highRisk,
        currency,
      },
      "common.ok",
      c.get("locale"),
    ),
  );
});

/** Debitorlik ro'yxati — server-side sahifalash + holat filtri + saralash + qidiruv. */
receivableRoutes.get("/receivables", async (c) => {
  const { tenantId } = c.get("auth");
  const { page, pageSize, limit, offset } = pageParams(c);
  const statusParam = c.req.query("status");
  const sort = c.req.query("sort") ?? "overdue";
  const q = (c.req.query("q") ?? "").trim();

  const orderBy =
    sort === "amount" ? desc(receivables.outstandingMinor) : sort === "risk" ? desc(receivables.riskScore) : desc(receivables.overdueDays);

  const data = await withTenant(tenantId, async (tx) => {
    const conds = [];
    if (statusParam && statusParam !== "all")
      conds.push(eq(receivables.status, statusParam as ReceivableStatus));
    if (q)
      conds.push(
        or(ilike(contractors.name, `%${q}%`), ilike(contractors.tin, `%${q}%`), ilike(invoices.number, `%${q}%`)),
      );
    const where = conds.length ? and(...conds) : undefined;

    const countRows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(receivables)
      .innerJoin(invoices, eq(receivables.invoiceId, invoices.id))
      .innerJoin(contractors, eq(receivables.contractorId, contractors.id))
      .where(where);
    const count = countRows[0]?.count ?? 0;

    const rows = await tx
      .select({
        id: receivables.id,
        status: receivables.status,
        outstandingMinor: receivables.outstandingMinor,
        penaltyMinor: receivables.penaltyMinor,
        currency: receivables.currency,
        overdueDays: receivables.overdueDays,
        agingBucket: receivables.agingBucket,
        riskScore: receivables.riskScore,
        invoiceNumber: invoices.number,
        invoiceAmountMinor: invoices.amountMinor,
        issuedAt: invoices.issuedAt,
        dueDate: invoices.dueDate,
        contractorId: contractors.id,
        contractorName: contractors.name,
        contractorTin: contractors.tin,
        contractNumber: contracts.number,
        penaltyDailyBps: contracts.penaltyDailyBps,
      })
      .from(receivables)
      .innerJoin(invoices, eq(receivables.invoiceId, invoices.id))
      .innerJoin(contractors, eq(receivables.contractorId, contractors.id))
      .leftJoin(contracts, eq(invoices.contractId, contracts.id))
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    // Faqat joriy sahifadagi debitorliklar bo'yicha eslatma soni.
    const ids = rows.map((r) => r.id);
    const countMap = new Map<string, number>();
    if (ids.length) {
      const counts = await tx
        .select({ receivableId: reminders.receivableId, count: sql<number>`count(*)::int` })
        .from(reminders)
        .where(inArray(reminders.receivableId, ids))
        .groupBy(reminders.receivableId);
      for (const x of counts) countMap.set(x.receivableId, x.count);
    }

    // Filtr chiplari uchun barqaror sanoq (filtrdan mustaqil).
    const statusCounts = await tx
      .select({ k: receivables.status, c: sql<number>`count(*)::int` })
      .from(receivables)
      .groupBy(receivables.status);
    const byStatus: Record<string, number> = {};
    let allTotal = 0;
    for (const x of statusCounts) {
      byStatus[x.k] = x.c;
      allTotal += x.c;
    }

    const items = rows.map((r) => ({
      id: r.id,
      status: r.status,
      outstanding: amount(r.outstandingMinor, r.currency),
      penalty: amount(r.penaltyMinor, r.currency),
      invoiceAmount: amount(r.invoiceAmountMinor, r.currency),
      currency: r.currency,
      overdueDays: r.overdueDays,
      agingBucket: r.agingBucket,
      riskScore: r.riskScore,
      invoiceNumber: r.invoiceNumber,
      issuedAt: r.issuedAt,
      dueDate: r.dueDate,
      contractorId: r.contractorId,
      contractorName: r.contractorName,
      contractorTin: r.contractorTin,
      contractNumber: r.contractNumber,
      penaltyDailyBps: r.penaltyDailyBps ?? 0,
      reminderCount: countMap.get(r.id) ?? 0,
    }));

    return { items, count, byStatus, allTotal };
  });

  return c.json(
    ok({ items: data.items, byStatus: data.byStatus, allTotal: data.allTotal, ...pageMeta(data.count, page, pageSize) }, "common.ok", c.get("locale")),
  );
});

/** Bitta debitorlikning to'liq tafsiloti (kontragent, shartnoma, to'lovlar, eslatmalar). */
receivableRoutes.get("/receivables/:id", async (c) => {
  const { tenantId } = c.get("auth");
  const id = c.req.param("id");

  const result = await withTenant(tenantId, async (tx) => {
    const [row] = await tx
      .select({
        id: receivables.id,
        status: receivables.status,
        outstandingMinor: receivables.outstandingMinor,
        penaltyMinor: receivables.penaltyMinor,
        currency: receivables.currency,
        overdueDays: receivables.overdueDays,
        agingBucket: receivables.agingBucket,
        riskScore: receivables.riskScore,
        executedStages: receivables.executedStages,
        lastEvaluatedAt: receivables.lastEvaluatedAt,
        invoiceId: invoices.id,
        invoiceNumber: invoices.number,
        invoiceAmountMinor: invoices.amountMinor,
        issuedAt: invoices.issuedAt,
        dueDate: invoices.dueDate,
        contractId: contracts.id,
        contractNumber: contracts.number,
        signedAt: contracts.signedAt,
        penaltyDailyBps: contracts.penaltyDailyBps,
        penaltyCapBps: contracts.penaltyCapBps,
        jurisdictionNote: contracts.jurisdictionNote,
        contractorId: contractors.id,
        contractorName: contractors.name,
        contractorTin: contractors.tin,
        legalAddress: contractors.legalAddress,
        bankAccount: contractors.bankAccount,
        bankMfo: contractors.bankMfo,
        phone: contractors.phone,
        email: contractors.email,
        telegramId: contractors.telegramId,
      })
      .from(receivables)
      .innerJoin(invoices, eq(receivables.invoiceId, invoices.id))
      .innerJoin(contractors, eq(receivables.contractorId, contractors.id))
      .leftJoin(contracts, eq(invoices.contractId, contracts.id))
      .where(eq(receivables.id, id))
      .limit(1);

    if (!row) return null;

    const paymentRows = await tx
      .select({
        id: payments.id,
        amountMinor: payments.amountMinor,
        currency: payments.currency,
        status: payments.status,
        paidAt: payments.paidAt,
      })
      .from(payments)
      .where(eq(payments.invoiceId, row.invoiceId))
      .orderBy(desc(payments.paidAt));

    const reminderRows = await tx
      .select({
        id: reminders.id,
        stage: reminders.stage,
        channel: reminders.channel,
        status: reminders.status,
        address: reminders.address,
        body: reminders.body,
        paymentLink: reminders.paymentLink,
        sentAt: reminders.sentAt,
        createdAt: reminders.createdAt,
      })
      .from(reminders)
      .where(eq(reminders.receivableId, id))
      .orderBy(desc(reminders.createdAt));

    return { row, paymentRows, reminderRows };
  });

  if (!result) {
    return c.json(ok(null, "common.ok", c.get("locale")));
  }

  const { row, paymentRows, reminderRows } = result;
  const cur = row.currency;
  const paidMinor = paymentRows.reduce((s, p) => s + p.amountMinor, 0n);

  const data = {
    id: row.id,
    status: row.status,
    overdueDays: row.overdueDays,
    agingBucket: row.agingBucket,
    riskScore: row.riskScore,
    currency: cur,
    executedStages: row.executedStages ?? [],
    lastEvaluatedAt: row.lastEvaluatedAt,
    amounts: {
      invoice: amount(row.invoiceAmountMinor, cur),
      paid: amount(paidMinor, cur),
      outstanding: amount(row.outstandingMinor, cur),
      penalty: amount(row.penaltyMinor, cur),
      total: amount(row.outstandingMinor + row.penaltyMinor, cur),
    },
    invoice: {
      number: row.invoiceNumber,
      issuedAt: row.issuedAt,
      dueDate: row.dueDate,
    },
    contract: row.contractId
      ? {
          number: row.contractNumber,
          signedAt: row.signedAt,
          penaltyDailyBps: row.penaltyDailyBps ?? 0,
          penaltyCapBps: row.penaltyCapBps,
          jurisdictionNote: row.jurisdictionNote,
        }
      : null,
    contractor: {
      id: row.contractorId,
      name: row.contractorName,
      tin: row.contractorTin,
      legalAddress: row.legalAddress,
      bankAccount: row.bankAccount,
      bankMfo: row.bankMfo,
      phone: row.phone,
      email: row.email,
      telegramId: row.telegramId,
    },
    payments: paymentRows.map((p) => ({
      id: p.id,
      amount: amount(p.amountMinor, p.currency),
      status: p.status,
      paidAt: p.paidAt,
    })),
    reminders: reminderRows.map((rm) => ({
      id: rm.id,
      stage: rm.stage,
      channel: rm.channel,
      status: rm.status,
      address: rm.address,
      body: rm.body,
      paymentLink: rm.paymentLink,
      sentAt: rm.sentAt,
      createdAt: rm.createdAt,
    })),
  };

  return c.json(ok(data, "common.ok", c.get("locale")));
});

/** To'lov qayd etish — qarzni yopish sikli. To'lovni yozadi, keyin receivable'ni
 * qayta baholaydi (outstanding, penya, holat, aging) va yangilaydi. */
const CAN_PAY = new Set(["owner", "admin", "finance"]);
receivableRoutes.post("/receivables/:id/payment", async (c) => {
  const locale = c.get("locale");
  const { tenantId, userId, role } = c.get("auth");
  if (!CAN_PAY.has(role)) return c.json(fail(ERROR_CODE.FORBIDDEN, "auth.forbidden", locale), 403);
  const id = c.req.param("id");
  const parsed = validate(paymentSchema, await c.req.json().catch(() => null));
  if (!parsed.ok) return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale, { fields: parsed.fields }), 422);

  let payAmount: bigint;
  try {
    payAmount = BigInt(String(parsed.data.amountMinor));
  } catch {
    return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale, { fields: { amountMinor: "invalid" } }), 422);
  }
  if (payAmount <= 0n) return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale, { fields: { amountMinor: "positive" } }), 422);
  const paidAt = parsed.data.paidAt ? new Date(parsed.data.paidAt) : new Date();

  const result = await withTenant(tenantId, async (tx) => {
    const [rec] = await tx
      .select({
        invoiceId: receivables.invoiceId,
        currency: receivables.currency,
        executedStages: receivables.executedStages,
        invoiceAmountMinor: invoices.amountMinor,
        dueDate: invoices.dueDate,
        penaltyDailyBps: contracts.penaltyDailyBps,
        penaltyCapBps: contracts.penaltyCapBps,
      })
      .from(receivables)
      .innerJoin(invoices, eq(receivables.invoiceId, invoices.id))
      .leftJoin(contracts, eq(invoices.contractId, contracts.id))
      .where(eq(receivables.id, id))
      .limit(1);
    if (!rec) return null;

    await tx.insert(payments).values({
      tenantId,
      invoiceId: rec.invoiceId,
      amountMinor: payAmount,
      currency: rec.currency,
      status: "received",
      paidAt,
    });

    const paidRows = await tx
      .select({ amountMinor: payments.amountMinor })
      .from(payments)
      .where(and(eq(payments.invoiceId, rec.invoiceId), eq(payments.status, "received")));
    const totalPaid = paidRows.reduce((s, p) => s + p.amountMinor, 0n);

    const now = new Date();
    const invoiced = money(rec.invoiceAmountMinor, rec.currency);
    const paid = money(totalPaid, rec.currency);
    const state = evaluateReceivable({ invoiced, paid, dueDate: rec.dueDate, now });
    const penalty =
      rec.penaltyDailyBps != null
        ? calcPenalty(state.outstanding, { dailyRateBps: rec.penaltyDailyBps, capBps: rec.penaltyCapBps ?? undefined }, rec.dueDate, now).penalty
        : money(0n, rec.currency);
    const outstandingRatio = invoiced.minor > 0n ? Number(state.outstanding.minor) / Number(invoiced.minor) : 0;
    const risk = calcRisk({
      maxOverdueDays: state.overdueDays,
      outstandingRatio,
      latePaymentCount: 0,
      priorDemandCount: (rec.executedStages ?? []).includes("demand_letter") ? 1 : 0,
    });

    await tx
      .update(receivables)
      .set({
        status: state.status,
        outstandingMinor: state.outstanding.minor,
        penaltyMinor: penalty.minor,
        overdueDays: state.overdueDays,
        agingBucket: state.agingBucket,
        riskScore: risk.score,
        lastEvaluatedAt: now,
      })
      .where(and(eq(receivables.id, id), eq(receivables.tenantId, tenantId)));

    await tx.insert(auditLogs).values({
      tenantId,
      actorType: "user",
      actorId: userId,
      action: "payment.recorded",
      entityType: "receivable",
      entityId: id,
      detail: { amountMinor: payAmount.toString(), status: state.status },
    });

    return {
      status: state.status,
      outstanding: amount(state.outstanding.minor, rec.currency),
      penalty: amount(penalty.minor, rec.currency),
      totalPaid: amount(totalPaid, rec.currency),
    };
  });

  if (!result) return c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", locale), 404);
  return c.json(ok(result, "common.updated", locale));
});

/** Hisobdan chiqarish — undirib bo'lmaydigan qarzni "written_off" deb belgilaydi. */
const CAN_WRITE_OFF = new Set(["owner", "admin"]);
receivableRoutes.post("/receivables/:id/write-off", async (c) => {
  const locale = c.get("locale");
  const { tenantId, userId, role } = c.get("auth");
  if (!CAN_WRITE_OFF.has(role)) return c.json(fail(ERROR_CODE.FORBIDDEN, "auth.forbidden", locale), 403);
  const id = c.req.param("id");
  const done = await withTenant(tenantId, async (tx) => {
    const [rec] = await tx.select({ id: receivables.id }).from(receivables).where(eq(receivables.id, id)).limit(1);
    if (!rec) return false;
    await tx.update(receivables).set({ status: "written_off", lastEvaluatedAt: new Date() }).where(and(eq(receivables.id, id), eq(receivables.tenantId, tenantId)));
    await tx.insert(auditLogs).values({ tenantId, actorType: "user", actorId: userId, action: "receivable.written_off", entityType: "receivable", entityId: id, detail: {} });
    return true;
  });
  if (!done) return c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", locale), 404);
  return c.json(ok({ status: "written_off" }, "common.updated", locale));
});
