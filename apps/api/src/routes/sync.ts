import { SyncReconnectError, syncTenant } from "@lex/integrations";
import { ERROR_CODE, fail, ok } from "@lex/shared";
import { Hono } from "hono";
import { type Variables } from "../lib/context";

export const syncRoutes = new Hono<{ Variables: Variables }>();

const CAN_SYNC = new Set(["owner", "admin"]);

syncRoutes.post("/integrations/sync", async (c) => {
  const locale = c.get("locale");
  const { tenantId, role } = c.get("auth");
  if (!CAN_SYNC.has(role)) return c.json(fail(ERROR_CODE.FORBIDDEN, "auth.forbidden", locale), 403);

  try {
    const result = await syncTenant(tenantId);
    return c.json(ok(result, "common.updated", locale));
  } catch (err) {
    if (err instanceof SyncReconnectError) return c.json(fail(ERROR_CODE.UNAUTHORIZED, "integrations.didox_reconnect", locale), 400);
    if (err instanceof Error && err.message === "tenant not found") return c.json(fail(ERROR_CODE.NOT_FOUND, "common.not_found", locale), 404);
    throw err;
  }
});
