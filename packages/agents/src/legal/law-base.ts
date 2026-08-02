/**
 * QONUN BAZASI (RAG) — lex.uz rasmiy manbasidan olingan ANIQ modda matnlari.
 * Ma'lumot `law-data.json`da (lex.uz'дан to'liq olingan). Generatsiya va tahlil
 * shu moddalarга tayanib ANIQ havola beradi (o'ylab topmasдан).
 * Ketma-ket kengaytiriladi (Fuqarolik 2-qism, IPK, Mehnat kodeksi, Oliy sud plenumi...).
 */
import lawDataRaw from "./law-data.json";

export interface LawArticle {
  code: string;
  n: number | string; // modda raqami (son) yoki Plenum band kaliti ("163-4")
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
  PLENUM: "O'zbekiston Respublikasi Oliy sudi Plenumi qarori",
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
// O'zbek KIRILL → LOTIN transliteratsiyasi (kirill/lotin matnlarni bir fazoда
// solishtirish uchun — so'rov qaysi alifboда bo'lsa ham moddага mos tushadi).
const CYR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "",
  э: "e", ю: "yu", я: "ya", ў: "o", қ: "q", ғ: "g", ҳ: "h",
};
function translit(s: string): string {
  let out = "";
  for (const ch of s) out += ch in CYR ? CYR[ch] : ch;
  return out;
}
/** O'zbek matnini normallaydi (kirill→lotin, oʻ→o, gʻ→g, apostroflar) — mos tushishi uchun. */
export function normUz(s: string): string {
  return translit(s.toLowerCase())
    .replace(/[ʻʼ'`']/g, "")
    .replace(/oʻ|o'/g, "o")
    .replace(/gʻ|g'/g, "g");
}
const norm = normUz;
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

// Original kod+raqam bo'yicha modda qidirish (anchor uchun).
const BY_KEY = new Map<string, LawArticle>();
LAW_BASE.forEach((a, i) => BY_KEY.set(`${RAW[i]!.code}:${a.n}`, a));

/**
 * KANONIK (anchor) moddalar — real yuristlar hujjat turiga qarab HAR DOIM
 * keltiradigan asosiy moddalar. Kalit-so'z retrieval ularni bosib qo'ymasin
 * (masalan "tovar yetkazib berish" davlat-ehtiyoj moddalarini chiqarib, asl
 * qarz-undiruv moddalarini yo'qotmasin). Hujjat mavzusi so'rovдan aniqlanadi.
 */
const ANCHORS: { re: RegExp; refs: [string, number][] }[] = [
  {
    // Qarz/penya undirish (da'vo arizasi, talabnoma, pretenziya)
    re: /qarz|penya|neustoyka|to.?lov|undir|talabnoma|pretenz|debitor|qarzdorlik|majburiyatni bajarma/i,
    refs: [
      ["FK-1", 236], // Majburiyatlar lozim darajada bajarilishi
      ["FK-1", 237], // Bir tomonlama bosh tortishga yo'l qo'yilmaydi
      ["FK-1", 324], // Qarzdorning zararni to'lash majburiyati
      ["FK-1", 327], // Pul majburiyatini bajarmaganlik uchun javobgarlik
      ["XSHB", 24], // Shartnomani bajarmaganlik uchun javobgarlik
      ["XSHB", 25], // Yetkazib berish/to'lov muddatini kechiktirish jarimasi
    ],
  },
  {
    // Ijro / xatlov (MIB shikoyati, ijro varaqasi)
    re: /\bijro\b|xatlov|xatlab|majburiy ijro|ijrochi|hisobvaraq|ijro varaqa/i,
    refs: [["IJRO", 47]], // Undiruvni pul mablag'lari va mol-mulkka qaratish
  },
];
export function anchorArticles(query: string): LawArticle[] {
  const out: LawArticle[] = [];
  const seen = new Set<string>();
  for (const a of ANCHORS) {
    if (!a.re.test(query)) continue;
    for (const [code, n] of a.refs) {
      const key = `${code}:${n}`;
      const art = BY_KEY.get(key);
      if (art && !seen.has(key)) {
        seen.add(key);
        out.push(art);
      }
    }
  }
  return out;
}

// Ichki skorlash (BM25-lite: tf-idf + sarlavha ustuvorligi + soha-kodeks boost).
function scoreAll(query: string): { a: LawArticle; score: number; codeKey: string }[] {
  const qTerms = [...new Set(tokenize(query).map(stem))];
  if (qTerms.length === 0) return [];
  const boostCodes = domainCodes(query);
  return LAW_BASE.map((a, i) => {
    const d = DOC_TOKENS[i]!;
    let score = 0;
    for (const w of qTerms) {
      const tf = d.text.filter((t) => t === w).length;
      if (tf > 0) score += idf(w) * (tf / (tf + 1.5));
      if (d.title.has(w)) score += idf(w) * 2.5;
    }
    if (score > 0 && boostCodes.has(d.codeKey)) score *= 1.6;
    return { a, score, codeKey: d.codeKey };
  })
    .filter((s) => s.score > 0)
    .sort((x, y) => y.score - x.score);
}

/** So'rovga eng mos MODDALARни topadi (Plenum qarorlari alohida — bu yerда emas). */
export function retrieveLawContext(query: string, limit = 5): LawArticle[] {
  return scoreAll(query)
    .filter((s) => s.codeKey !== "PLENUM")
    .slice(0, limit)
    .map((s) => s.a);
}

/** So'rovga eng mos Oliy sud PLENUMI qarori bandlarини topadi (sud amaliyoti). */
export function retrievePlenum(query: string, limit = 2): LawArticle[] {
  return scoreAll(query)
    .filter((s) => s.codeKey === "PLENUM")
    .slice(0, limit)
    .map((s) => s.a);
}

/** Topilган moddalar + sud amaliyotini prompt uchun matnға aylantiradi (ANIQ havola bilan). */
export function lawContextText(query: string): string {
  const anchors = anchorArticles(query);
  const anchorKeys = new Set(anchors.map((a) => `${a.code}:${a.n}`));
  // Retrieval'дан anchor'lar takrorланmasin; qolganini to'ldiramiz.
  const extra = retrieveLawContext(query, 6).filter((a) => !anchorKeys.has(`${a.code}:${a.n}`)).slice(0, 4);
  const plenum = retrievePlenum(query, 2);
  if (!anchors.length && !extra.length && !plenum.length) return "";
  const fmtArt = (a: LawArticle) => `- ${a.code}, ${a.n}-modda (${a.title}): ${a.text.slice(0, 700)}`;
  const fmtPle = (a: LawArticle) => `- ${a.title}: ${a.text.slice(0, 650)}`;
  let out = "\n\nRASMIY MODDA BAZASI (lex.uz). Hujjat/tahlilда FAQAT quyidagi moddalarга aniq raqam bilan havola qil; ro'yxatда yo'q modda RAQAMINI umuman yozma (o'ylab topsang — hujjat sudда rad etiladi):";
  if (anchors.length) {
    out += `\n\n★ ASOSIY MODDALAR (bu tur hujjatда ODATDA shular keltiriladi — "Qonuniy asoslar" bo'limида avvalо shulardan foydalan):\n${anchors.map(fmtArt).join("\n")}`;
  }
  if (extra.length) {
    out += `\n\nQO'SHIMCHA MOS MODDALAR (agar ishga aloqador bo'lsa):\n${extra.map(fmtArt).join("\n")}`;
  }
  if (plenum.length) {
    out += `\n\nSUD AMALIYOTI — Oliy sud Plenumi qarorlari. Hujjatning "Qonuniy asoslar" bo'limида modda iqtiboslaridan KEYIN quyidagi tegishli Plenum bandiga ham havola qil (real sud hujjatlari shunday — huquqiy asosni kuchaytiradi), masalan "O'zbekiston Respublikasi Oliy sudi Plenumining [son]-sonli qarori [band]-bandiga muvofiq, ...":\n${plenum.map(fmtPle).join("\n")}`;
  }
  return out;
}
