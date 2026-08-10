import { getDb, tenants } from "@lex/db";
import { ok } from "@lex/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";
import { decryptSecret, encryptSecret } from "@lex/shared/secrets";

/**
 * Firma o'z to'lov merchantini ulaydi (qarzdor→firma karta to'lovi uchun).
 * Migratsiyasiz: `tenant.settings.merchant.{click,payme}`. Sir DB'da AES-256-GCM bilan
 * shifrlangan holda saqlanadi (secrets.ts) — o'qishда maskalanadi, hech qachon ochiq
 * qaytarilmaydi.
 */
export const merchantRoutes = new Hono<{ Variables: Variables }>();

interface ClickM { serviceId?: string; merchantId?: string; secretKey?: string }
interface PaymeM { merchantId?: string; secretKey?: string }
interface Merchant { click?: ClickM; payme?: PaymeM }

const mask = (s: string) => (s ? "••••" + s.slice(-3) : "");

merchantRoutes.get("/merchant", async (c) => {
  const { tenantId } = c.get("auth");
  const [row] = await getDb().select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const m = ((row?.settings as Record<string, unknown> | undefined)?.merchant ?? {}) as Merchant;
  const clickSecret = decryptSecret(m.click?.secretKey);
  const paymeSecret = decryptSecret(m.payme?.secretKey);
  return c.json(
    ok(
      {
        click: { connected: Boolean(m.click?.serviceId && m.click?.merchantId && clickSecret), serviceId: m.click?.serviceId ?? "", merchantId: m.click?.merchantId ?? "", secretKey: mask(clickSecret) },
        payme: { connected: Boolean(m.payme?.merchantId && paymeSecret), merchantId: m.payme?.merchantId ?? "", secretKey: mask(paymeSecret) },
      },
      "common.ok",
      c.get("locale"),
    ),
  );
});

merchantRoutes.post("/merchant", async (c) => {
  const { tenantId, role } = c.get("auth");
  if (role !== "owner" && role !== "admin") return c.json({ success: false, data: null, error: "forbidden", message: "faqat rahbar" }, 403);
  const body = (await c.req.json().catch(() => ({}))) as { click?: ClickM; payme?: PaymeM };
  const [row] = await getDb().select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const s = { ...((row?.settings ?? {}) as Record<string, unknown>) };
  const prev = (s.merchant ?? {}) as Merchant;

  const next: Merchant = { click: { ...prev.click }, payme: { ...prev.payme } };
  if (body.click) {
    if (typeof body.click.serviceId === "string") next.click!.serviceId = body.click.serviceId.trim();
    if (typeof body.click.merchantId === "string") next.click!.merchantId = body.click.merchantId.trim();
    // Sirni faqat yangi qiymat berilganда (maskalangan emas) yangilaymiz — shifrlab saqlaymiz.
    if (typeof body.click.secretKey === "string" && body.click.secretKey && !body.click.secretKey.startsWith("••••")) next.click!.secretKey = encryptSecret(body.click.secretKey.trim());
  }
  if (body.payme) {
    if (typeof body.payme.merchantId === "string") next.payme!.merchantId = body.payme.merchantId.trim();
    if (typeof body.payme.secretKey === "string" && body.payme.secretKey && !body.payme.secretKey.startsWith("••••")) next.payme!.secretKey = encryptSecret(body.payme.secretKey.trim());
  }
  s.merchant = next;
  await getDb().update(tenants).set({ settings: s }).where(eq(tenants.id, tenantId));
  return c.json(ok({ ok: true }, "common.ok", c.get("locale")));
});
