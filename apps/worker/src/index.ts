import { closeDb } from "@lex/db";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { runMonitor } from "./monitor";

/**
 * Worker entry — BullMQ takrorlanuvchi cron (har kuni 03:00) monitoringni ishga tushiradi.
 * Redis ulanishi `REDIS_URL` orqali.
 */
const QUEUE_NAME = "monitoring";

async function main(): Promise<void> {
  const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });

  const queue = new Queue(QUEUE_NAME, { connection });
  // Har kuni 03:00 da (Toshkent vaqti serverga bog'liq) monitoring.
  await queue.upsertJobScheduler("daily-monitor", { pattern: "0 3 * * *" }, { name: "monitor" });

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      const summary = await runMonitor(new Date());
      console.log("[monitor]", JSON.stringify(summary));
      return summary;
    },
    { connection },
  );

  worker.on("completed", (job) => console.log(`[monitor] job ${job.id} tugadi`));
  worker.on("failed", (job, err) => console.error(`[monitor] job ${job?.id} xato:`, err));

  console.log("✓ Worker ishga tushdi. Cron: har kuni 03:00.");

  const shutdown = async () => {
    console.log("→ Worker to'xtatilmoqda...");
    await worker.close();
    await queue.close();
    await connection.quit();
    await closeDb();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("✗ Worker xatosi:", err);
  process.exit(1);
});
