import { analyzeContractRisk, LEGAL_AGENT_SYS, runAgent, studioReply, type AgentToolDef } from "@lex/agents";
import { approvalRequests, contractors, contracts, documents, legalMatters, withTenant } from "@lex/db";
import { ok } from "@lex/shared";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";

/**
 * "Yuridik" ish rejimi uchun AI agent — apps/api/src/routes/agent-chat.ts bilan bir xil
 * arxitektura (runAgent + tool-calling), lekin qarz undirish emas, yuridik ish (legal_matters),
 * shartnoma va sud hujjatlari bilan ishlaydi. Tashqi/qaytmas amal — faqat tasdiq bilan (queueApproval).
 */
export const legalAgentRoutes = new Hono<{ Variables: Variables }>();

legalAgentRoutes.post("/legal/agent/chat", async (c) => {
  const locale = c.get("locale");
  const { tenantId } = c.get("auth");
  const body = (await c.req.json().catch(() => ({}))) as { messages?: { role: "user" | "assistant"; content: string }[] };
  const messages = Array.isArray(body.messages) ? body.messages.filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string") : [];
  if (!messages.length) return c.json(ok({ reply: "", steps: [] }, "common.ok", locale));

  const tools: AgentToolDef[] = [
    {
      name: "findMatter",
      description: "Yuridik ishlarni (legal_matters) qidiradi — sarlavha, ish raqami yoki kontragent nomi bo'yicha. Ish haqidagi savoldan oldin shu asbobni chaqir.",
      parameters: {
        type: "object",
        properties: { search: { type: "string", description: "Sarlavha, ish raqami yoki kontragent nomi bo'yicha filtr" } },
      },
      execute: async (args) =>
        withTenant(tenantId, async (tx) => {
          const search = String(args.search ?? "").trim();
          const rows = await tx
            .select({
              matterNumber: legalMatters.matterNumber,
              title: legalMatters.title,
              type: legalMatters.type,
              status: legalMatters.status,
              riskLevel: legalMatters.riskLevel,
              dueDate: legalMatters.dueDate,
              contractorName: contractors.name,
            })
            .from(legalMatters)
            .leftJoin(contractors, eq(legalMatters.contractorId, contractors.id))
            .where(search ? or(ilike(legalMatters.title, `%${search}%`), ilike(legalMatters.matterNumber, `%${search}%`), ilike(contractors.name, `%${search}%`)) : undefined)
            .orderBy(desc(legalMatters.updatedAt))
            .limit(20);
          return rows;
        }),
    },
    {
      name: "findContract",
      description: "Shartnomalarni kontragent nomi bo'yicha qidiradi (raqam, imzo sanasi, penya stavkasi). Shartnoma haqidagi savol yoki tahlildan oldin shu asbobni chaqir.",
      parameters: {
        type: "object",
        properties: { search: { type: "string", description: "Kontragent nomi bo'yicha filtr (ixtiyoriy)" } },
      },
      execute: async (args) =>
        withTenant(tenantId, async (tx) => {
          const search = String(args.search ?? "").trim();
          const rows = await tx
            .select({
              id: contracts.id,
              number: contracts.number,
              signedAt: contracts.signedAt,
              penaltyDailyBps: contracts.penaltyDailyBps,
              contractorName: contractors.name,
            })
            .from(contracts)
            .innerJoin(contractors, eq(contracts.contractorId, contractors.id))
            .where(search ? ilike(contractors.name, `%${search}%`) : undefined)
            .orderBy(desc(contracts.signedAt))
            .limit(20);
          return rows;
        }),
    },
    {
      name: "analyzeContractRisk",
      description: "Shartnoma hujjatini huquqiy xavf nuqtai nazaridan tahlil qiladi (xavf darajasi, sabab, yetishmayotgan/g'ayrioddiy bandlar). contractorName bo'yicha eng so'nggi shartnoma-turi hujjatni topib tahlil qiladi.",
      parameters: {
        type: "object",
        properties: { contractorName: { type: "string", description: "Kontragent nomi (findContract'dagi nom bilan bir xil)" } },
        required: ["contractorName"],
      },
      execute: async (args) =>
        withTenant(tenantId, async (tx) => {
          const name = String(args.contractorName ?? "").trim();
          const [doc] = await tx
            .select({ id: documents.id, extracted: documents.extracted })
            .from(documents)
            .innerJoin(contractors, eq(documents.contractorId, contractors.id))
            .where(sql`${documents.type} = 'contract' and ${contractors.name} ilike ${"%" + name + "%"}`)
            .orderBy(desc(documents.createdAt))
            .limit(1);
          if (!doc) return { found: false, message: "Shartnoma hujjati topilmadi (matn yuklanmagan bo'lishi mumkin)." };
          const bodyText = typeof (doc.extracted as Record<string, unknown> | null)?.body === "string" ? String((doc.extracted as Record<string, unknown>).body) : "";
          if (!bodyText.trim()) return { found: false, message: "Hujjat matni mavjud emas — avval hujjatlar bo'limida tahlil qiling." };
          const result = await analyzeContractRisk(bodyText, locale);
          return { found: true, documentId: doc.id, ...result };
        }),
    },
    {
      name: "draftCourtFiling",
      description: "Sud uchun to'liq da'vo arizasi matnini tuzadi. details — haqiqiy tafsilotlar (kontragent, summa, asos). To'ldiriladigan noaniq joylar [kvadrat qavs]da qoldiriladi.",
      parameters: {
        type: "object",
        properties: { details: { type: "string", description: "Da'vo arizasiga kiritiladigan haqiqiy ma'lumotlar" } },
        required: ["details"],
      },
      execute: async (args) => {
        const text = await studioReply({
          locale,
          instruction: "Iqtisodiy sudga TO'LIQ, professional da'vo arizasi matnini tuz. Faqat berilgan haqiqiy ma'lumotlardan foydalan; boshqa joylarni [kvadrat qavs]da qoldir.",
          document: String(args.details ?? ""),
        });
        return { document: text };
      },
    },
    {
      name: "queueApproval",
      description:
        "TASHQI yoki QAYTMAS amalni (sudga rasman topshirish, hujjatni rasman yuborish) bevosita bajarmaydi — uni foydalanuvchi TASDIG'iga qo'yadi (Tasdiqlar bo'limi). Hujjat tayyor bo'lgach chaqir. Chaqirgach foydalanuvchiga 'Tasdiqlar bo'limida tasdiqlang' deb ayt.",
      parameters: {
        type: "object",
        properties: {
          matterNumber: { type: "string", description: "Tegishli ish raqami, agar bo'lsa (ixtiyoriy)" },
          documentText: { type: "string", description: "Tasdiqqa qo'yiladigan hujjat matni" },
          note: { type: "string", description: "Qisqa izoh (ixtiyoriy)" },
        },
        required: ["documentText"],
      },
      execute: async (args) =>
        withTenant(tenantId, async (tx) => {
          const matterNumber = String(args.matterNumber ?? "").trim();
          let matterId: string | null = null;
          if (matterNumber) {
            const [m] = await tx.select({ id: legalMatters.id }).from(legalMatters).where(eq(legalMatters.matterNumber, matterNumber)).limit(1);
            matterId = m?.id ?? null;
          }
          const [ins] = await tx
            .insert(approvalRequests)
            .values({
              tenantId,
              type: "matter_action",
              payload: { matterId, body: String(args.documentText ?? ""), note: String(args.note ?? ""), source: "ai_agent" },
            })
            .returning({ id: approvalRequests.id });
          return {
            queued: true,
            id: ins?.id ?? null,
            linkedMatter: Boolean(matterId),
            message: "Amal Tasdiqlar bo'limiga qo'yildi. Foydalanuvchi u yerda tasdiqlashi kerak — o'zim bajarmadim.",
          };
        }),
    },
  ];

  const { text, steps } = await runAgent({ locale, messages, tools, system: LEGAL_AGENT_SYS[locale] });
  return c.json(ok({ reply: text, steps }, "common.ok", locale));
});
