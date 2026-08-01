/**
 * Payme (Paycom) Merchant API — checkout URL + Basic auth. Callback JSON-RPC 2.0.
 * account maydoni: payment_id (bizning order id). Summa tiyinда.
 */
function cfg() {
  const isTest = (process.env.PAYME_IS_TEST ?? "false").toLowerCase() === "true";
  return {
    merchantId: process.env.PAYME_MERCHANT_ID ?? "",
    key: isTest ? process.env.PAYME_TEST_SECRET_KEY || process.env.PAYME_SECRET_KEY || "" : process.env.PAYME_SECRET_KEY ?? "",
    isTest,
  };
}
export function paymeConfigured(): boolean {
  const c = cfg();
  return Boolean(c.merchantId && c.key);
}
/** Payme Basic auth: "Basic base64(Paycom:KEY)". */
export function paymeAuthOk(authorization: string | undefined): boolean {
  if (!authorization || !authorization.startsWith("Basic ")) return false;
  try {
    const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8"); // "Paycom:KEY"
    const key = decoded.split(":")[1] ?? "";
    return Boolean(key) && key === cfg().key;
  } catch {
    return false;
  }
}
/** Checkout URL: base64("m=merchant;ac.payment_id=order;a=tiyin"). */
export function paymeCheckoutUrl(orderId: string, amountTiyin: number, returnUrl?: string): string {
  return paymeCheckoutUrlWith(cfg().merchantId, cfg().isTest, orderId, amountTiyin, returnUrl);
}

/** Per-tenant: firma merchant_id bilan checkout URL (qarzdor→firma to'lovi). */
export function paymeCheckoutUrlWith(merchantId: string, isTest: boolean, orderId: string, amountTiyin: number, returnUrl?: string): string {
  let raw = `m=${merchantId};ac.payment_id=${orderId};a=${amountTiyin}`;
  if (returnUrl) raw += `;c=${returnUrl}`;
  const b64 = Buffer.from(raw, "utf8").toString("base64");
  const base = isTest ? "https://test.paycom.uz" : "https://checkout.paycom.uz";
  return `${base}/${b64}`;
}
export const somToTiyin = (som: number): number => Math.round(som * 100);

// Payme JSON-RPC xato kodlari va state (eski MC LEGAL implementatsiyasiga mos).
export const PAYME_ERR = {
  UNAUTHORIZED: -32504,
  INVALID_PARAMS: -32602,
  METHOD_NOT_FOUND: -32601,
  AMOUNT_WRONG: -31001,
  TRANSACTION_WRONG: -31003,
  ALREADY_DONE: -31060,
  UNABLE_TO_PERFORM: -31008,
  COULD_NOT_CANCEL: -31007,
} as const;
export const PAYME_STATE = { CREATED: 1, COMPLETED: 2, CANCELLED: -1 } as const;
