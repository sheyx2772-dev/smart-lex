import { inflateRawSync } from "node:zlib";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { getModel } from "../llm";

/** .docx (ZIP) ichidagi word/document.xml ni Node zlib bilan ochib, matn qaytaradi. */
function docxToText(buf: Buffer): string {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65536); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("docx: ZIP emas");
  const cdCount = buf.readUInt16LE(eocd + 10);
  const cdOff = buf.readUInt32LE(eocd + 16);
  let target: { method: number; compSize: number; localOff: number } | null = null;
  let p = cdOff;
  for (let n = 0; n < cdCount && p + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    if (name === "word/document.xml") {
      target = { method, compSize, localOff };
      break;
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  if (!target) throw new Error("docx: document.xml topilmadi");
  const lo = target.localOff;
  if (buf.readUInt32LE(lo) !== 0x04034b50) throw new Error("docx: lokal sarlavha xato");
  const dataStart = lo + 30 + buf.readUInt16LE(lo + 26) + buf.readUInt16LE(lo + 28);
  const comp = buf.subarray(dataStart, dataStart + target.compSize);
  const xml = (target.method === 0 ? comp : inflateRawSync(comp)).toString("utf8");
  return xml
    .replace(/<w:tab\b[^>]*\/?>/g, "\t")
    .replace(/<w:br\b[^>]*\/?>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * HUJJAT/RASMDAN MATN AJRATISH — .docx Node zlib bilan (kalitsiz), PDF va rasmlar
 * (jpg/png/webp) esa Gemini multimodal modeli bilan. Yuridik hujjatlar ko'pincha
 * skan/rasm, PDF yoki Word — foydalanuvchi chatga biriktirsa, matni AI kontekstiga
 * tushadi. PDF/rasm uchun kalit yo'q bo'lsa bo'sh string qaytadi.
 */
export async function extractDocumentText(opts: { dataBase64: string; mimeType: string }): Promise<string> {
  const mt = opts.mimeType.toLowerCase();
  if (mt.includes("wordprocessingml") || mt.includes("officedocument.word") || mt.endsWith("/docx")) {
    try {
      return docxToText(Buffer.from(opts.dataBase64, "base64"));
    } catch {
      return "";
    }
  }
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) return "";
  const model = google(process.env.GEMINI_MODEL ?? "gemini-2.0-flash");
  const isPdf = /pdf/i.test(opts.mimeType);
  const instruction =
    "Ushbu hujjat yoki rasmdagi BARCHA matnni to'liq, asl tartibida ajratib chiqar. " +
    "Faqat matnning o'zini ber — hech qanday izoh, sarlavha yoki tushuntirish qo'shma. " +
    "Jadvallarni tushunarli matn ko'rinishida saqla. Matn o'zbek, rus yoki ingliz tilida bo'lishi mumkin.";
  const filePart = isPdf
    ? ({ type: "file", data: opts.dataBase64, mimeType: opts.mimeType } as const)
    : ({ type: "image", image: `data:${opts.mimeType || "image/png"};base64,${opts.dataBase64}` } as const);
  const { text } = await generateText({
    model,
    messages: [{ role: "user", content: [{ type: "text", text: instruction }, filePart] }],
  });
  return (text ?? "").trim();
}

export interface ContractFieldGuess {
  contractorName: string | null;
  contractorTin: string | null;
  contractorPhone: string | null;
  contractorAddress: string | null;
  contractorEmail: string | null;
  contractNumber: string | null;
  contractSignedAt: string | null; // YYYY-MM-DD
  penaltyDailyBps: number | null;
  invoiceNumber: string | null;
  invoiceAmountMinor: string | null; // tiyin (faqat raqamlar) — koddan ×100 hisoblanadi, LLM'dan emas
  invoiceIssuedAt: string | null;
  invoiceDueDate: string | null;
}

const EMPTY_GUESS: ContractFieldGuess = {
  contractorName: null,
  contractorTin: null,
  contractorPhone: null,
  contractorAddress: null,
  contractorEmail: null,
  contractNumber: null,
  contractSignedAt: null,
  penaltyDailyBps: null,
  invoiceNumber: null,
  invoiceAmountMinor: null,
  invoiceIssuedAt: null,
  invoiceDueDate: null,
};

function extractJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const asStr = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const asDigits = (v: unknown): string | null => {
  const s = typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
  const d = s.replace(/\D/g, "");
  return d || null;
};
const asIsoDate = (v: unknown): string | null => {
  const s = asStr(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};
const asNumber = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * OCR qilingan (extractDocumentText) matndan shartnoma/hisob-faktura maydonlarini
 * AI orqali "taxmin qiladi" — forma to'ldirish o'rniga inson faqat TEKSHIRIB tasdiqlaydi.
 * HECH QACHON topilmagan maydonni o'ylab topmaydi (noaniq bo'lsa null). Pul hisob-kitobi
 * (so'm→tiyin, foiz→bps) LLM'ga ISHONILMAYDI — LLM faqat matndagi XOM sonlarni topadi,
 * ko'paytirish/konvertatsiya shu yerda deterministik amalga oshadi.
 */
export async function extractContractFields(text: string): Promise<ContractFieldGuess> {
  const model = getModel();
  if (!model || !text.trim()) return EMPTY_GUESS;

  const prompt = [
    "Quyidagi shartnoma/hisob-faktura matnidan maydonlarni top va FAQAT JSON qaytar (izohsiz, kod bloksiz):",
    "{",
    '  "contractorName": string|null,        // qarzdor/kontragent tashkilot nomi',
    '  "contractorTin": string|null,          // STIR (9 xonali raqam)',
    '  "contractorPhone": string|null,',
    '  "contractorAddress": string|null,',
    '  "contractorEmail": string|null,',
    '  "contractNumber": string|null,         // shartnoma raqami',
    '  "contractSignedAt": string|null,       // shartnoma sanasi, YYYY-MM-DD',
    '  "penaltyDailyPercent": number|null,    // kunlik penya, matnda YOZILGANIDEK foiz (masalan 0.1)',
    '  "invoiceNumber": string|null,          // hisob-faktura raqami',
    '  "invoiceAmountSom": number|null,       // summa, matnda YOZILGANIDEK SO\'MDA (tiyinga o\'girmang)',
    '  "invoiceIssuedAt": string|null,        // hisob-faktura sanasi, YYYY-MM-DD',
    '  "invoiceDueDate": string|null          // to\'lov muddati, YYYY-MM-DD',
    "}",
    "Aniq bo'lmagan yoki matnda umuman topilmagan maydonni HECH QACHON o'ylab topma — null qo'y. Hech qanday hisob-kitob qilma, faqat matnda yozilgan sonlarni ber.",
    "",
    "MATN:",
    text.slice(0, 12000),
  ].join("\n");

  try {
    const { text: raw } = await generateText({ model, temperature: 0, prompt });
    const j = extractJson(raw);
    if (!j) return EMPTY_GUESS;

    const amountSom = asNumber(j.invoiceAmountSom);
    const penaltyPercent = asNumber(j.penaltyDailyPercent);

    return {
      contractorName: asStr(j.contractorName),
      contractorTin: asDigits(j.contractorTin),
      contractorPhone: asStr(j.contractorPhone),
      contractorAddress: asStr(j.contractorAddress),
      contractorEmail: asStr(j.contractorEmail),
      contractNumber: asStr(j.contractNumber),
      contractSignedAt: asIsoDate(j.contractSignedAt),
      penaltyDailyBps: penaltyPercent != null && penaltyPercent >= 0 ? Math.round(penaltyPercent * 100) : null,
      invoiceNumber: asStr(j.invoiceNumber),
      invoiceAmountMinor: amountSom != null && amountSom >= 0 ? String(Math.round(amountSom * 100)) : null,
      invoiceIssuedAt: asIsoDate(j.invoiceIssuedAt),
      invoiceDueDate: asIsoDate(j.invoiceDueDate),
    };
  } catch {
    return EMPTY_GUESS;
  }
}
