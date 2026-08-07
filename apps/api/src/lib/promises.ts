import { paymentPromises, payments, receivables, type TenantTx } from "@lex/db";
import { and, desc, eq } from "drizzle-orm";

/**
 * To'lov qayd etilganda — shu receivable bo'yicha kutilayotgan (pending) va'da bormi
 * tekshiradi, jami to'langan summa va'da qilingan miqdorga yetgan/oshgan bo'lsa "kept"
 * deb belgilaydi. Ikkala to'lov yo'li ham (qo'lda va Click/Payme webhook) shu funksiyani
 * chaqiradi — va'da holati qayerdan to'lansa ham to'g'ri yopiladi.
 */
export async function resolvePromiseOnPayment(tx: TenantTx, receivableId: string): Promise<void> {
  const [promise] = await tx
    .select({ id: paymentPromises.id, amountMinor: paymentPromises.amountMinor })
    .from(paymentPromises)
    .where(and(eq(paymentPromises.receivableId, receivableId), eq(paymentPromises.status, "pending")))
    .orderBy(desc(paymentPromises.createdAt))
    .limit(1);
  if (!promise) return;

  const [rec] = await tx.select({ invoiceId: receivables.invoiceId }).from(receivables).where(eq(receivables.id, receivableId)).limit(1);
  if (!rec) return;

  const paidRows = await tx.select({ amountMinor: payments.amountMinor }).from(payments).where(eq(payments.invoiceId, rec.invoiceId));
  const totalPaid = paidRows.reduce((s, p) => s + p.amountMinor, 0n);

  if (totalPaid >= promise.amountMinor) {
    await tx.update(paymentPromises).set({ status: "kept", resolvedAt: new Date() }).where(eq(paymentPromises.id, promise.id));
  }
}
