import { findUserForAuth } from "@lex/db";
import { ERROR_CODE, fail, ok, type UserRole } from "@lex/shared";
import { verifyPassword } from "@lex/shared/auth";
import { Hono } from "hono";
import { type Variables } from "../lib/context";
import { signToken } from "../lib/jwt";
import { checkLoginRateLimit, resetLoginRateLimit } from "../lib/rate-limit";
import { loginSchema, validate } from "../lib/validation";

export const authRoutes = new Hono<{ Variables: Variables }>();

authRoutes.post("/login", async (c) => {
  const locale = c.get("locale");
  const parsed = validate(loginSchema, await c.req.json().catch(() => null));
  if (!parsed.ok) {
    return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale, { fields: parsed.fields }), 422);
  }

  // Kaba-forta himoyasi: IP+email bo'yicha 15 daqiqada 5 ta muvaffaqiyatsiz urinish.
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "unknown";
  const rlKey = `${ip}:${parsed.data.email.toLowerCase()}`;
  const rl = checkLoginRateLimit(rlKey);
  if (!rl.allowed) {
    return c.json(fail(ERROR_CODE.RATE_LIMITED, "auth.too_many_attempts", locale), 429);
  }

  const user = await findUserForAuth(parsed.data.email);
  // passwordHash null => One-ID (parolsiz) foydalanuvchi: parol bilan kira olmaydi.
  if (!user || !user.passwordHash || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return c.json(fail(ERROR_CODE.UNAUTHORIZED, "auth.invalid_credentials", locale), 401);
  }
  resetLoginRateLimit(rlKey);

  const role = user.role as UserRole;
  const token = await signToken(user.id, user.tenantId, role);
  return c.json(
    ok(
      {
        token,
        user: { id: user.id, fullName: user.fullName, role, locale: user.locale, tenantId: user.tenantId },
      },
      "auth.login_success",
      locale,
    ),
  );
});
