import { generateLawsuitSmart, generateReconciliationAct, type ReconEntry } from "@lex/agents";
import { calcStateDuty, determineCourt, format, money } from "@lex/core";
import {
  approvalRequests,
  auditLogs,
  contractors,
  contracts,
  documents,
  invoices,
  payments,
  receivables,
  reminders,
  tenants,
  withTenant,
} from "@lex/db";
import { ERROR_CODE, fail, ok } from "@lex/shared";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";
import { pageMeta, pageParams } from "../lib/pagination";

const CAN_GENERATE = new Set(["owner", "admin", "finance", "legal"]);

export const companyRoutes = new Hono<{ Variables: Variables }>();

const amount = (minor: bigint, currency = "UZS") => ({ minor: minor.toString(), formatted: format(money(minor, currency)) });

/**
 * Kontragentlar (case) ro'yxati — har biri uchun agregat: qarz, penya, muddati o'tgan,
 * shartnoma/hujjat soni, xavf. Bu "dosyalar" ro'yxati — Knowledge Engine kirish nuqtasi.
 */
companyRoutes.get("/companies", async (c) => {
  const { tenantId } = c.get("auth");
  const { page, pageSize, limit, offset } = pageParams(c);
  const q = (c.req.query("q") ?? "").trim();

  const data = await withTenant(tenantId, async (tx) => {
    const where = q ? or(ilike(contractors.name, `%${q}%`), ilike(contractors.tin, `%${q}%`)) : undefined;

    const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(contractors).where(where);

    const rows = await tx
      .select({
        id: contractors.id,
        name: contractors.name,
        tin: contractors.tin,
        phone: contractors.phone,
        email: contractors.email,
        outstanding: sql<string>`coalesce(sum(${receivables.outstandingMinor}),0)::text`,
        penalty: sql<string>`coalesce(sum(${receivables.penaltyMinor}),0)::text`,
        overdueCount: sql<number>`count(*) filter (where ${receivables.status} = 'overdue')::int`,
        maxRisk: sql<number>`coalesce(max(${receivables.riskScore}),0)::int`,
        maxOverdueDays: sql<number>`coalesce(max(${receivables.overdueDays}),0)::int`,
      })
      .from(contractors)
      .leftJoin(receivables, eq(receivables.contractorId, contractors.id))
      .where(where)
      .groupBy(contractors.id, contractors.name, contractors.tin, contractors.phone, contractors.email)
      .orderBy(desc(sql`coalesce(sum(${receivables.outstandingMinor}),0)`))
      .limit(limit)
      .offset(offset);

    const ids = rows.map((r) => r.id);
    const docCount = new Map<string, number>();
    const contractCount = new Map<string, number>();
    if (ids.length) {
      const dc = await tx
        .select({ k: documents.contractorId, c: sql<number>`count(*)::int` })
        .from(documents)
        .where(inArray(documents.contractorId, ids))
        .groupBy(documents.contractorId);
      for (const x of dc) if (x.k) docCount.set(x.k, x.c);
      const cc = await tx
        .select({ k: contracts.contractorId, c: sql<number>`count(*)::int` })
        .from(contracts)
        .where(inArray(contracts.contractorId, ids))
        .groupBy(contracts.contractorId);
      for (const x of cc) contractCount.set(x.k, x.c);
    }

    const items = rows.map((r) => ({
      id: r.id,
      name: r.name,
      tin: r.tin,
      phone: r.phone,
      email: r.email,
      outstanding: amount(BigInt(r.outstanding)),
      penalty: amount(BigInt(r.penalty)),
      overdueCount: r.overdueCount,
      riskScore: r.maxRisk,
      maxOverdueDays: r.maxOverdueDays,
      documentsCount: docCount.get(r.id) ?? 0,
      contractsCount: contractCount.get(r.id) ?? 0,
    }));

    return { items, count };
  });

  return c.json(ok({ items: data.items, ...pageMeta(data.count, page, pageSize) }, "common.ok", c.get("locale")));
});

/** Bitta kontragentning to'liq DOSYESI — butun zanjir bitta javobda (Case View). */
companyRoutes.get("/companies/:id", async (c) => {
  const { tenantId } = c.get("auth");
  const id = c.req.param("id");

  const result = await withTenant(tenantId, async (tx) => {
    const [contractor] = await tx.select().from(contractors).where(eq(contractors.id, id)).limit(1);
    if (!contractor) return null;

    const contractRows = await tx.select().from(contracts).where(eq(contracts.contractorId, id)).orderBy(desc(contracts.signedAt));
    const invoiceRows = await tx.select().from(invoices).where(eq(invoices.contractorId, id)).orderBy(desc(invoices.dueDate));
    const invIds = invoiceRows.map((i) => i.id);

    const recRows = await tx.select().from(receivables).where(eq(receivables.contractorId, id));
    const recIds = recRows.map((r) => r.id);

    const payRows = invIds.length
      ? await tx.select().from(payments).where(inArray(payments.invoiceId, invIds)).orderBy(desc(payments.paidAt))
      : [];
    const remRows = recIds.length
      ? await tx.select().from(reminders).where(inArray(reminders.receivableId, recIds)).orderBy(desc(reminders.createdAt))
      : [];
    const docRows = await tx.select().from(documents).where(eq(documents.contractorId, id)).orderBy(desc(documents.createdAt));
    const apprRows = recIds.length
      ? await tx.select().from(approvalRequests).where(inArray(approvalRequests.receivableId, recIds)).orderBy(desc(approvalRequests.createdAt))
      : [];

    return { contractor, contractRows, invoiceRows, recRows, payRows, remRows, docRows, apprRows };
  });

  if (!result) return c.json(ok(null, "common.ok", c.get("locale")));
  const { contractor, contractRows, invoiceRows, recRows, payRows, remRows, docRows, apprRows } = result;
  const cur = recRows[0]?.currency ?? invoiceRows[0]?.currency ?? "UZS";

  // Agregatlar
  let totalOutstanding = 0n;
  let totalPenalty = 0n;
  let overdueCount = 0;
  let maxRisk = 0;
  for (const r of recRows) {
    totalOutstanding += r.outstandingMinor;
    totalPenalty += r.penaltyMinor;
    if (r.status === "overdue") overdueCount++;
    if (r.riskScore > maxRisk) maxRisk = r.riskScore;
  }
  const totalPaid = payRows.reduce((s, p) => s + (p.status === "received" ? p.amountMinor : 0n), 0n);

  // Yagona TIMELINE — butun voqealar zanjiri (case reasoning uchun).
  type Ev = { at: string | Date | null; type: string; title: string; ref?: string };
  const events: Ev[] = [];
  for (const k of contractRows) events.push({ at: k.signedAt, type: "contract", title: k.number, ref: k.number });
  for (const i of invoiceRows) events.push({ at: i.issuedAt, type: "invoice", title: i.number, ref: format(money(i.amountMinor, i.currency)) });
  for (const p of payRows) if (p.paidAt) events.push({ at: p.paidAt, type: "payment", title: format(money(p.amountMinor, p.currency)) });
  for (const rm of remRows) events.push({ at: rm.sentAt ?? rm.createdAt, type: "reminder", title: rm.stage, ref: rm.channel });
  for (const a of apprRows) events.push({ at: a.createdAt, type: `approval_${a.type}`, title: a.status });
  for (const d of docRows) events.push({ at: d.createdAt, type: "document", title: d.title, ref: d.type });
  events.sort((x, y) => new Date(y.at ?? 0).getTime() - new Date(x.at ?? 0).getTime());

  const data = {
    contractor: {
      id: contractor.id,
      name: contractor.name,
      tin: contractor.tin,
      legalAddress: contractor.legalAddress,
      bankAccount: contractor.bankAccount,
      bankMfo: contractor.bankMfo,
      phone: contractor.phone,
      email: contractor.email,
      telegramId: contractor.telegramId,
    },
    summary: {
      totalOutstanding: amount(totalOutstanding, cur),
      totalPenalty: amount(totalPenalty, cur),
      totalPaid: amount(totalPaid, cur),
      overdueCount,
      riskScore: maxRisk,
      contractsCount: contractRows.length,
      invoicesCount: invoiceRows.length,
      documentsCount: docRows.length,
      remindersCount: remRows.length,
    },
    contracts: contractRows.map((k) => ({
      id: k.id,
      number: k.number,
      signedAt: k.signedAt,
      penaltyDailyBps: k.penaltyDailyBps,
      penaltyCapBps: k.penaltyCapBps,
    })),
    invoices: invoiceRows.map((i) => {
      const rec = recRows.find((r) => r.invoiceId === i.id);
      return {
        id: i.id,
        number: i.number,
        amount: amount(i.amountMinor, i.currency),
        issuedAt: i.issuedAt,
        dueDate: i.dueDate,
        status: rec?.status ?? "pending",
        overdueDays: rec?.overdueDays ?? 0,
        outstanding: rec ? amount(rec.outstandingMinor, i.currency) : amount(0n, i.currency),
        penalty: rec ? amount(rec.penaltyMinor, i.currency) : amount(0n, i.currency),
      };
    }),
    documents: docRows.map((d) => ({ id: d.id, type: d.type, title: d.title, didoxId: d.didoxId, createdAt: d.createdAt })),
    reminders: remRows.map((rm) => ({ id: rm.id, stage: rm.stage, channel: rm.channel, status: rm.status, sentAt: rm.sentAt, createdAt: rm.createdAt })),
    approvals: apprRows.map((a) => ({ id: a.id, type: a.type, status: a.status, createdAt: a.createdAt, decidedAt: a.decidedAt })),
    timeline: events.map((e) => ({ at: e.at, type: e.type, title: e.title, ref: e.ref ?? null })),
  };

  return c.json(ok(data, "common.ok", c.get("locale")));
});
