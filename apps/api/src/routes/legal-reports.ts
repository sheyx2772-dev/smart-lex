import { contractors, documents, legalMatters, withTenant } from "@lex/db";
import { LEGAL_MATTER_STATUSES, ok } from "@lex/shared";
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";

/** "Yuridik" ish rejimi uchun hisobotlar — legal_matters va shartnoma xavf tahlillari
 * asosida. Debitorlik hisobotlari (reports.ts) bilan hech qanday aloqasi yo'q. */
export const legalReportRoutes = new Hono<{ Variables: Variables }>();

const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

legalReportRoutes.get("/legal/reports", async (c) => {
  const { tenantId } = c.get("auth");
  const locale = c.get("locale");

  const data = await withTenant(tenantId, async (tx) => {
    const matters = await tx
      .select({
        id: legalMatters.id,
        status: legalMatters.status,
        priority: legalMatters.priority,
        riskLevel: legalMatters.riskLevel,
        type: legalMatters.type,
        createdAt: legalMatters.createdAt,
        closedAt: legalMatters.closedAt,
      })
      .from(legalMatters);

    const statusCounts: Record<string, number> = Object.fromEntries(LEGAL_MATTER_STATUSES.map((s) => [s, 0]));
    const priorityCounts: Record<string, number> = Object.fromEntries(PRIORITIES.map((p) => [p, 0]));
    const riskCounts: Record<string, number> = Object.fromEntries(RISK_LEVELS.map((r) => [r, 0]));
    let closedCount = 0;
    let resolutionDaysSum = 0;
    let resolutionN = 0;

    for (const m of matters) {
      if (m.status in statusCounts) statusCounts[m.status] = (statusCounts[m.status] ?? 0) + 1;
      if (m.priority in priorityCounts) priorityCounts[m.priority] = (priorityCounts[m.priority] ?? 0) + 1;
      if (m.riskLevel && m.riskLevel in riskCounts) riskCounts[m.riskLevel] = (riskCounts[m.riskLevel] ?? 0) + 1;
      if (m.status === "closed") {
        closedCount++;
        if (m.closedAt) {
          const days = Math.max(0, Math.round((new Date(m.closedAt).getTime() - new Date(m.createdAt).getTime()) / (24 * 60 * 60 * 1000)));
          resolutionDaysSum += days;
          resolutionN++;
        }
      }
    }

    // ── Shartnoma xavf tahlillari (documents.extracted.riskAnalysis) ──
    const contractDocs = await tx.select({ extracted: documents.extracted }).from(documents).where(eq(documents.type, "contract"));
    const contractRisk: Record<string, number> = Object.fromEntries(RISK_LEVELS.map((r) => [r, 0]));
    let analyzedCount = 0;
    for (const d of contractDocs) {
      const ra = (d.extracted as Record<string, unknown> | null)?.riskAnalysis as Record<string, unknown> | undefined;
      const level = typeof ra?.riskLevel === "string" ? ra.riskLevel : null;
      if (level && level in contractRisk) {
        contractRisk[level] = (contractRisk[level] ?? 0) + 1;
        analyzedCount++;
      }
    }

    // ── So'nggi yopilgan ishlar ──
    const recentClosed = await tx
      .select({
        matterNumber: legalMatters.matterNumber,
        title: legalMatters.title,
        closedAt: legalMatters.closedAt,
        contractorName: contractors.name,
      })
      .from(legalMatters)
      .leftJoin(contractors, eq(legalMatters.contractorId, contractors.id))
      .where(eq(legalMatters.status, "closed"))
      .orderBy(desc(legalMatters.closedAt))
      .limit(8);

    return {
      total: matters.length,
      closedCount,
      avgResolutionDays: resolutionN ? Math.round(resolutionDaysSum / resolutionN) : null,
      statusCounts,
      priorityCounts,
      riskCounts,
      contractRisk,
      analyzedContractsCount: analyzedCount,
      totalContractsCount: contractDocs.length,
      recentClosed,
    };
  });

  return c.json(ok(data, "common.ok", locale));
});
