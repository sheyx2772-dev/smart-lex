import { hashPassword } from "@lex/shared/auth";
import postgres from "postgres";

/**
 * Bitta foydalanuvchi (email + parol) yaratadi — tenant STIR bo'yicha topiladi.
 * Superuser ulanishi (DATABASE_MIGRATION_URL) bilan, RLS chetlab o'tiladi.
 * Ishlatish (env bilan):
 *   NEW_EMAIL=admin@lexai.com.uz NEW_PASSWORD=... NEW_TENANT_TIN=312559000 NEW_ROLE=owner \
 *   corepack pnpm --filter @lex/db exec tsx src/create-user.ts
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_MIGRATION_URL yoki DATABASE_URL o'rnatilmagan");

  const email = process.env.NEW_EMAIL?.trim();
  const password = process.env.NEW_PASSWORD;
  const tin = process.env.NEW_TENANT_TIN?.trim();
  const role = (process.env.NEW_ROLE ?? "owner").trim();
  const fullName = (process.env.NEW_FULL_NAME ?? email ?? "Administrator").trim();
  if (!email || !password || !tin) {
    throw new Error("NEW_EMAIL, NEW_PASSWORD va NEW_TENANT_TIN majburiy");
  }

  const sql = postgres(url, { max: 1 });
  try {
    const tenants = await sql<{ id: string; name: string }[]>`select id, name from tenants where tin = ${tin} limit 1`;
    const tenant = tenants[0];
    if (!tenant) throw new Error(`Tenant topilmadi (STIR=${tin}). Avval tenant yarating.`);

    const passwordHash = await hashPassword(password);
    const rows = await sql<{ id: string; email: string; role: string }[]>`
      insert into users (tenant_id, email, password_hash, full_name, role, locale, is_active)
      values (${tenant.id}, ${email}, ${passwordHash}, ${fullName}, ${role}::user_role, 'uz', true)
      on conflict (tenant_id, email)
        do update set password_hash = excluded.password_hash, role = excluded.role, is_active = true
      returning id, email, role::text
    `;
    console.log(`✓ Foydalanuvchi tayyor: ${rows[0]?.email} (rol: ${rows[0]?.role}) — tenant "${tenant.name}"`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("✗ Xato:", err instanceof Error ? err.message : err);
  process.exit(1);
});
