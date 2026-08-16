import { closeDb } from "@lex/db";
import { runLegalTasks } from "./legal-tasks";

/** Bir martalik ishga tushirish (cron/BullMQ'siz) — qo'lda tekshirish uchun:
 *   pnpm --filter @lex/worker exec tsx src/legal-tasks-once.ts
 */
async function main(): Promise<void> {
  const summary = await runLegalTasks(new Date());
  console.log("[legal-tasks:once]", JSON.stringify(summary, null, 2));
  await closeDb();
}

main().catch(async (err) => {
  console.error("✗ legal-tasks:once xatosi:", err);
  await closeDb();
  process.exit(1);
});
