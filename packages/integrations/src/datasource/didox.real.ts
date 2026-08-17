import crypto from "node:crypto";
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
 * REAL Didox partner adapteri — JONLI API bilan tasdiqlangan (2026-07).
 *
 * Endpoint:  GET https://api2.didox.uz/v2/documents?owner={0|1}&page=1&limit=N
 *   owner=0 => kiruvchi (incoming), owner=1 => chiquvchi (outgoing).
 * Auth (ikkita header):
 *   User-Key: <foydalanuvchi kaliti> — ECP (E-IMZO) login orqali olinadi (Didox web: localStorage.user.token).
 *   Partner-Authorization: base64( RSA-OAEP-SHA256( DIDOX_PUBLIC_KEY, JSON.stringify({token, iat}) ) )
 *     bu yerda token = partner JWT (MC LEGAL), iat = new Date().toUTCString().
 *   X-Requested-From: website  (majburiy).
 *
 * Javob shakli:  { data: [ { doc_id, name, doc_date, doctype, partnerTin, partnerCompany,
 *   contract_number, contract_date, total_delivery_sum_with_vat, total_sum, ... } ] }
 *
 * Pul/sana hech qachon o'ylab topilmaydi — faqat Didox bergan qiymatlar normallashtiriladi.
 */

/** Didox ochiq RSA kaliti (Partner-Authorization shifrlash uchun). Bu — ommaviy kalit, maxfiy emas. */
const DIDOX_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAydhu02KeiDhZGB8dtgaxkcd7qfPs9Xt7
G08NEPSbrWoDMvHS6odLm9IimDK8TuWcSE3z+QQQNvCiloo0R9ZqOsd1VkNrBs5Bzo70icrQOEvg
AVb7mJsVs3tE8jghHcySttKbT23Ev5ZOKKjKOI6gs9oMQrp9mQsDL2i2zarde6mzo5s+VIq2LnIf
AnBndSkwHxehyvKN54iI/jEMmE/6vCtkfkpCmbSTShanDJMYhWLkkUqRgcftw9u36mop8osYhsoB
5/fAO/aJuPQ+Obn59Dg0mj6V3ma8Fc7g9YyhOZbvnMWxh3TCL9/C/CXVIxqw5JF90OwzXMjZh0Lz
mort3dkxfF1JAjZ3vkd9PfIkr/b300X+JcfFyaqQk5msezm2Fs3WNw9MvsxUHpQ2K4nsPmr7pn6L
G7O/NkHKqKySq4DMc8nCDQDWSPaveKzeHtghgF4bXC2Ke094OqoNhLVBdB2MJCJqbf/FNfiUC1/b
X20mBe9odCxJBehGdbGTXB5zHSxo097ysWqTowhTuS1MrPSgdqt3rqjeJntbjeKe1QFiQMQSp5AU
6tw95uGfPYv31Not+1ulBRhHMN241Insk+WlZvmPtPQkGmW1hFvhOCO7KODfSr3HQ3pSqOovdEIq
jgvTAyOWN9cqpZtHoL7W6P4XbhP/73865SMMfIlU2lsCAwEAAQ==
-----END PUBLIC KEY-----`;

/** Didox doctype kodi -> bizning DocumentType. (002=ЭСФ/faktura, 005=akt — jonli tasdiqlangan.) */
const DOCTYPE_MAP: Record<string, DocumentType> = {
  "000": "invoice",
  "001": "invoice",
  "002": "invoice", // hisob-faktura (ЭСФ)
  "003": "invoice",
  "004": "invoice",
  "005": "act", // akt
  "006": "reconciliation_act",
  "007": "ttn",
};

interface RawDidoxDoc {
  [k: string]: unknown;
}

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v ? v : typeof v === "number" ? String(v) : undefined;
const first = (o: RawDidoxDoc, keys: string[]): string | undefined => {
  for (const k of keys) {
    const v = str(o[k]);
    if (v) return v;
  }
  return undefined;
};

/**
 * Способ 2 — parol orqali token olish (Didox qo'llab-quvvatlash tavsiyasi, 2026-08).
 * ECP (E-IMZO) shart emas — shuning uchun token muddati tugaganda avtomatik qayta
 * chaqirish mumkin (E-IMZO'da esa foydalanuvchi qo'lda qayta ulanishi kerak).
 */
export async function fetchDidoxPasswordToken(baseUrl: string, taxId: string, password: string, locale = "ru"): Promise<string> {
  const base = baseUrl.replace(/\/+$/, "");
  const res = await fetch(`${base}/v1/auth/${encodeURIComponent(taxId)}/password/${locale}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(`Didox auth/password HTTP ${res.status}`);
  const data = (await res.json().catch(() => null)) as { token?: string } | null;
  if (!data?.token) throw new Error("Didox auth/password: javobda token yo'q");
  return data.token;
}

export interface DidoxConfig {
  /** Default: https://api2.didox.uz */
  baseUrl: string;
  /** Partner JWT (env DIDOX_PARTNER_TOKEN). */
  partnerToken: string;
  /** Foydalanuvchi kaliti — ECP login natijasi (tenant sozlamasidan yoki env DIDOX_USER_KEY). */
  userKey: string;
  /** Didox ochiq kaliti (default: ichki). */
  publicKeyPem?: string;
}

export class DidoxDataSource implements DataSource {
  readonly name = "didox";
  private readonly pubKey: crypto.KeyObject;

  constructor(private readonly cfg: DidoxConfig) {
    this.pubKey = crypto.createPublicKey({ key: cfg.publicKeyPem ?? DIDOX_PUBLIC_KEY_PEM, format: "pem" });
  }

  /** Partner-Authorization = base64(RSA-OAEP-SHA256(pubkey, {token, iat})). */
  private partnerAuth(): string {
    const payload = JSON.stringify({ token: this.cfg.partnerToken, iat: new Date().toUTCString() });
    const enc = crypto.publicEncrypt(
      { key: this.pubKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
      Buffer.from(payload, "utf8"),
    );
    return enc.toString("base64");
  }

  private headers(): Record<string, string> {
    return {
      Accept: "application/json",
      "Accept-Language": "uz",
      "X-Requested-From": "website",
      "User-Key": this.cfg.userKey,
      "Partner-Authorization": this.partnerAuth(),
    };
  }

  private async getDocuments(owner: 0 | 1): Promise<RawDidoxDoc[]> {
    const base = this.cfg.baseUrl.replace(/\/+$/, "");
    const res = await fetch(`${base}/v2/documents?owner=${owner}&page=1&limit=500`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Didox /v2/documents (owner=${owner}) HTTP ${res.status}`);
    const data = (await res.json().catch(() => null)) as unknown;
    if (Array.isArray(data)) return data as RawDidoxDoc[];
    const obj = (data ?? {}) as Record<string, unknown>;
    const arr = obj.data ?? obj.documents ?? obj.items ?? [];
    return Array.isArray(arr) ? (arr as RawDidoxDoc[]) : [];
  }

  async fetchSnapshot(): Promise<DataSourceSnapshot> {
    const [incoming, outgoing] = await Promise.all([this.getDocuments(0), this.getDocuments(1)]);
    // Yo'nalish shu yerda BIRINCHI marta va OXIRGI marta aniq — pastda birlashtirilgach
    // qaytadan tiklab bo'lmaydi, shuning uchun har bir hujjatga darhol yorliq qo'yiladi.
    const raw: (RawDidoxDoc & { __direction: "incoming" | "outgoing" })[] = [
      ...incoming.map((d) => ({ ...d, __direction: "incoming" as const })),
      ...outgoing.map((d) => ({ ...d, __direction: "outgoing" as const })),
    ];

    const contractors = new Map<string, ExternalContractor>();
    const contractsMap = new Map<string, ExternalContract>();
    const invoices: ExternalInvoice[] = [];
    const payments: ExternalPayment[] = [];
    const documents: ExternalDocument[] = [];

    for (const d of raw) {
      const direction = d.__direction;
      const tin = first(d, ["partnerTin", "contragent_tin", "partner_tin", "tin"]);
      const name = first(d, ["partnerCompany", "contragent_name", "partner_name", "name"]);
      const number = first(d, ["name", "doc_number", "number", "facture_no"]) ?? "—";
      const didoxId = first(d, ["doc_id", "id", "uuid"]) ?? number;
      const typeKey = String(d.doctype ?? first(d, ["doc_type", "type", "document_type"]) ?? "").trim();
      const type = DOCTYPE_MAP[typeKey] ?? "other";
      const contractNumber = first(d, ["contract_number", "dogovor_no"]);
      const contractDate = first(d, ["contract_date", "signed_at"]);
      const phone = first(d, ["partnerPhone", "phone"]);

      if (tin && name && !contractors.has(tin)) contractors.set(tin, { name, tin, phone });

      documents.push({
        didoxId,
        type,
        title: `${type} ${number}`.trim(),
        contractorTin: tin,
        contractNumber,
      });

      if (type === "invoice") {
        const amountMinor =
          this.toMinor(first(d, ["total_delivery_sum_with_vat", "total_sum", "amount", "sum"])) ?? "0";
        invoices.push({
          number,
          contractNumber: contractNumber ?? number,
          contractorTin: tin ?? "",
          amountMinor,
          currency: (first(d, ["currency"]) as Currency) ?? "UZS",
          issuedAt: this.toISO(first(d, ["doc_date", "date", "created"])),
          // Didox hujjat ro'yxatida to'lov muddati yo'q — Document Agent shartnoma matnidan aniqlaydi.
          dueDate: this.toISO(first(d, ["due_date", "payment_date", "doc_date"])),
          didoxId,
          direction,
        });
      }

      // Shartnoma — hujjatlardagi contract_number bo'yicha dedupe qilib yig'amiz.
      if (contractNumber && tin && !contractsMap.has(contractNumber)) {
        contractsMap.set(contractNumber, {
          number: contractNumber,
          contractorTin: tin,
          signedAt: this.toISO(contractDate ?? first(d, ["doc_date"])),
          penaltyDailyBps: 0, // penya shartnoma matnida — Document Agent tahlil qiladi
          didoxId,
        });
      }

      void payments; // Didox to'lovlarni bermaydi — to'lov bank/manba orqali (alohida adapter).
    }

    return {
      contractors: [...contractors.values()],
      contracts: [...contractsMap.values()],
      invoices,
      payments,
      documents,
    };
  }

  // ── WRITE — qarzdorga eslatma (talabnoma) Didox'ga yuborish ─────────────────
  // Endpointlar jonli tasdiqlangan (api2.didox.uz/v1). Imzo HAR DOIM foydalanuvchi
  // mashinasida (E-IMZO) — server imzolamaydi. Javob shakllari mudofaaviy tahlil qilinadi.
  private v1(path: string): string {
    return `${this.cfg.baseUrl.replace(/\/+$/, "")}/v1${path}`;
  }

  /** Berilgan (chiquvchi) invoyslar bo'yicha talabnoma base64'ini oladi. */
  async getDebtorNotification(invoiceIds: string[]): Promise<string> {
    const q = new URLSearchParams({ invoicesId: invoiceIds.join(",") });
    const res = await fetch(`${this.v1("/debtor/notification")}?${q.toString()}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Didox debtor/notification HTTP ${res.status}`);
    const data = (await res.json().catch(() => null)) as unknown;
    if (typeof data === "string") return data;
    const o = (data ?? {}) as Record<string, unknown>;
    return str(o.data) ?? str(o.document) ?? str(o.base64) ?? "";
  }

  /** Talabnomani yaratadi → imzolanadigan hujjat (JSON matn) va pending obyektni qaytaradi. */
  async createDebtorNotification(documentBase64: string): Promise<{ pending: unknown; toSign: string }> {
    const res = await fetch(this.v1("/debtor/notification/create"), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ document: documentBase64 }),
    });
    if (!res.ok) throw new Error(`Didox notification/create HTTP ${res.status}`);
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const pending = (data?.pending_document ??
      (data?.data as Record<string, unknown>)?.pending_document ??
      data) as Record<string, unknown>;
    const doc = pending?.document_json ?? pending?.document ?? pending;
    return { pending, toSign: JSON.stringify(doc) };
  }

  /** E-IMZO PKCS7 imzoni yuboradi → talabnoma jo'natiladi. */
  async signDebtorNotification(signaturePkcs7: string): Promise<unknown> {
    const res = await fetch(this.v1("/debtor/notification/sign"), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ signature: signaturePkcs7 }),
    });
    if (!res.ok) throw new Error(`Didox notification/sign HTTP ${res.status}`);
    return res.json().catch(() => ({}));
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
