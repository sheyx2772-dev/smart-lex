import { findUserForAuth } from "@lex/db";
import { ERROR_CODE, fail, ok, type UserRole } from "@lex/shared";
import { verifyPassword } from "@lex/shared/auth";
import { Hono } from "hono";
import { type Variables } from "../lib/context";
import { signToken } from "../lib/jwt";
import { loginSchema, validate } from "../lib/validation";

export const authRoutes = new Hono<{ Variables: Variables }>();

authRoutes.post("/login", async (c) => {
  const locale = c.get("locale");
  const parsed = validate(loginSchema, await c.req.json().catch(() => null));
  if (!parsed.ok) {
    return c.json(fail(ERROR_CODE.VALIDATION_FAILED, "common.validation_failed", locale, { fields: parsed.fields }), 422);
  }

  const user = await findUserForAuth(parsed.data.email);
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return c.json(fail(ERROR_CODE.UNAUTHORIZED, "auth.invalid_credentials", locale), 401);
  }

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
