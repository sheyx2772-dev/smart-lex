import { analyzeContractRisk } from "@lex/agents";
import { documents, getDb, legalAgentTasks, legalMatters, tenants, withTenant } from "@lex/db";
import { and, eq, isNotNull, lte, ne } from "drizzle-orm";

export interface LegalTasksSummary {
  tenantsScanned: number;
  deadlineTasksCreated: number;
  documentsAnalyzed: number;
  recommendationTasksCreated: number;
}

/** Bitta hujjatning matnini oladi (documents.extracted.body — mavjud konventsiya). */
function bodyOf(extracted: unknown): string {
  const b = (extracted as Record<string, unknown> | null)?.body;
  return typeof b === "string" ? b : "";
}
function hasRiskAnalysis(extracted: unknown): boolean {
  return Boolean((extracted as Record<string, unknown> | null)?.riskAnalysis);
}

/**
 * "AI Vazifalari" navbatini to'ldiruvchi fon jarayoni — faqat "legal" ish rejimidagi
 * tenantlar uchun. 3 generator: 1) muddat skaneri (legal_matters.dueDate) 2) yangi
 * shartnoma hujjatlarini avtomatik xavf tahlili 3) tahlil natijasida band muammosi
 * topilsa alohida tavsiya vazifasi. Har biri (tenantId, source, sourceKey) bo'yicha
 * idempotent — qayta yugurganda takror vazifa yaratmaydi (onConflictDoNothing).
 */
export async function runLegalTasks(now: Date = new Date()): Promise<LegalTasksSummary> {
  const db = getDb();
  const tenantRows = await db.select({ id: tenants.id, settings: tenants.settings }).from(tenants);

  const summary: LegalTasksSummary = { tenantsScanned: 0, deadlineTasksCreated: 0, documentsAnalyzed: 0, recommendationTasksCreated: 0 };
  const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  for (const t of tenantRows) {
    const settings = (t.settings ?? {}) as Record<string, unknown>;
    if (settings.workMode !== "legal") continue;
    summary.tenantsScanned++;

    await withTenant(t.id, async (tx) => {
      // ── 1) Muddat skaneri — 3 kun ichida yoki o'tgan, yopilmagan ishlar ──
      const dueMatters = await tx
        .select({ id: legalMatters.id, title: legalMatters.title, dueDate: legalMatters.dueDate, contractorId: legalMatters.contractorId })
        .from(legalMatters)
        .where(and(ne(legalMatters.status, "closed"), isNotNull(legalMatters.dueDate), lte(legalMatters.dueDate, soon)));

      for (const m of dueMatters) {
        const days = m.dueDate ? Math.ceil((m.dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) : 0;
        const label = days <= 0 ? `muddat ${Math.abs(days)} kun oldin o'tgan` : `${days} kun qoldi`;
        const [ins] = await tx
          .insert(legalAgentTasks)
          .values({
            tenantId: t.id,
            category: "urgent",
            title: `"${m.title}" bo'yicha muddatni tekshirish`,
            reason: `Muddat: ${label}`,
            legalMatterId: m.id,
            contractorId: m.contractorId,
            source: "deadline_scanner",
            sourceKey: m.id,
          })
          .onConflictDoNothing({ target: [legalAgentTasks.tenantId, legalAgentTasks.source, legalAgentTasks.sourceKey] })
          .returning({ id: legalAgentTasks.id });
        if (ins) summary.deadlineTasksCreated++;
      }

      // ── 2) Yangi shartnoma hujjatlarini avtomatik tahlil qilish (hali tahlil qilinmagan, matni bor) ──
      const contractDocs = await tx
        .select({ id: documents.id, extracted: documents.extracted, contractorId: documents.contractorId })
        .from(documents)
        .where(eq(documents.type, "contract"))
        .limit(200);

      let analyzedThisRun = 0;
      for (const d of contractDocs) {
        if (analyzedThisRun >= 20) break; // bitta yugurishda LLM chaqiruvini cheklaymiz
        if (hasRiskAnalysis(d.extracted)) continue;
        const body = bodyOf(d.extracted);
        if (!body.trim()) continue;

        const result = await analyzeContractRisk(body, "uz");
        analyzedThisRun++;
        summary.documentsAnalyzed++;

        await tx
          .update(documents)
          .set({ extracted: { ...((d.extracted ?? {}) as object), riskAnalysis: result } })
          .where(eq(documents.id, d.id));

        await tx
          .insert(legalAgentTasks)
          .values({
            tenantId: t.id,
            category: "auto_check",
            title: "Yangi shartnoma AI tomonidan tahlil qilindi",
            reason: `Xavf darajasi: ${result.riskLevel}`,
            documentId: d.id,
            contractorId: d.contractorId,
            source: "document_analyzer",
            sourceKey: d.id,
          })
          .onConflictDoNothing({ target: [legalAgentTasks.tenantId, legalAgentTasks.source, legalAgentTasks.sourceKey] });

        // ── 3) Band muammosi topilsa — alohida tavsiya vazifasi ──
        if (result.missingClauses.length > 0 || result.unusualClauses.length > 0) {
          const parts = [...result.missingClauses.map((c) => `Yo'q: ${c}`), ...result.unusualClauses.map((c) => `G'ayrioddiy: ${c}`)];
          const [ins] = await tx
            .insert(legalAgentTasks)
            .values({
              tenantId: t.id,
              category: "recommendation",
              title: "Shartnomada band muammosi aniqlandi",
              reason: parts.join("; ").slice(0, 300),
              documentId: d.id,
              contractorId: d.contractorId,
              source: "clause_auditor",
              sourceKey: d.id,
            })
            .onConflictDoNothing({ target: [legalAgentTasks.tenantId, legalAgentTasks.source, legalAgentTasks.sourceKey] })
            .returning({ id: legalAgentTasks.id });
          if (ins) summary.recommendationTasksCreated++;
        }
      }
    });
  }

  return summary;
}
