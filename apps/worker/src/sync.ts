import { getDb, tenants } from "@lex/db";
import { syncTenant } from "@lex/integrations";

/**
 * Didox ulangan har bir tenant uchun kunlik avtomatik sinxronizatsiya — inson qo'lda
 * shartnoma/hisob-faktura kiritmasin, hammasi tunda o'zi kelib tushsin. Faqat HAQIQIY
 * integratsiya token'i bor tenantlar chaqiriladi — token yo'q bo'lsa createDataSource
 * mock (demo) adapterga tushadi va soxta ma'lumot real tenant'ga yozilib qoladi.
 */
export async function runDailySync(): Promise<{ synced: number; failed: number; skipped: number }> {
  const all = await getDb().select({ id: tenants.id, settings: tenants.settings }).from(tenants);
  let synced = 0;
  let failed = 0;
  let skipped = 0;

  for (const t of all) {
    const integrations = ((t.settings ?? {}) as Record<string, unknown>).integrations as Record<string, string> | undefined;
    if (!integrations?.didoxToken) {
      skipped++;
      continue;
    }
    try {
      const result = await syncTenant(t.id);
      console.log(`[sync] tenant ${t.id}:`, JSON.stringify(result));
      synced++;
    } catch (err) {
      console.error(`[sync] tenant ${t.id} xato:`, err);
      failed++;
    }
  }

  return { synced, failed, skipped };
}
