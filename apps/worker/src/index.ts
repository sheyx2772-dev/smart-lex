import { closeDb } from "@lex/db";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { createPendingAnchors, upgradePendingAnchors } from "./anchor";
import { runMonitor } from "./monitor";
import { runDailySync } from "./sync";

/**
 * Worker entry — BullMQ takrorlanuvchi cron ishlar:
 *  - sync: har kuni 02:30 (Didox ulangan tenantlar uchun shartnoma/hisob-faktura
 *    avtomatik kelib tushadi — inson qo'lda kiritmasin) — monitoringdan OLDIN, shu kunning
 *    monitoring yugurishi yangi ma'lumot bilan ishlasin deb.
 *  - monitoring: har kuni 03:00 (debitorlik monitoring + AI qarorlari)
 *  - anchoring: audit-zanjirini Bitcoin'ga (OpenTimestamps) langar qilish —
 *    "create" har kuni 04:00 (joriy zanjir uchini kalendar serverlariga yuboradi),
 *    "upgrade" har soatda (yuborilgan langarlarni Bitcoin blokida tasdiqlanganini tekshiradi).
 * Redis ulanishi `REDIS_URL` orqali.
 */
const SYNC_QUEUE = "sync";
const MONITOR_QUEUE = "monitoring";
const ANCHOR_QUEUE = "anchoring";

async function main(): Promise<void> {
  const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });

  const syncQueue = new Queue(SYNC_QUEUE, { connection });
  await syncQueue.upsertJobScheduler("daily-sync", { pattern: "30 2 * * *" }, { name: "sync" });

  const syncWorker = new Worker(
    SYNC_QUEUE,
    async () => {
      const summary = await runDailySync();
      console.log("[sync]", JSON.stringify(summary));
      return summary;
    },
    { connection },
  );
  syncWorker.on("completed", (job) => console.log(`[sync] job ${job.id} tugadi`));
  syncWorker.on("failed", (job, err) => console.error(`[sync] job ${job?.id} xato:`, err));

  const monitorQueue = new Queue(MONITOR_QUEUE, { connection });
  // Har kuni 03:00 da (Toshkent vaqti serverga bog'liq) monitoring.
  await monitorQueue.upsertJobScheduler("daily-monitor", { pattern: "0 3 * * *" }, { name: "monitor" });

  const monitorWorker = new Worker(
    MONITOR_QUEUE,
    async () => {
      const summary = await runMonitor(new Date());
      console.log("[monitor]", JSON.stringify(summary));
      return summary;
    },
    { connection },
  );
  monitorWorker.on("completed", (job) => console.log(`[monitor] job ${job.id} tugadi`));
  monitorWorker.on("failed", (job, err) => console.error(`[monitor] job ${job?.id} xato:`, err));

  const anchorQueue = new Queue(ANCHOR_QUEUE, { connection });
  await anchorQueue.upsertJobScheduler("daily-anchor-create", { pattern: "0 4 * * *" }, { name: "anchor-create" });
  await anchorQueue.upsertJobScheduler("hourly-anchor-upgrade", { pattern: "0 * * * *" }, { name: "anchor-upgrade" });

  const anchorWorker = new Worker(
    ANCHOR_QUEUE,
    async (job) => {
      if (job.name === "anchor-create") {
        const summary = await createPendingAnchors();
        console.log("[anchor:create]", JSON.stringify(summary));
        return summary;
      }
      const summary = await upgradePendingAnchors();
      console.log("[anchor:upgrade]", JSON.stringify(summary));
      return summary;
    },
    { connection },
  );
  anchorWorker.on("completed", (job) => console.log(`[anchor] job ${job.name}#${job.id} tugadi`));
  anchorWorker.on("failed", (job, err) => console.error(`[anchor] job ${job?.name}#${job?.id} xato:`, err));

  console.log("✓ Worker ishga tushdi. Cron: sync 02:30, monitoring 03:00, anchor-create 04:00, anchor-upgrade har soatda.");

  const shutdown = async () => {
    console.log("→ Worker to'xtatilmoqda...");
    await syncWorker.close();
    await monitorWorker.close();
    await anchorWorker.close();
    await syncQueue.close();
    await monitorQueue.close();
    await anchorQueue.close();
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
