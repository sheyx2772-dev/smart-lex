import { ERROR_CODE, fail, parseLocale } from "@lex/shared";
import { type MiddlewareHandler } from "hono";
import { type Variables } from "./lib/context";
import { verifyToken } from "./lib/jwt";

/** Tilni HTTP header'dan (`X-Lang` ustuvor, so'ng `Accept-Language`) aniqlaydi. */
export const localeMiddleware: MiddlewareHandler<{ Variables: Variables }> = async (c, next) => {
  const header = c.req.header("x-lang") ?? c.req.header("accept-language");
  c.set("locale", parseLocale(header));
  await next();
};

/** JWT tekshiradi va auth kontekstini o'rnatadi. Yaroqsiz bo'lsa 401. */
export const authMiddleware: MiddlewareHandler<{ Variables: Variables }> = async (c, next) => {
  const header = c.req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const payload = token ? await verifyToken(token) : null;

  if (!payload) {
    return c.json(fail(ERROR_CODE.UNAUTHORIZED, "auth.unauthorized", c.get("locale")), 401);
  }

  c.set("auth", { userId: payload.sub, tenantId: payload.tid, role: payload.role });
  await next();
};
