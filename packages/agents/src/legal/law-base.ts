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
  FPK: "O'zbekiston Respublikasi Fuqarolik protsessual kodeksi",
  MK: "O'zbekiston Respublikasi Mehnat kodeksi",
  SK: "O'zbekiston Respublikasi Soliq kodeksi",
  XSHB: "O'zbekiston Respublikasining «Xo'jalik yurituvchi subyektlar faoliyatining shartnomaviy-huquqiy bazasi to'g'risida»gi Qonuni",
  IJRO: "O'zbekiston Respublikasining «Sud hujjatlari va boshqa organlar hujjatlarini ijro etish to'g'risida»gi Qonuni",
};

export const LAW_BASE: LawArticle[] = (lawDataRaw as { code: string; n: number; title: string; text: string }[]).map((a) => ({
  code: CODE_NAMES[a.code] ?? a.code,
  n: a.n,
  title: a.title,
  text: a.text,
}));

const STOP = new Set([
  "uchun", "yoki", "ular", "ushbu", "bilan", "bolsa", "kerak", "shart", "haqida", "togrisida", "hamda", "boyicha", "hisoblanadi",
  "mumkin", "nazarda", "tutilgan", "boladi", "qilish", "qilinadi", "boyича", "boлган", "orqali", "hollarda", "asosida", "tomonidan",
]);
/** O'zbek matnini normallaydi (oʻ→o, gʻ→g, apostroflar olib tashlanadi) — mos tushishi uchun. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ʻʼ'`']/g, "")
    .replace(/oʻ|o'/g, "o")
    .replace(/gʻ|g'/g, "g")
    .replace(/[şsh]/g, "sh");
}
function tokenize(s: string): string[] {
  return (norm(s).match(/[\p{L}\p{N}]{4,}/gu) ?? []).filter((w) => !STOP.has(w));
}
// Poyasini olish (o'zbek qo'shimchalarини qisqartirish) — "shartnomasi"≈"shartnoma".
function stem(w: string): string {
  return w.replace(/(larining|lariga|lardan|larida|siga|sidan|sining|ning|larni|lari|ini|iga|dan|dagi|ni|ga|da|si|lar)$/g, "");
}

// IDF (bir marта hisoblanadi) — kam uchraydigan so'z og'irroq.
const DF = new Map<string, number>();
for (const a of LAW_BASE) {
  const seen = new Set(tokenize(a.title + " " + a.text).map(stem));
  for (const w of seen) DF.set(w, (DF.get(w) ?? 0) + 1);
}
const N = LAW_BASE.length;
const idf = (w: string) => Math.log(1 + N / (1 + (DF.get(w) ?? 0)));

// Har modda uchun tokenlarni + kodeks-kalitini oldindan tayyorlaymiz.
const RAW = lawDataRaw as { code: string; n: number; title: string; text: string }[];
const DOC_TOKENS: { title: Set<string>; text: string[]; codeKey: string }[] = LAW_BASE.map((a, i) => ({
  title: new Set(tokenize(a.title).map(stem)),
  text: tokenize(a.text).map(stem),
  codeKey: RAW[i]!.code,
}));

// Soha aniqlash — so'rov mavzusiga qarab mos kodeksni kuchaytiramiz.
const DOMAINS: { re: RegExp; codes: string[] }[] = [
  { re: /shartnoma|ijara|sotib|sotish|xarid|qarz|majburiyat|penya|neustoyka|zarar|mulk|meros|garov|renta|pudrat|kelishuv|hadya|omonat/i, codes: ["FK-1", "FK-2"] },
  { re: /shartnoma|qarz|penya|neustoyka|yetkazib ber|talabnoma|pretenz|xo.?jalik shartnoma|tovar|jarima|majburiyatni bajarma/i, codes: ["XSHB"] },
  { re: /ijro|xatlov|xatlab|undiruv|majburiy ijro|ijrochi|hisobvaraq|mol-mulk|ijro varaqa|ijro hujjat|MIB|byuro/i, codes: ["IJRO"] },
  { re: /sud|da.?vo|apellyatsiya|kassatsiya|nazorat|arbitraj|hakam|ijro varaqa|xarajat|isbot|dalil/i, codes: ["IPK", "FPK"] },
  { re: /iqtisodiy|tadbirkor|xo.?jalik|korxona/i, codes: ["IPK"] },
  { re: /\bish\b|\bishga\b|\bishdan\b|xodim|mehnat|ta.?til|maosh|ish haqi|bo.?shatish|lavozim|\bshtat\b|intizom|smena|ish vaqti|nafaqa/i, codes: ["MK"] },
  { re: /soliq|qqs|qo.?shilgan qiymat|aksiz|foyda solig|davlat boji|deklaratsiya/i, codes: ["SK", "IPK"] },
];
function domainCodes(query: string): Set<string> {
  const out = new Set<string>();
  for (const d of DOMAINS) if (d.re.test(query)) d.codes.forEach((c) => out.add(c));
  return out;
}

/** So'rovga eng mos moddalarни topadi (BM25-lite: tf-idf + sarlavha ustuvorligi). */
export function retrieveLawContext(query: string, limit = 5): LawArticle[] {
  const qTerms = [...new Set(tokenize(query).map(stem))];
  if (qTerms.length === 0) return [];
  const boostCodes = domainCodes(query); // so'rov mavzusiga mos kodekslar
  const scored = LAW_BASE.map((a, i) => {
    const d = DOC_TOKENS[i]!;
    let score = 0;
    for (const w of qTerms) {
      const tf = d.text.filter((t) => t === w).length;
      if (tf > 0) score += idf(w) * (tf / (tf + 1.5));
      if (d.title.has(w)) score += idf(w) * 2.5; // sarlavhada bo'lsa kuchli signal
    }
    if (score > 0 && boostCodes.has(d.codeKey)) score *= 1.6; // mos kodeksни kuchaytiramiz
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
