import { legalMatters, type TenantTx } from "@lex/db";
import { sql } from "drizzle-orm";

/** "2026-LM-014" uslubidagi ish raqamini generatsiya qiladi — shu yilgi ishlar soni + 1.
 * Ikkita joyda ishlatiladi: qo'lda yaratish (POST /legal/matters) va AI createMatter asbobi. */
export async function generateMatterNumber(tx: TenantTx): Promise<string> {
  const year = new Date().getFullYear();
  const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(legalMatters).where(sql`extract(year from ${legalMatters.createdAt}) = ${year}`);
  const seq = (row?.n ?? 0) + 1;
  return `${year}-LM-${String(seq).padStart(3, "0")}`;
}
