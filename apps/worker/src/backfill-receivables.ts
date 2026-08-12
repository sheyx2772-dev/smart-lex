import { calcPenalty, calcRisk, evaluateReceivable, money } from "@lex/core";
import { closeDb, contracts as contractsTable, getDb, invoices as invoicesTable, payments as paymentsTable, receivables, tenants as tenantsTable, withTenant } from "@lex/db";
import { eq, isNull, inArray } from "drizzle-orm";

/**
 * Invoice → receivable snapshot hisoblaydi (LLM/Groq'siz — faqat deterministik core).
 * Har bir tenant o'z RLS kontekstida (withTenant) tekshiriladi — tenants jadvali
 * o'zi RLS'siz, lekin invoices/receivables RLS bilan himoyalangan.
 * Sinxronlashdan keyin monitor cron LLM rate-limit'da tiqilib qolganda ishlatiladi:
 *   pnpm --filter @lex/worker backfill:receivables
 */
async function main(): Promise<void> {
  const db = getDb();
  const now = new Date();

  const allTenants = await db.select({ id: tenantsTable.id }).from(tenantsTable);

  let created = 0;
  let tenantsWithWork = 0;
  for (const { id: tenantId } of allTenants) {
    const count = await withTenant(tenantId, async (tx) => {
      const invoiceRows = await tx
        .select()
        .from(invoicesTable)
        .leftJoin(receivables, eq(receivables.invoiceId, invoicesTable.id))
        .where(isNull(receivables.id))
        .then((rows) => rows.map((r) => r.invoices));
      if (invoiceRows.length === 0) return 0;

      const invoiceIds = invoiceRows.map((i) => i.id);
      const contractIds = invoiceRows.map((i) => i.contractId).filter((id): id is string => Boolean(id));
      const contractRows = contractIds.length ? await tx.select().from(contractsTable).where(inArray(contractsTable.id, contractIds)) : [];
      const contractById = new Map(contractRows.map((c) => [c.id, c]));
      const paymentRows = await tx.select().from(paymentsTable).where(inArray(paymentsTable.invoiceId, invoiceIds));
      const paidByInvoice = new Map<string, bigint>();
      for (const p of paymentRows) {
        if (p.status !== "received") continue;
        paidByInvoice.set(p.invoiceId, (paidByInvoice.get(p.invoiceId) ?? 0n) + p.amountMinor);
      }

      let insertedForTenant = 0;
      for (const invoice of invoiceRows) {
        const contract = invoice.contractId ? contractById.get(invoice.contractId) : undefined;
        const invoiced = money(invoice.amountMinor, invoice.currency);
        const paid = money(paidByInvoice.get(invoice.id) ?? 0n, invoice.currency);
        const state = evaluateReceivable({ invoiced, paid, dueDate: invoice.dueDate, now });

        const penalty = contract
          ? calcPenalty(state.outstanding, { dailyRateBps: contract.penaltyDailyBps, capBps: contract.penaltyCapBps ?? undefined }, invoice.dueDate, now).penalty
          : money(0n, invoice.currency);

        const outstandingRatio = invoiced.minor > 0n ? Number(state.outstanding.minor) / Number(invoiced.minor) : 0;
        const risk = calcRisk({ maxOverdueDays: state.overdueDays, outstandingRatio, latePaymentCount: 0, priorDemandCount: 0 });

        await tx
          .insert(receivables)
          .values({
            tenantId,
            invoiceId: invoice.id,
            contractorId: invoice.contractorId,
            status: state.status,
            outstandingMinor: state.outstanding.minor,
            penaltyMinor: penalty.minor,
            currency: invoice.currency,
            overdueDays: state.overdueDays,
            agingBucket: state.agingBucket,
            riskScore: risk.score,
            executedStages: [],
            lastEvaluatedAt: now,
          })
          .onConflictDoNothing({ target: receivables.invoiceId });
        insertedForTenant++;
      }
      return insertedForTenant;
    });
    if (count > 0) {
      created += count;
      tenantsWithWork++;
      console.log(`[backfill] tenant ${tenantId}: ${count} receivables created`);
    }
  }

  console.log(`[backfill] done. tenantsWithWork=${tenantsWithWork} receivablesCreated=${created}`);
  await closeDb();
}

main().catch(async (err) => {
  console.error("✗ backfill xatosi:", err);
  await closeDb();
  process.exit(1);
});
