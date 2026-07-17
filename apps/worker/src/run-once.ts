import { closeDb } from "@lex/db";
import { runMonitor } from "./monitor";

/**
 * Monitorni bir marta ishga tushiradi (cron/BullMQ'siz). Seed'dan keyin
 * receivables, eslatmalar, talabnoma hujjatlari va tasdiqlarni yaratish uchun:
 *   pnpm --filter @lex/worker monitor:once
 */
async function main(): Promise<void> {
  const summary = await runMonitor(new Date());
  console.log("[monitor:once]", JSON.stringify(summary, null, 2));
  await closeDb();
}

main().catch(async (err) => {
  console.error("✗ monitor:once xatosi:", err);
  await closeDb();
  process.exit(1);
});
