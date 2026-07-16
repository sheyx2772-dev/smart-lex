import { generateDemandLetterSmart, generateReminderText } from "@lex/agents";
import {
  calcPenalty,
  calcRisk,
  type CollectionStep,
  DEFAULT_COLLECTION_STEPS,
  dueCollectionSteps,
  evaluateReceivable,
  money,
  totalDebt,
} from "@lex/core";
import {
  approvalRequests,
  auditLogs,
  collectionRules,
  contractors as contractorsTable,
  contracts as contractsTable,
  documents,
  getDb,
  invoices as invoicesTable,
  payments as paymentsTable,
  receivables,
  reminders,
  type TenantTx,
  tenants,
  withTenant,
} from "@lex/db";
import { createNotifier } from "@lex/integrations";
import { type Locale, type ReminderChannel, type TenantType } from "@lex/shared";
import { and, eq } from "drizzle-orm";

export interface MonitorSummary {
  tenants: number;
  evaluated: number;
  overdue: number;
  remindersSent: number;
  approvalsCreated: number;
}

/** Bitta AI/tizim harakatini audit logga yozadi. */
async function audit(
  tx: TenantTx,
  tenantId: string,
  action: string,
  entityType: string,
  entityId: string,
  detail?: Record<string, unknown>,
): Promise<void> {
  await tx.insert(auditLogs).values({
    tenantId,
    actorType: "ai_agent",
    actorId: "monitor-agent",
    action,
    entityType,
    entityId,
    detail,
  });
}

interface ChannelConfig {
  sms: boolean;
  email: boolean;
  telegram: boolean;
  hybridPost: boolean;
}
const DEFAULT_CHANNELS: ChannelConfig = { sms: true, email: true, telegram: false, hybridPost: false };

/**
 * Qarzdor bilan bog'lanish kanali va manzilini tanlaydi — FAQAT yoqilgan kanallardan.
 * Bank tenant SMS'ni afzal ko'radi, boshqalar email'ni.
 */
function pickContact(
  tenantType: TenantType,
  contractor: { phone: string | null; email: string | null; telegramId: string | null },
  enabled: ChannelConfig,
): { channel: ReminderChannel; address: string } | null {
  const order: ReminderChannel[] = tenantType === "bank" ? ["sms", "email", "telegram"] : ["email", "sms", "telegram"];
  for (const channel of order) {
    if (!enabled[channel === "hybrid_post" ? "hybridPost" : channel]) continue;
    const address = channel === "sms" ? contractor.phone : channel === "email" ? contractor.email : contractor.telegramId;
    if (address) return { channel, address };
  }
  return null;
}

/** Berilgan tenant uchun monitoring. Natijani summariga qo'shadi. */
async function runForTenant(
  tenant: {
    id: string;
    type: TenantType;
    name: string;
    tin: string;
    defaultLocale: Locale;
    settings: Record<string, unknown>;
  },
  now: Date,
  sum: MonitorSummary,
): Promise<void> {
  const channelCfg = (tenant.settings?.channels as ChannelConfig | undefined) ?? DEFAULT_CHANNELS;
  const templates = tenant.settings?.templates as
    | { soft?: Record<string, string>; firm?: Record<string, string> }
    | undefined;
  await withTenant(tenant.id, async (tx) => {
    const [contractorRows, contractRows, invoiceRows, paymentRows, ruleRows, receivableRows] =
      await Promise.all([
        tx.select().from(contractorsTable),
        tx.select().from(contractsTable),
        tx.select().from(invoicesTable),
        tx.select().from(paymentsTable),
        tx.select().from(collectionRules).where(eq(collectionRules.isDefault, true)),
        tx.select().from(receivables),
      ]);

    const contractorById = new Map(contractorRows.map((c) => [c.id, c]));
    const contractById = new Map(contractRows.map((c) => [c.id, c]));
    const receivableByInvoice = new Map(receivableRows.map((r) => [r.invoiceId, r]));
    const paidByInvoice = new Map<string, bigint>();
    for (const p of paymentRows) {
      if (p.status !== "received") continue;
      paidByInvoice.set(p.invoiceId, (paidByInvoice.get(p.invoiceId) ?? 0n) + p.amountMinor);
    }

    const steps = (ruleRows[0]?.steps as CollectionStep[] | undefined) ?? DEFAULT_COLLECTION_STEPS;

    for (const invoice of invoiceRows) {
      const contractor = contractorById.get(invoice.contractorId);
      if (!contractor) continue;
      const contract = invoice.contractId ? contractById.get(invoice.contractId) : undefined;

      const invoiced = money(invoice.amountMinor, invoice.currency);
      const paid = money(paidByInvoice.get(invoice.id) ?? 0n, invoice.currency);
      const state = evaluateReceivable({ invoiced, paid, dueDate: invoice.dueDate, now });
      sum.evaluated++;
      if (state.status === "overdue") sum.overdue++;

      // Penya — muddati o'tgan asosiy qarz (outstanding) bo'yicha.
      const penalty = contract
        ? calcPenalty(
            state.outstanding,
            { dailyRateBps: contract.penaltyDailyBps, capBps: contract.penaltyCapBps ?? undefined },
            invoice.dueDate,
            now,
          ).penalty
        : money(0n, invoice.currency);

      const existing = receivableByInvoice.get(invoice.id);
      const executedStages = new Set<string>(existing?.executedStages ?? []);

      const outstandingRatio =
        invoiced.minor > 0n ? Number(state.outstanding.minor) / Number(invoiced.minor) : 0;
      const risk = calcRisk({
        maxOverdueDays: state.overdueDays,
        outstandingRatio,
        latePaymentCount: 0,
        priorDemandCount: executedStages.has("demand_letter") ? 1 : 0,
      });

      // Debitorlik snapshot upsert.
      const [receivable] = await tx
        .insert(receivables)
        .values({
          tenantId: tenant.id,
          invoiceId: invoice.id,
          contractorId: invoice.contractorId,
          status: state.status,
          outstandingMinor: state.outstanding.minor,
          penaltyMinor: penalty.minor,
          currency: invoice.currency,
          overdueDays: state.overdueDays,
          agingBucket: state.agingBucket,
          riskScore: risk.score,
          executedStages: [...executedStages],
          lastEvaluatedAt: now,
        })
        .onConflictDoUpdate({
          target: receivables.invoiceId,
          set: {
            status: state.status,
            outstandingMinor: state.outstanding.minor,
            penaltyMinor: penalty.minor,
            overdueDays: state.overdueDays,
            agingBucket: state.agingBucket,
            riskScore: risk.score,
            lastEvaluatedAt: now,
          },
        })
        .returning();
      if (!receivable) continue;

      // To'langan bo'lsa collection harakatlari yo'q.
      if (state.status === "paid") continue;

      const due = dueCollectionSteps({
        steps,
        dueDate: invoice.dueDate,
        now,
        executedStages: [...executedStages] as CollectionStep["stage"][],
      });

      for (const step of due) {
        if (step.stage === "soft_reminder" || step.stage === "firm_reminder") {
          const contact = pickContact(tenant.type, contractor, channelCfg);
          if (!contact) continue;
          const paymentLink =
            tenant.type === "bank"
              ? `${process.env.WEB_URL ?? "http://localhost:3000"}/pay/${receivable.id}`
              : undefined;
          const kind = step.stage === "soft_reminder" ? "soft" : "firm";
          const template = templates?.[kind]?.[tenant.defaultLocale];
          const body = generateReminderText({
            stage: step.stage,
            locale: tenant.defaultLocale,
            debtorName: contractor.name,
            amount: state.outstanding,
            invoiceNumbers: [invoice.number],
            overdueDays: state.overdueDays,
            paymentLink,
            template,
          });

          const pochtaToken = (tenant.settings?.integrations as Record<string, unknown> | undefined)?.pochtaToken;
          const result = await createNotifier(contact.channel, {
            pochtaToken: typeof pochtaToken === "string" ? pochtaToken : null,
          }).send({
            channel: contact.channel,
            address: contact.address,
            body,
            paymentLink,
          });

          await tx.insert(reminders).values({
            tenantId: tenant.id,
            receivableId: receivable.id,
            stage: step.stage,
            channel: contact.channel,
            status: result.status === "sent" ? "sent" : "failed",
            address: contact.address,
            body,
            paymentLink,
            sentAt: result.status === "sent" ? now : null,
          });
          await audit(tx, tenant.id, "reminder.sent", "receivable", receivable.id, {
            stage: step.stage,
            channel: contact.channel,
          });
          if (result.status === "sent") sum.remindersSent++;
          executedStages.add(step.stage);
        } else if (step.stage === "demand_letter") {
          const total = totalDebt(state.outstanding, penalty);
          const letter = await generateDemandLetterSmart({
            locale: tenant.defaultLocale,
            creditor: { name: tenant.name, tin: tenant.tin },
            debtor: { name: contractor.name, tin: contractor.tin, legalAddress: contractor.legalAddress ?? undefined },
            contractNumber: contract?.number ?? "—",
            contractSignedAt: contract?.signedAt ?? undefined,
            invoiceNumbers: [invoice.number],
            principal: state.outstanding,
            penalty,
            total,
            overdueDays: state.overdueDays,
            responseDeadlineDays: 10,
            signatory: tenant.settings?.signatory as { name: string; position: string } | undefined,
          }, (tenant.settings?.docTemplates as Record<string, string> | undefined)?.demand_letter);

          const [doc] = await tx
            .insert(documents)
            .values({
              tenantId: tenant.id,
              type: "demand_letter",
              contractId: invoice.contractId,
              contractorId: invoice.contractorId,
              title: letter.subject,
              extracted: { body: letter.body },
            })
            .returning();

          await tx.insert(approvalRequests).values({
            tenantId: tenant.id,
            type: "demand_letter",
            status: "pending",
            receivableId: receivable.id,
            documentId: doc?.id ?? null,
            payload: {
              subject: letter.subject,
              body: letter.body,
              principalMinor: state.outstanding.minor.toString(),
              penaltyMinor: penalty.minor.toString(),
              totalMinor: total.minor.toString(),
              currency: invoice.currency,
            },
          });
          await audit(tx, tenant.id, "demand.generated", "receivable", receivable.id, {
            documentId: doc?.id,
          });
          sum.approvalsCreated++;
          executedStages.add(step.stage);
        } else if (step.stage === "court") {
          // Faza 2: sud bosqichi — hozircha tasdiq so'raladi, ish tayyorlanmaydi.
          await tx.insert(approvalRequests).values({
            tenantId: tenant.id,
            type: "court_claim",
            status: "pending",
            receivableId: receivable.id,
            payload: { note: "Sud bosqichi (Faza 2)", overdueDays: state.overdueDays },
          });
          await audit(tx, tenant.id, "court.requested", "receivable", receivable.id);
          sum.approvalsCreated++;
          executedStages.add(step.stage);
        }
      }

      // Yangilangan bosqichlarni saqlash.
      await tx
        .update(receivables)
        .set({ executedStages: [...executedStages] })
        .where(and(eq(receivables.id, receivable.id), eq(receivables.tenantId, tenant.id)));
    }
  });
}

/** Barcha tenantlar bo'yicha monitoring (cron chaqiradi). */
export async function runMonitor(now: Date = new Date()): Promise<MonitorSummary> {
  const db = getDb();
  const tenantRows = await db.select().from(tenants);
  const sum: MonitorSummary = { tenants: 0, evaluated: 0, overdue: 0, remindersSent: 0, approvalsCreated: 0 };

  for (const tenant of tenantRows) {
    sum.tenants++;
    await runForTenant(tenant, now, sum);
  }
  return sum;
}
