import { phraseChatReply } from "@lex/agents";
import { format, money } from "@lex/core";
import { approvalRequests, contractors, documents, invoices, receivables, reminders, withTenant } from "@lex/db";
import { ok } from "@lex/shared";
import { desc, eq, inArray, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";

export const chatRoutes = new Hono<{ Variables: Variables }>();

interface ChatResult {
  kind: "company" | "receivable" | "document";
  title: string;
  subtitle: string;
  href?: string;
}

/**
 * "Ask AI" — tabiiy tilda qidiruv. Hozircha deterministik intent-engine (LLM kaliti
 * kelganda shu qatlam ustiga qo'yiladi). Real ma'lumot ustida ishlaydi, tenant izolyatsiyasi bilan.
 */
chatRoutes.post("/chat", async (c) => {
  const { tenantId } = c.get("auth");
  const locale = c.get("locale");
  const body = await c.req.json().catch(() => ({}));
  const message = String(body.message ?? "").trim();
  const m = message.toLowerCase();

  if (!message) {
    return c.json(ok({ reply: T.empty[locale], results: [] as ChatResult[], intent: "empty" }, "common.ok", locale));
  }

  const has = (...kw: string[]) => kw.some((k) => m.includes(k));
  const amount = (minor: bigint, cur = "UZS") => format(money(minor, cur));

  // ── Butun tenant holati snapshot (deterministik) — LLM ISTALGAN savolga shundan javob beradi ──
  const snapshot = await withTenant(tenantId, async (tx): Promise<string> => {
    const rows = await tx
      .select({
        name: contractors.name,
        tin: contractors.tin,
        out: sql<string>`coalesce(sum(${receivables.outstandingMinor}),0)::text`,
        pen: sql<string>`coalesce(sum(${receivables.penaltyMinor}),0)::text`,
        over: sql<number>`count(*) filter (where ${receivables.status}='overdue')::int`,
        risk: sql<number>`coalesce(max(${receivables.riskScore}),0)::int`,
      })
      .from(contractors)
      .leftJoin(receivables, eq(receivables.contractorId, contractors.id))
      .groupBy(contractors.id, contractors.name, contractors.tin)
      .orderBy(desc(sql`coalesce(sum(${receivables.outstandingMinor}),0)`))
      .limit(20);

    let totOut = 0n, totPen = 0n, over = 0, paidCnt = 0;
    const [{ paid }] = await tx.select({ paid: sql<number>`count(*) filter (where ${receivables.status}='paid')::int` }).from(receivables);
    paidCnt = paid ?? 0;
    for (const r of rows) {
      totOut += BigInt(r.out);
      totPen += BigInt(r.pen);
      over += r.over;
    }
    const [pa] = await tx.select({ c: sql<number>`count(*)::int` }).from(approvalRequests).where(eq(approvalRequests.status, "pending"));
    const [rc] = await tx.select({ c: sql<number>`count(*)::int` }).from(reminders);

    const lines = rows.map(
      (r) => `- ${r.name} (STIR ${r.tin}): qarz ${amount(BigInt(r.out))}, penya ${amount(BigInt(r.pen))}, muddati o'tgan ${r.over}, xavf ${r.risk}`,
    );
    return [
      `Jami kontragent: ${rows.length}`,
      `Umumiy qarz: ${amount(totOut)}; Umumiy penya: ${amount(totPen)}`,
      `Muddati o'tgan qarzlar: ${over}; To'langan: ${paidCnt}`,
      `Tasdiq kutayotgan hujjatlar: ${pa?.c ?? 0}; Yuborilgan eslatmalar: ${rc?.c ?? 0}`,
      ``,
      `Kontragentlar (qarz bo'yicha):`,
      ...lines,
    ].join("\n");
  });

  const response = await withTenant(tenantId, async (tx): Promise<{ reply: string; results: ChatResult[]; intent: string }> => {
    const allContractors = await tx.select({ id: contractors.id, name: contractors.name, tin: contractors.tin }).from(contractors);
    // Xabarda kontragent nomi bor-yo'qligini aniqlaymiz (eng uzun moslik).
    const matched = allContractors
      .filter((cc) => {
        const first = cc.name.toLowerCase().split(/\s+/)[0];
        return m.includes(cc.name.toLowerCase()) || (first.length >= 3 && m.includes(first)) || m.includes(cc.tin);
      })
      .sort((a, b) => b.name.length - a.name.length)[0];

    // 1) Aniq kontragent + hujjat so'rovi → shu kompaniya hujjatlari
    if (matched && has("hujjat", "document", "документ", "файл", "fayl")) {
      const docs = await tx
        .select({ id: documents.id, title: documents.title, type: documents.type })
        .from(documents)
        .where(eq(documents.contractorId, matched.id))
        .orderBy(desc(documents.createdAt));
      return {
        intent: "company_documents",
        reply: fill(T.companyDocs[locale], { name: matched.name, n: docs.length }),
        results: docs.map((doc) => ({ kind: "document", title: doc.title, subtitle: doc.type, href: `/companies/${matched.id}` })),
      };
    }

    // 2) Kontragent nomi bor (umumiy) → uning dosyesi
    if (matched) {
      const [agg] = await tx
        .select({ out: sql<string>`coalesce(sum(${receivables.outstandingMinor}),0)::text`, over: sql<number>`count(*) filter (where ${receivables.status}='overdue')::int` })
        .from(receivables)
        .where(eq(receivables.contractorId, matched.id));
      return {
        intent: "company",
        reply: fill(T.company[locale], { name: matched.name, sum: amount(BigInt(agg?.out ?? "0")), over: agg?.over ?? 0 }),
        results: [{ kind: "company", title: matched.name, subtitle: `${T.tin[locale]}: ${matched.tin}`, href: `/companies/${matched.id}` }],
      };
    }

    // 3) Muddati o'tgan qarzlar
    if (has("muddati o'tgan", "muddati otgan", "overdue", "просрочен", "kechik")) {
      const rows = await joinRec(tx).where(eq(receivables.status, "overdue")).orderBy(desc(receivables.overdueDays)).limit(10);
      return {
        intent: "overdue",
        reply: fill(T.overdue[locale], { n: rows.length }),
        results: rows.map((r) => ({ kind: "receivable", title: r.name, subtitle: `${r.invoice} · ${r.days} ${T.days[locale]} · ${amount(r.out, r.cur)}`, href: `/companies/${r.cid}` })),
      };
    }

    // 4) To'lanmagan hisob-fakturalar
    if (has("to'lanmagan", "tolanmagan", "unpaid", "неоплач", "qarzdor")) {
      const rows = await joinRec(tx).where(inArray(receivables.status, ["overdue", "pending", "partial"])).orderBy(desc(receivables.outstandingMinor)).limit(10);
      return {
        intent: "unpaid",
        reply: fill(T.unpaid[locale], { n: rows.length }),
        results: rows.map((r) => ({ kind: "receivable", title: r.name, subtitle: `${r.invoice} · ${amount(r.out, r.cur)}`, href: `/companies/${r.cid}` })),
      };
    }

    // 5) Yuqori xavf
    if (has("xavf", "risk", "риск", "tavakkal")) {
      const rows = await joinRec(tx).where(sql`${receivables.riskScore} >= 40`).orderBy(desc(receivables.riskScore)).limit(10);
      return {
        intent: "risk",
        reply: fill(T.risk[locale], { n: rows.length }),
        results: rows.map((r) => ({ kind: "receivable", title: r.name, subtitle: `${T.risk_[locale]}: ${r.risk} · ${amount(r.out, r.cur)}`, href: `/companies/${r.cid}` })),
      };
    }

    // Standart — yordam
    return { intent: "help", reply: T.help[locale], results: [] };
  });

  // LLM (mavjud bo'lsa) butun holat snapshot'i + topilgan natijalar asosida ISTALGAN
  // savolga javob beradi. Barcha raqamlar deterministik — LLM faqat tushuntiradi.
  const context = [
    "=== JORIY HOLAT / CURRENT STATE ===",
    snapshot,
    response.results.length ? `\n=== SAVOLGA MOS TOPILDI ===\n${response.results.map((r) => `- ${r.title} (${r.subtitle})`).join("\n")}` : "",
  ].join("\n");
  const reply = await phraseChatReply({ locale: locale as "uz" | "ru" | "en", question: message, context, fallback: response.reply });

  return c.json(ok({ ...response, reply }, "common.ok", locale));
});

// Debitorlik + kontragent + invoice join (qayta ishlatiladi).
function joinRec(tx: Parameters<Parameters<typeof withTenant>[1]>[0]) {
  return tx
    .select({
      cid: contractors.id,
      name: contractors.name,
      invoice: invoices.number,
      out: receivables.outstandingMinor,
      cur: receivables.currency,
      days: receivables.overdueDays,
      risk: receivables.riskScore,
    })
    .from(receivables)
    .innerJoin(contractors, eq(receivables.contractorId, contractors.id))
    .innerJoin(invoices, eq(receivables.invoiceId, invoices.id));
}

function fill(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

// Ko'p tilli javob shablonlari (locale kaliti bilan).
type L = Record<string, string>;
const T: Record<string, L> = {
  empty: { uz: "Savolingizni yozing.", ru: "Напишите ваш вопрос.", en: "Type your question." },
  tin: { uz: "STIR", ru: "ИНН", en: "TIN" },
  days: { uz: "kun", ru: "дн.", en: "days" },
  risk_: { uz: "Xavf", ru: "Риск", en: "Risk" },
  companyDocs: {
    uz: "{name} bo'yicha {n} ta hujjat topdim:",
    ru: "Нашёл {n} документов по {name}:",
    en: "Found {n} documents for {name}:",
  },
  company: {
    uz: "{name}: umumiy qarz {sum}, {over} ta muddati o'tgan. Dosyeni oching:",
    ru: "{name}: общий долг {sum}, {over} просроченных. Откройте дело:",
    en: "{name}: total debt {sum}, {over} overdue. Open the case:",
  },
  overdue: {
    uz: "{n} ta muddati o'tgan qarz topdim (kechikish bo'yicha):",
    ru: "Нашёл {n} просроченных долгов (по просрочке):",
    en: "Found {n} overdue debts (by days overdue):",
  },
  unpaid: {
    uz: "{n} ta to'lanmagan qarz topdim (summa bo'yicha):",
    ru: "Нашёл {n} неоплаченных долгов (по сумме):",
    en: "Found {n} unpaid debts (by amount):",
  },
  risk: {
    uz: "{n} ta yuqori xavfli qarz topdim:",
    ru: "Нашёл {n} долгов с высоким риском:",
    en: "Found {n} high-risk debts:",
  },
  help: {
    uz: "Menga so'rang: «muddati o'tgan qarzlar», «GLOBAL SNAB hujjatlari», «to'lanmaganlar», «yuqori xavf» yoki kontragent nomini yozing.",
    ru: "Спросите меня: «просроченные долги», «документы GLOBAL SNAB», «неоплаченные», «высокий риск» или введите название контрагента.",
    en: "Ask me: 'overdue debts', 'GLOBAL SNAB documents', 'unpaid', 'high risk', or type a counterparty name.",
  },
};
