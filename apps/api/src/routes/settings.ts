import { auditLogs, collectionRules, tenants, users, withTenant } from "@lex/db";
import { DEFAULT_COLLECTION_STEPS } from "@lex/core";
import { ERROR_CODE, fail, ok } from "@lex/shared";
import { hashPassword, verifyPassword } from "@lex/shared/auth";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { env } from "../lib/env";
import { type Variables } from "../lib/context";
import {
  collectionSchema,
  companySchema,
  createUserSchema,
  didoxConnectSchema,
  docTemplatesSchema,
  integrationsSchema,
  passwordChangeSchema,
  profileSchema,
  updateUserSchema,
  validate,
} from "../lib/validation";

export const settingsRoutes = new Hono<{ Variables: Variables }>();

/** Maxfiy integratsiya maydonlarini yashiradi — mijozga sirlar chiqmaydi, faqat holat. */
function integrationStatus(settings: Record<string, unknown>) {
  const i = (settings.integrations ?? {}) as Record<string, string>;
  return {
    didoxSet: Boolean(i.didoxToken),
    bankSet: Boolean(i.bankApiKey),
    eimzoSiteId: i.eimzoSiteId ?? "",
    smsProvider: i.smsProvider ?? "",
    smsSet: Boolean(i.smsApiKey),
    telegramSet: Boolean(i.telegramBotToken),
    telegramChatId: i.telegramChatId ?? "",
    telegramTopicId: i.telegramTopicId ?? "",
  };
}

/** settings'dan integrations'ni olib tashlaydi (mijozga qaytarishdan oldin). */
function stripIntegrations(settings: Record<string, unknown>): Record<string, unknown> {
  const { integrations: _omit, ...rest } = settings;
  return rest;
}

const CAN_EDIT_COMPANY = new Set(["owner", "admin"]);
const CAN_EDIT_COLLECTION = new Set(["owner", "admin", "finance"]);
const CAN_MANAGE_USERS = new Set(["owner", "admin"]);

/** Barcha sozlamalar: profil, kompaniya, collection siyosati. */
settingsRoutes.get("/", async (c) => {
  const { tenantId, userId } = c.get("auth");
  const data = await withTenant(tenantId, async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId));
    const [tenant] = await tx.select().from(tenants).where(eq(tenants.id, tenantId));
    const [rule] = await tx.select().from(collectionRules).where(eq(collectionRules.isDefault, true));
    return { user, tenant, rule };
  });

  return c.json(
    ok(
      {
        profile: data.user ? { id: data.user.id, fullName: data.user.fullName, email: data.user.email, locale: data.user.locale, role: data.user.role } : null,
        company: data.tenant
          ? {
              name: data.tenant.name,
              tin: data.tenant.tin,
              type: data.tenant.type,
              legalAddress: data.tenant.legalAddress ?? "",
              bankAccount: data.tenant.bankAccount ?? "",
              bankMfo: data.tenant.bankMfo ?? "",
              phone: data.tenant.phone ?? "",
              email: data.tenant.email ?? "",
              defaultLocale: data.tenant.defaultLocale,
              settings: stripIntegrations(data.tenant.settings ?? {}),
              integrations: integrationStatus(data.tenant.settings ?? {}),
            }
          : null,
        collection: { steps: data.rule?.steps ?? DEFAULT_COLLECTION_STEPS },
      },
      "common.ok",
      c.get("locale"),
    ),
  );
});

/** Profil (ism, til). */
settingsRoutes.put("/profile", async (c) => {
  const locale = c.get("locale");
  const { tenantId, userId } = c.get("auth");
  const parsed = validate(profileSchema, await c.req.json().catch(() => null));
  if (!parsed.ok) return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale, { fields: parsed.fields }), 422);

  await withTenant(tenantId, (tx) =>
    tx.update(users).set({ fullName: parsed.data.fullName, locale: parsed.data.locale }).where(eq(users.id, userId)),
  );
  return c.json(ok(parsed.data, "common.updated", locale));
});

/** Parolni o'zgartirish. */
settingsRoutes.put("/password", async (c) => {
  const locale = c.get("locale");
  const { tenantId, userId } = c.get("auth");
  const parsed = validate(passwordChangeSchema, await c.req.json().catch(() => null));
  if (!parsed.ok) return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale, { fields: parsed.fields }), 422);

  const result = await withTenant(tenantId, async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId));
    // One-ID (parolsiz) foydalanuvchida passwordHash null — parol almashtirib bo'lmaydi.
    if (!user || !user.passwordHash || !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) return "bad_current";
    const hash = await hashPassword(parsed.data.newPassword);
    await tx.update(users).set({ passwordHash: hash }).where(eq(users.id, userId));
    return "ok";
  });

  if (result === "bad_current") {
    return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale, { fields: { currentPassword: "invalid" } }), 422);
  }
  return c.json(ok({ changed: true }, "common.updated", locale));
});

/** Kompaniya profili + konfiguratsiya (settings jsonb). */
settingsRoutes.put("/company", async (c) => {
  const locale = c.get("locale");
  const { tenantId, role } = c.get("auth");
  if (!CAN_EDIT_COMPANY.has(role)) return c.json(fail(ERROR_CODE.FORBIDDEN, "auth.forbidden", locale), 403);

  const parsed = validate(companySchema, await c.req.json().catch(() => null));
  if (!parsed.ok) return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale, { fields: parsed.fields }), 422);

  const d = parsed.data;
  await withTenant(tenantId, async (tx) => {
    const [existing] = await tx.select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, tenantId));
    const prev = existing?.settings ?? {};
    // Merge: yangi settings'ni qo'shadi, LEKIN integrations (sirlar) saqlanib qoladi.
    const mergedSettings = d.settings
      ? { ...prev, ...(d.settings as Record<string, unknown>), integrations: prev.integrations }
      : prev;
    await tx
      .update(tenants)
      .set({
        name: d.name,
        legalAddress: d.legalAddress || null,
        bankAccount: d.bankAccount || null,
        bankMfo: d.bankMfo || null,
        phone: d.phone || null,
        email: d.email || null,
        defaultLocale: d.defaultLocale,
        settings: mergedSettings,
      })
      .where(eq(tenants.id, tenantId));
    await tx.insert(auditLogs).values({ tenantId, actorType: "user", actorId: c.get("auth").userId, action: "settings.company_updated", entityType: "tenant", entityId: tenantId });
  });
  return c.json(ok({ saved: true }, "common.updated", locale));
});

/** Integratsiyalar — maxfiy kalitlar (settings.integrations). Faqat bo'sh bo'lmagan
 * maydonlar yangilanadi (bo'sh qoldirsa eskisi saqlanadi). */
settingsRoutes.put("/integrations", async (c) => {
  const locale = c.get("locale");
  const { tenantId, role, userId } = c.get("auth");
  if (!CAN_EDIT_COMPANY.has(role)) return c.json(fail(ERROR_CODE.FORBIDDEN, "auth.forbidden", locale), 403);

  const parsed = validate(integrationsSchema, await c.req.json().catch(() => null));
  if (!parsed.ok) return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale, { fields: parsed.fields }), 422);

  await withTenant(tenantId, async (tx) => {
    const [existing] = await tx.select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, tenantId));
    const prev = existing?.settings ?? {};
    const prevInt = (prev.integrations ?? {}) as Record<string, string>;
    // Faqat kiritilgan (bo'sh bo'lmagan) maydonlarni yangilash.
    const next: Record<string, string> = { ...prevInt };
    for (const [k, v] of Object.entries(parsed.data)) {
      if (typeof v === "string" && v.length > 0) next[k] = v;
    }
    await tx.update(tenants).set({ settings: { ...prev, integrations: next } }).where(eq(tenants.id, tenantId));
    await tx.insert(auditLogs).values({ tenantId, actorType: "user", actorId: userId, action: "settings.integrations_updated", entityType: "tenant", entityId: tenantId });
  });
  return c.json(ok({ saved: true }, "common.updated", locale));
});

/**
 * Didox'ga E-IMZO orqali o'z-o'zini ulash (self-service). Brauzer E-IMZO orqali
 * kompaniya STIR'ini imzolab pkcs7+signatureHex yuboradi; server Didox bilan
 * gaplashadi (Partner-Authorization sirini serverdan chiqarmaslik uchun) va
 * natijadagi shaxsiy User-Key'ni tenant sozlamalariga saqlaydi.
 */
settingsRoutes.post("/didox/connect", async (c) => {
  const locale = c.get("locale");
  const { tenantId, role, userId } = c.get("auth");
  if (!CAN_EDIT_COMPANY.has(role)) return c.json(fail(ERROR_CODE.FORBIDDEN, "auth.forbidden", locale), 403);

  const parsed = validate(didoxConnectSchema, await c.req.json().catch(() => null));
  if (!parsed.ok) return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale, { fields: parsed.fields }), 422);

  if (!env.didox.partnerToken) {
    return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "integrations.didox_not_configured", locale), 422);
  }

  const [tenant] = await withTenant(tenantId, (tx) => tx.select({ tin: tenants.tin }).from(tenants).where(eq(tenants.id, tenantId)));
  if (!tenant?.tin) return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "integrations.didox_tin_missing", locale), 422);

  const base = env.didox.apiUrl.replace(/\/+$/, "");
  const headers = { "Content-Type": "application/json", "Partner-Authorization": env.didox.partnerToken };

  const tsRes = await fetch(`${base}/v1/dsvs/timestamp`, {
    method: "POST",
    headers,
    body: JSON.stringify({ pkcs7: parsed.data.pkcs7, signatureHex: parsed.data.signatureHex }),
  }).catch((e) => {
    console.error("[didox/connect] timestamp fetch throw:", e);
    return null;
  });
  const tsText = tsRes ? await tsRes.clone().text().catch(() => "") : "";
  console.error("[didox/connect] timestamp", tsRes?.status, tsText.slice(0, 500));
  const tsData = tsRes && tsRes.ok ? ((await tsRes.json().catch(() => null)) as { timeStampTokenB64?: string } | null) : null;
  if (!tsData?.timeStampTokenB64) {
    return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "integrations.didox_connect_failed", locale), 502);
  }

  const authRes = await fetch(`${base}/v1/auth/${encodeURIComponent(tenant.tin)}/token/ru`, {
    method: "POST",
    headers,
    body: JSON.stringify({ signature: tsData.timeStampTokenB64 }),
  }).catch((e) => {
    console.error("[didox/connect] auth fetch throw:", e);
    return null;
  });
  const authText = authRes ? await authRes.clone().text().catch(() => "") : "";
  console.error("[didox/connect] auth", authRes?.status, authText.slice(0, 500));
  const authData = authRes && authRes.ok ? ((await authRes.json().catch(() => null)) as { token?: string } | null) : null;
  if (!authData?.token) {
    return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "integrations.didox_connect_failed", locale), 502);
  }

  await withTenant(tenantId, async (tx) => {
    const [existing] = await tx.select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, tenantId));
    const prev = existing?.settings ?? {};
    const prevInt = (prev.integrations ?? {}) as Record<string, string>;
    await tx
      .update(tenants)
      .set({ settings: { ...prev, integrations: { ...prevInt, didoxToken: authData.token } } })
      .where(eq(tenants.id, tenantId));
    await tx.insert(auditLogs).values({ tenantId, actorType: "user", actorId: userId, action: "settings.didox_connected", entityType: "tenant", entityId: tenantId });
  });

  return c.json(ok({ connected: true }, "integrations.didox_connected", locale));
});

/** Hujjat shablonlari — tenant o'z talabnoma/da'vo/akt-sverka matnini sozlaydi. */
settingsRoutes.put("/doc-templates", async (c) => {
  const locale = c.get("locale");
  const { tenantId, role, userId } = c.get("auth");
  if (!CAN_EDIT_COMPANY.has(role)) return c.json(fail(ERROR_CODE.FORBIDDEN, "auth.forbidden", locale), 403);

  const parsed = validate(docTemplatesSchema, await c.req.json().catch(() => null));
  if (!parsed.ok) return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale, { fields: parsed.fields }), 422);

  await withTenant(tenantId, async (tx) => {
    const [existing] = await tx.select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, tenantId));
    const prev = existing?.settings ?? {};
    const prevT = (prev.docTemplates ?? {}) as Record<string, string>;
    const next = { ...prevT, ...parsed.data };
    await tx.update(tenants).set({ settings: { ...prev, docTemplates: next } }).where(eq(tenants.id, tenantId));
    await tx.insert(auditLogs).values({ tenantId, actorType: "user", actorId: userId, action: "settings.templates_updated", entityType: "tenant", entityId: tenantId });
  });
  return c.json(ok({ saved: true }, "common.updated", locale));
});

/** Jamoa — foydalanuvchilar ro'yxati. */
settingsRoutes.get("/users", async (c) => {
  const { tenantId } = c.get("auth");
  const rows = await withTenant(tenantId, (tx) =>
    tx
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        locale: users.locale,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.createdAt),
  );
  return c.json(ok(rows, "common.ok", c.get("locale")));
});

/** Yangi foydalanuvchi qo'shish. */
settingsRoutes.post("/users", async (c) => {
  const locale = c.get("locale");
  const { tenantId, role, userId } = c.get("auth");
  if (!CAN_MANAGE_USERS.has(role)) return c.json(fail(ERROR_CODE.FORBIDDEN, "auth.forbidden", locale), 403);

  const parsed = validate(createUserSchema, await c.req.json().catch(() => null));
  if (!parsed.ok) return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale, { fields: parsed.fields }), 422);

  const result = await withTenant(tenantId, async (tx) => {
    const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email));
    if (existing) return "conflict";
    const passwordHash = await hashPassword(parsed.data.password);
    const [created] = await tx
      .insert(users)
      .values({ tenantId, email: parsed.data.email, fullName: parsed.data.fullName, role: parsed.data.role, passwordHash })
      .returning({ id: users.id, fullName: users.fullName, email: users.email, role: users.role, isActive: users.isActive });
    await tx.insert(auditLogs).values({ tenantId, actorType: "user", actorId: userId, action: "user.created", entityType: "user", entityId: created?.id });
    return created;
  });

  if (result === "conflict") {
    return c.json(fail(ERROR_CODE.CONFLICT, "common.validation_failed", locale, { fields: { email: "exists" } }), 409);
  }
  return c.json(ok(result, "common.created", locale));
});

/** Foydalanuvchi rolini / faolligini o'zgartirish (o'zini bloklab bo'lmaydi). */
settingsRoutes.put("/users/:id", async (c) => {
  const locale = c.get("locale");
  const { tenantId, role, userId } = c.get("auth");
  if (!CAN_MANAGE_USERS.has(role)) return c.json(fail(ERROR_CODE.FORBIDDEN, "auth.forbidden", locale), 403);

  const id = c.req.param("id");
  if (id === userId) return c.json(fail(ERROR_CODE.FORBIDDEN, "auth.forbidden", locale), 403); // o'zini o'zgartirmaydi

  const parsed = validate(updateUserSchema, await c.req.json().catch(() => null));
  if (!parsed.ok) return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale, { fields: parsed.fields }), 422);

  const updated = await withTenant(tenantId, async (tx) => {
    const [row] = await tx
      .update(users)
      .set({ ...(parsed.data.role ? { role: parsed.data.role } : {}), ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}) })
      .where(eq(users.id, id))
      .returning({ id: users.id, role: users.role, isActive: users.isActive });
    if (row) await tx.insert(auditLogs).values({ tenantId, actorType: "user", actorId: userId, action: "user.updated", entityType: "user", entityId: id });
    return row;
  });

  if (!updated) return c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", locale), 404);
  return c.json(ok(updated, "common.updated", locale));
});

/** Collection siyosati (bosqichlar). */
settingsRoutes.put("/collection", async (c) => {
  const locale = c.get("locale");
  const { tenantId, role, userId } = c.get("auth");
  if (!CAN_EDIT_COLLECTION.has(role)) return c.json(fail(ERROR_CODE.FORBIDDEN, "auth.forbidden", locale), 403);

  const parsed = validate(collectionSchema, await c.req.json().catch(() => null));
  if (!parsed.ok) return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale, { fields: parsed.fields }), 422);

  await withTenant(tenantId, async (tx) => {
    const [existing] = await tx.select().from(collectionRules).where(eq(collectionRules.isDefault, true));
    if (existing) {
      await tx.update(collectionRules).set({ steps: parsed.data.steps }).where(and(eq(collectionRules.id, existing.id), eq(collectionRules.tenantId, tenantId)));
    } else {
      await tx.insert(collectionRules).values({ tenantId, name: "Standart siyosat", steps: parsed.data.steps, isDefault: true });
    }
    await tx.insert(auditLogs).values({ tenantId, actorType: "user", actorId: userId, action: "settings.collection_updated", entityType: "collection_rule", entityId: tenantId });
  });
  return c.json(ok({ saved: true }, "common.updated", locale));
});
