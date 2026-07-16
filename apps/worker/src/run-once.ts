import { closeDb } from "@lex/db";
import { runMonitor } from "./monitor";

/**
 * Monitoringni bir marta ishga tushiradi (E2E tekshiruvi / qo'lda ishga tushirish uchun).
 * Ishlatish: `pnpm --filter @lex/worker monitor:once`
 */
async function main(): Promise<void> {
  console.log("→ Monitoring ishga tushdi...");
  const summary = await runMonitor(new Date());
  console.log("✓ Monitoring yakunlandi:");
  console.table(summary);
  await closeDb();
}

main().catch(async (err) => {
  console.error("✗ Monitoring xatosi:", err);
  await closeDb();
  process.exit(1);
});
