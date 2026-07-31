import { contractors, getDb, tenants, users, withTenant } from "@lex/db";
import { ok } from "@lex/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";
import { env } from "../lib/env";
import { readSub } from "../lib/subscription";

export const miscRoutes = new Hono<{ Variables: Variables }>();

/** Joriy foydalanuvchi + tenant profili. */
miscRoutes.get("/me", async (c) => {
  const { userId, tenantId, role } = c.get("auth");
  const data = await withTenant(tenantId, async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId));
    return user;
  });
  const [tenant] = await getDb().select().from(tenants).where(eq(tenants.id, tenantId));

  return c.json(
    ok(
      {
        user: data ? { id: data.id, fullName: data.fullName, email: data.email, role, locale: data.locale } : null,
        tenant: tenant ? { id: tenant.id, name: tenant.name, type: tenant.type, tin: tenant.tin, defaultLocale: tenant.defaultLocale } : null,
        isPlatformAdmin: Boolean(env.platformTenantId) && tenantId === env.platformTenantId && (role === "owner" || role === "admin"),
        subscription: readSub(tenant?.settings as Record<string, unknown> | undefined),
      },
      "common.ok",
      c.get("locale"),
    ),
  );
});

miscRoutes.get("/contractors", async (c) => {
  const { tenantId } = c.get("auth");
  const rows = await withTenant(tenantId, (tx) => tx.select().from(contractors).orderBy(contractors.name));
  return c.json(ok(rows, "common.ok", c.get("locale")));
});

