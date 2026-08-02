import { extractDocumentText, studioNoKeyMessage, studioReply, studioReplyStream } from "@lex/agents";
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

/**
 * Fayldan MATN ajratish — PDF va rasmlar (jpg/png/webp) Gemini multimodal bilan.
 * Klient base64 + mimeType yuboradi; matnли docx/txt esa client'да ajratiladi.
 * Chatga hujjat biriktirish (rasm/PDF/Word) shu orqali ishlaydi.
 */
studioRoutes.post("/studio/extract", async (c) => {
  const locale = c.get("locale");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const data = String(body.data ?? "");
  const mimeType = String(body.mimeType ?? "");
  if (!data || !mimeType) return c.json(ok({ text: "" }, "common.ok", locale));
  let text = "";
  try {
    text = await extractDocumentText({ dataBase64: data, mimeType });
  } catch {
    text = "";
  }
  return c.json(ok({ text }, "common.ok", locale));
});

/**
 * Studio AI — STREAMING (javob harfma-harf). Klient (Next route-proxy) oqib o'qiydi.
 * text/plain chunked; nginx buferini o'chirish uchun X-Accel-Buffering: no.
 */
studioRoutes.post("/studio/ai/stream", async (c) => {
  const locale = c.get("locale");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const instruction = String(body.instruction ?? "").trim();
  const document = String(body.document ?? "").trim();
  const textStream = instruction ? studioReplyStream({ locale, instruction, document }) : null;

  const encoder = new TextEncoder();
  const rs = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!textStream) {
          if (instruction) controller.enqueue(encoder.encode(studioNoKeyMessage(locale)));
        } else {
          for await (const chunk of textStream) controller.enqueue(encoder.encode(chunk));
        }
      } catch {
        /* oqim xatosi — bo'sh yakun; klient aiError ko'rsatadi */
      } finally {
        controller.close();
      }
    },
  });

  return new Response(rs, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
});
