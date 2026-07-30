import { studioReply } from "@lex/agents";
import { ok } from "@lex/shared";
import { Hono } from "hono";
import { type Variables } from "../lib/context";

/**
 * Studio AI — HUJJAT-fokusли yordamchi (chat'дан farqi: DB emas, ochiq HUJJAT konteksti).
 * LLM chaqiruvi @lex/agents.studioReply da (ai/generateText o'sha paketда).
 */
export const studioRoutes = new Hono<{ Variables: Variables }>();

studioRoutes.post("/studio/ai", async (c) => {
  const locale = c.get("locale");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const instruction = String(body.instruction ?? "").trim();
  const document = String(body.document ?? "").trim();
  if (!instruction) return c.json(ok({ reply: "" }, "common.ok", locale));

  const reply = await studioReply({ locale, instruction, document });
  return c.json(ok({ reply }, "common.ok", locale));
});
