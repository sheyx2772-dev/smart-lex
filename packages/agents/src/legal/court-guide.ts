/**
 * AMALIY QO'LLANMA (RAG) — "Iqtisodiy sudlarga murojaat qilish tartibi"
 * (Q.Komilov, M.Ergashev, Toshkent–2018, 232 bet) kitobidan olingan sud-jarayon
 * BILIMLARI: da'vo arizasini yozish, ilovalar, davlat bojini hisoblash, topshirish,
 * rad etish/qaytarish asoslari, ijro, apellyatsiya/kassatsiya muddatlari va h.k.
 *
 * Aniq MODDA iqtiboslaridan (law-base) FARQLI: bu — PROTSEDURA/USUL bilimi.
 * Alohida retriever bilan qidiriladi va promptga alohida blok sifatida qo'shiladi
 * (modda iqtiboslarини siqib chiqarmasligi uchun). Matn kirillда — normUz
 * transliteratsiyasi tufayli lotin so'rov ham mos tushadi.
 */
import guideRaw from "./guide-data.json";
import { normUz } from "./law-base";

interface GuideChunk {
  code: string;
  n: string;
  title: string;
  text: string;
}
const GUIDE = guideRaw as GuideChunk[];

const STOP = new Set([
  "uchun", "yoki", "ular", "ushbu", "bilan", "kerak", "shart", "haqida", "togrisida", "hamda", "boyicha",
  "hisoblanadi", "mumkin", "boladi", "qilish", "qilinadi", "orqali", "hollarda", "asosida", "tomonidan", "lozim",
]);
function tokenize(s: string): string[] {
  return (normUz(s).match(/[\p{L}\p{N}]{4,}/gu) ?? []).filter((w) => !STOP.has(w));
}
function stem(w: string): string {
  return w.replace(/(larining|lariga|lardan|larida|siga|sidan|sining|ning|larni|lari|ini|iga|dan|dagi|ni|ga|da|si|lar)$/g, "");
}

// IDF (bir marta).
const DF = new Map<string, number>();
for (const g of GUIDE) {
  const seen = new Set(tokenize(g.title + " " + g.text).map(stem));
  for (const w of seen) DF.set(w, (DF.get(w) ?? 0) + 1);
}
const N = GUIDE.length;
const idf = (w: string) => Math.log(1 + N / (1 + (DF.get(w) ?? 0)));
const DOC = GUIDE.map((g) => ({ title: new Set(tokenize(g.title).map(stem)), text: tokenize(g.text).map(stem) }));

/** So'rovга eng mos qo'llanma bo'laklarini topadi (BM25-lite). */
export function retrieveGuide(query: string, limit = 2): GuideChunk[] {
  const qTerms = [...new Set(tokenize(query).map(stem))];
  if (qTerms.length === 0) return [];
  const scored = GUIDE.map((g, i) => {
    const d = DOC[i]!;
    let score = 0;
    for (const w of qTerms) {
      const tf = d.text.filter((t) => t === w).length;
      if (tf > 0) score += idf(w) * (tf / (tf + 1.8)); // uzun bo'laklar uchun tf-to'yinish
      if (d.title.has(w)) score += idf(w) * 2;
    }
    return { g, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map((s) => s.g);
}

// Faqat sud-jarayon mavzusida qo'llanmани chaqiramiz (har so'rovда emas).
const COURT_TOPIC =
  /sud|da.?vo|даъво|суд|ariza|ариза|talab|shikoyat|шикоят|apellyat|апелляц|kassatsiya|кассац|ijro|ижро|xatlov|davlat boji|давлат бож|buyruq|буйруқ|nizolar|низо|protsess|процесс|jarayon|жараён|undir|ундир|pretenz|претенз|hakam|ҳакам|bankrot|банкрот/i;

/** Topilган qo'llanma bo'laklarini prompt uchun matnга aylantiradi. */
export function guideContextText(query: string): string {
  if (!COURT_TOPIC.test(query)) return "";
  const chunks = retrieveGuide(query);
  if (!chunks.length) return "";
  const body = chunks.map((c) => `- [${c.title}]: ${c.text.slice(0, 900)}`).join("\n");
  return `\n\nSUD-JARAYON AMALIY QO'LLANMASI (Iqtisodiy sudlarga murojaat qilish tartibi — 2018). Hujjat tuzish/tahlil tartibiда shu amaliy qoidalarга amal qil:\n${body}`;
}
