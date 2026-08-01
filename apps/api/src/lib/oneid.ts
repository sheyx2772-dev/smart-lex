import { randomUUID } from "node:crypto";
import { sign, verify } from "hono/jwt";
import { env } from "./env";

/**
 * One-ID (sso.egov.uz) mijozi — OAuth2 (davlat varianti). Barcha so'rov bitta
 * endpointga (Authorization.do) `grant_type` bilan yuboriladi. Texnologik
 * yo'riqnoma (tijoraat.uz ↔ Yagona identifikatsiya tizimi) asosida.
 */

/** One-ID `identify` javobi — bitta yuridik shaxs. */
export interface OneIdLegalInfo {
  is_basic?: boolean;
  tin?: string;
  le_tin?: string;
  acron_UZ?: string;
  le_name?: string;
}

/** One-ID `identify` (foydalanuvchi ma'lumotlari) javobi. */
export interface OneIdIdentity {
  valid?: string | boolean;
  validation_method?: string[];
  pin?: string; // JShShIR
  user_id?: string; // One-ID login
  full_name?: string;
  pport_no?: string;
  birth_date?: string;
  sur_name?: string;
  first_name?: string;
  mid_name?: string;
  user_type?: string; // I = jismoniy, L = yuridik
  sess_id?: string;
  ret_cd?: string; // 0 = muvaffaqiyatli
  auth_method?: string; // LOGINPASSMETHOD | MOBILEMETHOD | PKCSMETHOD | LEPKCSMETHOD | QR
  pkcs_legal_tin?: string; // faqat LEPKCSMETHOD bo'lsa
  legal_info?: OneIdLegalInfo[];
}

interface OneIdToken {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

/** 1-qadam: avtorizatsiya kodi uchun One-ID sahifasiga yo'naltirish URL'i. */
export function buildAuthorizeUrl(state: string): string {
  const q = new URLSearchParams({
    response_type: "one_code",
    client_id: env.oneid.clientId,
    redirect_uri: env.oneid.redirectUri,
    scope: env.oneid.scope,
    state,
  });
  return `${env.oneid.baseUrl}?${q.toString()}`;
}

async function postForm<T>(params: Record<string, string>): Promise<T> {
  const res = await fetch(env.oneid.baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(params).toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`One-ID HTTP ${res.status}: ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`One-ID: JSON kutilgan edi, keldi: ${text.slice(0, 300)}`);
  }
}

/** 2-qadam: avtorizatsiya kodini access_token'ga almashtirish. */
export async function exchangeCode(code: string): Promise<OneIdToken> {
  return postForm<OneIdToken>({
    grant_type: "one_authorization_code",
    client_id: env.oneid.clientId,
    client_secret: env.oneid.clientSecret,
    code,
    redirect_uri: env.oneid.redirectUri,
  });
}

/** 3-qadam: access_token orqali foydalanuvchi ma'lumotlarini olish. */
export async function identify(accessToken: string): Promise<OneIdIdentity> {
  return postForm<OneIdIdentity>({
    grant_type: "one_access_token_identify",
    client_id: env.oneid.clientId,
    client_secret: env.oneid.clientSecret,
    access_token: accessToken,
    scope: env.oneid.scope,
  });
}

/** 4-qadam: One-ID sessiyasidan chiqish (best-effort). */
export async function oneIdLogout(accessToken: string): Promise<void> {
  try {
    await postForm({
      grant_type: "one_log_out",
      client_id: env.oneid.clientId,
      client_secret: env.oneid.clientSecret,
      access_token: accessToken,
      scope: env.oneid.scope,
    });
  } catch {
    /* logout xatosi kirishni buzmasligi kerak */
  }
}

// ── CSRF himoyasi: `state` — qisqa muddatli imzolangan token (server holatisiz) ──

const STATE_TTL = 60 * 10; // 10 daqiqa

/** Imzolangan `state` (nonce + expiry + origin). origin — qaysi web domen boshladi (masalan "lex-ai.uz"). */
export async function signState(origin = ""): Promise<string> {
  return sign({ purpose: "oneid_state", origin, nonce: randomUUID(), exp: Math.floor(Date.now() / 1000) + STATE_TTL }, env.jwtSecret, "HS256");
}

/** `state`ni tekshiradi — yaroqli bo'lsa { origin } qaytaradi, aks holda null. */
export async function verifyState(state: string): Promise<{ origin: string } | null> {
  try {
    const p = (await verify(state, env.jwtSecret, "HS256")) as { purpose?: string; origin?: string };
    if (p.purpose !== "oneid_state") return null;
    return { origin: typeof p.origin === "string" ? p.origin : "" };
  } catch {
    return null;
  }
}

// ── Cross-domen handoff: bir martalik kod (in-memory; lex-api single fork process) ──
// lex-ai.uz'da One-ID: callback baribir api.lexai.com.uz'da bo'ladi va cookie'ni
// .lex-ai.uz'ga o'rnata olmaydi. Shu bois app tokenni qisqa muddatli KOD bilan
// lex-ai.uz web'iga topshiramiz (web o'zi host-only cookie o'rnatadi). One-ID
// kabinetida yangi redirect_uri SHART EMAS — mavjud callback ishlatiladi.
const OTC_TTL_MS = 90 * 1000;
const otcStore = new Map<string, { token: string; exp: number }>();
export function putOtc(token: string): string {
  const code = (randomUUID() + randomUUID()).replace(/-/g, "");
  otcStore.set(code, { token, exp: Date.now() + OTC_TTL_MS });
  return code;
}
export function takeOtc(code: string): string | null {
  const e = otcStore.get(code);
  otcStore.delete(code); // bir martalik ishlatiladi
  if (!e || e.exp < Date.now()) return null;
  return e.token;
}

/**
 * `identify` javobidan asosiy yuridik shaxs STIRini aniqlaydi:
 * legal_info ичida is_basic=true bo'lgani, aks holda birinchisi, aks holda pkcs_legal_tin.
 */
export function primaryLegalTin(id: OneIdIdentity): string | null {
  const list = id.legal_info ?? [];
  const basic = list.find((l) => l.is_basic) ?? list[0];
  return basic?.tin ?? basic?.le_tin ?? id.pkcs_legal_tin ?? null;
}

/** Asosiy yuridik shaxs NOMINI aniqlaydi (self-onboarding'da tenant nomi uchun). */
export function primaryLegalName(id: OneIdIdentity): string | null {
  const list = id.legal_info ?? [];
  const basic = list.find((l) => l.is_basic) ?? list[0];
  return (basic?.le_name || basic?.acron_UZ || "").trim() || null;
}

// E-IMZO (ERI) va Mobile-ID — One-ID ichidagi tasdiqlash/kirish usullari.
const ERI_METHODS = new Set(["PKCSMETHOD", "LEPKCSMETHOD"]); // ERI (E-IMZO): jismoniy / yuridik
const VERIFIED_METHODS = new Set(["PKCSMETHOD", "MOBILEMETHOD"]); // "Tasdiqlangan foydalanuvchi" usullari

/** Foydalanuvchi E-IMZO (ERI) bilan kirdimi — auth_method PKCS/LEPKCS. */
export function signedInWithEri(id: OneIdIdentity): boolean {
  return ERI_METHODS.has((id.auth_method ?? "").toUpperCase());
}

/**
 * "Tasdiqlangan foydalanuvchi"mi — valid=true YOKI ERI/Mobile-ID bilan tasdiqlangan.
 * (Bo'sh validation_method = tasdiqlanmagan hisob.)
 */
export function isVerified(id: OneIdIdentity): boolean {
  if (String(id.valid ?? "") === "true" || id.valid === true) return true;
  if (signedInWithEri(id) || (id.auth_method ?? "").toUpperCase() === "MOBILEMETHOD") return true;
  return (id.validation_method ?? []).some((m) => VERIFIED_METHODS.has((m ?? "").toUpperCase()));
}

/** Kirish usulini qisqa tavsiflaydi (audit uchun). */
export function describeAuth(id: OneIdIdentity): { method: string; eri: boolean; verified: boolean; legalEri: boolean } {
  const method = (id.auth_method ?? "").toUpperCase() || "UNKNOWN";
  return { method, eri: signedInWithEri(id), verified: isVerified(id), legalEri: method === "LEPKCSMETHOD" };
}
