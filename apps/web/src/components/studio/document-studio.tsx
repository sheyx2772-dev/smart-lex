"use client";

import {
  ArrowRight,
  Briefcase,
  ArrowCounterClockwise,
  CaretDown,
  CircleNotch,
  ClipboardText,
  ClockCounterClockwise,
  Coins,
  DownloadSimple,
  Envelope,
  FileDoc,
  FileHtml,
  FilePdf,
  FileDashed,
  Gavel,
  Hammer,
  Handshake,
  House,
  type Icon,
  IdentificationCard,
  MagicWand,
  MagnifyingGlass,
  Megaphone,
  Plus,
  Prohibit,
  Receipt,
  Scroll,
  ShieldCheck,
  ShieldWarning,
  Sparkle,
  SquaresFour,
  X,
  Truck,
  UploadSimple,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react";
import type { Editor } from "@tiptap/react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { RichEditor } from "@/components/ui/rich-editor";
import { cn } from "@/lib/utils";

interface AiMsg {
  role: "user" | "ai";
  text: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function toHtml(text: string): string {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p>${escapeHtml(l)}</p>`)
    .join("");
}
function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Fayl yuklab tahlil: matn ajratish (dependency'siz) ──
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}
/** Word document.xml → tekis matn (paragraf/tab/tab bo'linishlarini saqlaydi). */
function docxXmlToText(xml: string): string {
  const body = xml.replace(/^[\s\S]*?<w:body\b[^>]*>/, "").replace(/<\/w:body>[\s\S]*$/, "");
  return decodeEntities(
    body
      .replace(/<w:tab\b[^>]*\/?>/g, "\t")
      .replace(/<w:br\b[^>]*\/?>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
/** .docx (ZIP) ichidan word/document.xml ni topib, deflate-raw bilan ochadi. */
async function extractDocx(buf: ArrayBuffer): Promise<string> {
  const dv = new DataView(buf);
  const bytes = new Uint8Array(buf);
  const td = new TextDecoder();
  // EOCD (End Of Central Directory) ni oxiridan qidiramiz.
  let eocd = -1;
  const min = Math.max(0, buf.byteLength - 22 - 65536);
  for (let i = buf.byteLength - 22; i >= min; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("docx: ZIP emas");
  const cdCount = dv.getUint16(eocd + 10, true);
  const cdOff = dv.getUint32(eocd + 16, true);
  let target: { method: number; compSize: number; localOff: number } | null = null;
  let p = cdOff;
  for (let n = 0; n < cdCount && p + 46 <= buf.byteLength; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOff = dv.getUint32(p + 42, true);
    const name = td.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    if (name === "word/document.xml") {
      target = { method, compSize, localOff };
      break;
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  if (!target) throw new Error("docx: document.xml topilmadi");
  const lo = target.localOff;
  if (dv.getUint32(lo, true) !== 0x04034b50) throw new Error("docx: lokal sarlavha xato");
  const dataStart = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
  const comp = bytes.subarray(dataStart, dataStart + target.compSize);
  let xmlBytes: Uint8Array;
  if (target.method === 0) {
    xmlBytes = comp;
  } else {
    const ds = new DecompressionStream("deflate-raw");
    const stream = new Response(comp).body!.pipeThrough(ds);
    xmlBytes = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  return docxXmlToText(td.decode(xmlBytes));
}
/** RTF → tekis matn (boshqaruv so'zlarini olib tashlaydi). */
function rtfToText(rtf: string): string {
  return rtf
    .replace(/\\par[d]?\b/g, "\n")
    .replace(/\\'[0-9a-fA-F]{2}/g, " ")
    .replace(/\\[a-zA-Z]+-?\d*\s?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
/** Yuklangan fayldan tekis matn (docx/rtf/html/txt/md). */
async function extractFileText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) return extractDocx(await file.arrayBuffer());
  const raw = await file.text();
  if (name.endsWith(".html") || name.endsWith(".htm")) return plainText(raw);
  if (name.endsWith(".rtf")) return rtfToText(raw);
  return raw; // txt, md, csv, ...
}

// ── Shablon hujjatlar kutubxonasi (trustme.uz uslubi: qidiruv + kategoriya) ──
// Har biri O'zbekiston huquqiga mos; [...] — to'ldiriladigan joylar. LLM'siz ishlaydi.
type Loc = { uz: string; ru: string };
type CatKey = "collection" | "contract" | "other";
interface Template {
  key: string;
  cat: CatKey;
  icon: Icon;
  title: Loc;
  desc: Loc;
  kw: string; // qidiruv kalit so'zlari (uz + ru, kichik harf)
  html: string;
}

const CATS: { key: "all" | CatKey; label: Loc }[] = [
  { key: "all", label: { uz: "Barchasi", ru: "Все" } },
  { key: "collection", label: { uz: "Undiruv", ru: "Взыскание" } },
  { key: "contract", label: { uz: "Shartnomalar", ru: "Договоры" } },
  { key: "other", label: { uz: "Hujjatlar", ru: "Документы" } },
];

// ── Professional shartnoma quruvchisi (takrorlanuvchi bo'limlar bir joyda) ──
const cReq = (a: string, b: string) =>
  `<h3>9. TOMONLARNING REKVIZITLARI VA IMZOLARI</h3>` +
  `<p><strong>${a}:</strong> «[Kreditor nomi]»<br>Manzil: [Kreditor manzili] · STIR: [Kreditor STIR]<br>H/r: [Kreditor h/r] · Bank: [Kreditor bank] · MFO: [Kreditor MFO] · Tel: [Kreditor telefoni]<br>_________________ [Kreditor direktori]&nbsp;&nbsp; M.O'.</p>` +
  `<p><strong>${b}:</strong> «[Qarzdor nomi]»<br>Manzil: [Qarzdor manzili] · STIR: [Qarzdor STIR]<br>H/r: [Qarzdor h/r] · Bank: [Qarzdor bank] · MFO: [Qarzdor MFO] · Tel: [Qarzdor telefoni]<br>_________________ [Qarzdor direktori]&nbsp;&nbsp; M.O'.</p>`;
const cTail = (payer: string, a: string, b: string) =>
  `<h3>4. TOMONLARNING JAVOBGARLIGI</h3><p>4.1. To'lov muddati buzilganda, ${payer} har bir kechiktirilgan kalendar kun uchun [Foiz]% miqdorida penya to'laydi.</p><p>4.2. Penya to'lash Tomonlarni asosiy majburiyatni bajarishdan ozod etmaydi; yetkazilgan real zarar O'zbekiston Respublikasi Fuqarolik kodeksiga muvofiq qoplanadi.</p>` +
  `<h3>5. FORS-MAJOR (YENGIB BO'LMAS KUCH)</h3><p>5.1. Yengib bo'lmas kuch holatlari (tabiiy ofat, urush, favqulodda vaziyat, vakolatli davlat organlarining qarorlari va shu kabilar) yuzaga kelganda, Tomonlar majburiyatlarni bajarmaganlik uchun javobgarlikdan ozod etiladi. Bunday holatlar tugagach, majburiyatlarni bajarish tiklanadi.</p>` +
  `<h3>6. NIZOLARNI HAL QILISH</h3><p>6.1. Nizolar avval muzokara va sudgacha (pretenziya) tartibida hal etiladi; pretenziyaga javob berish muddati — 30 kalendar kun.</p><p>6.2. Kelishuvga erishilmasa, nizo O'zbekiston Respublikasi Iqtisodiy protsessual kodeksiga muvofiq iqtisodiy sud tomonidan ko'rib chiqiladi.</p>` +
  `<h3>7. SHARTNOMA MUDDATI VA UNI BEKOR QILISH</h3><p>7.1. Shartnoma imzolangan kundan kuchga kiradi va Tomonlar o'z majburiyatlarini to'liq bajargunga qadar amal qiladi.</p><p>7.2. Shartnoma Tomonlar kelishuviga binoan yoki qonunchilikda nazarda tutilgan hollarda bekor qilinishi mumkin.</p>` +
  `<h3>8. YAKUNIY QOIDALAR</h3><p>8.1. Shartnomaga o'zgartirish va qo'shimchalar yozma shaklda, Tomonlar imzolagan qo'shimcha kelishuv bilan kiritiladi.</p><p>8.2. Shartnoma teng yuridik kuchga ega ikki nusxada, har bir Tomon uchun bittadan tuzildi.</p>` +
  cReq(a, b);
const contractDoc = (o: { title: string; aRole: string; bRole: string; payer: string; body: string }) =>
  `<h2 style="text-align:center">${o.title} № [Shartnoma raqami]</h2><p style="text-align:center">[Shahar] sh.&nbsp;&nbsp;&nbsp;[Sana]</p>` +
  `<p>«[Kreditor nomi]» (bundan buyon — «${o.aRole}»), [Kreditor direktori] shaxsida Ustav asosida ish yurituvchi, bir tomondan, va «[Qarzdor nomi]» (STIR: [Qarzdor STIR]; bundan buyon — «${o.bRole}»), [Qarzdor direktori] shaxsida ish yurituvchi, ikkinchi tomondan, birgalikda «Tomonlar» deb ataluvchi, quyidagilar to'g'risida ushbu shartnomani (bundan buyon — «Shartnoma») tuzdilar:</p>` +
  o.body +
  cTail(o.payer, o.aRole, o.bRole);

const CATALOG: Template[] = [
  // ── Undiruv (qarz undirish hujjatlari) ──
  {
    key: "demand",
    cat: "collection",
    icon: Scroll,
    title: { uz: "Talabnoma", ru: "Требование" },
    desc: { uz: "Qarzdorga muddati o'tgan qarz to'g'risida rasmiy talab", ru: "Требование должнику о погашении просроченного долга" },
    kw: "talabnoma qarz undiruv trebovanie dolg pretenziya",
    html: `<h2 style="text-align:center">TALABNOMA</h2><p style="text-align:right">[Sana] · № [Chiquvchi raqam]</p><p><strong>Kimga:</strong> «[Qarzdor nomi]»<br><strong>STIR:</strong> [Qarzdor STIR] · <strong>Manzil:</strong> [Qarzdor manzili]<br><strong>Rahbar:</strong> [Qarzdor direktori]</p><p>Hurmatli [Qarzdor direktori]!</p><p>«[Kreditor nomi]» (STIR: [Kreditor STIR]) Sizning tashkilotingiz bilan tuzilgan № [Shartnoma raqami] shartnoma (bundan buyon — «Shartnoma») asosida o'z majburiyatlarini to'liq va lozim darajada bajardi. Biroq Siz tomoningizdan to'lov majburiyati belgilangan muddatda bajarilmadi va muddati o'tgan qarzdorlik yuzaga keldi.</p><h3>1. Qarzdorlik tafsiloti</h3><p>Shartnoma: № [Shartnoma raqami]<br>Hisob-faktura: № [Faktura raqami]<br>Asosiy qarz: <strong>[Asosiy qarz]</strong><br>Penya ([Kechikish kunlari] kun kechikish uchun): <strong>[Penya]</strong><br>Jami to'lanishi lozim: <strong>[Jami summa]</strong></p><h3>2. Huquqiy asos</h3><p>O'zbekiston Respublikasi Fuqarolik kodeksiga muvofiq majburiyatlar shartnoma shartlariga va qonun hujjatlariga muvofiq lozim darajada hamda o'z vaqtida bajarilishi shart; majburiyatni bir tomonlama bajarishdan bosh tortishga yo'l qo'yilmaydi.</p><h3>3. Talab</h3><p>Yuqoridagilarga asosan, ushbu talabnoma qo'lga tekkan kundan boshlab <strong>[Muddat] kalendar kun</strong> ichida <strong>[Jami summa]</strong> miqdoridagi qarzdorlikni quyidagi hisob raqamiga to'liq to'lashingizni talab qilamiz:<br>H/r: [Kreditor h/r] · Bank: [Kreditor bank] · MFO: [Kreditor MFO].</p><p>Belgilangan muddatda to'lov amalga oshirilmasa, «[Kreditor nomi]» qo'shimcha ogohlantirishsiz O'zbekiston Respublikasi Iqtisodiy protsessual kodeksiga muvofiq iqtisodiy sudga da'vo arizasi bilan murojaat qilish, shuningdek yetkazilgan zararni undirish huquqini o'zida saqlaydi. Bunda barcha sud xarajatlari qarzdor zimmasiga yuklatiladi.</p><p><strong>Ilova:</strong> shartnoma nusxasi; hisob-fakturalar; solishtirma dalolatnoma (akt-sverka).</p><p>Hurmat bilan,<br>«[Kreditor nomi]»<br>[Kreditor direktori] _________________&nbsp;&nbsp; M.O'.</p>`,
  },
  {
    key: "pretenzia",
    cat: "collection",
    icon: Megaphone,
    title: { uz: "Pretenziya", ru: "Претензия" },
    desc: { uz: "Sudgacha (pretenziya) tartibida rasmiy da'vo xati", ru: "Досудебная претензия перед подачей иска" },
    kw: "pretenziya sudgacha dosudebnaya pretenzia da'vo",
    html: `<h2 style="text-align:center">PRETENZIYA</h2><p style="text-align:right">[Sana] · № [Chiquvchi raqam]</p><p><strong>Kimga:</strong> «[Qarzdor nomi]» (STIR: [Qarzdor STIR])<br><strong>Manzil:</strong> [Qarzdor manzili]</p><p>«[Kreditor nomi]» (STIR: [Kreditor STIR]) № [Shartnoma raqami] shartnoma va № [Faktura raqami] hisob-faktura bo'yicha yuzaga kelgan qarzdorlik yuzasidan ushbu pretenziyani (sudgacha talab) yo'llaydi.</p><h3>1. Holat</h3><p>«[Kreditor nomi]» Shartnoma bo'yicha o'z majburiyatlarini to'liq bajardi. Javob beruvchi tomon to'lovni belgilangan muddatda amalga oshirmadi.</p><h3>2. Qarzdorlik</h3><p>Asosiy qarz: <strong>[Asosiy qarz]</strong><br>Penya ([Kechikish kunlari] kun): <strong>[Penya]</strong><br>Jami: <strong>[Jami summa]</strong></p><h3>3. Talab va huquqiy asos</h3><p>O'zbekiston Respublikasi Iqtisodiy protsessual kodeksining sudgacha (pretenziya) tartibi talablariga muvofiq, ushbu pretenziya olingan kundan boshlab <strong>[Muddat] kalendar kun</strong> ichida yuqoridagi summani quyidagi rekvizitlarga to'lashingizni talab qilamiz:<br>H/r: [Kreditor h/r] · Bank: [Kreditor bank] · MFO: [Kreditor MFO].</p><p>Talab bajarilmasa, «[Kreditor nomi]» qarzni, penyani va sud xarajatlarini undirish uchun iqtisodiy sudga da'vo arizasi bilan murojaat qiladi.</p><p><strong>Ilova:</strong> shartnoma va hisob-fakturalar nusxasi; akt-sverka.</p><p>Hurmat bilan,<br>«[Kreditor nomi]»<br>[Kreditor direktori] _________________&nbsp;&nbsp; M.O'.</p>`,
  },
  {
    key: "lawsuit",
    cat: "collection",
    icon: Gavel,
    title: { uz: "Da'vo arizasi", ru: "Исковое заявление" },
    desc: { uz: "Iqtisodiy sudga qarz undirish uchun da'vo arizasi", ru: "Исковое заявление о взыскании долга в экономический суд" },
    kw: "da'vo ariza sud isk iskovoe zayavlenie undiruv",
    html: `<h2 style="text-align:center">IQTISODIY SUDGA DA'VO ARIZASI</h2><p style="text-align:right">[Shahar] tumanlararo iqtisodiy sudiga</p><p><strong>Da'vogar:</strong> «[Kreditor nomi]», STIR: [Kreditor STIR]<br>Manzil: [Kreditor manzili] · Tel: [Kreditor telefoni]<br><strong>Javobgar:</strong> «[Qarzdor nomi]», STIR: [Qarzdor STIR]<br>Manzil: [Qarzdor manzili]<br><strong>Da'vo narxi:</strong> [Jami summa]<br><strong>Davlat boji:</strong> [Davlat boji] (qonunda belgilangan stavka bo'yicha)</p><h3>1. Ishning holati</h3><p>1.1. Da'vogar va Javobgar o'rtasida № [Shartnoma raqami] shartnoma tuzilgan. Da'vogar shartnoma bo'yicha o'z majburiyatlarini to'liq bajardi, bu № [Faktura raqami] hisob-faktura hamda tovar/xizmat topshirilganini tasdiqlovchi hujjatlar bilan tasdiqlanadi.</p><p>1.2. Javobgar to'lov majburiyatini belgilangan muddatda bajarmadi. Asosiy qarz — [Asosiy qarz], [Kechikish kunlari] kun kechikish uchun penya — [Penya].</p><p>1.3. Da'vogar Javobgarga [Talabnoma sanasi] da № [Chiquvchi raqam] talabnoma (pretenziya) yubordi, biroq qarz to'lanmadi — sudgacha (pretenziya) tartibi bajarilgan.</p><h3>2. Huquqiy asos</h3><p>2.1. O'zbekiston Respublikasi Fuqarolik kodeksiga muvofiq majburiyatlar lozim darajada va o'z vaqtida bajarilishi shart; buzilganda kreditor asosiy qarz, penya va zararni undirish huquqiga ega. Ish O'zbekiston Respublikasi Iqtisodiy protsessual kodeksiga muvofiq ko'rib chiqiladi.</p><h3>3. So'rov</h3><p><strong>SO'RAYMAN:</strong></p><p>1) Javobgardan Da'vogar foydasiga asosiy qarz [Asosiy qarz] undirilsin;<br>2) penya [Penya] undirilsin;<br>3) jami: <strong>[Jami summa]</strong>;<br>4) to'langan davlat boji [Davlat boji] Javobgar zimmasiga yuklatilsin.</p><p><strong>Ilovalar:</strong> shartnoma nusxasi; hisob-fakturalar; talabnoma va u yuborilganini tasdiqlovchi hujjat; akt-sverka; davlat boji to'langanligi to'g'risidagi hujjat; da'vo nusxasi Javobgarga yuborilgani tasdig'i; vakolatni tasdiqlovchi hujjat.</p><p>Da'vogar nomidan: [Kreditor direktori] _________________ (imzo, sana)&nbsp;&nbsp; M.O'.</p>`,
  },
  {
    key: "reconciliation",
    cat: "collection",
    icon: ClipboardText,
    title: { uz: "Akt-sverka", ru: "Акт сверки" },
    desc: { uz: "Tomonlar o'rtasidagi o'zaro hisob-kitob solishtirmasi", ru: "Акт сверки взаиморасчётов между сторонами" },
    kw: "akt sverka solishtirma dalolatnoma hisob-kitob saldo",
    html: `<h2 style="text-align:center">SOLISHTIRMA DALOLATNOMA (AKT-SVERKA)</h2><p style="text-align:center">[Shahar] sh., [Sana] holatiga</p><p>Biz, quyida imzo chekuvchilar — «[Kreditor nomi]» (STIR: [Kreditor STIR]) nomidan [Kreditor direktori], bir tomondan, va «[Qarzdor nomi]» (STIR: [Qarzdor STIR]) nomidan [Qarzdor direktori], ikkinchi tomondan — № [Shartnoma raqami] shartnoma bo'yicha o'zaro hisob-kitob holatini solishtirib, ushbu dalolatnomani tuzdik.</p><h3>Hisob-kitob holati</h3><p>Shartnoma: № [Shartnoma raqami] · Hisob-faktura: № [Faktura raqami]<br>Davr boshiga qoldiq: [Boshlang'ich qoldiq]<br>Hisoblangan (yetkazilgan tovar/xizmat): [Hisoblangan]<br>To'langan: [To'langan]<br>Asosiy qarz: <strong>[Asosiy qarz]</strong><br>Penya: [Penya]<br><strong>Yakuniy qoldiq (saldo): [Jami summa]</strong></p><p>Tomonlar yuqoridagi ma'lumotlarni tasdiqlaydilar. Kelishmovchiliklar mavjud emas (mavjud bo'lsa — quyida bayon etiladi): _______________________________</p><p><strong>«[Kreditor nomi]»</strong><br>[Kreditor direktori] _________________&nbsp;&nbsp; M.O'.</p><p><strong>«[Qarzdor nomi]»</strong><br>[Qarzdor direktori] _________________&nbsp;&nbsp; M.O'.</p>`,
  },
  {
    key: "reply",
    cat: "collection",
    icon: Envelope,
    title: { uz: "Javob xati", ru: "Ответное письмо" },
    desc: { uz: "Kelib tushgan xat yoki da'voga rasmiy javob", ru: "Официальный ответ на входящее письмо или претензию" },
    kw: "javob xati pismo otvet rasmiy xat",
    html: `<h2 style="text-align:center">JAVOB XATI</h2><p style="text-align:right">[Sana] · № [Chiquvchi raqam]</p><p><strong>Kimga:</strong> «[Qarzdor nomi]»<br><strong>Manzil:</strong> [Qarzdor manzili]</p><p>Hurmatli [Qarzdor direktori]!</p><p>Sizning [Kiruvchi sana] dagi № [Kiruvchi raqam] xatingiz (murojaatingiz) ko'rib chiqildi. Bayon etilgan masala yuzasidan quyidagilarni ma'lum qilamiz:</p><p>[Javob mazmunini shu yerga batafsil yozing — faktlar, huquqiy asos, tomonning pozitsiyasi va takliflar]</p><p>Bildirilgan pozitsiya O'zbekiston Respublikasi amaldagi qonunchiligiga asoslanadi. Qo'shimcha savollar yuzasidan biz bilan bog'lanishingizni so'raymiz.</p><p>Hurmat bilan,<br>«[Kreditor nomi]»<br>[Kreditor direktori] _________________&nbsp;&nbsp; M.O'.</p>`,
  },
  // ── Shartnomalar ──
  {
    key: "contract",
    cat: "contract",
    icon: Handshake,
    title: { uz: "Oldi-sotdi shartnomasi", ru: "Договор купли-продажи" },
    desc: { uz: "Tovar (xizmat) oldi-sotdisi bo'yicha umumiy shartnoma", ru: "Общий договор купли-продажи товара (услуги)" },
    kw: "oldi-sotdi shartnoma kuplya prodaja dogovor tovar",
    html: contractDoc({
      title: "OLDI-SOTDI SHARTNOMASI",
      aRole: "Sotuvchi",
      bRole: "Xaridor",
      payer: "Xaridor",
      body:
        `<h3>1. SHARTNOMA PREDMETI</h3><p>1.1. Sotuvchi tovarni Xaridor mulkiga o'tkazadi, Xaridor esa tovarni qabul qilib olib, uning qiymatini to'laydi.</p><p>1.2. Tovarning nomi, assortimenti va miqdori Tomonlar imzolagan spetsifikatsiya hamda hisob-fakturalarda belgilanadi.</p>` +
        `<h3>2. SHARTNOMA SUMMASI VA TO'LOV TARTIBI</h3><p>2.1. Shartnoma umumiy summasi: <strong>[Jami summa]</strong> (QQS hisobga olingan holda).</p><p>2.2. To'lov shartnoma imzolangach [Muddat] ichida, Xaridorning hisob raqamidan Sotuvchi hisob raqamiga pul o'tkazish yo'li bilan amalga oshiriladi.</p>` +
        `<h3>3. TOVARNI TOPSHIRISH VA TOMONLAR MAJBURIYATLARI</h3><p>3.1. Sotuvchi tovarni sifatli holatda, hujjatlari bilan birga kelishilgan muddatda topshiradi.</p><p>3.2. Xaridor tovarni qabul qilib oladi va to'lovni o'z vaqtida amalga oshiradi. Tovar qabul qilinganda dalolatnoma (akt) yoki yuk xati imzolanadi.</p>`,
    }),
  },
  {
    key: "nasiya",
    cat: "contract",
    icon: Coins,
    title: { uz: "Nasiya (bo'lib to'lash)", ru: "Договор рассрочки" },
    desc: { uz: "Tovarni bo'lib-bo'lib to'lash sharti bilan sotish", ru: "Продажа товара с оплатой в рассрочку" },
    kw: "nasiya bo'lib to'lash rassrochka bolib tolash kredit",
    html: contractDoc({
      title: "NASIYA (BO'LIB TO'LASH) OLDI-SOTDI SHARTNOMASI",
      aRole: "Sotuvchi",
      bRole: "Xaridor",
      payer: "Xaridor",
      body:
        `<h3>1. SHARTNOMA PREDMETI</h3><p>1.1. Sotuvchi tovarni Xaridorga bo'lib-bo'lib (nasiyaga) to'lash sharti bilan sotadi, mulk huquqi to'liq to'lov amalga oshirilgach o'tadi (agar Tomonlar boshqacha kelishmagan bo'lsa).</p><p>1.2. Tovarning umumiy qiymati: <strong>[Jami summa]</strong>.</p>` +
        `<h3>2. TO'LOV JADVALI</h3><p>2.1. Boshlang'ich to'lov: [Boshlang'ich to'lov] — shartnoma imzolanganda to'lanadi.</p><p>2.2. Qolgan summa [Muddat] oy davomida teng ulushlarda, har oyning [To'lov kuni]-sanasigacha to'lanadi. Batafsil to'lov jadvali ushbu shartnomaga ilova qilinadi.</p>` +
        `<h3>3. TOMONLAR MAJBURIYATLARI</h3><p>3.1. Sotuvchi tovarni topshiradi. Xaridor to'lov jadvaliga qat'iy rioya qiladi.</p><p>3.2. Ketma-ket ikki oy to'lov amalga oshirilmasa, Sotuvchi qolgan qarzni muddatidan oldin to'liq undirishni talab qilishi mumkin.</p>`,
    }),
  },
  {
    key: "supply",
    cat: "contract",
    icon: Truck,
    title: { uz: "Yetkazib berish", ru: "Договор поставки" },
    desc: { uz: "Tovarni kelishilgan muddatda yetkazib berish shartnomasi", ru: "Договор поставки товара в согласованные сроки" },
    kw: "yetkazib berish postavka supply logistika",
    html: contractDoc({
      title: "YETKAZIB BERISH SHARTNOMASI",
      aRole: "Yetkazib beruvchi",
      bRole: "Xaridor",
      payer: "Xaridor",
      body:
        `<h3>1. SHARTNOMA PREDMETI</h3><p>1.1. Yetkazib beruvchi tovarni kelishilgan muddat, miqdor va assortimentda Xaridorga yetkazib beradi, Xaridor esa uni qabul qilib to'laydi.</p><p>1.2. Tovar nomenklaturasi va narxi spetsifikatsiya hamda hisob-fakturalarda belgilanadi. Umumiy qiymat: <strong>[Jami summa]</strong>.</p>` +
        `<h3>2. YETKAZIB BERISH SHARTLARI</h3><p>2.1. Yetkazib berish [Muddat] ichida, [Yetkazib berish manzili] manzili bo'yicha amalga oshiriladi.</p><p>2.2. Tovar bilan birga hisob-faktura va yuk xati taqdim etiladi. Tovar qabul qilinganda dalolatnoma imzolanadi.</p>` +
        `<h3>3. TO'LOV TARTIBI</h3><p>3.1. To'lov tovar yetkazib berilgach [Muddat] ichida pul ko'chirish yo'li bilan amalga oshiriladi.</p>`,
    }),
  },
  {
    key: "service",
    cat: "contract",
    icon: Briefcase,
    title: { uz: "Xizmat ko'rsatish", ru: "Договор оказания услуг" },
    desc: { uz: "Pullik xizmat ko'rsatish bo'yicha shartnoma", ru: "Договор возмездного оказания услуг" },
    kw: "xizmat ko'rsatish usluga service ijrochi",
    html: contractDoc({
      title: "XIZMAT KO'RSATISH SHARTNOMASI",
      aRole: "Ijrochi",
      bRole: "Buyurtmachi",
      payer: "Buyurtmachi",
      body:
        `<h3>1. SHARTNOMA PREDMETI</h3><p>1.1. Ijrochi Buyurtmachining topshirig'iga binoan [Xizmat turi] xizmatlarini ko'rsatadi, Buyurtmachi esa ularni qabul qilib haqini to'laydi.</p><p>1.2. Xizmatlar hajmi va talablari Tomonlar imzolagan texnik topshiriq (ilova)da belgilanadi.</p>` +
        `<h3>2. XIZMAT NARXI VA TO'LOV TARTIBI</h3><p>2.1. Xizmatlar qiymati: <strong>[Jami summa]</strong>.</p><p>2.2. To'lov ko'rsatilgan xizmatlar dalolatnomasi (akt) imzolangach [Muddat] ichida amalga oshiriladi.</p>` +
        `<h3>3. XIZMATNI TOPSHIRISH VA QABUL QILISH</h3><p>3.1. Xizmatlar ko'rsatilgach, Ijrochi bajarilgan ishlar dalolatnomasini taqdim etadi.</p><p>3.2. Buyurtmachi 5 ish kuni ichida dalolatnomani imzolaydi yoki asoslantirilgan e'tirozini bildiradi.</p>`,
    }),
  },
  {
    key: "rent",
    cat: "contract",
    icon: House,
    title: { uz: "Ijara shartnomasi", ru: "Договор аренды" },
    desc: { uz: "Mol-mulkni vaqtinchalik foydalanishga berish", ru: "Передача имущества во временное пользование" },
    kw: "ijara arenda rent turar-joy kvartira",
    html: contractDoc({
      title: "IJARA SHARTNOMASI",
      aRole: "Ijaraga beruvchi",
      bRole: "Ijarachi",
      payer: "Ijarachi",
      body:
        `<h3>1. SHARTNOMA PREDMETI</h3><p>1.1. Ijaraga beruvchi quyidagi mol-mulkni Ijarachiga vaqtinchalik egalik qilish va foydalanishga beradi: [Ijara obyekti] (manzil/tavsif: [Obyekt manzili]).</p><p>1.2. Mol-mulk ijaraga beruvchining mulki bo'lib, uchinchi shaxslar huquqidan xoli.</p>` +
        `<h3>2. IJARA HAQI VA TO'LOV TARTIBI</h3><p>2.1. Oylik ijara haqi: <strong>[Jami summa]</strong>.</p><p>2.2. To'lov har oy uchun oldindan, har oyning [To'lov kuni]-sanasigacha amalga oshiriladi.</p>` +
        `<h3>3. MUDDAT VA FOYDALANISH SHARTLARI</h3><p>3.1. Ijara muddati: [Muddat] oy, mol-mulk topshirilgan kundan (topshirish dalolatnomasi bo'yicha).</p><p>3.2. Ijarachi mol-mulkdan maqsadli foydalanadi, uni saqlab qoladi va muddat tugagach yaroqli holatda qaytaradi. Kommunal to'lovlar [Kommunal to'lov tomoni] zimmasida.</p>`,
    }),
  },
  {
    key: "pudrat",
    cat: "contract",
    icon: Hammer,
    title: { uz: "Pudrat shartnomasi", ru: "Договор подряда" },
    desc: { uz: "Ish (qurilish, ta'mir) bajarish bo'yicha pudrat", ru: "Договор подряда на выполнение работ" },
    kw: "pudrat podryad qurilish ta'mir ish bajarish",
    html: contractDoc({
      title: "PUDRAT SHARTNOMASI",
      aRole: "Pudratchi",
      bRole: "Buyurtmachi",
      payer: "Buyurtmachi",
      body:
        `<h3>1. SHARTNOMA PREDMETI</h3><p>1.1. Pudratchi Buyurtmachining topshirig'iga binoan [Ish nomi] ishlarini o'z kuchi va vositalari bilan bajaradi, Buyurtmachi esa natijani qabul qilib haqini to'laydi.</p><p>1.2. Ishlar hajmi, tarkibi va talablari smeta hamda texnik topshiriq (ilova)da belgilanadi.</p>` +
        `<h3>2. ISH NARXI VA TO'LOV TARTIBI</h3><p>2.1. Ishlar qiymati: <strong>[Jami summa]</strong>.</p><p>2.2. To'lov bajarilgan ishlar dalolatnomasi (akt) imzolangach [Muddat] ichida amalga oshiriladi. Zarur bo'lganda avans [Avans] miqdorida beriladi.</p>` +
        `<h3>3. MUDDAT VA ISHNI TOPSHIRISH</h3><p>3.1. Ishlar [Boshlanish sanasi]dan boshlab [Muddat] ichida bajariladi.</p><p>3.2. Ish tugagach Pudratchi natijani topshiradi; Buyurtmachi qabul qilib dalolatnomani imzolaydi yoki kamchiliklarni yozma bildiradi.</p>`,
    }),
  },
  {
    key: "loan",
    cat: "contract",
    icon: Coins,
    title: { uz: "Qarz (zayom) shartnomasi", ru: "Договор займа" },
    desc: { uz: "Pul mablag'ini qarzga berish shartnomasi", ru: "Договор денежного займа между сторонами" },
    kw: "qarz zayom zaym loan pul qarzga berish",
    html: contractDoc({
      title: "QARZ (ZAYOM) SHARTNOMASI",
      aRole: "Qarz beruvchi",
      bRole: "Qarz oluvchi",
      payer: "Qarz oluvchi",
      body:
        `<h3>1. SHARTNOMA PREDMETI</h3><p>1.1. Qarz beruvchi Qarz oluvchiga <strong>[Jami summa]</strong> miqdorida pul mablag'ini qarzga beradi, Qarz oluvchi esa uni belgilangan muddatda qaytarish majburiyatini oladi.</p><p>1.2. Qarz mablag'i o'tkazilgani to'lov hujjati (yoki tilxat) bilan tasdiqlanadi.</p>` +
        `<h3>2. FOIZLAR</h3><p>2.1. Qarzdan foydalanganlik uchun yillik [Foiz]% ustama hisoblanadi (agar Tomonlar foizsiz deb kelishmagan bo'lsa).</p>` +
        `<h3>3. QAYTARISH MUDDATI VA TARTIBI</h3><p>3.1. Qarz [Muddat] ichida, [Qaytarish jadvali] bo'yicha to'liq qaytariladi.</p><p>3.2. Qarz oluvchi qarzni muddatidan oldin ham qaytarishi mumkin.</p>`,
    }),
  },
  {
    key: "employment",
    cat: "contract",
    icon: IdentificationCard,
    title: { uz: "Mehnat shartnomasi", ru: "Трудовой договор" },
    desc: { uz: "Xodim bilan tuziladigan mehnat shartnomasi", ru: "Трудовой договор с работником" },
    kw: "mehnat trudovoy xodim ish beruvchi lavozim",
    html: `<h2 style="text-align:center">MEHNAT SHARTNOMASI № [Shartnoma raqami]</h2><p style="text-align:center">[Shahar] sh.&nbsp;&nbsp;&nbsp;[Sana]</p><p>«[Kreditor nomi]» (bundan buyon — «Ish beruvchi»), [Kreditor direktori] shaxsida, bir tomondan, va [Qarzdor nomi] (bundan buyon — «Xodim»), ikkinchi tomondan, O'zbekiston Respublikasi Mehnat kodeksiga muvofiq quyidagilar to'g'risida ushbu mehnat shartnomasini tuzdilar:</p><h3>1. SHARTNOMA PREDMETI</h3><p>1.1. Xodim [Lavozim] lavozimiga (kasbiga) [Bo'lim] bo'linmasiga ishga qabul qilinadi.</p><p>1.2. Ish [Ish joyi manzili] manzilida bajariladi. Ushbu ish Xodim uchun asosiy ish hisoblanadi.</p><h3>2. SHARTNOMA MUDDATI VA SINOV</h3><p>2.1. Xodim ishga [Ishga chiqish sanasi]dan kirishadi. Shartnoma [Muddat]ga (yoki muddatsiz) tuziladi.</p><p>2.2. Sinov muddati: [Sinov muddati] (belgilangan bo'lsa).</p><h3>3. MEHNAT HAQI</h3><p>3.1. Xodimga lavozim maoshi (tarif stavkasi) <strong>[Jami summa]</strong> belgilanadi.</p><p>3.2. Mehnat haqi oyiga kamida ikki marta, qonunchilikda belgilangan muddatlarda to'lanadi.</p><h3>4. ISH VA DAM OLISH VAQTI</h3><p>4.1. Xodimga haftasiga [Ish soati] soatlik ish vaqti belgilanadi.</p><p>4.2. Xodim mehnat qonunchiligiga muvofiq yillik haq to'lanadigan mehnat ta'tiliga haqli.</p><h3>5. TOMONLARNING HUQUQ VA MAJBURIYATLARI</h3><p>5.1. Ish beruvchi xavfsiz mehnat sharoitini yaratadi va mehnat haqini o'z vaqtida to'laydi.</p><p>5.2. Xodim mehnat vazifalarini va ichki mehnat tartibi qoidalarini halol bajaradi.</p><h3>6. SHARTNOMANI BEKOR QILISH</h3><p>6.1. Mehnat shartnomasi O'zbekiston Respublikasi Mehnat kodeksida nazarda tutilgan asoslar va tartibda bekor qilinadi.</p><h3>7. YAKUNIY QOIDALAR</h3><p>7.1. Shartnoma teng yuridik kuchga ega ikki nusxada tuzildi. Nizolar qonunchilikka muvofiq hal etiladi.</p><p><strong>Ish beruvchi:</strong> «[Kreditor nomi]», STIR: [Kreditor STIR]<br>Manzil: [Kreditor manzili] · Tel: [Kreditor telefoni]<br>_________________ [Kreditor direktori]&nbsp;&nbsp; M.O'.</p><p><strong>Xodim:</strong> [Qarzdor nomi]<br>PINFL: [Xodim PINFL] · Manzil: [Xodim manzili] · Tel: [Xodim telefoni]<br>_________________ (imzo)</p>`,
  },
  {
    key: "commission",
    cat: "contract",
    icon: Receipt,
    title: { uz: "Komissiya shartnomasi", ru: "Договор комиссии" },
    desc: { uz: "Komissioner Komitent nomidan bitim tuzadi", ru: "Комиссионер совершает сделки для комитента" },
    kw: "komissiya komissioner komitent commission vositachi",
    html: contractDoc({
      title: "KOMISSIYA SHARTNOMASI",
      aRole: "Komissioner",
      bRole: "Komitent",
      payer: "Komitent",
      body:
        `<h3>1. SHARTNOMA PREDMETI</h3><p>1.1. Komissioner Komitentning topshirig'iga binoan, o'z nomidan, lekin Komitent hisobidan [Bitim predmeti] bo'yicha bitim(lar) tuzadi.</p><p>1.2. Bitim shartlari (narx, miqdor, muddat) Komitentning topshirig'ida belgilanadi.</p>` +
        `<h3>2. KOMISSIYA HAQI VA HISOB-KITOB</h3><p>2.1. Komissiya haqi: <strong>[Jami summa]</strong> (yoki bitim summasining [Foiz]%i).</p><p>2.2. Komissioner topshiriq bajarilgach hisobot taqdim etadi; hisob-kitob [Muddat] ichida amalga oshiriladi.</p>` +
        `<h3>3. TOMONLAR MAJBURIYATLARI</h3><p>3.1. Komissioner topshiriqni Komitent manfaatlariga muvofiq, eng qulay shartlarda bajaradi.</p><p>3.2. Komitent Komissionerni zarur mablag' va hujjatlar bilan ta'minlaydi.</p>`,
    }),
  },
  {
    key: "multiparty",
    cat: "contract",
    icon: UsersThree,
    title: { uz: "Ko'p tomonlama shartnoma", ru: "Многосторонний договор" },
    desc: { uz: "Uch va undan ortiq tomon o'rtasidagi shartnoma", ru: "Договор между тремя и более сторонами" },
    kw: "ko'p tomonlama multiparty uch tomon mnogostoronniy",
    html: `<h2 style="text-align:center">KO'P TOMONLAMA SHARTNOMA № [Shartnoma raqami]</h2><p style="text-align:center">[Shahar] sh.&nbsp;&nbsp;&nbsp;[Sana]</p><p>Quyidagi Tomonlar:<br>1) «[Kreditor nomi]» (STIR: [Kreditor STIR]), [Kreditor direktori] shaxsida;<br>2) «[Qarzdor nomi]» (STIR: [Qarzdor STIR]), [Qarzdor direktori] shaxsida;<br>3) «[Uchinchi tomon]» (STIR: [Uchinchi tomon STIR]), [Uchinchi tomon rahbari] shaxsida —<br>birgalikda «Tomonlar» deb ataluvchi, quyidagilar to'g'risida ushbu shartnomani tuzdilar:</p><h3>1. SHARTNOMA PREDMETI</h3><p>1.1. Tomonlar [Hamkorlik predmeti] bo'yicha birgalikda harakat qilish to'g'risida kelishdilar. Umumiy qiymat (yoki hissalar): <strong>[Jami summa]</strong>.</p><h3>2. HAR BIR TOMONNING MAJBURIYATLARI</h3><p>2.1. Tomon 1: [1-tomon majburiyati].</p><p>2.2. Tomon 2: [2-tomon majburiyati].</p><p>2.3. Tomon 3: [3-tomon majburiyati].</p><h3>3. TOMONLARNING JAVOBGARLIGI</h3><p>3.1. Majburiyatni buzgan Tomon boshqa Tomonlarga yetkazilgan real zararni O'zbekiston Respublikasi Fuqarolik kodeksiga muvofiq qoplaydi.</p><h3>4. NIZOLARNI HAL QILISH</h3><p>4.1. Nizolar muzokara va sudgacha (pretenziya) tartibida hal etiladi; kelishuvga erishilmasa, nizo Iqtisodiy protsessual kodeksga muvofiq iqtisodiy sudda ko'rib chiqiladi.</p><h3>5. YAKUNIY QOIDALAR</h3><p>5.1. Shartnoma Tomonlar soniga teng nusxada, har biri teng yuridik kuchga ega holda tuzildi.</p><p>5.2. O'zgartirishlar barcha Tomonlar imzolagan yozma kelishuv bilan kiritiladi.</p><p><strong>Tomon 1:</strong> «[Kreditor nomi]» _________________&nbsp; M.O'.<br><strong>Tomon 2:</strong> «[Qarzdor nomi]» _________________&nbsp; M.O'.<br><strong>Tomon 3:</strong> «[Uchinchi tomon]» _________________&nbsp; M.O'.</p>`,
  },
  // ── Boshqa hujjatlar ──
  {
    key: "ishonchnoma",
    cat: "other",
    icon: IdentificationCard,
    title: { uz: "Ishonchnoma", ru: "Доверенность" },
    desc: { uz: "Vakolat berish (ishonchnoma) hujjati", ru: "Доверенность на представление интересов" },
    kw: "ishonchnoma doverennost vakolat vakil",
    html: `<h2 style="text-align:center">ISHONCHNOMA</h2><p style="text-align:center">[Shahar] sh.&nbsp;&nbsp;&nbsp;[Sana]</p><p>«[Kreditor nomi]» (STIR: [Kreditor STIR], manzil: [Kreditor manzili]) nomidan Ustav asosida ish yurituvchi rahbar [Kreditor direktori] ushbu ishonchnoma bilan quyidagi shaxsni vakil qilib tayinlaydi:</p><p><strong>Vakil:</strong> [Ishonchli vakil F.I.Sh]; PINFL: [Vakil PINFL]; pasport: [Vakil pasport].</p><h3>Beriladigan vakolatlar</h3><p>Vakilga tashkilot manfaatlarini davlat organlari, sud, banklar va uchinchi shaxslar oldida ifodalash; ariza, da'vo va boshqa hujjatlarni imzolash hamda topshirish; kerakli ma'lumotlarni olish; shuningdek [Qo'shimcha vakolatlar] vakolatlari beriladi.</p><h3>Muddat</h3><p>Ishonchnoma [Sana]dan boshlab [Muddat] muddatga beriladi. Vakolatlarni boshqa shaxsga o'tkazish huquqi berilmaydi (agar alohida ko'rsatilmagan bo'lsa).</p><p>Rahbar: [Kreditor direktori] _________________&nbsp;&nbsp; M.O'.</p>`,
  },
  {
    key: "nda",
    cat: "other",
    icon: ShieldCheck,
    title: { uz: "Konfidensiallik (NDA)", ru: "Соглашение о конфиденциальности" },
    desc: { uz: "Maxfiy ma'lumotlarni sir saqlash kelishuvi", ru: "Соглашение о неразглашении (NDA)" },
    kw: "nda konfidensiallik maxfiylik nerazglashenie sir",
    html: `<h2 style="text-align:center">KONFIDENSIALLIK TO'G'RISIDA KELISHUV (NDA)</h2><p style="text-align:center">[Shahar] sh.&nbsp;&nbsp;&nbsp;[Sana]</p><p>«[Kreditor nomi]» (STIR: [Kreditor STIR]) va «[Qarzdor nomi]» (STIR: [Qarzdor STIR]), birgalikda «Tomonlar» deb ataluvchi, quyidagilar to'g'risida ushbu kelishuvni tuzdilar:</p><h3>1. MAXFIY MA'LUMOT</h3><p>1.1. Maxfiy ma'lumot deganda Tomonlar hamkorlik davomida bir-biriga oshkor qilgan tijoriy, moliyaviy, texnik va boshqa maxfiy xarakterdagi har qanday ma'lumot tushuniladi.</p><h3>2. TOMONLARNING MAJBURIYATLARI</h3><p>2.1. Tomonlar maxfiy ma'lumotni sir saqlaydilar, uni uchinchi shaxslarga oshkor qilmaydilar va faqat hamkorlik maqsadida ishlatadilar.</p><h3>3. MUDDAT</h3><p>3.1. Majburiyat kelishuv amal qilgan davrda va u tugagach ham [Muddat] davomida saqlanadi.</p><h3>4. JAVOBGARLIK</h3><p>4.1. Maxfiylik buzilsa, aybdor Tomon yetkazilgan real zararni O'zbekiston Respublikasi Fuqarolik kodeksiga muvofiq to'liq qoplaydi.</p><h3>5. YAKUNIY QOIDALAR</h3><p>5.1. Nizolar muzokara, kelishilmasa iqtisodiy sud orqali hal etiladi. Kelishuv teng yuridik kuchga ega ikki nusxada tuzildi.</p><p><strong>Tomon 1:</strong> «[Kreditor nomi]» _________________&nbsp;&nbsp; M.O'.<br><strong>Tomon 2:</strong> «[Qarzdor nomi]» _________________&nbsp;&nbsp; M.O'.</p>`,
  },
  {
    key: "termination",
    cat: "other",
    icon: Prohibit,
    title: { uz: "Shartnomani bekor qilish", ru: "Расторжение договора" },
    desc: { uz: "Amaldagi shartnomani bekor qilish kelishuvi", ru: "Соглашение о расторжении договора" },
    kw: "bekor qilish rastorzhenie termination shartnomani tugatish",
    html: `<h2 style="text-align:center">SHARTNOMANI BEKOR QILISH TO'G'RISIDA KELISHUV</h2><p style="text-align:center">[Shahar] sh.&nbsp;&nbsp;&nbsp;[Sana]</p><p>«[Kreditor nomi]» (STIR: [Kreditor STIR]) va «[Qarzdor nomi]» (STIR: [Qarzdor STIR]), birgalikda «Tomonlar» deb ataluvchi, o'rtasida tuzilgan № [Shartnoma raqami] shartnomaga (bundan buyon — «Shartnoma») nisbatan quyidagilar to'g'risida kelishdilar:</p><h3>1. BEKOR QILISH</h3><p>1.1. Tomonlar № [Shartnoma raqami] Shartnomani [Sana]dan boshlab o'zaro kelishuv asosida bekor qiladilar. Ushbu sanadan e'tiboran Shartnoma bo'yicha kelgusi majburiyatlar to'xtatiladi.</p><h3>2. O'ZARO HISOB-KITOB</h3><p>2.1. Bekor qilish sanasiga o'zaro moliyaviy holat: [Jami summa]. Hisob-kitob [Muddat] ichida to'liq yakunlanadi.</p><p>2.2. Hisob-kitob yakunlangach Tomonlar bir-biriga da'voga ega emaslar (aks holda quyida ko'rsatiladi): _______________________________</p><h3>3. YAKUNIY QOIDALAR</h3><p>3.1. Ushbu kelishuv Shartnomaning ajralmas qismi bo'lib, teng yuridik kuchga ega ikki nusxada tuzildi.</p><p><strong>Tomon 1:</strong> «[Kreditor nomi]» _________________&nbsp;&nbsp; M.O'.<br><strong>Tomon 2:</strong> «[Qarzdor nomi]» _________________&nbsp;&nbsp; M.O'.</p>`,
  },
  {
    key: "blank",
    cat: "other",
    icon: FileDashed,
    title: { uz: "Bo'sh hujjat", ru: "Пустой документ" },
    desc: { uz: "Noldan o'zingiz yozadigan bo'sh hujjat", ru: "Пустой документ для создания с нуля" },
    kw: "bo'sh blank pustoy noldan yangi hujjat",
    html: "",
  },
];

/** Studio avtomatik to'ldirish uchun qarzdor ma'lumoti (receivables'dan). */
export interface StudioDebtor {
  id: string;
  name: string;
  tin: string;
  invoiceNumber: string;
  contractNumber: string;
  principal: string;
  penalty: string;
  total: string;
  overdueDays: string;
  stateDuty: string;
}

/** Kreditor (firma) rekvizitlari — har hujjatда avtomatik to'ldiriladi. */
export interface Creditor {
  name: string;
  tin: string;
  address: string;
  bankAccount: string;
  bankMfo: string;
  phone: string;
  director: string;
  city: string;
}

function todayStr(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

/** Shablondagi [joy]larni ish qiymatlari (qarzdor + kreditor + summalar + sana) bilan to'ldiradi. */
function applyCase(html: string, creditor: Creditor | undefined, d: StudioDebtor | undefined): string {
  const map: Record<string, string> = {};
  if (d)
    Object.assign(map, {
      "[Qarzdor nomi]": d.name,
      "[Qarzdor STIR]": d.tin,
      "[Shartnoma raqami]": d.contractNumber,
      "[Faktura raqami]": d.invoiceNumber,
      "[Asosiy qarz]": d.principal,
      "[Penya]": d.penalty,
      "[Jami summa]": d.total,
      "[Kechikish kunlari]": d.overdueDays,
      "[Davlat boji]": d.stateDuty,
    });
  if (creditor)
    Object.assign(map, {
      "[Kreditor nomi]": creditor.name,
      "[Kreditor STIR]": creditor.tin,
      "[Kreditor manzili]": creditor.address,
      "[Kreditor h/r]": creditor.bankAccount,
      "[Kreditor MFO]": creditor.bankMfo,
      "[Kreditor telefoni]": creditor.phone,
      "[Kreditor direktori]": creditor.director,
      "[Shahar]": creditor.city,
    });
  map["[Sana]"] = todayStr();
  let out = html;
  for (const [needle, value] of Object.entries(map)) {
    if (value) out = out.split(needle).join(value);
  }
  return out;
}
/** Hujjatдаги to'ldirilmagan [joy]lar ro'yxati (takrorlanmas). */
function unfilledFields(html: string): string[] {
  const found = html.match(/\[[^\]\n]{1,40}\]/g) ?? [];
  return [...new Set(found)];
}

/** PII (maxfiy shaxsiy ma'lumot) — karta, JShShIR, telefon, pasport, email. */
const PII_PATTERNS: { type: string; re: RegExp }[] = [
  { type: "Karta raqami", re: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g },
  { type: "JShShIR (PINFL)", re: /\b\d{14}\b/g },
  { type: "Telefon", re: /\+?998[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/g },
  { type: "Pasport", re: /\b[A-Z]{2}[\s-]?\d{7}\b/g },
  { type: "Email", re: /\b[\w.-]+@[\w.-]+\.\w{2,}\b/g },
];
function detectPii(text: string): { type: string; value: string }[] {
  const out: { type: string; value: string }[] = [];
  const seen = new Set<string>();
  for (const p of PII_PATTERNS) {
    for (const m of text.matchAll(p.re)) {
      const v = m[0];
      if (!seen.has(v)) {
        seen.add(v);
        out.push({ type: p.type, value: v });
      }
    }
  }
  return out;
}
function maskPii(v: string): string {
  if (v.includes("@")) {
    const [a, b] = v.split("@");
    return (a?.[0] ?? "") + "•••@" + (b ?? "");
  }
  return v.length > 4 ? "•".repeat(v.length - 4) + v.slice(-4) : "•".repeat(v.length);
}

function TemplateLibrary({
  locale,
  t,
  onPick,
}: {
  locale: string;
  t: ReturnType<typeof useTranslations>;
  onPick: (tpl: Template) => void;
}) {
  const L = (o: Loc) => (locale === "ru" ? o.ru : o.uz);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"all" | CatKey>("all");
  const query = q.trim().toLowerCase();
  const list = CATALOG.filter((tpl) => {
    if (cat !== "all" && tpl.cat !== cat) return false;
    if (!query) return true;
    return L(tpl.title).toLowerCase().includes(query) || tpl.kw.includes(query);
  });
  return (
    <div className="scroll-clean min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-background p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-secondary text-white shadow-lg shadow-primary/25">
            <SquaresFour weight="fill" className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">{t("pickTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("pickSub")}</p>
          </div>
        </div>

        {/* Qidiruv */}
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 focus-within:border-primary/40">
          <MagnifyingGlass className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={locale === "ru" ? "Поиск шаблона…" : "Shablon qidirish…"}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          {q && (
            <button onClick={() => setQ("")} className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground">
              ✕
            </button>
          )}
        </div>

        {/* Kategoriya filtri */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {CATS.map((c) => (
            <button
              key={c.key}
              onClick={() => setCat(c.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                cat === c.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/40",
              )}
            >
              {L(c.label)}
            </button>
          ))}
        </div>

        {/* Shablonlar */}
        {list.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{locale === "ru" ? "Ничего не найдено" : "Hech narsa topilmadi"}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {list.map((tpl) => {
              const Ic = tpl.icon;
              return (
                <button
                  key={tpl.key}
                  onClick={() => onPick(tpl)}
                  className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary transition-colors group-hover:bg-gradient-to-br group-hover:from-primary group-hover:to-secondary group-hover:text-white">
                    <Ic weight="fill" className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{L(tpl.title)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{L(tpl.desc)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function DocumentStudio({ debtors, creditor }: { debtors: StudioDebtor[]; creditor?: Creditor }) {
  const t = useTranslations("studio");
  const locale = useLocale();
  const Lc = (o: Loc) => (locale === "ru" ? o.ru : o.uz);
  const searchParams = useSearchParams();

  // ?template=<key> — kutubxonadagi istalgan shablonni to'g'ridan-to'g'ri ochish.
  const initTplKey = searchParams.get("template");
  const initTpl = initTplKey ? CATALOG.find((x) => x.key === initTplKey) : undefined;
  const initHtml = initTpl?.html; // "blank" → "" (bo'sh muharrir), topilmasa → undefined (kutubxona)
  // ?debtor=<id> — ochilishda o'sha qarzdor bilan avtomatik to'ldirish (akt-sverka, talabnoma...).
  const initDebtor = debtors.find((x) => x.id === searchParams.get("debtor"));

  const [debtorId, setDebtorId] = useState(initDebtor?.id ?? "");
  const [title, setTitle] = useState(searchParams.get("title") ?? (initTpl && initTpl.key !== "blank" ? Lc(initTpl.title) : ""));
  const [docHtml, setDocHtml] = useState(initHtml !== undefined ? applyCase(initHtml, creditor, initDebtor) : "");
  const [picker, setPicker] = useState(initHtml === undefined);
  // Rejim: "ai" = chapda AI chat; "template" = o'ngda qo'lda to'ldirish paneli (TrustContract uslubi).
  const [mode, setMode] = useState<"ai" | "template">(initTpl && initTpl.key !== "blank" ? "template" : "ai");
  const [messages, setMessages] = useState<AiMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const editorRef = useRef<Editor | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Versiyalar (hujjat tarixi) — snapshotlar, tiklash imkoni bilan.
  interface DocVersion {
    id: number;
    label: string;
    html: string;
    at: string;
  }
  const [versions, setVersions] = useState<DocVersion[]>([]);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const verId = useRef(0);

  // Sud (yoki boshqa bo'lim) "Da'voni tahrirlash" bilan yuborgan hujjatni ochish.
  useEffect(() => {
    if (searchParams.get("handoff") !== "1") return;
    try {
      const raw = sessionStorage.getItem("lex:studio-doc");
      if (!raw) return;
      const { title: ht, html } = JSON.parse(raw) as { title?: string; html?: string };
      if (ht) setTitle(ht);
      if (typeof html === "string") setDocHtml(html);
      setPicker(false);
      sessionStorage.removeItem("lex:studio-doc");
    } catch {
      /* noto'g'ri handoff — e'tiborsiz */
    }
  }, [searchParams]);

  const text = plainText(docHtml);
  const words = text ? text.split(" ").length : 0;
  const hasDoc = words > 0;
  const unfilled = unfilledFields(docHtml); // to'ldirilmagan [joy]lar
  const pii = detectPii(text); // maxfiy ma'lumotlar (PII)
  const [piiOpen, setPiiOpen] = useState(false);
  function maskAllPii() {
    let out = docHtml;
    for (const p of pii) out = out.split(p.value).join(maskPii(p.value));
    setDocHtml(out);
    setPiiOpen(false);
  }

  // Studio AI — STREAMING: javob harfma-harf keladi va oxirgi AI xabariga yoziladi.
  async function ask(prompt: string, docOverride?: string) {
    const q = prompt.trim();
    if (!q || loading) return;
    const docText = docOverride ?? text;
    const wasEmpty = !text.trim() && !docOverride; // hujjat bo'sh → AI natijani o'ng ekranga o'tkazamiz
    setInput("");
    // Foydalanuvchi savoli + bo'sh AI "joy" (oqim shunga to'ldiriladi).
    setMessages((m) => [...m, { role: "user", text: q }, { role: "ai", text: "" }]);
    setLoading(true);
    const setLast = (val: string) =>
      setMessages((m) => {
        const n = m.slice();
        n[n.length - 1] = { role: "ai", text: val };
        return n;
      });
    const toBottom = () => requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
    try {
      const res = await fetch("/api/studio/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: q, document: docText }),
      });
      if (!res.ok || !res.body) throw new Error("stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setLast(acc);
        toBottom();
      }
      if (!acc.trim()) setLast(t("aiError"));
      else if (wasEmpty && acc.trim().length > 100) insertToDoc(acc); // birinchi hujjat → o'ng ekranga
    } catch {
      setLast(t("aiError"));
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
    }
  }

  // Tez amallar — hujjat matni AI'ga kontekst sifatida (ask ichida) uzatiladi.
  function docAction(instruction: string) {
    ask(instruction);
  }

  function insertToDoc(aiText: string) {
    if (plainText(docHtml)) snapshot(locale === "ru" ? "до вставки AI" : "AI qo'shishdan oldin");
    const html = toHtml(aiText);
    if (editorRef.current) editorRef.current.chain().focus().insertContent(html).run();
    else setDocHtml((h) => h + html);
  }

  // ── Versiyalash: joriy holatni tarixga saqlaydi (oxirgi 20 ta). ──
  function snapshot(label: string) {
    const html = docHtml;
    if (!plainText(html)) return; // bo'sh hujjatni saqlamaymiz
    verId.current += 1;
    const at = new Date().toLocaleString(locale === "ru" ? "ru-RU" : "uz-UZ", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
    setVersions((v) => [{ id: verId.current, label, html, at }, ...v].slice(0, 20));
  }
  function restoreVersion(v: DocVersion) {
    snapshot(locale === "ru" ? "перед откатом" : "tiklashdan oldin");
    setDocHtml(v.html);
    setVersionsOpen(false);
  }

  function chooseTemplate(tpl: Template) {
    if (plainText(docHtml)) snapshot(locale === "ru" ? "до шаблона" : "shablon oldidan");
    const d = debtors.find((x) => x.id === debtorId);
    setDocHtml(applyCase(tpl.html, creditor, d));
    if (!title.trim() && tpl.key !== "blank") setTitle(Lc(tpl.title));
    setPicker(false);
  }

  // ── Fayl yuklab tahlil: matn ajratib, editorga yuklaydi va AI tahlilini boshlaydi. ──
  async function onFilePicked(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // bir xil faylni qayta tanlash mumkin bo'lsin
    if (!file || loading) return;
    if (file.size > 8 * 1024 * 1024) {
      setMessages((m) => [...m, { role: "ai", text: locale === "ru" ? "Файл слишком большой (макс. 8 МБ)." : "Fayl juda katta (maks. 8 MB)." }]);
      return;
    }
    let extracted = "";
    try {
      extracted = (await extractFileText(file)).trim();
    } catch {
      setMessages((m) => [...m, { role: "ai", text: locale === "ru" ? "Не удалось прочитать файл. Поддерживаются .docx, .txt, .rtf, .html." : "Faylni o'qib bo'lmadi. .docx, .txt, .rtf, .html qo'llab-quvvatlanadi." }]);
      return;
    }
    if (!extracted) {
      setMessages((m) => [...m, { role: "ai", text: locale === "ru" ? "В файле нет текста." : "Faylda matn topilmadi." }]);
      return;
    }
    if (plainText(docHtml)) snapshot(locale === "ru" ? "до загрузки" : "yuklashdan oldin");
    setDocHtml(toHtml(extracted));
    setTitle((tt) => tt.trim() || file.name.replace(/\.[^.]+$/, ""));
    setPicker(false);
    // Yuklangan matnni to'g'ridan-to'g'ri AI'ga (docOverride) berib tahlil qildiramiz.
    ask(t("qRisks"), extracted);
  }

  // Tanlangan qarzdor ma'lumotini joriy hujjatga to'ldiradi (RichEditor value orqali
  // o'zini sinxronlaydi; qo'lda tahrir shundan keyin ham davom etadi).
  function fillFromDebtor(id: string) {
    setDebtorId(id);
    const d = debtors.find((x) => x.id === id);
    setDocHtml(applyCase(docHtml, creditor, d));
  }

  const [exportOpen, setExportOpen] = useState(false);

  // AI yordamchi paneli — CHAP tomonда (default ochiq). Chat orqali hujjat tayyorlaysiz,
  // AI natijani o'ng tomondagi A4 ekranga o'tkazadi; o'sha yerда tahrirlaysiz.
  const [aiOpen, setAiOpen] = useState(true);

  // ── Qo'lda boshqariladigan to'ldirish: har [joy] uchun aniq input (matn ichidan qidirilmaydi) ──
  const [fillOpen, setFillOpen] = useState(false);
  const [fillValues, setFillValues] = useState<Record<string, string>>({});
  function applyFill() {
    let out = docHtml;
    for (const [ph, val] of Object.entries(fillValues)) {
      if (val.trim()) out = out.split(ph).join(val.trim());
    }
    setDocHtml(out);
    setFillValues({});
    setFillOpen(false);
  }

  const docName = () => (title.trim() || t("untitled")).replace(/[^\p{L}\p{N} _-]/gu, "");
  const bodyHtml = () => docHtml || `<p>${escapeHtml(text)}</p>`;

  function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  }
  function exportHtml() {
    const name = docName();
    saveBlob(new Blob([`<!doctype html><meta charset="utf-8"><title>${escapeHtml(name)}</title><body>${bodyHtml()}</body>`], { type: "text/html" }), `${name}.html`);
  }
  function exportWord() {
    const name = docName();
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${escapeHtml(name)}</title></head><body style="font-family:'Times New Roman',serif;font-size:14px">${bodyHtml()}</body></html>`;
    saveBlob(new Blob(["﻿", html], { type: "application/msword" }), `${name}.doc`);
  }
  function exportPdf() {
    const name = docName();
    const win = window.open("", "_blank", "width=820,height=1040");
    if (!win) return;
    win.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(name)}</title><style>@page{margin:2cm}body{font-family:'Times New Roman',Georgia,serif;font-size:14px;line-height:1.65;color:#111;max-width:720px;margin:0 auto;padding:1cm}h2{font-size:18px;text-align:center}h3{font-size:15px}p{margin:.5em 0}</style></head><body>${bodyHtml()}</body></html>`,
    );
    win.document.close();
    win.focus();
    setExportOpen(false);
    setTimeout(() => win.print(), 350);
  }

  // Soha bo'yicha kuchli huquqiy tahlil — strukturaviy hisobot beruvchi promptlar.
  const QUICK: { label: Loc; prompt: Loc }[] = [
    {
      label: { uz: "To'liq tahlil", ru: "Полный анализ" },
      prompt: {
        uz: "Ushbu hujjatni professional yurist sifatida TO'LIQ tahlil qil. Quyidagi tuzilmада, har bo'lim sarlavha bilan javob ber:\n1) HUJJAT TURI VA MAQSADI\n2) XAVFLI YOKI KAMCHILIKLI BANDLAR — aniq band va nega xavfli\n3) YETISHMAGAN MAJBURIY REKVIZITLAR/ELEMENTLAR va bo'sh [joy]lar\n4) QONUNCHILIKKA MUVOFIQLIK — O'zbekiston qonunlariga mosligi (kodeks NOMINI yoz; modda raqamini FAQAT aniq bilsang)\n5) ANIQ TAVSIYALAR. Qisqa, amaliy.",
        ru: "Проанализируй документ как профессиональный юрист. Ответь по структуре, каждый раздел с заголовком:\n1) ТИП И ЦЕЛЬ ДОКУМЕНТА\n2) РИСКОВЫЕ/НЕДОСТАЮЩИЕ ПУНКТЫ\n3) НЕДОСТАЮЩИЕ ОБЯЗАТЕЛЬНЫЕ РЕКВИЗИТЫ и пустые [места]\n4) СООТВЕТСТВИЕ ЗАКОНОДАТЕЛЬСТВУ РУз (название кодекса; номер статьи только если уверен)\n5) КОНКРЕТНЫЕ РЕКОМЕНДАЦИИ.",
      },
    },
    {
      label: { uz: "Xavfli bandlar", ru: "Рисковые пункты" },
      prompt: {
        uz: "Hujjatdagi XAVFLI, noaniq yoki bir tomonga zarar keltiruvchi bandlarni top. Har biri uchun: band matni, xavf nima, tavsiya. Ro'yxat shaklida.",
        ru: "Найди рисковые, неоднозначные или невыгодные пункты. Для каждого: текст пункта, риск, рекомендация. Списком.",
      },
    },
    {
      label: { uz: "Rekvizit tekshiruvi", ru: "Проверка реквизитов" },
      prompt: {
        uz: "Hujjatning majburiy rekvizitlari to'liqmi tekshir: tomonlar nomi va STIR, manzil, sana, hujjat raqami, summa, imzo, ilovalar. Yetishmaganini va bo'sh [joy]larni ro'yxat qil.",
        ru: "Проверь обязательные реквизиты: стороны и ИНН, адрес, дата, номер, сумма, подпись, приложения. Перечисли недостающее и пустые [места].",
      },
    },
    {
      label: { uz: "Huquqiy asos", ru: "Правовая основа" },
      prompt: {
        uz: "Hujjatni O'zbekiston Fuqarolik kodeksi va Iqtisodiy protsessual kodeks nuqtai nazaridan tekshir: qaysi qoidalarga tayanadi, huquqiy oqibatlar, muvofiqlik. Kodeks NOMINI yoz; modda raqamini FAQAT 100% aniq bilsang.",
        ru: "Проверь документ с точки зрения ГК и ЭПК РУз: на какие нормы опирается, правовые последствия, соответствие. Название кодекса; номер статьи только при 100% уверенности.",
      },
    },
    {
      label: { uz: "Soddalashtir", ru: "Упростить" },
      prompt: {
        uz: "Hujjatni oddiy, tushunarli tilда qisqacha tushuntir: asosiy mazmun, tomonlar majburiyatlari, muddatlar va summalar.",
        ru: "Объясни документ простым языком: суть, обязанности сторон, сроки и суммы.",
      },
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* ── Rejim tanlash: AI asosida / Namuna asosida ── */}
      <div className="flex items-center">
        <div className="inline-flex rounded-xl border border-border bg-card p-1 text-sm font-medium">
          <button
            onClick={() => {
              setMode("ai");
              setPicker(false);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 transition-colors",
              mode === "ai" ? "bg-gradient-to-br from-primary to-secondary text-white shadow" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <MagicWand weight={mode === "ai" ? "fill" : "regular"} className="size-4" /> {locale === "ru" ? "С помощью AI" : "AI asosida tayyorlash"}
          </button>
          <button
            onClick={() => {
              setMode("template");
              setPicker(true);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 transition-colors",
              mode === "template" ? "bg-gradient-to-br from-primary to-secondary text-white shadow" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <SquaresFour weight={mode === "template" ? "fill" : "regular"} className="size-4" /> {locale === "ru" ? "Из шаблона" : "Namuna asosida tayyorlash"}
          </button>
        </div>
      </div>

      {picker ? (
        <TemplateLibrary locale={locale} t={t} onPick={chooseTemplate} />
      ) : (
        <div
          className={cn(
            "grid min-h-0 flex-1 gap-4",
            mode === "ai" && aiOpen && "lg:grid-cols-[minmax(340px,380px)_1fr]",
            mode === "template" && "lg:grid-cols-[1fr_minmax(300px,360px)]",
          )}
        >
          {/* ── Hujjat muharriri ─────────────────────────── */}
          <div className={cn("flex min-h-0 min-w-0 flex-col", mode === "ai" && "lg:order-2")}>
            <div className="mb-3 flex flex-wrap items-center gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("titlePlaceholder")}
            className="min-w-0 flex-1 border-0 bg-transparent font-display text-xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50"
          />
          <span className="shrink-0 text-xs text-muted-foreground">{t("words", { n: words })}</span>
          {hasDoc && unfilled.length > 0 && (
            <button
              type="button"
              onClick={() => setFillOpen(true)}
              title="Bosing — har bir joyni forma orqali to'ldiring"
              className="shrink-0 rounded-lg bg-amber-500/15 px-2 py-1 text-xs font-semibold text-amber-600 transition-colors hover:bg-amber-500/25"
            >
              {unfilled.length} joyni to'ldirish
            </button>
          )}
          {hasDoc && pii.length > 0 && (
            <button
              type="button"
              onClick={() => setPiiOpen(true)}
              title="Maxfiy ma'lumotlar — bosing"
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-red-500/15 px-2 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-500/25"
            >
              <ShieldWarning weight="fill" className="size-3.5" /> {pii.length} PII
            </button>
          )}
          {mode === "ai" && (
            <button
              type="button"
              onClick={() => setAiOpen((o) => !o)}
              title="AI yordamchi"
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                aiOpen ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:border-primary/40",
              )}
            >
              <Sparkle weight="fill" className="size-4" /> AI
            </button>
          )}
          {debtors.length > 0 && (
            <select
              value={debtorId}
              onChange={(e) => fillFromDebtor(e.target.value)}
              title={t("autofillHint")}
              className="max-w-[190px] shrink-0 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm outline-none focus:border-primary/50"
            >
              <option value="">{t("autofill")}</option>
              {debtors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · {d.invoiceNumber}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setPicker(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:border-muted-foreground/30"
          >
            <SquaresFour className="size-4" /> {t("templates")}
          </button>

          {/* Yashirin fayl input — fayl yuklab tahlil */}
          <input
            ref={fileRef}
            type="file"
            accept=".docx,.txt,.md,.rtf,.html,.htm,.csv"
            className="hidden"
            onChange={onFilePicked}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={loading}
            title={locale === "ru" ? "Загрузить документ (.docx, .txt, .rtf) и проанализировать" : "Hujjat yuklash (.docx, .txt, .rtf) va tahlil qilish"}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:border-muted-foreground/30 disabled:opacity-40"
          >
            <UploadSimple className="size-4" /> <span className="hidden sm:inline">{locale === "ru" ? "Загрузить" : "Yuklash"}</span>
          </button>

          {/* Versiyalar (hujjat tarixi) */}
          <div className="relative shrink-0">
            <button
              onClick={() => setVersionsOpen((o) => !o)}
              title={locale === "ru" ? "Версии документа" : "Hujjat versiyalari"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:border-muted-foreground/30"
            >
              <ClockCounterClockwise className="size-4" />
              {versions.length > 0 && <span className="text-xs text-muted-foreground">{versions.length}</span>}
              <CaretDown className={cn("size-3.5 transition-transform", versionsOpen && "rotate-180")} />
            </button>
            {versionsOpen && (
              <>
                <button type="button" aria-label="close" className="fixed inset-0 z-10 cursor-default" onClick={() => setVersionsOpen(false)} />
                <div className="absolute right-0 z-20 mt-1 max-h-80 w-64 overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-lg scroll-clean">
                  <button
                    onClick={() => {
                      snapshot(locale === "ru" ? "ручное сохранение" : "qo'lda saqlash");
                      setVersionsOpen(false);
                    }}
                    disabled={!hasDoc}
                    className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-muted disabled:opacity-40"
                  >
                    <ClockCounterClockwise weight="fill" className="size-4 text-primary" /> {locale === "ru" ? "Сохранить версию" : "Versiyani saqlash"}
                  </button>
                  {versions.length === 0 ? (
                    <p className="px-3 py-3 text-center text-xs text-muted-foreground">{locale === "ru" ? "Пока нет версий" : "Hozircha versiya yo'q"}</p>
                  ) : (
                    versions.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => restoreVersion(v)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          <span className="text-muted-foreground">{v.at}</span> · {v.label}
                        </span>
                        <ArrowCounterClockwise className="size-3.5 shrink-0 text-primary" />
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <div className="relative shrink-0">
            <button
              onClick={() => setExportOpen((o) => !o)}
              disabled={!hasDoc}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:border-muted-foreground/30 disabled:opacity-40"
            >
              <DownloadSimple className="size-4" /> {t("export")}
              <CaretDown className={cn("size-3.5 transition-transform", exportOpen && "rotate-180")} />
            </button>
            {exportOpen && (
              <>
                <button type="button" aria-label="close" className="fixed inset-0 z-10 cursor-default" onClick={() => setExportOpen(false)} />
                <div className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg">
                  <button onClick={exportWord} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted">
                    <FileDoc weight="fill" className="size-4 text-blue-600" /> {t("exportWord")}
                  </button>
                  <button onClick={exportPdf} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted">
                    <FilePdf weight="fill" className="size-4 text-red-500" /> {t("exportPdf")}
                  </button>
                  <button onClick={exportHtml} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted">
                    <FileHtml weight="fill" className="size-4 text-orange-500" /> {t("exportHtml")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
            <RichEditor value={docHtml} onChange={setDocHtml} onReady={(e) => (editorRef.current = e)} className="min-h-0 flex-1" paper />
          </div>

          {/* ── AI Yordamchi paneli (faqat AI rejimида, chap tomon) ──────────────────────── */}
          {mode === "ai" && aiOpen && (
          <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card lg:order-1">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-secondary text-white">
            <Sparkle weight="fill" className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold">{t("assistant")}</p>
            <p className="truncate text-[11px] text-muted-foreground">{t("assistantSub")}</p>
          </div>
        </div>

        {/* Hujjat tahlili — soha bo'yicha kuchli amallar */}
        <div className="border-b border-border px-3 py-2.5">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <MagicWand weight="fill" className="size-3.5 text-primary" /> {locale === "ru" ? "Анализ документа" : "Hujjat tahlili"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map((q, i) => (
              <button
                key={i}
                onClick={() => docAction(Lc(q.prompt))}
                disabled={!hasDoc || loading}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-40"
              >
                {Lc(q.label)}
              </button>
            ))}
          </div>
        </div>

        {/* Xabarlar */}
        <div ref={scrollRef} className="scroll-clean min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
          {messages.length === 0 && (
            <div className="flex h-full flex-col justify-center gap-3 px-1">
              <div className="text-center">
                <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-white">
                  <Sparkle weight="fill" className="size-5" />
                </span>
                <p className="mt-2 text-sm font-semibold text-foreground">{t("welcome")}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("welcomeSub")}</p>
              </div>
              <div className="rounded-xl border border-border bg-background/60 p-3">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{locale === "ru" ? "Я умею:" : "Men:"}</p>
                <ul className="space-y-1 text-xs text-foreground/90">
                  {(locale === "ru"
                    ? ["Готовлю документ (требование, иск, договор...)", "Нахожу риски и недостающие реквизиты", "Объясняю сложный текст простым языком", "Редактирую и переношу документ в правое окно"]
                    : ["Tayyor hujjat tuzaman (talabnoma, da'vo, shartnoma...)", "Xavflar va yetishmagan rekvizitlarni topaman", "Murakkab matnni oddiy tilда tushuntiraman", "Hujjatni tahrirlab, o'ng ekranga o'tkazaman"]
                  ).map((s) => (
                    <li key={s} className="flex gap-1.5">
                      <span className="text-primary">•</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="px-1 text-center text-[11px] text-muted-foreground">{locale === "ru" ? "Например: «Подготовь требование для GLOBAL SNAB»" : "Masalan: «GLOBAL SNAB MChJ ga talabnoma tayyorla»"}</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn("flex flex-col gap-1", m.role === "user" ? "items-end" : "items-start")}>
              <div
                className={cn(
                  "max-w-[92%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[13px] leading-relaxed",
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                )}
              >
                {m.text}
                {m.role === "ai" && loading && i === messages.length - 1 && (
                  <span className="ml-0.5 inline-block w-1.5 animate-pulse text-primary">▍</span>
                )}
              </div>
              {m.role === "ai" && m.text.trim() && (
                <button
                  onClick={() => insertToDoc(m.text)}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary-soft"
                >
                  <Plus className="size-3" /> {t("insert")}
                </button>
              )}
            </div>
          ))}
          {loading && !messages[messages.length - 1]?.text && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CircleNotch className="size-4 animate-spin" /> {t("thinking")}
            </div>
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="border-t border-border p-2.5"
        >
          <div className="flex items-end gap-2 rounded-xl border border-border bg-background p-1.5 focus-within:border-primary/40">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(input);
                }
              }}
              rows={1}
              placeholder={t("inputPlaceholder")}
              className="scroll-clean max-h-28 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <ArrowRight weight="bold" className="size-4" />
            </button>
          </div>
          <p className="mt-1.5 flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
            <WarningCircle className="size-3" /> {t("disclaimer")}
          </p>
        </form>
          </aside>
          )}

          {/* ── Namuna rejimi: qo'lda to'ldirish paneli (o'ng tomon, TrustContract uslubi) ── */}
          {mode === "template" && (
            <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <p className="font-display text-sm font-semibold">{locale === "ru" ? "Заполнение данных" : "Ma'lumotlarni to'ldirish"}</p>
                <p className="text-[11px] text-muted-foreground">{locale === "ru" ? "Заполните поля — попадут в документ" : "Maydonlarni to'ldiring — hujjatga o'zi tushadi"}</p>
              </div>
              <div className="scroll-clean min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                {unfilled.length === 0 ? (
                  <p className="py-8 text-center text-sm font-medium text-emerald-600">{locale === "ru" ? "Всё заполнено ✓" : "Hammasi to'ldirilgan ✓"}</p>
                ) : (
                  unfilled.map((ph) => (
                    <label key={ph} className="block">
                      <span className="text-[11px] font-medium text-muted-foreground">{ph.replace(/[[\]]/g, "")}</span>
                      <input
                        value={fillValues[ph] ?? ""}
                        onChange={(e) => setFillValues((v) => ({ ...v, [ph]: e.target.value }))}
                        placeholder={ph.replace(/[[\]]/g, "")}
                        className="mt-0.5 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary/50"
                      />
                    </label>
                  ))
                )}
              </div>
              {unfilled.length > 0 && (
                <div className="border-t border-border p-3">
                  <button onClick={applyFill} className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.01]">
                    {locale === "ru" ? "Вставить" : "Joylashtirish"}
                  </button>
                </div>
              )}
            </aside>
          )}
        </div>
      )}

      {/* Qo'lda to'ldirish formasi — har [joy] uchun input */}
      {fillOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setFillOpen(false)}>
          <div className="flex max-h-[82vh] w-full max-w-md flex-col rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <h3 className="font-display text-lg font-semibold">Joylarni to'ldirish</h3>
                <p className="text-xs text-muted-foreground">Har bir maydonni yozing — hujjatga o'zi tushadi</p>
              </div>
              <button onClick={() => setFillOpen(false)} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
                ✕
              </button>
            </div>
            <div className="flex-1 space-y-2 overflow-auto p-4">
              {unfilled.length === 0 ? (
                <p className="py-6 text-center text-sm font-medium text-emerald-600">Hammasi to'ldirilgan ✓</p>
              ) : (
                unfilled.map((ph) => (
                  <label key={ph} className="block">
                    <span className="text-xs font-medium text-muted-foreground">{ph.replace(/[[\]]/g, "")}</span>
                    <input
                      value={fillValues[ph] ?? ""}
                      onChange={(e) => setFillValues((v) => ({ ...v, [ph]: e.target.value }))}
                      className="mt-0.5 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary/50"
                    />
                  </label>
                ))
              )}
            </div>
            {unfilled.length > 0 && (
              <div className="border-t border-border p-4">
                <button onClick={applyFill} className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.01]">
                  Joylashtirish
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PII — maxfiy ma'lumotlar paneli */}
      {piiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPiiOpen(false)}>
          <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <h3 className="flex items-center gap-1.5 font-display text-lg font-semibold">
                  <ShieldWarning weight="fill" className="size-5 text-red-500" /> Maxfiy ma'lumotlar
                </h3>
                <p className="text-xs text-muted-foreground">Hujjatда {pii.length} ta maxfiy ma'lumot topildi</p>
              </div>
              <button onClick={() => setPiiOpen(false)} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
                <X className="size-4" />
              </button>
            </div>
            <div className="scroll-clean min-h-0 flex-1 space-y-1.5 overflow-auto p-4">
              {pii.map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2">
                  <span className="font-mono text-sm">{p.value}</span>
                  <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{p.type}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border p-4">
              <button onClick={maskAllPii} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.01]">
                <ShieldWarning weight="fill" className="size-4" /> Hammasini maskalash (••••)
              </button>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">Hujjatni tashqariga yuborishдан oldin maxfiy ma'lumotlarni yashiring.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
