/**
 * Chatga biriktirilgan fayldan MATN ajratish (universal).
 * - txt/md/csv/html/rtf — brauzerда (tez, serverга yubormay);
 * - docx/pdf/rasm — serverга (base64) → /api/studio/extract (Node docx / Gemini vision).
 * Ikkала AI chat (hujjat tayyorlash va agent) shu funksiyani ishlatadi.
 */

function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\b[^>]*>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
function rtfToText(rtf: string): string {
  return rtf
    .replace(/\\par[d]?\b/g, "\n")
    .replace(/\\'[0-9a-fA-F]{2}/g, " ")
    .replace(/\\[a-zA-Z]+-?\d*\s?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
export async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}
async function extractViaServer(file: File): Promise<string> {
  const data = await fileToBase64(file);
  const lower = file.name.toLowerCase();
  const mimeType =
    file.type ||
    (lower.endsWith(".pdf") ? "application/pdf" : lower.endsWith(".docx") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/octet-stream");
  const res = await fetch("/api/studio/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data, mimeType }),
  });
  if (!res.ok) throw new Error("extract");
  const j = (await res.json()) as { data?: { text?: string } };
  return String(j?.data?.text ?? "").trim();
}

/** Fayldan tekis matn. docx/pdf/rasm — serverда; txt/html/rtf — brauzerда. */
export async function extractFileText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const mime = file.type || "";
  const server =
    mime === "application/pdf" ||
    name.endsWith(".pdf") ||
    mime.startsWith("image/") ||
    /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/.test(name) ||
    mime.includes("wordprocessingml") ||
    name.endsWith(".docx");
  if (server) return extractViaServer(file);
  const raw = await file.text();
  if (name.endsWith(".html") || name.endsWith(".htm")) return htmlToText(raw);
  if (name.endsWith(".rtf")) return rtfToText(raw);
  return raw; // txt, md, csv, ...
}

export const MAX_ATTACH_BYTES = 8 * 1024 * 1024;
