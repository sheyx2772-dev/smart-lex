import { type Currency, type DocumentType } from "@lex/shared";
import {
  type DataSource,
  type DataSourceSnapshot,
  type ExternalContract,
  type ExternalContractor,
  type ExternalDocument,
  type ExternalInvoice,
  type ExternalPayment,
} from "./types";

/**
 * REAL Didox partner adapteri.
 *
 * Endpoint (tasdiqlangan): GET {base}/v2/documents?status=1  (imzolangan hujjatlar)
 *   Prod:  https://api-partners.didox.uz
 *   Test:  https://testapi3.didox.uz
 * Token: partner token (account manager orqali olinadi) — env DIDOX_PARTNER_TOKEN.
 *
 * MUHIM: Didox hujjatining aniq JSON maydon nomlari va tur kodlari partner hujjatlarida
 * (token bilan) beriladi. Shuning uchun barcha xaritalash (mapping) `mapRaw*` funksiyalarida
 * IZOLYATSIYALANGAN — token kelganda faqat shu joyni yakunlash kifoya, qolgan kod tegilmaydi.
 * Pul/sana hech qachon o'ylab topilmaydi — faqat Didox bergan qiymatlar normallashtiriladi.
 */
export interface DidoxConfig {
  baseUrl: string;
  token: string;
  authHeader?: string; // default "Authorization"
  authScheme?: string; // default "" (xom token). Kerak bo'lsa "Bearer".
}

/** Didox hujjat turi kodi -> bizning DocumentType. Token kelganda tasdiqlanadi/to'ldiriladi. */
const TYPE_MAP: Record<string, DocumentType> = {
  contract: "contract",
  dogovor: "contract",
  invoice: "invoice",
  esf: "invoice", // elektron schyot-faktura
  schet_faktura: "invoice",
  akt: "act",
  reconciliation: "reconciliation_act",
  akt_sverki: "reconciliation_act",
  ttn: "ttn",
  waybill: "ttn",
};

interface RawDidoxDoc {
  [k: string]: unknown;
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : typeof v === "number" ? String(v) : undefined);
const first = (o: RawDidoxDoc, keys: string[]): string | undefined => {
  for (const k of keys) {
    const v = str(o[k]);
    if (v) return v;
  }
  return undefined;
};

export class DidoxDataSource implements DataSource {
  readonly name = "didox";

  constructor(private readonly cfg: DidoxConfig) {}

  private headers(): Record<string, string> {
    const h = this.cfg.authHeader ?? "Authorization";
    const scheme = this.cfg.authScheme ? `${this.cfg.authScheme} ` : "";
    return { [h]: `${scheme}${this.cfg.token}`, "Content-Type": "application/json" };
  }

  private async getDocuments(): Promise<RawDidoxDoc[]> {
    const base = this.cfg.baseUrl.replace(/\/$/, "");
    // status=1 => imzolangan (STATUS_SIGNED). Kerak bo'lsa "0,1,2".
    const res = await fetch(`${base}/v2/documents?status=1`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Didox /v2/documents HTTP ${res.status}`);
    const data = (await res.json().catch(() => null)) as unknown;
    // Javob shakli: {data:[...]} yoki {documents:[...]} yoki to'g'ridan-to'g'ri massiv.
    if (Array.isArray(data)) return data as RawDidoxDoc[];
    const obj = (data ?? {}) as Record<string, unknown>;
    const arr = obj.data ?? obj.documents ?? obj.items ?? [];
    return Array.isArray(arr) ? (arr as RawDidoxDoc[]) : [];
  }

  async fetchSnapshot(): Promise<DataSourceSnapshot> {
    const raw = await this.getDocuments();

    const contractors = new Map<string, ExternalContractor>();
    const contracts: ExternalContract[] = [];
    const invoices: ExternalInvoice[] = [];
    const payments: ExternalPayment[] = [];
    const documents: ExternalDocument[] = [];

    for (const d of raw) {
      const tin = first(d, ["contragent_tin", "buyer_tin", "partner_tin", "tin"]);
      const name = first(d, ["contragent_name", "buyer_name", "partner_name", "name"]);
      const number = first(d, ["doc_number", "number", "facture_no"]) ?? "—";
      const didoxId = first(d, ["doc_id", "id", "uuid"]) ?? number;
      const typeKey = (first(d, ["doc_type", "type", "document_type"]) ?? "").toLowerCase();
      const type = TYPE_MAP[typeKey] ?? "other";

      if (tin && name && !contractors.has(tin)) contractors.set(tin, { name, tin });

      documents.push({ didoxId, type, title: `${type} ${number}`.trim(), contractorTin: tin, contractNumber: type === "invoice" ? number : undefined });

      if (type === "invoice") {
        const amountMinor = first(d, ["total_amount_minor", "amount_minor"]) ?? this.toMinor(first(d, ["total", "amount", "sum"]));
        invoices.push({
          number,
          contractNumber: first(d, ["contract_number", "dogovor_no"]) ?? number,
          contractorTin: tin ?? "",
          amountMinor: amountMinor ?? "0",
          currency: (first(d, ["currency"]) as Currency) ?? "UZS",
          issuedAt: this.toISO(first(d, ["doc_date", "date", "created_at"])),
          dueDate: this.toISO(first(d, ["due_date", "payment_date"])),
          didoxId,
        });
      } else if (type === "contract") {
        contracts.push({
          number,
          contractorTin: tin ?? "",
          signedAt: this.toISO(first(d, ["doc_date", "signed_at", "date"])),
          penaltyDailyBps: 0, // penya shartnoma matnida — Document Agent tahlil qiladi
          didoxId,
        });
      }
      // Akt/TTN/reconciliation — documents ro'yxatiga tushadi (yuqorida qo'shildi).
      void payments; // Didox to'lovlarni bermaydi — to'lov bank/manba orqali (alohida adapter).
    }

    return { contractors: [...contractors.values()], contracts, invoices, payments, documents };
  }

  private toMinor(v?: string): string | undefined {
    if (!v) return undefined;
    const n = v.replace(/[^\d.]/g, "");
    if (!n) return undefined;
    const [i, f = ""] = n.split(".");
    return (BigInt(i || "0") * 100n + BigInt((f + "00").slice(0, 2))).toString();
  }

  private toISO(v?: string): string {
    if (!v) return new Date(0).toISOString();
    const d = new Date(v);
    return isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
  }
}
