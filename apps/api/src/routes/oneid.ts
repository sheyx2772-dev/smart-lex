import { auditLogs, createOneIdUser, findTenantByTin, findUserByOneId, linkOneIdByEmail, type OneIdSessionUser, withTenant } from "@lex/db";
import { type UserRole } from "@lex/shared";
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { type Variables } from "../lib/context";
import { env } from "../lib/env";
import { signToken } from "../lib/jwt";
import { buildAuthorizeUrl, describeAuth, exchangeCode, identify, oneIdLogout, primaryLegalTin, putOtc, signState, takeOtc, verifyState } from "../lib/oneid";

export const oneIdRoutes = new Hono<{ Variables: Variables }>();

/** Origin uchun web ildizi (ikkinchi domen bo'lsa altWebUrl, aks holda asosiy). */
function webForOrigin(origin: string): string {
  return origin && env.oneid.altOrigin && origin === env.oneid.altOrigin && env.oneid.altWebUrl
    ? env.oneid.altWebUrl
    : env.oneid.postLoginRedirect;
}

/**
 * Cross-domen handoff web (OTC bilan). Callback boshqa domenда (mas. api.tijoraat.uz)
 * bo'lsa, cookie'ni to'g'ridan o'rnata olmaydi — origin mos bo'lsa shu web'ga OTC
 * bilan topshiriladi. Mos kelmasa "" (oddiy cookie yo'li).
 */
function handoffWebFor(origin: string): string {
  if (!origin) return "";
  if (origin === env.oneid.altOrigin && env.oneid.altWebUrl) return env.oneid.altWebUrl;
  if (env.oneid.primaryOrigin && origin === env.oneid.primaryOrigin) return env.oneid.postLoginRedirect;
  return "";
}

/** Web login sahifasiga xato bilan qaytarish (origin domeniga). */
function loginError(code: string, origin = ""): string {
  const base = webForOrigin(origin).replace(/\/$/, "");
  return `${base}/login?oneid_error=${encodeURIComponent(code)}`;
}

/** 1-qadam: One-ID sahifasiga yo'naltirish. `?origin=` — qaysi domen boshladi. */
oneIdRoutes.get("/oneid", async (c) => {
  if (!env.oneid.clientId) return c.redirect(loginError("not_configured"));
  const origin = c.req.query("origin") ?? "";
  const state = await signState(origin);
  return c.redirect(buildAuthorizeUrl(state));
});

/** Cross-domen handoff: ikkinchi domen web'i bir martalik kodni app tokenga almashtiradi. */
oneIdRoutes.post("/oneid/otc", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { code?: string };
  const token = body.code ? takeOtc(String(body.code)) : null;
  if (!token) return c.json({ success: false, data: null, error: "invalid_code", message: "invalid" }, 400);
  return c.json({ success: true, data: { token }, error: null, message: "ok" });
});

/** 2–3 qadam: callback — kod → token → identify → foydalanuvchini bog'lash → JWT cookie. */
oneIdRoutes.get("/oneid/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const statePayload = state ? await verifyState(state) : null;

  if (!code || !statePayload) {
    return c.redirect(loginError("invalid_state"));
  }
  const origin = statePayload.origin;

  let identityAccessToken: string | null = null;
  try {
    // 2) access_token
    const token = await exchangeCode(code);
    identityAccessToken = token.access_token;
    // 3) foydalanuvchi ma'lumotlari
    const id = await identify(token.access_token);

    if (String(id.ret_cd ?? "") !== "0" || String(id.valid ?? "") === "false") {
      return c.redirect(loginError("not_valid", origin));
    }
    const pin = id.pin?.trim();
    if (!pin) return c.redirect(loginError("no_pin", origin));

    // ── E-IMZO (ERI) / tasdiqlanganlik — One-ID ичida kirish usuli ──
    const auth = describeAuth(id);
    if (env.oneid.requireEri && !auth.eri) return c.redirect(loginError("require_eri", origin));
    if (env.oneid.requireVerified && !auth.verified) return c.redirect(loginError("not_verified", origin));

    // Tashkilotni STIR bo'yicha aniqlash (B2B — foydalanuvchi yuridik shaxsni ifodalashi kerak).
    const legalTin = primaryLegalTin(id);
    if (!legalTin) return c.redirect(loginError("no_legal_entity", origin));

    const tenant = await findTenantByTin(legalTin);
    if (!tenant) return c.redirect(loginError("tenant_not_registered", origin));

    // Foydalanuvchini topish → email bilan bog'lash → (yoqilgan bo'lsa) yaratish.
    let user: OneIdSessionUser | null = await findUserByOneId(tenant.id, pin);
    if (!user && id.user_id) {
      // Ehtimol email = One-ID login yoki to'liq email — mavjud parolli hisobни PIN bilan bog'lash.
      user = await linkOneIdByEmail(tenant.id, id.user_id, pin, id.user_id);
    }
    if (!user && env.oneid.autoProvision) {
      user = await createOneIdUser({
        tenantId: tenant.id,
        pin,
        sub: id.user_id ?? pin,
        fullName: id.full_name?.trim() || [id.sur_name, id.first_name, id.mid_name].filter(Boolean).join(" ") || pin,
        email: id.user_id ?? "",
        locale: tenant.defaultLocale,
      });
    }
    if (!user) return c.redirect(loginError("user_not_found", origin));

    // Kirish usulini audit'ga yozamiz — huquqiy platforma uchun (kim, qanday: E-IMZO/ERI/Mobile-ID).
    try {
      const u = user;
      await withTenant(u.tenantId, (tx) =>
        tx.insert(auditLogs).values({
          tenantId: u.tenantId,
          actorType: "user",
          actorId: u.id,
          action: "auth.oneid_login",
          entityType: "user",
          entityId: u.id,
          detail: {
            authMethod: auth.method, // LOGINPASSMETHOD | MOBILEMETHOD | PKCSMETHOD | LEPKCSMETHOD | QR
            eri: auth.eri, // E-IMZO (ERI) bilan kirdi
            legalEri: auth.legalEri, // yuridik shaxs ERIsi
            verified: auth.verified, // "Tasdiqlangan foydalanuvchi"
            legalTin, // qaysi yuridik shaxs (STIR)
            sessId: id.sess_id ?? null,
          },
        }),
      );
    } catch (e) {
      console.error("[oneid:audit]", e);
    }

    // Ilova sessiyasi (JWT) — mavjud login bilan bir xil.
    const appToken = await signToken(user.id, user.tenantId, user.role as UserRole);

    // Callback boshqa domenда (mas. api.tijoraat.uz — One-ID kabinetida ro'yxatda)
    // bo'lgani uchun cookie'ni to'g'ridan o'rnata olmaydi: origin (lexai.com.uz yoki
    // lex-ai.uz) mos web'ga tokenni bir martalik KOD bilan topshiramiz.
    const handoffWeb = handoffWebFor(origin);
    if (handoffWeb) {
      const otc = putOtc(appToken);
      return c.redirect(`${handoffWeb.replace(/\/$/, "")}/api/oneid/finish?code=${otc}`);
    }

    setCookie(c, env.tokenCookie, appToken, {
      httpOnly: true,
      sameSite: "Lax",
      secure: env.isProd,
      path: "/",
      maxAge: 60 * 60 * 8,
      ...(env.oneid.cookieDomain ? { domain: env.oneid.cookieDomain } : {}),
    });

    return c.redirect(env.oneid.postLoginRedirect.replace(/\/$/, "") + "/");
  } catch (err) {
    console.error("[oneid:callback]", err);
    return c.redirect(loginError("exchange_failed", origin));
  } finally {
    if (identityAccessToken) await oneIdLogout(identityAccessToken);
  }
});
