/**
 * Obuna holati — tenant.settings.subscription ichida saqlanadi:
 *   { plan, until (ISO — pulli obuna tugash sanasi), trialUntil (ISO — bepul sinov) }
 * Model (freemium): trial/active — to'liq ishlaydi; expired/none — pulli amallar (sudga
 * topshirish, Didox rasmiy yuborish) bloklanadi, ko'rish/hujjat tuzish ochiq qoladi.
 */
export type SubStatus = "none" | "trial" | "active" | "expired";

export interface SubInfo {
  plan: string | null;
  status: SubStatus;
  until: string | null;
  trialUntil: string | null;
}

export const TRIAL_DAYS = 14;

function str(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

/** Sozlamalardan obuna holatini hisoblaydi. */
export function readSub(settings: Record<string, unknown> | null | undefined): SubInfo {
  const s = (settings?.subscription ?? {}) as Record<string, unknown>;
  const plan = str(s.plan);
  const until = str(s.until);
  const trialUntil = str(s.trialUntil);
  const now = Date.now();
  let status: SubStatus = "none";
  if (until && Date.parse(until) > now) status = "active";
  else if (until) status = "expired";
  else if (trialUntil && Date.parse(trialUntil) > now) status = "trial";
  else if (trialUntil) status = "expired";
  return { plan, status, until, trialUntil };
}

/** Pulli amallarga ruxsat bormi (trial yoki active). */
export function canUsePaid(settings: Record<string, unknown> | null | undefined): boolean {
  const st = readSub(settings).status;
  return st === "trial" || st === "active";
}

/** Yangi tenant uchun boshlang'ich trial (agar hali obuna yo'q bo'lsa). ISO sana qaytaradi. */
export function trialUntilIso(days = TRIAL_DAYS): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}
