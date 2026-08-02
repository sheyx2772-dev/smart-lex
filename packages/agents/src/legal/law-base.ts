/**
 * QONUN BAZASI (RAG) — lex.uz rasmiy manbasidan olingan ANIQ modda matnlari.
 * Ma'lumot `law-data.json`da (lex.uz'дан to'liq olingan). Generatsiya va tahlil
 * shu moddalarга tayanib ANIQ havola beradi (o'ylab topmasдан).
 * Ketma-ket kengaytiriladi (Fuqarolik 2-qism, IPK, Mehnat kodeksi, Oliy sud plenumi...).
 */
import lawDataRaw from "./law-data.json";

export interface LawArticle {
  code: string;
  n: number;
  title: string;
  text: string;
}

// Qisqartma → to'liq kodeks nomi.
const CODE_NAMES: Record<string, string> = {
  "FK-1": "O'zbekiston Respublikasi Fuqarolik kodeksi (1-qism)",
  "FK-2": "O'zbekiston Respublikasi Fuqarolik kodeksi (2-qism)",
  IPK: "O'zbekiston Respublikasi Iqtisodiy protsessual kodeksi",
  MK: "O'zbekiston Respublikasi Mehnat kodeksi",
  SK: "O'zbekiston Respublikasi Soliq kodeksi",
};

export const LAW_BASE: LawArticle[] = (lawDataRaw as { code: string; n: number; title: string; text: string }[]).map((a) => ({
  code: CODE_NAMES[a.code] ?? a.code,
  n: a.n,
  title: a.title,
  text: a.text,
}));

const STOP = new Set(["uchun", "yoki", "ular", "ushbu", "bilan", "boʻlsa", "bolsa", "kerak", "shart", "haqida", "toʻgʻrisida", "togrisida", "hamda", "boʻyicha", "hisoblanadi", "mumkin", "nazarda", "tutilgan"]);
function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []).filter((w) => !STOP.has(w));
}

/** So'rovga eng mos moddalarни topadi (kalit-so'z ustma-ust; keyinchalik embedding). */
export function retrieveLawContext(query: string, limit = 5): LawArticle[] {
  const q = new Set(tokenize(query));
  if (q.size === 0) return [];
  const scored = LAW_BASE.map((a) => {
    let score = 0;
    for (const w of tokenize(a.text)) if (q.has(w)) score++;
    for (const w of tokenize(a.title)) if (q.has(w)) score += 3; // sarlavha muhimroq
    return { a, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map((s) => s.a);
}

/** Topilган moddalarни prompt uchun matnға aylantiradi (ANIQ havola bilan). */
export function lawContextText(query: string): string {
  const arts = retrieveLawContext(query);
  if (!arts.length) return "";
  const body = arts.map((a) => `- ${a.code}, ${a.n}-modda (${a.title}): ${a.text}`).join("\n");
  return `\n\nTOPILGAN ANIQ MODDALAR (rasmiy baza — lex.uz). Hujjat/tahlilда FAQAT shu moddalarга aniq raqam bilan havola qil; boshqa modda raqamini O'YLAB TOPMA:\n${body}`;
}
