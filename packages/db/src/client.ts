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
  passwordHash: string;
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
    password_hash: string;
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

export async function closeDb(): Promise<void> {
  await _client?.end({ timeout: 5 });
  _client = null;
  _db = null;
}

export { schema };
export * from "./schema/index";
