import { createHash } from "node:crypto";

/**
 * Click Merchant (SHOP) API — imzo va to'lov URL. Formulалар eski (ishlaydigan)
 * hamkor-backend implementatsiyasidan aynan olindi (MC LEGAL merchant).
 *   Prepare sign:  MD5(click_trans_id + service_id + secret + merchant_trans_id + amount.2f + action + sign_time)
 *   Complete sign: MD5(click_trans_id + service_id + secret + merchant_trans_id + merchant_prepare_id + amount.2f + action + sign_time)
 */
function cfg() {
  return {
    serviceId: process.env.CLICK_SERVICE_ID ?? "",
    merchantId: process.env.CLICK_MERCHANT_ID ?? "",
    secretKey: process.env.CLICK_SECRET_KEY ?? "",
  };
}
export function clickConfigured(): boolean {
  const c = cfg();
  return Boolean(c.serviceId && c.merchantId && c.secretKey);
}
function md5(s: string): string {
  return createHash("md5").update(s, "utf8").digest("hex");
}
const amt2 = (a: string | number): string => Number(a).toFixed(2);

export function verifyPrepareSign(p: { click_trans_id: string; service_id: string; merchant_trans_id: string; amount: string; action: string; sign_time: string; sign_string: string }): boolean {
  const raw = `${p.click_trans_id}${p.service_id}${cfg().secretKey}${p.merchant_trans_id}${amt2(p.amount)}${p.action}${p.sign_time}`;
  return md5(raw) === p.sign_string;
}
export function verifyCompleteSign(p: { click_trans_id: string; service_id: string; merchant_trans_id: string; merchant_prepare_id: string; amount: string; action: string; sign_time: string; sign_string: string }): boolean {
  const raw = `${p.click_trans_id}${p.service_id}${cfg().secretKey}${p.merchant_trans_id}${p.merchant_prepare_id}${amt2(p.amount)}${p.action}${p.sign_time}`;
  return md5(raw) === p.sign_string;
}

/** Foydalanuvchi yo'naltiriladigan Click to'lov sahifasi URL. */
export function clickPaymentUrl(orderId: string, amount: number, returnUrl?: string): string {
  const c = cfg();
  let url = `https://my.click.uz/services/pay?service_id=${c.serviceId}&merchant_id=${c.merchantId}&amount=${amount.toFixed(2)}&transaction_param=${encodeURIComponent(orderId)}`;
  if (returnUrl) url += `&return_url=${encodeURIComponent(returnUrl)}`;
  return url;
}

/** Tarif narxlari (so'm/oy) — SaaS obuna. Boshlang'ich 1 mln dan. */
export const PLAN_PRICES: Record<string, number> = {
  "Boshlang'ich": 1_000_000,
  Standart: 2_500_000,
  Professional: 5_000_000,
};
export function planPrice(plan: string): number {
  return PLAN_PRICES[plan] ?? PLAN_PRICES["Boshlang'ich"];
}
