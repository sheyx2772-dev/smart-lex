import { auditLogs, getDb, payments, receivables, tenants, withTenant } from "@lex/db";
import { ok } from "@lex/shared";
import { desc, eq, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import { type Variables } from "../lib/context";

/**
 * Agent AUTOPILOT — avtonomiya boshqaruvi + jonli "Agent nima qildi" tasmasi.
 * Migratsiyasiz: sozlama `tenant.settings.agent`da (jsonb), tasma `audit_logs`dan.
 *
 * mode: off (o'chirilgan) | suggest (taklif — yubormaydi, faqat tayyorlaydi) | auto (o'zi yuboradi)
 * aggressiveness: soft | normal | aggressive
 */
export const agentAutopilotRoutes = new Hono<{ Variables: Variables }>();

type AgentMode = "off" | "suggest" | "auto";
type Aggr = "soft" | "normal" | "aggressive";
const MODES: AgentMode[] = ["off", "suggest", "auto"];
const AGGR: Aggr[] = ["soft", "normal", "aggressive"];

interface AgentConfig {
  mode: AgentMode;
  aggressiveness: Aggr;
}
function readConfig(settings: Record<string, unknown> | null | undefined): AgentConfig {
  const a = (settings?.agent ?? {}) as Record<string, unknown>;
  return {
    mode: MODES.includes(a.mode as AgentMode) ? (a.mode as AgentMode) : "suggest",
    aggressiveness: AGGR.includes(a.aggressiveness as Aggr) ? (a.aggressiveness as Aggr) : "normal",
  };
}

/** Autopilot holati: sozlama + jonli tasma + bugungi statistika. */
agentAutopilotRoutes.get("/agent/autopilot", async (c) => {
  const { tenantId } = c.get("auth");
  const [t] = await getDb().select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const config = readConfig(t?.settings as Record<string, unknown> | undefined);

  const feed = await withTenant(tenantId, async (tx) =>
    tx
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        detail: auditLogs.detail,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(eq(auditLogs.actorType, "ai_agent"))
      .orderBy(desc(auditLogs.createdAt))
      .limit(50),
  );

  // Bugungi statistika (tasmadan hisoblanadi — alohida jadval yo'q).
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let decisions = 0;
  let reminders = 0;
  let escalations = 0;
  let recoverySum = 0;
  let recoveryN = 0;
  for (const f of feed) {
    const isToday = f.createdAt && new Date(f.createdAt) >= today;
    if (f.action === "agent.decision") {
      if (isToday) decisions++;
      const rec = Number((f.detail as Record<string, unknown> | null)?.recoveryScore);
      if (Number.isFinite(rec)) {
        recoverySum += rec;
        recoveryN++;
      }
    }
    if (f.action === "reminder.sent" && isToday) reminders++;
    if ((f.action === "demand.generated" || f.action === "court.requested") && isToday) escalations++;
  }
  const stats = {
    decisionsToday: decisions,
    remindersToday: reminders,
    escalationsToday: escalations,
    avgRecovery: recoveryN ? Math.round(recoverySum / recoveryN) : null,
  };

  // ── ROI: undirilgan pul + undirish darajasi (investor dalili) — mavjud jadvallardan.
  const rec = await withTenant(tenantId, async (tx) => {
    const [r] = await tx.select({ sum: sql<string>`coalesce(sum(${payments.amountMinor}),0)::text` }).from(payments).where(eq(payments.status, "received"));
    const [o] = await tx.select({ sum: sql<string>`coalesce(sum(${receivables.outstandingMinor}),0)::text` }).from(receivables).where(ne(receivables.status, "paid"));
    return { recoveredMinor: r?.sum ?? "0", outstandingMinor: o?.sum ?? "0" };
  });
  const recVal = Number(rec.recoveredMinor);
  const outVal = Number(rec.outstandingMinor);
  const recovery = {
    recoveredMinor: rec.recoveredMinor,
    outstandingMinor: rec.outstandingMinor,
    recoveryRate: recVal + outVal > 0 ? Math.round((recVal / (recVal + outVal)) * 100) : null,
  };

  return c.json(ok({ config, feed, stats, recovery }, "common.ok", c.get("locale")));
});

/** Autopilot sozlamasini yangilash (faqat owner/admin). */
agentAutopilotRoutes.post("/agent/autopilot/config", async (c) => {
  const { tenantId, role } = c.get("auth");
  if (role !== "owner" && role !== "admin") {
    return c.json({ success: false, data: null, error: "forbidden", message: "faqat rahbar" }, 403);
  }
  const body = (await c.req.json().catch(() => ({}))) as { mode?: string; aggressiveness?: string };
  const [t] = await getDb().select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const s = { ...((t?.settings ?? {}) as Record<string, unknown>) };
  const prev = (s.agent ?? {}) as Record<string, unknown>;
  s.agent = {
    ...prev,
    ...(MODES.includes(body.mode as AgentMode) ? { mode: body.mode } : {}),
    ...(AGGR.includes(body.aggressiveness as Aggr) ? { aggressiveness: body.aggressiveness } : {}),
  };
  await getDb().update(tenants).set({ settings: s }).where(eq(tenants.id, tenantId));
  return c.json(ok({ config: readConfig(s) }, "common.ok", c.get("locale")));
});
