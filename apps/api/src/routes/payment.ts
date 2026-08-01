import { auditLogs, getDb, payments, tenants, withTenant } from "@lex/db";
import { ok } from "@lex/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";
import { clickConfigured, clickPaymentUrl, planPrice, verifyCompleteSign, verifyCompleteSignKey, verifyPrepareSign, verifyPrepareSignKey } from "../lib/click";
import { env } from "../lib/env";
import { PAYME_ERR, PAYME_STATE, paymeAuthOk, paymeAuthOkWith, paymeCheckoutUrl, paymeConfigured, somToTiyin } from "../lib/payme";

interface PayOrder {
  plan: string;
  months: number;
  amount: number;
  provider: "click" | "payme";
  status: "pending" | "paid" | "canceled";
  createdAt: string;
  clickPrepareId?: number;
  paidAt?: string;
  // Qarzdor→firma to'lovi uchun (obunadan farqli):
  kind?: "subscription" | "debt";
  receivableId?: string;
  invoiceId?: string;
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

// ── Per-tenant (firma merchanti) — qarzdor→firma to'lovi uchun ──
function firmClickSecret(settings: Record<string, unknown>): string {
  return ((settings.merchant as { click?: { secretKey?: string } } | undefined)?.click?.secretKey) ?? "";
}
function firmPaymeKey(settings: Record<string, unknown>): string {
  return ((settings.merchant as { payme?: { secretKey?: string } } | undefined)?.payme?.secretKey) ?? "";
}
/** Qarz to'lovi tasdiqlanганда — `payments`ga yozadi (recovery raqami o'zi ko'tariladi). */
async function recordDebtPayment(tenantId: string, order: PayOrder): Promise<void> {
  if (!order.invoiceId) return;
  const invoiceId = order.invoiceId;
  await withTenant(tenantId, async (tx) => {
    await tx.insert(payments).values({
      tenantId,
      invoiceId,
      amountMinor: BigInt(Math.round(order.amount * 100)),
      currency: "UZS",
      status: "received",
      paidAt: new Date(),
    });
    if (order.receivableId) {
      await tx.insert(auditLogs).values({
        tenantId,
        actorType: "system",
        actorId: "debtor-portal",
        action: "debt.paid",
        entityType: "receivable",
        entityId: order.receivableId,
        detail: { amount: order.amount, provider: order.provider },
      });
    }
  });
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

paymentRoutes.post("/payment/payme/create", async (c) => {
  const { tenantId } = c.get("auth");
  const locale = c.get("locale");
  if (!paymeConfigured()) return c.json(ok({ ok: false, error: "not_configured" }, "common.ok", locale));
  const body = (await c.req.json().catch(() => ({}))) as { plan?: string; months?: number };
  const plan = typeof body.plan === "string" ? body.plan : "Boshlang'ich";
  const months = typeof body.months === "number" && body.months > 0 ? Math.min(Math.floor(body.months), 12) : 1;
  const amount = planPrice(plan) * months;

  const mid = orderId(tenantId);
  const [row] = await getDb().select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const settings = { ...((row?.settings ?? {}) as Record<string, unknown>) };
  await saveOrder(tenantId, settings, mid, { plan, months, amount, provider: "payme", status: "pending", createdAt: new Date().toISOString() });

  const returnUrl = `${env.oneid.postLoginRedirect.replace(/\/$/, "")}/billing`;
  return c.json(ok({ ok: true, url: paymeCheckoutUrl(mid, somToTiyin(amount), returnUrl), amount, plan, months }, "common.ok", locale));
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

  if (f(body, "action") !== "0") return c.json(resp(C_ACTION, "Action not found"));

  const { tenantId, settings, order } = await loadOrder(mid);
  if (!order) return c.json(resp(C_NOTFOUND, "Order not found"));

  // Debt = firma siri bilan, obuna = platforma siri bilan imzo tekshiruvi.
  const signPayload = {
    click_trans_id: f(body, "click_trans_id"),
    service_id: f(body, "service_id"),
    merchant_trans_id: mid,
    amount,
    action: f(body, "action"),
    sign_time: f(body, "sign_time"),
    sign_string: f(body, "sign_string"),
  };
  const signOk = order.kind === "debt" ? verifyPrepareSignKey(firmClickSecret(settings), signPayload) : verifyPrepareSign(signPayload);
  if (!signOk) return c.json(resp(C_SIGN, "SIGN CHECK FAILED"));
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

  const { tenantId, settings, order } = await loadOrder(mid);
  if (!order) return c.json(resp(C_NOTFOUND, "Order not found"));

  const signPayload = {
    click_trans_id: f(body, "click_trans_id"),
    service_id: f(body, "service_id"),
    merchant_trans_id: mid,
    merchant_prepare_id: prepareId,
    amount,
    action: f(body, "action"),
    sign_time: f(body, "sign_time"),
    sign_string: f(body, "sign_string"),
  };
  const signOk = order.kind === "debt" ? verifyCompleteSignKey(firmClickSecret(settings), signPayload) : verifyCompleteSign(signPayload);
  if (!signOk) return c.json(resp(C_SIGN, "SIGN CHECK FAILED"));
  if (order.status === "paid") return c.json(resp(C_OK, "Already confirmed"));

  // Click tomonida to'lov bekor/muvaffaqiyatsiz bo'lsa.
  if (clickError < 0) {
    await saveOrder(tenantId, settings, mid, { ...order, status: "canceled" });
    return c.json(resp(clickError, "Canceled by Click"));
  }

  // Muvaffaqiyatli → to'landi. Debt = to'lovni yozamiz, obuna = faollashadi.
  await saveOrder(tenantId, settings, mid, { ...order, status: "paid", paidAt: new Date().toISOString() });
  if (order.kind === "debt") await recordDebtPayment(tenantId, order);
  else await activateSubscription(tenantId, order.plan, order.months);
  return c.json(resp(C_OK, "Success"));
});

// ── Payme JSON-RPC 2.0 callback (/payme/callback — kabinetdagi yo'l) ──
interface PaymeTxn {
  orderId: string;
  state: number;
  create_time: number;
  perform_time: number;
  cancel_time: number;
  reason: number | null;
}
async function findPaymeTxn(paymeId: string): Promise<{ tenantId: string; settings: Record<string, unknown>; txn: PaymeTxn | null }> {
  const rows = await getDb().select({ id: tenants.id, settings: tenants.settings }).from(tenants);
  for (const r of rows) {
    const s = (r.settings ?? {}) as Record<string, unknown>;
    const txns = (s.paymeTxns ?? {}) as Record<string, PaymeTxn>;
    if (txns[paymeId]) return { tenantId: r.id, settings: { ...s }, txn: txns[paymeId] };
  }
  return { tenantId: "", settings: {}, txn: null };
}
async function savePaymeTxn(tenantId: string, settings: Record<string, unknown>, paymeId: string, txn: PaymeTxn): Promise<void> {
  const txns = { ...((settings.paymeTxns ?? {}) as Record<string, PaymeTxn>) };
  txns[paymeId] = txn;
  await getDb().update(tenants).set({ settings: { ...settings, paymeTxns: txns } }).where(eq(tenants.id, tenantId));
}

paymentWebhookRoutes.post("/payme/callback", async (c) => {
  const body = (await c.req.json().catch(() => null)) as { method?: string; params?: Record<string, unknown>; id?: unknown } | null;
  const id = body?.id ?? null;
  const msg = (m: string) => ({ ru: m, uz: m, en: m });
  const errR = (code: number, m: string, data?: string) => c.json({ error: { code, message: msg(m), ...(data ? { data } : {}) }, id });
  const okR = (result: unknown) => c.json({ result, id });

  if (!body || !body.method) return errR(-32600, "Invalid request");
  const params = (body.params ?? {}) as Record<string, unknown>;
  const method = body.method;
  const accountOrder = (): string => String((params.account as Record<string, unknown> | undefined)?.payment_id ?? "");

  // Auth: qarz (debt) buyurtmasi bo'lsa FIRMA kaliti bilan, obuna bo'lsa platforma kaliti bilan.
  let firmKey: string | null = null;
  try {
    const acct = accountOrder();
    if (acct) {
      const { settings, order } = await loadOrder(acct);
      if (order?.kind === "debt") firmKey = firmPaymeKey(settings);
    } else if (params.id) {
      const { txn } = await findPaymeTxn(String(params.id));
      if (txn) {
        const o = await loadOrder(txn.orderId);
        if (o.order?.kind === "debt") firmKey = firmPaymeKey(o.settings);
      }
    }
  } catch {
    firmKey = null;
  }
  const authed = firmKey !== null ? paymeAuthOkWith(c.req.header("authorization"), firmKey) : paymeAuthOk(c.req.header("authorization"));
  if (!authed) return errR(PAYME_ERR.UNAUTHORIZED, "Avtorizatsiya xatosi");
  const amtOk = (som: number) => Math.abs(somToTiyin(som) - Number(params.amount)) <= 100;

  try {
    if (method === "CheckPerformTransaction") {
      const { order } = await loadOrder(accountOrder());
      if (!order) return errR(PAYME_ERR.INVALID_PARAMS, "Buyurtma topilmadi", "payment_id");
      if (!amtOk(order.amount)) return errR(PAYME_ERR.AMOUNT_WRONG, "Noto'g'ri summa");
      if (order.status === "paid") return errR(PAYME_ERR.ALREADY_DONE, "Allaqachon to'langan");
      return okR({ allow: true });
    }
    if (method === "CreateTransaction") {
      const paymeId = String(params.id);
      const found = await findPaymeTxn(paymeId);
      if (found.txn) return okR({ create_time: found.txn.create_time, transaction: found.txn.orderId, state: found.txn.state });
      const { tenantId, settings, order } = await loadOrder(accountOrder());
      if (!order) return errR(PAYME_ERR.INVALID_PARAMS, "Buyurtma topilmadi", "payment_id");
      if (!amtOk(order.amount)) return errR(PAYME_ERR.AMOUNT_WRONG, "Noto'g'ri summa");
      if (order.status === "paid") return errR(PAYME_ERR.ALREADY_DONE, "Allaqachon to'langan");
      const t: PaymeTxn = { orderId: accountOrder(), state: PAYME_STATE.CREATED, create_time: Number(params.time) || Date.now(), perform_time: 0, cancel_time: 0, reason: null };
      await savePaymeTxn(tenantId, settings, paymeId, t);
      return okR({ create_time: t.create_time, transaction: t.orderId, state: t.state });
    }
    if (method === "PerformTransaction") {
      const paymeId = String(params.id);
      const { tenantId, settings, txn } = await findPaymeTxn(paymeId);
      if (!txn) return errR(PAYME_ERR.TRANSACTION_WRONG, "Tranzaksiya topilmadi");
      if (txn.state === PAYME_STATE.COMPLETED) return okR({ transaction: txn.orderId, perform_time: txn.perform_time, state: txn.state });
      if (txn.state !== PAYME_STATE.CREATED) return errR(PAYME_ERR.UNABLE_TO_PERFORM, "Bajarib bo'lmaydi");
      const performT = Date.now();
      await savePaymeTxn(tenantId, settings, paymeId, { ...txn, state: PAYME_STATE.COMPLETED, perform_time: performT });
      const ord = await loadOrder(txn.orderId);
      if (ord.order && ord.order.status !== "paid") {
        await saveOrder(ord.tenantId, ord.settings, txn.orderId, { ...ord.order, status: "paid", paidAt: new Date().toISOString() });
        if (ord.order.kind === "debt") await recordDebtPayment(ord.tenantId, ord.order);
        else await activateSubscription(ord.tenantId, ord.order.plan, ord.order.months);
      }
      return okR({ transaction: txn.orderId, perform_time: performT, state: PAYME_STATE.COMPLETED });
    }
    if (method === "CancelTransaction") {
      const paymeId = String(params.id);
      const { tenantId, settings, txn } = await findPaymeTxn(paymeId);
      if (!txn) return errR(PAYME_ERR.TRANSACTION_WRONG, "Tranzaksiya topilmadi");
      const cancelT = txn.cancel_time || Date.now();
      const newState = txn.state === PAYME_STATE.COMPLETED ? -2 : PAYME_STATE.CANCELLED;
      await savePaymeTxn(tenantId, settings, paymeId, { ...txn, state: newState, cancel_time: cancelT, reason: Number(params.reason) || null });
      return okR({ transaction: txn.orderId, cancel_time: cancelT, state: newState });
    }
    if (method === "CheckTransaction") {
      const { txn } = await findPaymeTxn(String(params.id));
      if (!txn) return errR(PAYME_ERR.TRANSACTION_WRONG, "Tranzaksiya topilmadi");
      return okR({ create_time: txn.create_time, perform_time: txn.perform_time, cancel_time: txn.cancel_time, transaction: txn.orderId, state: txn.state, reason: txn.reason });
    }
    if (method === "GetStatement") return okR({ transactions: [] });
    return errR(PAYME_ERR.METHOD_NOT_FOUND, `Metod topilmadi: ${method}`);
  } catch {
    return errR(PAYME_ERR.UNABLE_TO_PERFORM, "Server xatosi");
  }
});
