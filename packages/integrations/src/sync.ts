import { auditLogs, contractors, contracts, documents, invoices, tenants, withTenant } from "@lex/db";
import { decryptSecret } from "@lex/shared/secrets";
import { and, eq, inArray } from "drizzle-orm";
import { createDataSource } from "./datasource/index";

export class SyncReconnectError extends Error {}

/**
 * Didox (yoki bank) manbasidan hujjatlarni sinxronlaydi → DB'ga joylaydi (idempotent).
 * Ham API route (qo'lda "Sinxronlash" tugmasi), ham worker'ning kunlik cron ishi shu bitta
 * funksiyani chaqiradi — inson qo'lda shartnoma/hisob-faktura kiritmasin, deb.
 */
export async function syncTenant(tenantId: string) {
  const [tenant] = await withTenant(tenantId, (tx) => tx.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1));
  if (!tenant) throw new Error("tenant not found");

  // Didox user-key AVVAL tenant sozlamasidan (har firma o'z kaliti), aks holda global env.
  const settings = (tenant.settings ?? {}) as Record<string, unknown>;
  const integrations = (settings.integrations ?? {}) as Record<string, string>;
  const source = createDataSource(tenant.type, { userKey: decryptSecret(integrations.didoxToken) });

  let snap;
  try {
    snap = await source.fetchSnapshot();
  } catch (err) {
    // Didox 401 / "Invalid user key" → tushunarli "qayta ulaning" xabari (500 emas).
    const msg = String((err as { message?: unknown })?.message ?? err).toLowerCase();
    if (msg.includes("401") || msg.includes("invalid user key") || msg.includes("unauthorized")) {
      throw new SyncReconnectError("didox reconnect required");
    }
    throw err;
  }

  const counts = await withTenant(tenantId, async (tx) => {
    // 1) Kontragentlar (STIR bo'yicha, takrorlanmaydi).
    if (snap.contractors.length) {
      await tx
        .insert(contractors)
        .values(snap.contractors.map((c) => ({ tenantId, name: c.name, tin: c.tin, legalAddress: c.legalAddress ?? null, phone: c.phone ?? null, email: c.email ?? null, telegramId: c.telegramId ?? null })))
        .onConflictDoNothing({ target: [contractors.tenantId, contractors.tin] });
    }
    const conRows = await tx.select({ id: contractors.id, tin: contractors.tin }).from(contractors);
    const byTin = new Map(conRows.map((r) => [r.tin, r.id]));

    // 2) Shartnomalar (raqam bo'yicha).
    const contractVals = snap.contracts
      .map((k) => ({ tenantId, contractorId: byTin.get(k.contractorTin), number: k.number, signedAt: new Date(k.signedAt), penaltyDailyBps: k.penaltyDailyBps, penaltyCapBps: k.penaltyCapBps ?? null, didoxId: k.didoxId ?? null }))
      .filter((k): k is typeof k & { contractorId: string } => Boolean(k.contractorId));
    if (contractVals.length) {
      await tx.insert(contracts).values(contractVals).onConflictDoNothing({ target: [contracts.tenantId, contracts.number] });
    }
    const contractRows = await tx.select({ id: contracts.id, number: contracts.number }).from(contracts);
    const byContractNo = new Map(contractRows.map((r) => [r.number, r.id]));

    // 3) Invoicelar (raqam bo'yicha).
    const invoiceVals = snap.invoices
      .map((i) => ({ tenantId, contractId: byContractNo.get(i.contractNumber) ?? null, contractorId: byTin.get(i.contractorTin), number: i.number, amountMinor: BigInt(i.amountMinor), currency: i.currency, issuedAt: new Date(i.issuedAt), dueDate: new Date(i.dueDate), didoxId: i.didoxId ?? null }))
      .filter((i): i is typeof i & { contractorId: string } => Boolean(i.contractorId));
    if (invoiceVals.length) {
      await tx.insert(invoices).values(invoiceVals).onConflictDoNothing({ target: [invoices.tenantId, invoices.number] });
    }

    // 4) Hujjatlar (didoxId bo'yicha — mavjudini o'tkazamiz).
    const incomingDidox = snap.documents.map((d) => d.didoxId).filter(Boolean);
    const existing = incomingDidox.length
      ? await tx.select({ d: documents.didoxId }).from(documents).where(and(eq(documents.tenantId, tenantId), inArray(documents.didoxId, incomingDidox)))
      : [];
    const have = new Set(existing.map((e) => e.d));
    const docVals = snap.documents
      .filter((d) => !have.has(d.didoxId))
      .map((d) => ({ tenantId, type: d.type, contractorId: d.contractorTin ? byTin.get(d.contractorTin) ?? null : null, title: d.title, didoxId: d.didoxId }));
    if (docVals.length) await tx.insert(documents).values(docVals);

    await tx.insert(auditLogs).values({
      tenantId,
      actorType: "ai_agent",
      actorId: "document-agent",
      action: "didox.synced",
      entityType: "tenant",
      entityId: tenantId,
      detail: { source: source.name, contractors: snap.contractors.length, contracts: contractVals.length, invoices: invoiceVals.length, documents: docVals.length },
    });

    return { contractors: snap.contractors.length, contracts: contractVals.length, invoices: invoiceVals.length, documents: docVals.length };
  });

  return { source: source.name, ...counts };
}
