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

/** Imzolangan `state` yaratadi (nonce + expiry). */
export async function signState(): Promise<string> {
  return sign({ purpose: "oneid_state", nonce: randomUUID(), exp: Math.floor(Date.now() / 1000) + STATE_TTL }, env.jwtSecret, "HS256");
}

/** `state`ni tekshiradi — yaroqsiz/muddati o'tgan bo'lsa false. */
export async function verifyState(state: string): Promise<boolean> {
  try {
    const p = (await verify(state, env.jwtSecret, "HS256")) as { purpose?: string };
    return p.purpose === "oneid_state";
  } catch {
    return false;
  }
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
