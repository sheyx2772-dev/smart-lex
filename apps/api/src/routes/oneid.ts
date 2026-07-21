import { createOneIdUser, findTenantByTin, findUserByOneId, linkOneIdByEmail, type OneIdSessionUser } from "@lex/db";
import { type UserRole } from "@lex/shared";
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { type Variables } from "../lib/context";
import { env } from "../lib/env";
import { signToken } from "../lib/jwt";
import { buildAuthorizeUrl, exchangeCode, identify, oneIdLogout, primaryLegalTin, signState, verifyState } from "../lib/oneid";

export const oneIdRoutes = new Hono<{ Variables: Variables }>();

/** Web login sahifasiga xato bilan qaytarish. */
function loginError(code: string): string {
  const base = env.oneid.postLoginRedirect.replace(/\/$/, "");
  return `${base}/login?oneid_error=${encodeURIComponent(code)}`;
}

/** 1-qadam: One-ID sahifasiga yo'naltirish. */
oneIdRoutes.get("/oneid", async (c) => {
  if (!env.oneid.clientId) return c.redirect(loginError("not_configured"));
  const state = await signState();
  return c.redirect(buildAuthorizeUrl(state));
});

/** 2–3 qadam: callback — kod → token → identify → foydalanuvchini bog'lash → JWT cookie. */
oneIdRoutes.get("/oneid/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");

  if (!code || !state || !(await verifyState(state))) {
    return c.redirect(loginError("invalid_state"));
  }

  let identityAccessToken: string | null = null;
  try {
    // 2) access_token
    const token = await exchangeCode(code);
    identityAccessToken = token.access_token;
    // 3) foydalanuvchi ma'lumotlari
    const id = await identify(token.access_token);

    if (String(id.ret_cd ?? "") !== "0" || String(id.valid ?? "") === "false") {
      return c.redirect(loginError("not_valid"));
    }
    const pin = id.pin?.trim();
    if (!pin) return c.redirect(loginError("no_pin"));

    // Tashkilotni STIR bo'yicha aniqlash (B2B — foydalanuvchi yuridik shaxsni ifodalashi kerak).
    const legalTin = primaryLegalTin(id);
    if (!legalTin) return c.redirect(loginError("no_legal_entity"));

    const tenant = await findTenantByTin(legalTin);
    if (!tenant) return c.redirect(loginError("tenant_not_registered"));

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
    if (!user) return c.redirect(loginError("user_not_found"));

    // Ilova sessiyasi (JWT) — mavjud login bilan bir xil.
    const appToken = await signToken(user.id, user.tenantId, user.role as UserRole);
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
    return c.redirect(loginError("exchange_failed"));
  } finally {
    if (identityAccessToken) await oneIdLogout(identityAccessToken);
  }
});
