import { inflateRawSync } from "node:zlib";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";

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
