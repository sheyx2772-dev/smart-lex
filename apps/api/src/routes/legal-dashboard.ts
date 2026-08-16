import { auditLogs, contractors, legalAgentTasks, legalMatters, withTenant } from "@lex/db";
import { ok } from "@lex/shared";
import { and, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";

/**
 * "Yuridik" ish rejimi uchun bosh sahifa — legal_matters asosida. Debitorlik
 * boshqaruv paneli (dashboard.ts) bilan bog'liq emas, alohida jadval va so'rov.
 */
export const legalDashboardRoutes = new Hono<{ Variables: Variables }>();

legalDashboardRoutes.get("/legal/dashboard", async (c) => {
  const { tenantId } = c.get("auth");
  const locale = c.get("locale");

  const data = await withTenant(tenantId, async (tx) => {
    const now = new Date();
    const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [active] = await tx.select({ n: sql<number>`count(*)::int` }).from(legalMatters).where(ne(legalMatters.status, "closed"));
    const [highRisk] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(legalMatters)
      .where(inArray(legalMatters.riskLevel, ["high", "critical"]));
    const [deadlines] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(legalMatters)
      .where(and(ne(legalMatters.status, "closed"), gte(legalMatters.dueDate, now), lte(legalMatters.dueDate, weekAhead)));
    const [court] = await tx.select({ n: sql<number>`count(*)::int` }).from(legalMatters).where(eq(legalMatters.status, "in_court"));
    const [toReview] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(legalMatters)
      .where(and(eq(legalMatters.type, "contract_review"), inArray(legalMatters.status, ["new", "in_review"])));
    const [ai] = await tx.select({ n: sql<number>`count(*)::int` }).from(legalAgentTasks).where(eq(legalAgentTasks.status, "pending"));

    const recentMatters = await tx
      .select({
        id: legalMatters.id,
        matterNumber: legalMatters.matterNumber,
        title: legalMatters.title,
        status: legalMatters.status,
        priority: legalMatters.priority,
        riskLevel: legalMatters.riskLevel,
        dueDate: legalMatters.dueDate,
        contractorName: contractors.name,
        updatedAt: legalMatters.updatedAt,
      })
      .from(legalMatters)
      .leftJoin(contractors, eq(legalMatters.contractorId, contractors.id))
      .orderBy(desc(legalMatters.updatedAt))
      .limit(6);

    const activity = await tx
      .select({
        id: auditLogs.id,
        actorType: auditLogs.actorType,
        action: auditLogs.action,
        detail: auditLogs.detail,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(7);

    return {
      kpis: {
        activeMatters: active?.n ?? 0,
        highRisk: highRisk?.n ?? 0,
        deadlinesThisWeek: deadlines?.n ?? 0,
        courtCases: court?.n ?? 0,
        contractsToReview: toReview?.n ?? 0,
        aiTasks: ai?.n ?? 0,
      },
      recentMatters,
      activity,
    };
  });

  return c.json(ok(data, "common.ok", locale));
});
