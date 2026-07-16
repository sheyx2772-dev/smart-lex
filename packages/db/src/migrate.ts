import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { appRoleStatements, authFunctionStatements, rlsStatements } from "./rls";

/**
 * Migratsiyalarni qo'llaydi, cheklangan ilova rolini (`lex_app`) yaratadi va RLS
 * siyosatlarini o'rnatadi. Owner/superuser bilan ishga tushiriladi:
 *   DATABASE_MIGRATION_URL (owner) — bo'lmasa DATABASE_URL fallback.
 * Ilova esa (api/worker/seed) `lex_app` bilan ulanadi (RLS majburiy bo'lishi uchun).
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_MIGRATION_URL yoki DATABASE_URL o'rnatilmagan");

  const appPassword = process.env.APP_DB_PASSWORD ?? "lex_app";
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  console.log("→ Migratsiyalar qo'llanmoqda...");
  await migrate(db, { migrationsFolder: "./drizzle" });

  console.log("→ Ilova roli (lex_app) yaratilmoqda...");
  for (const stmt of appRoleStatements(appPassword)) {
    await db.execute(sql.raw(stmt));
  }

  console.log("→ RLS siyosatlari o'rnatilmoqda...");
  for (const stmt of rlsStatements()) {
    await db.execute(sql.raw(stmt));
  }

  console.log("→ Auth funksiyasi (SECURITY DEFINER) o'rnatilmoqda...");
  for (const stmt of authFunctionStatements()) {
    await db.execute(sql.raw(stmt));
  }

  await client.end();
  console.log("✓ Tayyor.");
}

main().catch((err) => {
  console.error("✗ Migratsiya xatosi:", err);
  process.exit(1);
});
