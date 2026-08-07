import { auditLogs, contractors, getDb, invoices, receivables, tenants, withTenant } from "@lex/db";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { clickPaymentUrlWith } from "../lib/click";
import { type Variables } from "../lib/context";
import { paymeCheckoutUrlWith } from "../lib/payme";

/**
 * QARZDOR PORTALI (PUBLIC — login talab qilinmaydi).
 * Qarzdor SMS/eslatmadagi havolani ochadi → qarzini ko'radi → to'lov rekvizitlari +
 * AI bo'lib-to'lash / kelishuv taklifi. Migratsiyasiz: kelishuv `audit_logs`ga yoziladi.
 *
 * receivable id tenant-scoped (RLS) — tenantlarni skanlab topamiz (Payme txn pattern).
 */
export const debtorPortalRoutes = new Hono<{ Variables: Variables }>();

interface Found {
  tenant: { id: string; name: string; tin: string; bankAccount: string | null; bankMfo: string | null; settings: Record<string, unknown> };
  receivable: { id: string; outstandingMinor: bigint; penaltyMinor: bigint | null; currency: string; overdueDays: number; status: string };
  debtorName: string;
  invoiceNumber: string;
  invoiceId: string | null;
}

async function findReceivable(id: string): Promise<Found | null> {
  const all = await getDb().select().from(tenants);
  for (const t of all) {
    const hit = await withTenant(t.id, async (tx) => {
      const [r] = await tx.select().from(receivables).where(eq(receivables.id, id)).limit(1);
      if (!r) return null;
      const [inv] = r.invoiceId ? await tx.select().from(invoices).where(eq(invoices.id, r.invoiceId)).limit(1) : [undefined];
      const [con] = await tx.select().from(contractors).where(eq(contractors.id, r.contractorId)).limit(1);
      return { r, inv, con };
    });
    if (hit?.r) {
      return {
        tenant: { id: t.id, name: t.name, tin: t.tin, bankAccount: t.bankAccount, bankMfo: t.bankMfo, settings: (t.settings ?? {}) as Record<string, unknown> },
        receivable: {
          id: hit.r.id,
          outstandingMinor: hit.r.outstandingMinor,
          penaltyMinor: hit.r.penaltyMinor,
          currency: hit.r.currency,
          overdueDays: hit.r.overdueDays,
          status: hit.r.status,
        },
        debtorName: hit.con?.name ?? "",
        invoiceNumber: hit.inv?.number ?? "",
        invoiceId: hit.r.invoiceId ?? null,
      };
    }
  }
  return null;
}

/** Qarz ma'lumoti (public). */
debtorPortalRoutes.get("/pay/:id", async (c) => {
  const f = await findReceivable(c.req.param("id"));
  if (!f) return c.json({ success: false, data: null, error: "not_found", message: "topilmadi" }, 404);
  return c.json({
    success: true,
    data: {
      creditor: { name: f.tenant.name, tin: f.tenant.tin, bankAccount: f.tenant.bankAccount, bankMfo: f.tenant.bankMfo },
      debtorName: f.debtorName,
      invoiceNumber: f.invoiceNumber,
      principalMinor: f.receivable.outstandingMinor.toString(),
      penaltyMinor: (f.receivable.penaltyMinor ?? 0n).toString(),
      currency: f.receivable.currency,
      overdueDays: f.receivable.overdueDays,
      status: f.receivable.status,
      cards: cardFlags(f.tenant.settings),
    },
    error: null,
    message: "ok",
  });
});

interface ClickM { serviceId?: string; merchantId?: string; secretKey?: string }
interface PaymeM { merchantId?: string; secretKey?: string }
function merchantOf(settings: Record<string, unknown>): { click?: ClickM; payme?: PaymeM } {
  return (settings.merchant ?? {}) as { click?: ClickM; payme?: PaymeM };
}
/** Firma qaysi karta to'lovlarini qabul qiladi (merchant ulanganmi). */
function cardFlags(settings: Record<string, unknown>): { click: boolean; payme: boolean } {
  const m = merchantOf(settings);
  return {
    click: Boolean(m.click?.serviceId && m.click?.merchantId && m.click?.secretKey),
    payme: Boolean(m.payme?.merchantId && m.payme?.secretKey),
  };
}

// Qattiqlikка qarab minimal kelishuv foizi (money mantiqi deterministik — LLM'da emas).
const SETTLEMENT_MIN: Record<string, number> = { soft: 60, normal: 72, aggressive: 85 };
const MAX_MONTHS: Record<string, number> = { soft: 6, normal: 4, aggressive: 3 };

/** AI bo'lib-to'lash / kelishuv taklifi (public). Qoidalarга asoslangan, firmaга xabar. */
debtorPortalRoutes.post("/pay/:id/negotiate", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { type?: string; months?: number };
  const f = await findReceivable(id);
  if (!f) return c.json({ success: false, data: null, error: "not_found", message: "topilmadi" }, 404);

  const principal = Number(f.receivable.outstandingMinor) / 100;
  const penalty = Number(f.receivable.penaltyMinor ?? 0n) / 100;
  const total = principal + penalty;
  const aggr = String((f.tenant.settings.agent as { aggressiveness?: string } | undefined)?.aggressiveness ?? "normal");

  let offer: { type: string; text: string; acceptMinor: number; schedule?: { month: number; amount: number }[] };
  if (body.type === "settlement") {
    const pct = SETTLEMENT_MIN[aggr] ?? 72;
    const accept = Math.round((total * pct) / 100);
    offer = {
      type: "settlement",
      acceptMinor: accept * 100,
      text: `Bir martalik to'lov kelishuvi: agar ${accept.toLocaleString("uz-UZ")} so'm (jami qarzning ${pct}%) darhol to'lansa, qolgan qismi kechiriladi. Penya to'xtatiladi.`,
    };
  } else {
    const maxM = MAX_MONTHS[aggr] ?? 4;
    const months = Math.max(2, Math.min(maxM, Math.round(body.months ?? maxM)));
    const per = Math.ceil(total / months);
    offer = {
      type: "installment",
      acceptMinor: Math.round(total) * 100,
      schedule: Array.from({ length: months }, (_, i) => ({ month: i + 1, amount: per })),
      text: `Bo'lib to'lash rejasi: ${months} oy davomida oyiga ~${per.toLocaleString("uz-UZ")} so'm. Reja bajarilса sud jarayoni to'xtatiladi.`,
    };
  }

  // Firmaga xabar — audit logga (yangi jadval yo'q).
  await withTenant(f.tenant.id, async (tx) => {
    await tx.insert(auditLogs).values({
      tenantId: f.tenant.id,
      actorType: "system",
      actorId: "debtor-portal",
      action: "debtor.negotiation",
      entityType: "receivable",
      entityId: f.receivable.id,
      detail: { debtor: f.debtorName, offerType: offer.type, acceptMinor: offer.acceptMinor, text: offer.text },
    });
  });

  return c.json({ success: true, data: { offer, creditor: f.tenant.name }, error: null, message: "ok" });
});

/**
 * Karta orqali to'lash — firma merchanti bilan buyurtma yaratadi va checkout URL qaytaradi (public).
 * mode="settlement" bo'lsa — /negotiate bilan AYNAN BIR XIL qoidadan (SETTLEMENT_MIN) chegirmali
 * summa serverda QAYTA hisoblanadi (klientdan summa qabul qilinmaydi — soxta chegirma so'rab
 * bo'lmasin). Shu orqali "kelishuv → hoziroq to'lash" bir bosishda yakunlanadi (avval faqat
 * bank o'tkazmasi bilan qo'lda "rasmiylashtirish" kerak edi — bu real yo'qotish nuqtasi edi).
 */
debtorPortalRoutes.post("/pay/:id/pay/:provider", async (c) => {
  const id = c.req.param("id");
  const provider = c.req.param("provider");
  const body = (await c.req.json().catch(() => ({}))) as { mode?: string };
  const f = await findReceivable(id);
  if (!f) return c.json({ success: false, data: null, error: "not_found", message: "topilmadi" }, 404);
  if (f.receivable.status === "paid") return c.json({ success: false, data: null, error: "already_paid", message: "to'langan" }, 400);

  const m = merchantOf(f.tenant.settings);
  const fullTotalMinor = Math.round(Number(f.receivable.outstandingMinor) + Number(f.receivable.penaltyMinor ?? 0n)); // tiyin

  let totalMinor = fullTotalMinor;
  let kind = "debt";
  if (body.mode === "settlement") {
    const aggr = String((f.tenant.settings.agent as { aggressiveness?: string } | undefined)?.aggressiveness ?? "normal");
    const pct = SETTLEMENT_MIN[aggr] ?? 72;
    totalMinor = Math.round(((fullTotalMinor / 100) * pct) / 100) * 100;
    kind = "debt_settlement";
  }
  const amountSom = totalMinor / 100;
  const mid = `${f.tenant.id}~${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  const returnUrl = `${process.env.WEB_URL ?? "https://lexai.com.uz"}/pay/${id}`;

  let url: string | null = null;
  if (provider === "click" && m.click?.serviceId && m.click?.merchantId && m.click?.secretKey) {
    url = clickPaymentUrlWith({ serviceId: m.click.serviceId, merchantId: m.click.merchantId, secretKey: m.click.secretKey }, mid, amountSom, returnUrl);
  } else if (provider === "payme" && m.payme?.merchantId && m.payme?.secretKey) {
    url = paymeCheckoutUrlWith(m.payme.merchantId, false, mid, totalMinor, returnUrl);
  }
  if (!url) return c.json({ success: false, data: null, error: "not_available", message: "karta to'lovi ulanmagan" }, 400);

  // Buyurtmani saqlaymiz (webhook tasdiqlaganда payments'ga yoziladi). Fresh o'qib merge.
  const [row] = await getDb().select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, f.tenant.id)).limit(1);
  const s = { ...((row?.settings ?? {}) as Record<string, unknown>) };
  const orders = { ...((s.payOrders ?? {}) as Record<string, unknown>) };
  orders[mid] = { plan: "", months: 0, amount: amountSom, provider, status: "pending", createdAt: new Date().toISOString(), kind, receivableId: id, invoiceId: f.invoiceId ?? undefined };
  s.payOrders = orders;
  await getDb().update(tenants).set({ settings: s }).where(eq(tenants.id, f.tenant.id));

  return c.json({ success: true, data: { url }, error: null, message: "ok" });
});
