import { getDb, tenants } from "@lex/db";
import { ok } from "@lex/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";
import { clickConfigured, clickPaymentUrl, planPrice, verifyCompleteSign, verifyPrepareSign } from "../lib/click";
import { env } from "../lib/env";

interface PayOrder {
  plan: string;
  months: number;
  amount: number;
  provider: "click" | "payme";
  status: "pending" | "paid" | "canceled";
  createdAt: string;
  clickPrepareId?: number;
  paidAt?: string;
}

// Click natija kodlari (eski implementatsiyaga mos).
const C_OK = 0,
  C_SIGN = -1,
  C_AMOUNT = -2,
  C_ACTION = -3,
  C_PAID = -4,
  C_NOTFOUND = -5;

const orderId = (tenantId: string) => `${tenantId}~${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
const tenantOf = (mid: string) => mid.split("~")[0] ?? "";

async function loadOrder(mid: string): Promise<{ tenantId: string; settings: Record<string, unknown>; order: PayOrder | null }> {
  const tenantId = tenantOf(mid);
  const [row] = await getDb().select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const settings = { ...((row?.settings ?? {}) as Record<string, unknown>) };
  const orders = (settings.payOrders ?? {}) as Record<string, PayOrder>;
  return { tenantId, settings, order: orders[mid] ?? null };
}
async function saveOrder(tenantId: string, settings: Record<string, unknown>, mid: string, order: PayOrder): Promise<void> {
  const orders = { ...((settings.payOrders ?? {}) as Record<string, PayOrder>) };
  orders[mid] = order;
  await getDb().update(tenants).set({ settings: { ...settings, payOrders: orders } }).where(eq(tenants.id, tenantId));
}
/** To'lov tasdiqlanganда obunani `months` oyga uzaytiradi. */
async function activateSubscription(tenantId: string, plan: string, months: number): Promise<void> {
  const [row] = await getDb().select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const settings = { ...((row?.settings ?? {}) as Record<string, unknown>) };
  const sub = { ...((settings.subscription ?? {}) as Record<string, unknown>) };
  const curUntil = typeof sub.until === "string" ? Date.parse(sub.until) : 0;
  const base = curUntil > Date.now() ? curUntil : Date.now();
  sub.plan = plan;
  sub.until = new Date(base + months * 30 * 24 * 60 * 60 * 1000).toISOString();
  sub.lastPaymentAt = new Date().toISOString();
  settings.subscription = sub;
  await getDb().update(tenants).set({ settings }).where(eq(tenants.id, tenantId));
}

// ── Authed: to'lov buyurtmasi yaratish → Click URL ──
export const paymentRoutes = new Hono<{ Variables: Variables }>();

paymentRoutes.post("/payment/click/create", async (c) => {
  const { tenantId } = c.get("auth");
  const locale = c.get("locale");
  if (!clickConfigured()) return c.json(ok({ ok: false, error: "not_configured" }, "common.ok", locale));
  const body = (await c.req.json().catch(() => ({}))) as { plan?: string; months?: number };
  const plan = typeof body.plan === "string" ? body.plan : "Boshlang'ich";
  const months = typeof body.months === "number" && body.months > 0 ? Math.min(Math.floor(body.months), 12) : 1;
  const amount = planPrice(plan) * months;

  const mid = orderId(tenantId);
  const [row] = await getDb().select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const settings = { ...((row?.settings ?? {}) as Record<string, unknown>) };
  const order: PayOrder = { plan, months, amount, provider: "click", status: "pending", createdAt: new Date().toISOString() };
  await saveOrder(tenantId, settings, mid, order);

  const returnUrl = `${env.oneid.postLoginRedirect.replace(/\/$/, "")}/billing`;
  return c.json(ok({ ok: true, url: clickPaymentUrl(mid, amount, returnUrl), amount, plan, months }, "common.ok", locale));
});

// ── PUBLIC: Click webhooks (kabinetda /click/prepare, /click/complete) ──
export const paymentWebhookRoutes = new Hono();

function f(body: Record<string, unknown>, k: string): string {
  const v = body[k];
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

paymentWebhookRoutes.post("/click/prepare", async (c) => {
  const body = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
  const mid = f(body, "merchant_trans_id");
  const amount = f(body, "amount");
  const resp = (error: number, note: string, prepareId: number | string = 0) => ({
    click_trans_id: f(body, "click_trans_id"),
    merchant_trans_id: mid,
    merchant_prepare_id: prepareId,
    error,
    error_note: note,
  });

  if (
    !verifyPrepareSign({
      click_trans_id: f(body, "click_trans_id"),
      service_id: f(body, "service_id"),
      merchant_trans_id: mid,
      amount,
      action: f(body, "action"),
      sign_time: f(body, "sign_time"),
      sign_string: f(body, "sign_string"),
    })
  ) {
    return c.json(resp(C_SIGN, "SIGN CHECK FAILED"));
  }
  if (f(body, "action") !== "0") return c.json(resp(C_ACTION, "Action not found"));

  const { tenantId, settings, order } = await loadOrder(mid);
  if (!order) return c.json(resp(C_NOTFOUND, "Order not found"));
  if (order.status === "paid") return c.json(resp(C_PAID, "Already paid"));
  if (Math.abs(order.amount - Number(amount)) > 1) return c.json(resp(C_AMOUNT, `Bad amount, expected ${order.amount}`));

  const prepareId = Date.now();
  await saveOrder(tenantId, settings, mid, { ...order, clickPrepareId: prepareId });
  return c.json(resp(C_OK, "Success", prepareId));
});

paymentWebhookRoutes.post("/click/complete", async (c) => {
  const body = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
  const mid = f(body, "merchant_trans_id");
  const prepareId = f(body, "merchant_prepare_id");
  const amount = f(body, "amount");
  const clickError = Number(f(body, "error") || "0");
  const resp = (error: number, note: string) => ({
    click_trans_id: f(body, "click_trans_id"),
    merchant_trans_id: mid,
    merchant_confirm_id: prepareId,
    error,
    error_note: note,
  });

  if (
    !verifyCompleteSign({
      click_trans_id: f(body, "click_trans_id"),
      service_id: f(body, "service_id"),
      merchant_trans_id: mid,
      merchant_prepare_id: prepareId,
      amount,
      action: f(body, "action"),
      sign_time: f(body, "sign_time"),
      sign_string: f(body, "sign_string"),
    })
  ) {
    return c.json(resp(C_SIGN, "SIGN CHECK FAILED"));
  }

  const { tenantId, settings, order } = await loadOrder(mid);
  if (!order) return c.json(resp(C_NOTFOUND, "Order not found"));
  if (order.status === "paid") return c.json(resp(C_OK, "Already confirmed"));

  // Click tomonida to'lov bekor/muvaffaqiyatsiz bo'lsa.
  if (clickError < 0) {
    await saveOrder(tenantId, settings, mid, { ...order, status: "canceled" });
    return c.json(resp(clickError, "Canceled by Click"));
  }

  // Muvaffaqiyatli → to'landi + obuna faollashadi.
  await saveOrder(tenantId, settings, mid, { ...order, status: "paid", paidAt: new Date().toISOString() });
  await activateSubscription(tenantId, order.plan, order.months);
  return c.json(resp(C_OK, "Success"));
});
