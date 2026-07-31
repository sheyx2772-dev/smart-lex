import { format, money } from "@lex/core";
import { contractors, invoices, receivables, withTenant } from "@lex/db";
import { runAgent, studioReply, type AgentToolDef } from "@lex/agents";
import { ok } from "@lex/shared";
import { desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";

/**
 * Lex AI Agent — suhbat + tool-calling. Agent qarzlarni O'QIYDI (listReceivables) va
 * hujjat TUZADI (draftDocument). Tashqi/qaytmas amallar keyingi bosqichda tasdiq bilan.
 * LLM chaqiruvi @lex/agents.runAgent'da (ai/generateText o'sha paketda).
 */
export const agentChatRoutes = new Hono<{ Variables: Variables }>();

agentChatRoutes.post("/agent/chat", async (c) => {
  const locale = c.get("locale");
  const { tenantId } = c.get("auth");
  const body = (await c.req.json().catch(() => ({}))) as { messages?: { role: "user" | "assistant"; content: string }[] };
  const messages = Array.isArray(body.messages) ? body.messages.filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string") : [];
  if (!messages.length) return c.json(ok({ reply: "", steps: [] }, "common.ok", locale));

  const tools: AgentToolDef[] = [
    {
      name: "listReceivables",
      description:
        "Foydalanuvchi tashkilotidagi to'lanmagan qarzlar ro'yxatini qaytaradi (qarzdor nomi, STIR, faktura raqami, qoldiq summa, kechikish kunlari, holat). Qarz yoki qarzdor haqidagi har qanday savol yoki hujjat tuzishdan oldin shu asbobni chaqir.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Qarzdor nomi bo'yicha filtr (ixtiyoriy)" },
          limit: { type: "number", description: "Nechta qator (default 20, maks 50)" },
        },
      },
      execute: async (args) =>
        withTenant(tenantId, async (tx) => {
          const search = String(args.search ?? "").trim();
          const limit = Math.min(Math.max(Number(args.limit ?? 20) || 20, 1), 50);
          const rows = await tx
            .select({
              name: contractors.name,
              tin: contractors.tin,
              invoiceNumber: invoices.number,
              outstanding: receivables.outstandingMinor,
              penalty: receivables.penaltyMinor,
              currency: receivables.currency,
              overdueDays: receivables.overdueDays,
              status: receivables.status,
            })
            .from(receivables)
            .innerJoin(invoices, eq(receivables.invoiceId, invoices.id))
            .innerJoin(contractors, eq(receivables.contractorId, contractors.id))
            .where(search ? sql`${receivables.status} <> 'paid' and ${contractors.name} ilike ${"%" + search + "%"}` : sql`${receivables.status} <> 'paid'`)
            .orderBy(desc(receivables.overdueDays))
            .limit(limit);
          return rows.map((r) => ({
            qarzdor: r.name,
            stir: r.tin,
            faktura: r.invoiceNumber,
            qoldiq: format(money(r.outstanding, r.currency)),
            penya: format(money(r.penalty, r.currency)),
            kechikish_kun: r.overdueDays,
            holat: r.status,
          }));
        }),
    },
    {
      name: "draftDocument",
      description:
        "To'liq yuridik hujjat matnini tuzadi (talabnoma, pretenziya, da'vo arizasi, akt-sverka, shartnoma, javob xati va h.k.). docType — hujjat turi; details — kerakli haqiqiy tafsilotlar (qarzdor nomi, summa, kechikish, faktura). To'ldiriladigan noaniq joylar [kvadrat qavs]da qoldiriladi.",
      parameters: {
        type: "object",
        properties: {
          docType: { type: "string", description: "Hujjat turi, masalan 'talabnoma'" },
          details: { type: "string", description: "Hujjatga kiritiladigan haqiqiy ma'lumotlar (listReceivables'dan olingan)" },
        },
        required: ["docType"],
      },
      execute: async (args) => {
        const text = await studioReply({
          locale,
          instruction: `Quyidagi turdagi TO'LIQ, professional yuridik hujjat matnini tuz: ${String(args.docType)}. Faqat berilgan haqiqiy ma'lumotlardan foydalan; boshqa joylarni [kvadrat qavs]da qoldir.`,
          document: String(args.details ?? ""),
        });
        return { document: text };
      },
    },
  ];

  const { text, steps } = await runAgent({ locale, messages, tools });
  return c.json(ok({ reply: text, steps }, "common.ok", locale));
});
