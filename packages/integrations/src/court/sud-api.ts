import {
  type CourtDocumentType,
  type CourtEntity,
  type CourtInvoiceRequest,
  type CourtInvoiceResponse,
  type CourtSaveSuitPayload,
  type CourtSaveSuitResult,
  type CourtUploadResult,
} from "./types";

const BASE_URL = "https://cabinetapi.sud.uz/api/cabinet";

/** Faqat PDF tasdiqlangan — boshqa mime kerak bo'lsa, brauzerdan yangi yuklashni kuzatib qo'shish kerak. */
const KNOWN_FILE_TYPE_IDS: Record<string, string> = {
  "application/pdf": "46e58bdd-d861-44fd-8168-9522719fa999",
};

/**
 * Hozircha bitta da'vo turi (qarzdorlikni majburiy undirish) — /guide/... claim-category
 * endpointi hali to'liq tasdiqlanmagan (SKILL.md 4-qadam), shuning uchun faqat shu ma'lum
 * juftlik ishlatiladi. Boshqa turlar qo'shilganda brauzerdan yangi juftlik kuzatilib qo'shiladi.
 */
export const DEBT_RECOVERY_CLAIM_CATEGORY = {
  categoryId: "bf20b380-d016-4c40-81b7-9f5568741c38",
  subCategoryId: "8d08903e-5e57-428a-971a-9dfa8a67fac8",
} as const;

/** Da'vo arizasi (claim statement) hujjat turi — document-types-list'da barqaror kuzatilgan. */
export const CLAIM_STATEMENT_DOCUMENT_TYPE_ID = "1c4b3a7e-3634-4972-8d32-9acc5e782766";

/**
 * ECONOMIC (iqtisodiy) da'volar uchun tasdiqlangan qo'shimcha hujjat turlari — jonli
 * getDocumentTypes() javobidan olingan (2026-08-08, haqiqiy tenant sessiyasi orqali,
 * hech qanday sud amali bajarilmasdan — faqat guide o'qildi). claim_types massivida
 * "ECONOMIC" bor deb tasdiqlangan.
 */
export const TALABNOMA_DOCUMENT_TYPE_ID = "eb37ed47-d973-40bd-a9cd-a481add9c1ce";
/** Shartnoma/hisob-faktura/TTN/akt-sverka va boshqa dalolat hujjatlari shu turga yuklanadi. */
export const OTHER_DOCUMENTS_TYPE_ID = "616ccb56-4b2f-42ed-8522-7b351d2edb5f";
/** Advokatlik byurosi nomidan topshirilganda — advokatlik orderi. */
export const ADVOCATE_ORDER_DOCUMENT_TYPE_ID = "27c13648-ad08-4d0f-97f7-8049f4969bd0";

/**
 * Hozircha faqat BITTA sud UUID'i qo'lda kiritilgan (foydalanuvchi tomonidan berilgan,
 * 2026-08-03). cabinet.sud.uz'da sudlar ro'yxati/qidiruv endpointi hali tasdiqlanmagan
 * (SKILL.md court-list guide'i yo'q) — determineCourt() faqat hudud NOMINI aniqlaydi,
 * haqiqiy UUID'ga mos kelishini KAFOLATLAMAYDI. Boshqa sud kerak bo'lsa, brauzerdan
 * yangi UUID kuzatib qo'shish kerak (xuddi shu tarzda claim-category kabi).
 */
export const DEFAULT_COURT_ID = "50aa28a9-1983-4db9-a421-9959117de21a";

/**
 * cabinet.sud.uz (E-SUD) — iqtisodiy da'vo topshirish uchun xususiy API klienti.
 * Token — foydalanuvchining jonli sessiya kredensiali (brauzer kengaytmasi
 * cabinet.sud.uz'dagi sessionStorage'dan olib beradi, qarang apps/extension).
 * Hech qachon log'ga yozilmasin, javobda qaytarilmasin.
 */
export class CourtClient {
  constructor(private readonly token: string) {}

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      Accept: "application/json, text/plain, */*",
      Origin: "https://cabinet.sud.uz",
      Referer: "https://cabinet.sud.uz/",
      "X-AUTH-TOKEN": this.token,
      ...extra,
    };
  }

  /** GET /user/entities — foydalanuvchi da'vogar sifatida vakillik qila oladigan shaxs/tashkilotlar. */
  async getEntities(): Promise<CourtEntity[]> {
    const res = await fetch(`${BASE_URL}/user/entities`, { headers: this.headers() });
    if (!res.ok) throw new Error(`getEntities: HTTP ${res.status} — ${await res.text()}`);
    return res.json() as Promise<CourtEntity[]>;
  }

  /** GET /guide/document-types-list — hujjat turlari (case_documents[].type_id manbai). */
  async getDocumentTypes(): Promise<CourtDocumentType[]> {
    const res = await fetch(`${BASE_URL}/guide/document-types-list`, { headers: this.headers() });
    if (!res.ok) throw new Error(`getDocumentTypes: HTTP ${res.status} — ${await res.text()}`);
    return res.json() as Promise<CourtDocumentType[]>;
  }

  /**
   * POST /case/file/upload — metadata HEADER sifatida (file_name/file_size/file_type/mime_type),
   * fayl bytes multipart "file" maydonida. Javobning `.id` (UUID) maydoni ishlatiladi,
   * `.file_id` (32-xonali hex) EMAS — aks holda save-suit'da FK xatosi (case_documents_file_id_fkey).
   */
  async uploadFile(fileBytes: Buffer, fileName: string, mimeType = "application/pdf"): Promise<CourtUploadResult> {
    const fileTypeId = KNOWN_FILE_TYPE_IDS[mimeType];
    if (!fileTypeId) throw new Error(`uploadFile: "${mimeType}" uchun file_type UUID topilmadi (KNOWN_FILE_TYPE_IDS)`);

    const form = new FormData();
    form.append("file", new Blob([fileBytes]), fileName);

    const res = await fetch(`${BASE_URL}/case/file/upload`, {
      method: "POST",
      headers: this.headers({
        file_name: fileName,
        file_size: String(fileBytes.length),
        file_type: fileTypeId,
        mime_type: mimeType,
      }),
      body: form,
    });
    if (!res.ok) throw new Error(`uploadFile: HTTP ${res.status} — ${await res.text()}`);
    return res.json() as Promise<CourtUploadResult>;
  }

  /**
   * POST /guide/generate-invoices — DIQQAT: idempotent EMAS, har chaqiruvda jonli
   * yangi hisob-faktura (davlat boji/pochta) yaratadi. Faqat haqiqatan topshirishdan
   * oldin, bir marta chaqirilsin.
   */
  async generateInvoices(entityId: string, courtId: string, invoices: CourtInvoiceRequest[]): Promise<CourtInvoiceResponse[]> {
    const res = await fetch(`${BASE_URL}/guide/generate-invoices`, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ entity_id: entityId, court_id: courtId, entity_details: {}, invoices }),
    });
    if (!res.ok) throw new Error(`generateInvoices: HTTP ${res.status} — ${await res.text()}`);
    return res.json() as Promise<CourtInvoiceResponse[]>;
  }

  /**
   * POST /case/economic/save-suit — QAYTARIB BO'LMAYDIGAN qadam: real sud ishini ochadi.
   * Chaqirishdan oldin yig'ilgan payload (yoki uning tushunarli xulosasi) foydalanuvchiga
   * ko'rsatilib, aniq tasdiq olinishi SHART.
   */
  async submitSaveSuit(payload: CourtSaveSuitPayload): Promise<CourtSaveSuitResult> {
    const res = await fetch(`${BASE_URL}/case/economic/save-suit`, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`submitSaveSuit: HTTP ${res.status} — ${await res.text()}`);
    return res.json() as Promise<CourtSaveSuitResult>;
  }
}

/** Step 8 — pure data shaping, tarmoq chaqiruvi yo'q. Qarang reference/save-suit-payload.template.json. */
export function buildSaveSuitPayload(args: {
  courtId: string;
  categoryId: string;
  subCategoryId: string;
  claimantEntityId: string;
  defendant: { pinfl?: number; tin: string; not_citizen?: boolean; entity_details: Record<string, unknown> };
  documents: Array<{ fileId: string; typeId: string }>;
  /**
   * O'zimiz SO'RAGAN `amount_type`ni har javob bilan birga saqlaymiz — javobning
   * o'z `receipt.type` maydoniga ISHONMAYMIZ, chunki uning haqiqiy nomi/qiymati
   * tasdiqlanmagan (jonli sinovda "Квитанция" тўлов тури хато" bilan rad etildi,
   * 2026-08-03 — sabab: noto'g'ri/mavjud bo'lmagan maydon nomi tufayli `type`
   * `undefined` bo'lib, JSON.stringify uni tushirib qoldirgan edi).
   */
  invoices: Array<{ type: "STATE" | "POST"; response: CourtInvoiceResponse }>;
  claimAmount: { amount: string; forfeit: string; currency_id: "UZS" };
  claimAmountParts: Array<{ amount: string; amount_type: string }>;
  stateDutyAmount: number;
}): CourtSaveSuitPayload {
  return {
    case: { doc_date: new Date().toISOString(), doc_number: "1", court_id: args.courtId, duty_reason_id: null },
    claim_categories: [
      { category_id: args.categoryId, sub_category_id: args.subCategoryId, second_category_id: null, fields_data: {}, is_main: true },
    ],
    receipts: args.invoices.map(({ type, response: inv }) => ({
      responseModel: null,
      receipt: {
        currency_id: "UZS" as const,
        type,
        receipt_date: new Date(inv.receipt.issued).toISOString(),
        receipt_number: inv.receipt.number,
        total: inv.receipt.amount,
        is_generated: true as const,
      },
      receipt_response: inv.receipt,
      right_hash: inv.right_hash,
    })),
    case_documents: args.documents.map((d) => ({ file_id: d.fileId, type_id: d.typeId })),
    case_participants: [
      {
        entity: { id: args.claimantEntityId },
        participant: { type: "CLAIMANT", is_main: true, is_appellant: false },
        entity_details: { is_small_business: true },
      },
      {
        entity: { pinfl: args.defendant.pinfl ?? 0, tin: args.defendant.tin, not_citizen: args.defendant.not_citizen ?? true },
        participant: { type: "DEFENDANT", is_main: true, is_appellant: false },
        entity_details: args.defendant.entity_details,
      },
    ],
    claim_amounts_with_parts: [{ claim_amount: args.claimAmount, claim_amount_parts: args.claimAmountParts }],
    claim: { claim_kind: "SUIT" },
    case_details: { state_duty_amount: args.stateDutyAmount },
    utility_accounts: {},
  };
}
