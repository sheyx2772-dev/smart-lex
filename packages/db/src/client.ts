import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

export type Database = PostgresJsDatabase<typeof schema>;
export type TenantTx = Parameters<Parameters<Database["transaction"]>[0]>[0];

let _client: postgres.Sql | null = null;
let _db: Database | null = null;

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL o'rnatilmagan");
  return url;
}

/** Umumiy (tenant kontekstsiz) db — faqat migratsiya/seed/auth-lookup uchun. */
export function getDb(): Database {
  if (!_db) {
    _client = postgres(connectionString(), { max: 10 });
    _db = drizzle(_client, { schema });
  }
  return _db;
}

/**
 * Tenant kontekstida tranzaksiya. `SET LOCAL app.current_tenant` o'rnatiladi —
 * shu tufayli PostgreSQL RLS siyosatlari faqat shu tenant qatorlarini ko'rsatadi.
 * BARCHA tenant-scoped so'rovlar shu orqali bajarilishi SHART (xavfsizlik).
 */
export async function withTenant<T>(tenantId: string, fn: (tx: TenantTx) => Promise<T>): Promise<T> {
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.current_tenant', ${tenantId}, true)`);
    return fn(tx);
  });
}

export interface AuthUser {
  id: string;
  tenantId: string;
  passwordHash: string | null; // One-ID (parolsiz) foydalanuvchilarда null
  role: string;
  locale: string;
  fullName: string;
}

/**
 * Login uchun email bo'yicha foydalanuvchini topadi (SECURITY DEFINER funksiya orqali,
 * tenant konteksti talab qilinmaydi). Topilmasa null.
 */
export async function findUserForAuth(email: string): Promise<AuthUser | null> {
  const db = getDb();
  const rows = await db.execute<{
    id: string;
    tenant_id: string;
    password_hash: string | null;
    role: string;
    locale: string;
    full_name: string;
    is_active: boolean;
  }>(sql`select * from auth_find_user(${email})`);

  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    passwordHash: row.password_hash,
    role: row.role,
    locale: row.locale,
    fullName: row.full_name,
  };
}

// ─── One-ID (SSO) login helperlar — tenant konteksti hali yo'q, SECURITY DEFINER orqali ──

export interface OneIdSessionUser {
  id: string;
  tenantId: string;
  role: string;
  locale: string;
  fullName: string;
}

/** Tashkilotni STIR (tenants.tin) bo'yicha topadi — One-ID legal_info.tin bilan mos. */
export async function findTenantByTin(tin: string): Promise<{ id: string; defaultLocale: string } | null> {
  const db = getDb();
  const rows = await db.execute<{ id: string; default_locale: string }>(sql`select * from auth_find_tenant_by_tin(${tin})`);
  const row = rows[0];
  return row ? { id: row.id, defaultLocale: row.default_locale } : null;
}

function mapSessionUser(row: { id: string; tenant_id: string; role: string; locale: string; full_name: string; is_active: boolean } | undefined): OneIdSessionUser | null {
  if (!row || !row.is_active) return null;
  return { id: row.id, tenantId: row.tenant_id, role: row.role, locale: row.locale, fullName: row.full_name };
}

/** One-ID PIN (JShShIR) bo'yicha tashkilot ichidan foydalanuvchini topadi. */
export async function findUserByOneId(tenantId: string, pin: string): Promise<OneIdSessionUser | null> {
  const db = getDb();
  const rows = await db.execute<{ id: string; tenant_id: string; role: string; locale: string; full_name: string; is_active: boolean }>(
    sql`select * from auth_find_user_by_oneid(${tenantId}, ${pin})`,
  );
  return mapSessionUser(rows[0]);
}

/** Mavjud (parolli) foydalanuvchini email orqali topib, birinchi One-ID kirishда PIN bilan bog'laydi. */
export async function linkOneIdByEmail(tenantId: string, email: string, pin: string, sub: string): Promise<OneIdSessionUser | null> {
  const db = getDb();
  const rows = await db.execute<{ id: string; tenant_id: string; role: string; locale: string; full_name: string; is_active: boolean }>(
    sql`select * from auth_link_oneid_by_email(${tenantId}, ${email}, ${pin}, ${sub})`,
  );
  return mapSessionUser(rows[0]);
}

/** Yangi One-ID foydalanuvchisi yaratadi (auto-provisioning yoqilganda). Parolsiz, rol 'viewer'. */
export async function createOneIdUser(input: {
  tenantId: string;
  pin: string;
  sub: string;
  fullName: string;
  email: string;
  locale: string;
}): Promise<OneIdSessionUser | null> {
  const db = getDb();
  const rows = await db.execute<{ id: string; tenant_id: string; role: string; locale: string; full_name: string; is_active: boolean }>(
    sql`select * from auth_create_oneid_user(${input.tenantId}, ${input.pin}, ${input.sub}, ${input.fullName}, ${input.email}, ${input.locale})`,
  );
  return mapSessionUser(rows[0]);
}

/**
 * One-ID self-onboarding: ro'yxatdan o'tmagan tashkilotni (STIR bo'yicha) avtomatik
 * yaratadi va uning BIRINCHI foydalanuvchisini `owner` (rahbar) sifatida qo'shadi.
 * `tenants`da RLS yo'q; `users` insert esa `withTenant` ичida (RLS WITH CHECK mos keladi).
 */
export async function createTenantWithOwner(input: {
  tin: string;
  name: string;
  owner: { pin: string; sub: string; fullName: string; email: string; locale?: string };
}): Promise<{ tenant: { id: string; defaultLocale: string }; user: OneIdSessionUser } | null> {
  const db = getDb();
  const [t] = await db
    .insert(schema.tenants)
    .values({ type: "company", name: input.name, tin: input.tin })
    .returning({ id: schema.tenants.id, defaultLocale: schema.tenants.defaultLocale });
  if (!t) return null;
  const locale = (input.owner.locale || t.defaultLocale || "uz") as (typeof schema.users.$inferInsert)["locale"];
  const u = await withTenant(t.id, async (tx) => {
    const [row] = await tx
      .insert(schema.users)
      .values({
        tenantId: t.id,
        email: input.owner.email || `${input.owner.pin}@oneid.local`,
        passwordHash: null,
        fullName: input.owner.fullName || input.owner.pin,
        role: "owner",
        locale,
        isActive: true,
        oneidPin: input.owner.pin,
        oneidSub: input.owner.sub,
      })
      .returning({
        id: schema.users.id,
        tenantId: schema.users.tenantId,
        role: schema.users.role,
        locale: schema.users.locale,
        fullName: schema.users.fullName,
        isActive: schema.users.isActive,
      });
    return row;
  });
  if (!u || !u.isActive) return null;
  return {
    tenant: { id: t.id, defaultLocale: t.defaultLocale },
    user: { id: u.id, tenantId: u.tenantId, role: u.role, locale: u.locale, fullName: u.fullName },
  };
}

export async function closeDb(): Promise<void> {
  await _client?.end({ timeout: 5 });
  _client = null;
  _db = null;
}

export { schema };
export * from "./schema/index";
