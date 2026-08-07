import { auditLogs, chainAnchors, tenants, users, verifyAuditChain, withTenant } from "@lex/db";
import { ok } from "@lex/shared";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { renderTextPdf } from "../lib/pdf";
import { type Variables } from "../lib/context";
import { pageMeta, pageParams } from "../lib/pagination";

export const auditRoutes = new Hono<{ Variables: Variables }>();

const ACTION_LABEL_UZ: Record<string, string> = {
  "agent.decision": "AI qarori",
  "reminder.sent": "Eslatma yuborildi",
  "debtor.negotiation": "Qarzdor bilan kelishuv",
  "contract.created": "Shartnoma yaratildi",
  "didox.synced": "Didox sinxronizatsiyasi",
  "court.filed": "Sudga topshirildi",
  "receivable.written_off": "Qarz hisobdan chiqarildi",
};

const fmtDateUz = (d: Date) => new Intl.DateTimeFormat("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);

/** Audit jurnali — server-side sahifalash + ijrochi filtri + qidiruv. */
auditRoutes.get("/audit", async (c) => {
  const { tenantId } = c.get("auth");
  const { page, pageSize, limit, offset } = pageParams(c);
  const actor = c.req.query("actor");
  const q = (c.req.query("q") ?? "").trim();

  const conds = [];
  if (actor && actor !== "all") conds.push(eq(auditLogs.actorType, actor as "user" | "ai_agent" | "system"));
  if (q) conds.push(or(ilike(auditLogs.action, `%${q}%`), ilike(auditLogs.actorId, `%${q}%`)));
  const where = conds.length ? and(...conds) : undefined;

  const data = await withTenant(tenantId, async (tx) => {
    const count = (await tx.select({ count: sql<number>`count(*)::int` }).from(auditLogs).where(where))[0]?.count ?? 0;

    const rows = await tx
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // Filtr chiplari uchun barqaror sanoq (filtrdan mustaqil).
    const actorCounts = await tx
      .select({ actorType: auditLogs.actorType, c: sql<number>`count(*)::int` })
      .from(auditLogs)
      .groupBy(auditLogs.actorType);
    const byActor: Record<string, number> = {};
    let allTotal = 0;
    for (const a of actorCounts) {
      byActor[a.actorType] = a.c;
      allTotal += a.c;
    }

    const userRows = await tx.select({ id: users.id, fullName: users.fullName }).from(users);
    const nameById = new Map(userRows.map((u) => [u.id, u.fullName]));

    const items = rows.map((r) => ({
      id: r.id,
      actorType: r.actorType,
      actorId: r.actorId,
      actorName: r.actorType === "user" && r.actorId ? nameById.get(r.actorId) ?? r.actorId : r.actorId,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      detail: r.detail,
      createdAt: r.createdAt,
    }));

    return { items, count, byActor, allTotal };
  });

  return c.json(
    ok(
      { items: data.items, byActor: data.byActor, allTotal: data.allTotal, ...pageMeta(data.count, page, pageSize) },
      "common.ok",
      c.get("locale"),
    ),
  );
});

/**
 * Audit zanjirining o'zgartirilmaganligini tekshiradi (har bir yozuv hash'ini
 * qayta hisoblab, saqlangan qiymat bilan solishtiradi — DB darajasidagi trigger
 * ilova kodidan mustaqil ishlaydi, shuning uchun natija ishonchli).
 */
auditRoutes.get("/audit/verify", async (c) => {
  const { tenantId } = c.get("auth");
  const status = await verifyAuditChain(tenantId);
  return c.json(ok(status, "common.ok", c.get("locale")));
});

/**
 * Zanjir "uchi"ni tashqi (Bitcoin) langarlash tarixi — OpenTimestamps orqali.
 * Ichki hash-zanjirdan farqli o'laroq, bu ISBOTNI hech kim (biz ham) o'zgartira
 * olmaydigan, mustaqil uchinchi tomon (Bitcoin blokcheyni)ga bog'laydi.
 */
auditRoutes.get("/audit/anchors", async (c) => {
  const { tenantId } = c.get("auth");
  const rows = await withTenant(tenantId, (tx) =>
    tx
      .select({
        id: chainAnchors.id,
        chainTipHash: chainAnchors.chainTipHash,
        status: chainAnchors.status,
        bitcoinBlockHeight: chainAnchors.bitcoinBlockHeight,
        confirmedAt: chainAnchors.confirmedAt,
        createdAt: chainAnchors.createdAt,
      })
      .from(chainAnchors)
      .orderBy(desc(chainAnchors.createdAt))
      .limit(20),
  );
  return c.json(ok({ items: rows }, "common.ok", c.get("locale")));
});

/**
 * Bank/komplayens uchun PDF hisobot — zanjir yaxlitligi + Bitcoin langar holati +
 * faoliyat statistikasi + so'nggi muhim voqealar. Firma bu hisobotni undiruv
 * jarayonining tekshirilishi mumkinligini isbotlash uchun bankka/auditorga beradi.
 */
auditRoutes.get("/audit/report", async (c) => {
  const { tenantId } = c.get("auth");
  const status = await verifyAuditChain(tenantId);

  const data = await withTenant(tenantId, async (tx) => {
    const [tenant] = await tx.select({ name: tenants.name, tin: tenants.tin }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);

    const actionCounts = await tx
      .select({ action: auditLogs.action, c: sql<number>`count(*)::int` })
      .from(auditLogs)
      .groupBy(auditLogs.action)
      .orderBy(desc(sql`count(*)`));

    const totalCount = (await tx.select({ count: sql<number>`count(*)::int` }).from(auditLogs))[0]?.count ?? 0;

    const recentEvents = await tx.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(40);

    const anchors = await tx
      .select({ status: chainAnchors.status, bitcoinBlockHeight: chainAnchors.bitcoinBlockHeight, confirmedAt: chainAnchors.confirmedAt, createdAt: chainAnchors.createdAt })
      .from(chainAnchors)
      .orderBy(desc(chainAnchors.createdAt))
      .limit(10);

    return { tenant, actionCounts, totalCount, recentEvents, anchors };
  });

  const confirmedAnchors = data.anchors.filter((a) => a.status === "confirmed");
  const lines: string[] = [];
  lines.push(`Firma: ${data.tenant?.name ?? "—"} (STIR ${data.tenant?.tin ?? "—"})`);
  lines.push(`Hisobot yaratilgan sana: ${fmtDateUz(new Date())}`);
  lines.push("");
  lines.push("AUDIT ZANJIRI YAXLITLIGI");
  lines.push(
    status.isValid
      ? `Tekshiruv natijasi: TASDIQLANDI — barcha ${status.totalRecords} ta yozuv o'zgartirilmagan holatda. Har bir yozuv o'zidan oldingi yozuv hash'iga kriptografik bog'langan (SHA-256 zanjir).`
      : `DIQQAT: zanjir ${status.brokenAtId} (${status.brokenAtCreated}) yozuvidan buzilgan — bu yozuvdan keyingi ma'lumotlar mustaqil tekshiruvdan o'ta olmadi.`,
  );
  lines.push("");
  lines.push("BITCOIN LANGAR (tashqi, mustaqil isbot)");
  if (confirmedAnchors.length > 0) {
    const latest = confirmedAnchors[0]!;
    lines.push(`So'nggi tasdiqlangan langar: Bitcoin blok #${latest.bitcoinBlockHeight ?? "—"}, ${latest.confirmedAt ? fmtDateUz(new Date(latest.confirmedAt)) : "—"}.`);
    lines.push(`Bu — audit zanjirining shu nuqtadagi holati Bitcoin blokcheynida abadiy qayd etilgan, hech kim (biz ham) uni orqaga qaytarib o'zgartira olmaydi degani.`);
  } else {
    lines.push("Hozircha Bitcoin blokida tasdiqlangan langar yo'q (jarayonda yoki hali yaratilmagan).");
  }
  lines.push("");
  lines.push("FAOLIYAT STATISTIKASI (jami)");
  for (const a of data.actionCounts) lines.push(`${ACTION_LABEL_UZ[a.action] ?? a.action}: ${a.c}`);
  lines.push(`JAMI YOZUVLAR: ${data.totalCount}`);
  lines.push("");
  lines.push(`SO'NGGI VOQEALAR (oxirgi ${data.recentEvents.length} ta)`);
  for (const e of data.recentEvents) {
    lines.push(`${fmtDateUz(new Date(e.createdAt))} — ${ACTION_LABEL_UZ[e.action] ?? e.action}${e.entityType ? ` (${e.entityType})` : ""}`);
  }

  const pdf = await renderTextPdf(lines.join("\n"), { title: "SmartLex — Audit va Komplayens Hisoboti" });
  return c.body(new Uint8Array(pdf), 200, {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="audit-hisobot-${new Date().toISOString().slice(0, 10)}.pdf"`,
  });
});
