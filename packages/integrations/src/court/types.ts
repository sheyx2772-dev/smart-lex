/**
 * cabinet.sud.uz (E-SUD) — jonli brauzer network capture orqali reverse-engineering
 * qilingan xususiy REST API. Rasmiy hujjat yo'q — har bir shakl "kuzatilgan", "spec"
 * emas. Qarang: ~/.claude/skills/sud-uz-economic-suit/SKILL.md.
 */

export interface CourtEntity {
  entity_id: string;
  name: string;
  entity_type: "PERSON" | "ORGANIZATION";
  tin?: string;
  [k: string]: unknown;
}

export interface CourtDocumentType {
  id: string;
  name_uz?: string;
  name_ru?: string;
  claim_types?: string[];
  [k: string]: unknown;
}

export interface CourtUploadResult {
  /** Haqiqiy UUID — case_documents[].file_id SHU maydonni ishlatishi SHART. */
  id: string;
  /** 32-belgili hex (UUID EMAS) — save-suit payload'da ishlatilmaydi. */
  file_id: string;
  [k: string]: unknown;
}

export interface CourtInvoiceRequest {
  amount_type: "STATE" | "POST";
  amount: number;
}

export interface CourtInvoiceResponse {
  receipt: {
    type: string;
    issued: number | string;
    number: string;
    amount: number;
    [k: string]: unknown;
  };
  right_hash: string;
  [k: string]: unknown;
}

/** case_participants[1] (DEFENDANT) uchun to'liq reyestr ma'lumoti. */
export interface CourtDefendantDetails {
  pinfl?: number;
  tin: string;
  not_citizen?: boolean;
  entity_details: Record<string, unknown>;
}

export interface CourtSaveSuitPayload {
  case: { doc_date: string; doc_number: string; court_id: string; duty_reason_id: null };
  claim_categories: Array<{
    category_id: string;
    sub_category_id: string;
    second_category_id: null;
    fields_data: Record<string, never>;
    is_main: true;
  }>;
  receipts: Array<{
    responseModel: null;
    receipt: {
      currency_id: "UZS";
      type: string;
      receipt_date: string;
      receipt_number: string;
      total: number;
      is_generated: true;
    };
    receipt_response: unknown;
    right_hash: string;
  }>;
  case_documents: Array<{ file_id: string; type_id: string }>;
  case_participants: [
    { entity: { id: string }; participant: { type: "CLAIMANT"; is_main: true; is_appellant: false }; entity_details: { is_small_business: true } },
    { entity: { pinfl: number; tin: string; not_citizen: boolean }; participant: { type: "DEFENDANT"; is_main: true; is_appellant: false }; entity_details: Record<string, unknown> },
  ];
  claim_amounts_with_parts: Array<{
    claim_amount: { amount: string; forfeit: string; currency_id: "UZS" };
    claim_amount_parts: Array<{ amount: string; amount_type: string }>;
  }>;
  claim: { claim_kind: "SUIT" };
  case_details: { state_duty_amount: number };
  utility_accounts: Record<string, never>;
}

export interface CourtSaveSuitResult {
  case_id: string;
  is_single_window: boolean;
  [k: string]: unknown;
}
