import { chainAnchors, getDb, tenants, withTenant } from "@lex/db";
import { eq, sql } from "drizzle-orm";
import OpenTimestamps from "opentimestamps";

const { DetachedTimestampFile, Ops, Context } = OpenTimestamps;

function hexToBytes(hex: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
  return out;
}

/**
 * `audit_chain_tip` — DB trigger ichida boshqariladigan, drizzle sxemasida yo'q ichki
 * jadval (@lex/db/src/chain.ts). Shuning uchun raw SQL bilan o'qiladi.
 */
async function currentTipHash(tenantId: string): Promise<string | null> {
  const db = getDb();
  const rows = await db.execute<{ tip_hash: string | null }>(
    sql`select tip_hash from audit_chain_tip where tenant_id = ${tenantId}`,
  );
  return rows[0]?.tip_hash ?? null;
}

export interface AnchorCreateSummary {
  tenants: number;
  created: number;
  skipped: number;
}

/**
 * Har bir tenant uchun joriy audit-zanjir "uchi"ni (tip hash) OpenTimestamps orqali
 * Bitcoin blokcheyniga yozishga yuboradi. Bir xil tip hash uchun ikkinchi marta
 * anchor yaratilmaydi (allaqachon shu holat uchun so'rov yuborilgan bo'ladi).
 */
export async function createPendingAnchors(): Promise<AnchorCreateSummary> {
  const db = getDb();
  const tenantRows = await db.select({ id: tenants.id }).from(tenants);
  const sum: AnchorCreateSummary = { tenants: tenantRows.length, created: 0, skipped: 0 };

  for (const t of tenantRows) {
    const tipHash = await currentTipHash(t.id);
    if (!tipHash) {
      sum.skipped++;
      continue;
    }

    const already = await withTenant(t.id, (tx) =>
      tx.select({ id: chainAnchors.id }).from(chainAnchors).where(eq(chainAnchors.chainTipHash, tipHash)).limit(1),
    );
    if (already.length > 0) {
      sum.skipped++;
      continue;
    }

    try {
      const detached = DetachedTimestampFile.fromHash(new Ops.OpSHA256(), hexToBytes(tipHash));
      await OpenTimestamps.stamp(detached);
      const proofBase64 = Buffer.from(detached.serializeToBytes()).toString("base64");

      await withTenant(t.id, (tx) =>
        tx.insert(chainAnchors).values({
          tenantId: t.id,
          chainTipHash: tipHash,
          otsProofBase64: proofBase64,
          status: "pending",
        }),
      );
      sum.created++;
    } catch (e) {
      console.error(`[anchor:create] tenant ${t.id}:`, e);
    }
  }
  return sum;
}

export interface AnchorUpgradeSummary {
  checked: number;
  confirmed: number;
  stillPending: number;
}

/**
 * "pending" anchorlarni kalendar serverlaridan tekshiradi — Bitcoin bloki
 * tasdiqlangan bo'lsa "confirmed"ga o'tkazadi va blok balandligini saqlaydi.
 *
 * MUHIM: `chain_anchors` RLS bilan himoyalangan (FORCE ROW LEVEL SECURITY), shuning
 * uchun uni faqat `withTenant()` ichida — tenant bo'yicha aylanib — o'qish/yozish
 * mumkin. `getDb()` orqali tenant kontekstisiz to'g'ridan-to'g'ri so'rov (RLS
 * `app.current_tenant`siz fail-closed ishlaydi) doim BO'SH natija qaytaradi.
 */
export async function upgradePendingAnchors(): Promise<AnchorUpgradeSummary> {
  const db = getDb();
  const tenantRows = await db.select({ id: tenants.id }).from(tenants);
  const sum: AnchorUpgradeSummary = { checked: 0, confirmed: 0, stillPending: 0 };

  for (const t of tenantRows) {
    const pending = await withTenant(t.id, (tx) =>
      tx
        .select({ id: chainAnchors.id, otsProofBase64: chainAnchors.otsProofBase64 })
        .from(chainAnchors)
        .where(eq(chainAnchors.status, "pending")),
    );

    for (const row of pending) {
      if (!row.otsProofBase64) continue;
      sum.checked++;
      try {
        const bytes = Array.from(Buffer.from(row.otsProofBase64, "base64"));
        const detached = DetachedTimestampFile.deserialize(new Context.StreamDeserialization(bytes));

        const changed = await OpenTimestamps.upgrade(detached);
        if (!changed) {
          sum.stillPending++;
          continue;
        }

        const newProofBase64 = Buffer.from(detached.serializeToBytes()).toString("base64");

        if (detached.timestamp.isTimestampComplete()) {
          let height: number | null = null;
          for (const attestation of detached.timestamp.allAttestations().values()) {
            if (typeof attestation.height === "number") {
              height = attestation.height;
              break;
            }
          }
          await withTenant(t.id, (tx) =>
            tx
              .update(chainAnchors)
              .set({ status: "confirmed", otsProofBase64: newProofBase64, bitcoinBlockHeight: height, confirmedAt: new Date() })
              .where(eq(chainAnchors.id, row.id)),
          );
          sum.confirmed++;
        } else {
          await withTenant(t.id, (tx) =>
            tx.update(chainAnchors).set({ otsProofBase64: newProofBase64 }).where(eq(chainAnchors.id, row.id)),
          );
          sum.stillPending++;
        }
      } catch (e) {
        console.error(`[anchor:upgrade] anchor ${row.id}:`, e);
        sum.stillPending++;
      }
    }
  }
  return sum;
}
