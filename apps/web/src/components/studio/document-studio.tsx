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
  PenNib,
  Plus,
  Prohibit,
  Receipt,
  Scroll,
  ShieldCheck,
  Sparkle,
  SquaresFour,
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

const CATALOG: Template[] = [
  // ── Undiruv (qarz undirish hujjatlari) ──
  {
    key: "demand",
    cat: "collection",
    icon: Scroll,
    title: { uz: "Talabnoma", ru: "Требование" },
    desc: { uz: "Qarzdorga muddati o'tgan qarz to'g'risida rasmiy talab", ru: "Требование должнику о погашении просроченного долга" },
    kw: "talabnoma qarz undiruv trebovanie dolg pretenziya",
    html: `<h2>TALABNOMA</h2><p>Hurmatli [Qarzdor nomi]!</p><p>"[Kreditor nomi]" Siz bilan tuzilgan shartnoma bo'yicha muddati o'tgan qarzdorlik yuzaga kelganini ma'lum qiladi.</p><p><strong>Shartnoma:</strong> № [Shartnoma raqami]<br><strong>Hisob-faktura:</strong> [Faktura raqami]</p><p><strong>Asosiy qarz:</strong> [Asosiy qarz]<br><strong>Penya ([Kechikish kunlari] kun):</strong> [Penya]<br><strong>Jami to'lanishi lozim:</strong> [Jami summa]</p><p>Ushbu talabnoma olingan kundan boshlab [Muddat] kalendar kun ichida qarzni to'liq to'lashingizni talab qilamiz. Aks holda kreditor O'zbekiston Respublikasi qonunchiligiga muvofiq iqtisodiy sudga da'vo arizasi bilan murojaat qilish huquqini o'zida saqlaydi.</p><p>Hurmat bilan,<br>[Kreditor nomi]<br>[Imzolovchi F.I.Sh, lavozim]</p>`,
  },
  {
    key: "pretenzia",
    cat: "collection",
    icon: Megaphone,
    title: { uz: "Pretenziya", ru: "Претензия" },
    desc: { uz: "Sudgacha (pretenziya) tartibida rasmiy da'vo xati", ru: "Досудебная претензия перед подачей иска" },
    kw: "pretenziya sudgacha dosudebnaya pretenzia da'vo",
    html: `<h2>PRETENZIYA</h2><p>[Sana], № [Chiquvchi raqam]</p><p>Kimga: "[Qarzdor nomi]" (STIR [Qarzdor STIR])</p><p>"[Kreditor nomi]" № [Shartnoma raqami] shartnoma va [Faktura raqami] hisob-faktura bo'yicha yuzaga kelgan qarzdorlik yuzasidan ushbu pretenziyani yo'llaydi.</p><p><strong>Asosiy qarz:</strong> [Asosiy qarz]<br><strong>Penya ([Kechikish kunlari] kun):</strong> [Penya]<br><strong>Jami:</strong> [Jami summa]</p><p>O'zbekiston Respublikasi Iqtisodiy protsessual kodeksining sudgacha (pretenziya) tartibi talablariga muvofiq, ushbu pretenziya olingan kundan boshlab [Muddat] kun ichida qarzni to'lashingizni talab qilamiz. Aks holda da'vo iqtisodiy sudga taqdim etiladi.</p><p>Hurmat bilan,<br>[Kreditor nomi]<br>[Imzolovchi F.I.Sh, lavozim]</p>`,
  },
  {
    key: "lawsuit",
    cat: "collection",
    icon: Gavel,
    title: { uz: "Da'vo arizasi", ru: "Исковое заявление" },
    desc: { uz: "Iqtisodiy sudga qarz undirish uchun da'vo arizasi", ru: "Исковое заявление о взыскании долга в экономический суд" },
    kw: "da'vo ariza sud isk iskovoe zayavlenie undiruv",
    html: `<h2>IQTISODIY SUDGA DA'VO ARIZASI</h2><p><strong>Da'vogar:</strong> "[Kreditor nomi]", STIR: [Da'vogar STIR]<br><strong>Javobgar:</strong> "[Qarzdor nomi]", STIR: [Qarzdor STIR]<br><strong>Da'vo narxi:</strong> [Jami summa]<br><strong>Davlat boji:</strong> [Davlat boji]</p><p>Da'vogar va javobgar o'rtasida [Shartnoma raqami] shartnoma tuzilgan. [Faktura raqami] hisob-faktura bo'yicha javobgar zimmasiga to'lov majburiyati yuklatilgan.</p><p>Javobgar to'lovni belgilangan muddatda bajarmagan. Asosiy qarz [Asosiy qarz], [Kechikish kunlari] kun kechikish uchun penya [Penya].</p><p><strong>Huquqiy asos:</strong> O'zbekiston Respublikasi Fuqarolik kodeksi va Iqtisodiy protsessual kodeksi.</p><p><strong>SO'RAYMAN:</strong> Javobgardan da'vogar foydasiga jami [Jami summa] undirilsin. Davlat boji javobgar zimmasiga yuklatilsin.</p><p>Da'vogar nomidan: [Imzolovchi] _________________ (imzo, sana)</p>`,
  },
  {
    key: "reconciliation",
    cat: "collection",
    icon: ClipboardText,
    title: { uz: "Akt-sverka", ru: "Акт сверки" },
    desc: { uz: "Tomonlar o'rtasidagi o'zaro hisob-kitob solishtirmasi", ru: "Акт сверки взаиморасчётов между сторонами" },
    kw: "akt sverka solishtirma dalolatnoma hisob-kitob saldo",
    html: `<h2>SOLISHTIRMA DALOLATNOMA (AKT-SVERKA)</h2><p>"[Kreditor nomi]" va "[Qarzdor nomi]" (STIR [Qarzdor STIR]) o'rtasida [Sana] holatiga tuzildi.</p><p>Shartnoma: [Shartnoma raqami] · Hisob-faktura: [Faktura raqami]</p><p><strong>Asosiy qarz:</strong> [Asosiy qarz]<br><strong>Penya:</strong> [Penya]<br><strong>Yakuniy qoldiq (saldo):</strong> [Jami summa]</p><p>Kreditor nomidan: _________________ (imzo, sana)<br>Qarzdor nomidan: _________________ (imzo, sana)</p>`,
  },
  {
    key: "reply",
    cat: "collection",
    icon: Envelope,
    title: { uz: "Javob xati", ru: "Ответное письмо" },
    desc: { uz: "Kelib tushgan xat yoki da'voga rasmiy javob", ru: "Официальный ответ на входящее письмо или претензию" },
    kw: "javob xati pismo otvet rasmiy xat",
    html: `<h2>JAVOB XATI</h2><p>[Sana], № [Chiquvchi raqam]</p><p>Kimga: "[Qarzdor nomi]"</p><p>Hurmatli [F.I.Sh]!</p><p>Sizning [Sana] dagi № [Kiruvchi raqam] xatingizga javoban quyidagilarni ma'lum qilamiz:</p><p>[Javob matnini shu yerga yozing]</p><p>Hurmat bilan,<br>[Kreditor nomi]<br>[Imzolovchi F.I.Sh, lavozim]</p>`,
  },
  // ── Shartnomalar ──
  {
    key: "contract",
    cat: "contract",
    icon: Handshake,
    title: { uz: "Oldi-sotdi shartnomasi", ru: "Договор купли-продажи" },
    desc: { uz: "Tovar (xizmat) oldi-sotdisi bo'yicha umumiy shartnoma", ru: "Общий договор купли-продажи товара (услуги)" },
    kw: "oldi-sotdi shartnoma kupля продажа dogovor tovar",
    html: `<h2>OLDI-SOTDI SHARTNOMASI № [Shartnoma raqami]</h2><p>[Shahar], [Sana]</p><p>"[Kreditor nomi]" (bundan buyon "Sotuvchi"), bir tomondan, va "[Qarzdor nomi]" (STIR [Qarzdor STIR], bundan buyon "Xaridor"), ikkinchi tomondan, quyidagilar haqida ushbu shartnomani tuzdilar:</p><h3>1. Shartnoma predmeti</h3><p>1.1. Sotuvchi tovarni (xizmatni) topshirish, Xaridor esa uni qabul qilib, [Jami summa] to'lash majburiyatini oladi.</p><h3>2. To'lov tartibi</h3><p>2.1. To'lov [Muddat] ichida amalga oshiriladi.</p><h3>3. Tomonlar javobgarligi</h3><p>3.1. To'lov kechiktirilsa, har kun uchun [Foiz]% penya hisoblanadi.</p><p>Sotuvchi: _________________  Xaridor: _________________</p>`,
  },
  {
    key: "nasiya",
    cat: "contract",
    icon: Coins,
    title: { uz: "Nasiya (bo'lib to'lash)", ru: "Договор рассрочки" },
    desc: { uz: "Tovarni bo'lib-bo'lib to'lash sharti bilan sotish", ru: "Продажа товара с оплатой в рассрочку" },
    kw: "nasiya bo'lib to'lash rassrochka bolib tolash kredit",
    html: `<h2>NASIYA (BO'LIB TO'LASH) OLDI-SOTDI SHARTNOMASI № [Shartnoma raqami]</h2><p>[Shahar], [Sana]</p><p>"[Kreditor nomi]" (Sotuvchi), bir tomondan, va "[Qarzdor nomi]" (STIR [Qarzdor STIR], Xaridor), ikkinchi tomondan, quyidagilar haqida shartnoma tuzdilar:</p><h3>1. Shartnoma predmeti</h3><p>1.1. Sotuvchi tovarni bo'lib-bo'lib to'lash sharti bilan Xaridorga sotadi. Umumiy narx: [Jami summa].</p><h3>2. To'lov jadvali</h3><p>2.1. Boshlang'ich to'lov: [Boshlang'ich to'lov]. Qolgan summa [Muddat] oy davomida teng ulushlarda to'lanadi (to'lov jadvali ilova qilinadi).</p><h3>3. Tomonlar javobgarligi</h3><p>3.1. To'lov kechiktirilsa, har kun uchun [Foiz]% penya hisoblanadi.</p><p>Sotuvchi: _________________  Xaridor: _________________</p>`,
  },
  {
    key: "supply",
    cat: "contract",
    icon: Truck,
    title: { uz: "Yetkazib berish", ru: "Договор поставки" },
    desc: { uz: "Tovarni kelishilgan muddatda yetkazib berish shartnomasi", ru: "Договор поставки товара в согласованные сроки" },
    kw: "yetkazib berish postavka supply logistika",
    html: `<h2>YETKAZIB BERISH SHARTNOMASI № [Shartnoma raqami]</h2><p>[Shahar], [Sana]</p><p>"[Kreditor nomi]" (Yetkazib beruvchi) va "[Qarzdor nomi]" (STIR [Qarzdor STIR], Xaridor) o'rtasida tuzildi.</p><h3>1. Shartnoma predmeti</h3><p>1.1. Yetkazib beruvchi tovarni kelishilgan muddatda va assortimentda yetkazib beradi. Umumiy qiymat: [Jami summa].</p><h3>2. Yetkazib berish va to'lov</h3><p>2.1. To'lov [Muddat] ichida amalga oshiriladi.</p><h3>3. Javobgarlik</h3><p>3.1. Kechikish uchun har kun [Foiz]% penya.</p><p>Yetkazib beruvchi: _________________  Xaridor: _________________</p>`,
  },
  {
    key: "service",
    cat: "contract",
    icon: Briefcase,
    title: { uz: "Xizmat ko'rsatish", ru: "Договор оказания услуг" },
    desc: { uz: "Pullik xizmat ko'rsatish bo'yicha shartnoma", ru: "Договор возмездного оказания услуг" },
    kw: "xizmat ko'rsatish usluga service ijrochi",
    html: `<h2>XIZMAT KO'RSATISH SHARTNOMASI № [Shartnoma raqami]</h2><p>[Shahar], [Sana]</p><p>"[Kreditor nomi]" (Ijrochi) va "[Qarzdor nomi]" (STIR [Qarzdor STIR], Buyurtmachi) o'rtasida.</p><h3>1. Shartnoma predmeti</h3><p>1.1. Ijrochi xizmatni ko'rsatadi, Buyurtmachi esa [Jami summa] to'laydi.</p><h3>2. To'lov tartibi</h3><p>2.1. To'lov [Muddat] ichida amalga oshiriladi.</p><h3>3. Javobgarlik</h3><p>3.1. Kechikish uchun har kun [Foiz]% penya.</p><p>Ijrochi: _________________  Buyurtmachi: _________________</p>`,
  },
  {
    key: "rent",
    cat: "contract",
    icon: House,
    title: { uz: "Ijara shartnomasi", ru: "Договор аренды" },
    desc: { uz: "Mol-mulkni vaqtinchalik foydalanishga berish", ru: "Передача имущества во временное пользование" },
    kw: "ijara arenda rent turar-joy kvartira",
    html: `<h2>IJARA SHARTNOMASI № [Shartnoma raqami]</h2><p>[Shahar], [Sana]</p><p>"[Kreditor nomi]" (Ijaraga beruvchi) va "[Qarzdor nomi]" (STIR [Qarzdor STIR], Ijarachi) o'rtasida.</p><h3>1. Shartnoma predmeti</h3><p>1.1. Ijaraga beruvchi mol-mulkni vaqtinchalik foydalanishga beradi. Oylik ijara haqi: [Jami summa].</p><h3>2. Muddat va to'lov</h3><p>2.1. Ijara muddati: [Muddat] oy. To'lov har oy amalga oshiriladi.</p><h3>3. Javobgarlik</h3><p>3.1. Kechikish uchun har kun [Foiz]% penya.</p><p>Ijaraga beruvchi: _________________  Ijarachi: _________________</p>`,
  },
  {
    key: "pudrat",
    cat: "contract",
    icon: Hammer,
    title: { uz: "Pudrat shartnomasi", ru: "Договор подряда" },
    desc: { uz: "Ish (qurilish, ta'mir) bajarish bo'yicha pudrat", ru: "Договор подряда на выполнение работ" },
    kw: "pudrat podryad qurilish ta'mir ish bajarish",
    html: `<h2>PUDRAT SHARTNOMASI № [Shartnoma raqami]</h2><p>[Shahar], [Sana]</p><p>"[Kreditor nomi]" (Pudratchi) va "[Qarzdor nomi]" (STIR [Qarzdor STIR], Buyurtmachi) o'rtasida.</p><h3>1. Shartnoma predmeti</h3><p>1.1. Pudratchi [Ish nomi] ishlarini bajaradi, Buyurtmachi natijani qabul qilib [Jami summa] to'laydi.</p><h3>2. Muddat</h3><p>2.1. Ishlar [Muddat] ichida bajariladi.</p><h3>3. To'lov va javobgarlik</h3><p>3.1. To'lov ish topshirilgach amalga oshiriladi. Kechikish uchun har kun [Foiz]% penya.</p><p>Pudratchi: _________________  Buyurtmachi: _________________</p>`,
  },
  {
    key: "loan",
    cat: "contract",
    icon: Coins,
    title: { uz: "Qarz (zayom) shartnomasi", ru: "Договор займа" },
    desc: { uz: "Pul mablag'ini qarzga berish shartnomasi", ru: "Договор денежного займа между сторонами" },
    kw: "qarz zayom zaym loan pul qarzga berish",
    html: `<h2>QARZ (ZAYOM) SHARTNOMASI № [Shartnoma raqami]</h2><p>[Shahar], [Sana]</p><p>"[Kreditor nomi]" (Qarz beruvchi) va "[Qarzdor nomi]" (STIR [Qarzdor STIR], Qarz oluvchi) o'rtasida.</p><h3>1. Shartnoma predmeti</h3><p>1.1. Qarz beruvchi Qarz oluvchiga [Jami summa] miqdorida pul mablag'ini qarzga beradi.</p><h3>2. Qaytarish muddati</h3><p>2.1. Qarz [Muddat] ichida to'liq qaytariladi.</p><h3>3. Foiz va javobgarlik</h3><p>3.1. Qarzga [Foiz]% ustama qo'llaniladi. Kechiktirilsa, har kun uchun [Foiz]% penya hisoblanadi.</p><p>Qarz beruvchi: _________________  Qarz oluvchi: _________________</p>`,
  },
  {
    key: "employment",
    cat: "contract",
    icon: IdentificationCard,
    title: { uz: "Mehnat shartnomasi", ru: "Трудовой договор" },
    desc: { uz: "Xodim bilan tuziladigan mehnat shartnomasi", ru: "Трудовой договор с работником" },
    kw: "mehnat trudovoy xodim ish beruvchi lavozim",
    html: `<h2>MEHNAT SHARTNOMASI № [Shartnoma raqami]</h2><p>[Shahar], [Sana]</p><p>"[Kreditor nomi]" (Ish beruvchi) va [Qarzdor nomi] (Xodim) o'rtasida.</p><h3>1. Lavozim</h3><p>1.1. Xodim [Lavozim] lavozimiga qabul qilinadi.</p><h3>2. Mehnat haqi</h3><p>2.1. Oylik ish haqi: [Jami summa]. To'lov oyiga bir marta.</p><h3>3. Ish vaqti</h3><p>3.1. Ish vaqti qonunchilikka muvofiq belgilanadi.</p><p>Ish beruvchi: _________________  Xodim: _________________</p>`,
  },
  {
    key: "commission",
    cat: "contract",
    icon: Receipt,
    title: { uz: "Komissiya shartnomasi", ru: "Договор комиссии" },
    desc: { uz: "Komissioner Komitent nomidan bitim tuzadi", ru: "Комиссионер совершает сделки для комитента" },
    kw: "komissiya komissioner komitent commission vositachi",
    html: `<h2>KOMISSIYA SHARTNOMASI № [Shartnoma raqami]</h2><p>[Shahar], [Sana]</p><p>"[Kreditor nomi]" (Komissioner) va "[Qarzdor nomi]" (STIR [Qarzdor STIR], Komitent) o'rtasida.</p><h3>1. Shartnoma predmeti</h3><p>1.1. Komissioner Komitent nomidan, lekin o'z hisobidan bitimlar tuzadi. Komissiya haqi: [Jami summa].</p><h3>2. To'lov</h3><p>2.1. Komissiya haqi [Muddat] ichida to'lanadi.</p><h3>3. Javobgarlik</h3><p>3.1. Kechikish uchun har kun [Foiz]% penya.</p><p>Komissioner: _________________  Komitent: _________________</p>`,
  },
  {
    key: "multiparty",
    cat: "contract",
    icon: UsersThree,
    title: { uz: "Ko'p tomonlama shartnoma", ru: "Многосторонний договор" },
    desc: { uz: "Uch va undan ortiq tomon o'rtasidagi shartnoma", ru: "Договор между тремя и более сторонами" },
    kw: "ko'p tomonlama multiparty uch tomon mnogostoronniy",
    html: `<h2>KO'P TOMONLAMA SHARTNOMA № [Shartnoma raqami]</h2><p>[Shahar], [Sana]</p><p>Quyidagi tomonlar o'rtasida tuzildi:<br>Tomon 1: "[Kreditor nomi]"<br>Tomon 2: "[Qarzdor nomi]" (STIR [Qarzdor STIR])<br>Tomon 3: [Uchinchi tomon]</p><h3>1. Shartnoma predmeti</h3><p>1.1. Tomonlar quyidagi majburiyatlar bo'yicha kelishdilar. Umumiy qiymat: [Jami summa].</p><h3>2. Har tomon majburiyati</h3><p>2.1. [Majburiyatlarni shu yerga yozing]</p><p>Tomon 1: _________  Tomon 2: _________  Tomon 3: _________</p>`,
  },
  // ── Boshqa hujjatlar ──
  {
    key: "ishonchnoma",
    cat: "other",
    icon: IdentificationCard,
    title: { uz: "Ishonchnoma", ru: "Доверенность" },
    desc: { uz: "Vakolat berish (ishonchnoma) hujjati", ru: "Доверенность на представление интересов" },
    kw: "ishonchnoma doverennost vakolat vakil",
    html: `<h2>ISHONCHNOMA</h2><p>[Shahar], [Sana]</p><p>Men, [Ishonch bildiruvchi F.I.Sh] (STIR/PINFL [Qarzdor STIR]), ushbu ishonchnoma bilan [Ishonchli vakil F.I.Sh]ga quyidagi vakolatlarni beraman:</p><p>[Vakolatlar ro'yxatini shu yerga yozing] — jumladan hujjatlarni imzolash, davlat organlarida vakillik qilish, arizalar topshirish.</p><p>Ishonchnoma [Muddat] muddatga beriladi. Vakolatlar boshqa shaxsga topshirilmaydi.</p><p>Ishonch bildiruvchi: _________________ (imzo)</p>`,
  },
  {
    key: "nda",
    cat: "other",
    icon: ShieldCheck,
    title: { uz: "Konfidensiallik (NDA)", ru: "Соглашение о конфиденциальности" },
    desc: { uz: "Maxfiy ma'lumotlarni sir saqlash kelishuvi", ru: "Соглашение о неразглашении (NDA)" },
    kw: "nda konfidensiallik maxfiylik nerazglashenie sir",
    html: `<h2>KONFIDENSIALLIK TO'G'RISIDA KELISHUV (NDA)</h2><p>[Shahar], [Sana]</p><p>"[Kreditor nomi]" va "[Qarzdor nomi]" (STIR [Qarzdor STIR]) o'rtasida.</p><h3>1. Predmet</h3><p>1.1. Tomonlar hamkorlik davomida bir-biriga oshkor qilgan maxfiy ma'lumotlarni sir saqlash majburiyatini oladilar.</p><h3>2. Maxfiylik muddati</h3><p>2.1. Majburiyat kelishuv tugagach ham [Muddat] davomida amal qiladi.</p><h3>3. Javobgarlik</h3><p>3.1. Maxfiylik buzilsa, aybdor tomon yetkazilgan zararni to'liq qoplaydi.</p><p>Tomon 1: _________________  Tomon 2: _________________</p>`,
  },
  {
    key: "termination",
    cat: "other",
    icon: Prohibit,
    title: { uz: "Shartnomani bekor qilish", ru: "Расторжение договора" },
    desc: { uz: "Amaldagi shartnomani bekor qilish kelishuvi", ru: "Соглашение о расторжении договора" },
    kw: "bekor qilish rastorzhenie termination shartnomani tugatish",
    html: `<h2>SHARTNOMANI BEKOR QILISH TO'G'RISIDA KELISHUV</h2><p>[Shahar], [Sana]</p><p>"[Kreditor nomi]" va "[Qarzdor nomi]" (STIR [Qarzdor STIR]) o'rtasida tuzilgan № [Shartnoma raqami] shartnomaga nisbatan.</p><h3>1. Tomonlar № [Shartnoma raqami] shartnomani [Sana] dan boshlab bekor qilishga kelishdilar.</h3><h3>2. O'zaro hisob-kitob</h3><p>2.1. Bekor qilish sanasiga o'zaro moliyaviy da'volar: [Jami summa]. Hisob-kitob [Muddat] ichida yakunlanadi.</p><p>Tomon 1: _________________  Tomon 2: _________________</p>`,
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
}

/** Shablondagi [belgilangan joy]larni qarzdor qiymatlari bilan almashtiradi. */
function applyDebtor(html: string, d: StudioDebtor): string {
  const map: Record<string, string> = {
    "[Qarzdor nomi]": d.name,
    "[Qarzdor STIR]": d.tin,
    "[Shartnoma raqami]": d.contractNumber,
    "[Faktura raqami]": d.invoiceNumber,
    "[Asosiy qarz]": d.principal,
    "[Penya]": d.penalty,
    "[Jami summa]": d.total,
    "[Kechikish kunlari]": d.overdueDays,
  };
  let out = html;
  for (const [needle, value] of Object.entries(map)) {
    if (value) out = out.split(needle).join(value);
  }
  return out;
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

export function DocumentStudio({ debtors }: { debtors: StudioDebtor[] }) {
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
  const [docHtml, setDocHtml] = useState(initHtml !== undefined ? (initDebtor ? applyDebtor(initHtml, initDebtor) : initHtml) : "");
  const [picker, setPicker] = useState(initHtml === undefined);
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

  // Studio AI — STREAMING: javob harfma-harf keladi va oxirgi AI xabariga yoziladi.
  async function ask(prompt: string, docOverride?: string) {
    const q = prompt.trim();
    if (!q || loading) return;
    const docText = docOverride ?? text;
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

  // ── Versiyalash: joriy holatni tarixга saqlaydi (oxirgi 20 ta). ──
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
    setDocHtml(d ? applyDebtor(tpl.html, d) : tpl.html);
    if (!title.trim() && tpl.key !== "blank") setTitle(Lc(tpl.title));
    setPicker(false);
  }

  // ── Fayl yuklab tahlil: matn ajratib, editorга yuklaydi va AI tahlilини boshlaydi. ──
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
      setMessages((m) => [...m, { role: "ai", text: locale === "ru" ? "В файле нет текста." : "Faylда matn topilmadi." }]);
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
    if (d) setDocHtml(applyDebtor(docHtml, d));
  }

  const [exportOpen, setExportOpen] = useState(false);

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

  const QUICK = [
    { key: "analyze", instruction: t("qAnalyze") },
    { key: "risks", instruction: t("qRisks") },
    { key: "simplify", instruction: t("qSimplify") },
  ];

  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[1fr_360px]">
      {/* ── Hujjat muharriri ─────────────────────────── */}
      <div className="flex min-h-0 flex-col">
        <div className="mb-3 flex items-center gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("titlePlaceholder")}
            className="min-w-0 flex-1 border-0 bg-transparent font-display text-xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50"
          />
          <span className="shrink-0 text-xs text-muted-foreground">{t("words", { n: words })}</span>
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
        {picker ? (
          <TemplateLibrary locale={locale} t={t} onPick={chooseTemplate} />
        ) : (
          <RichEditor value={docHtml} onChange={setDocHtml} onReady={(e) => (editorRef.current = e)} className="min-h-0 flex-1" />
        )}
      </div>

      {/* ── AI Yordamchi paneli ──────────────────────── */}
      <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-secondary text-white">
            <Sparkle weight="fill" className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold">{t("assistant")}</p>
            <p className="truncate text-[11px] text-muted-foreground">{t("assistantSub")}</p>
          </div>
        </div>

        {/* Tez amallar */}
        <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2.5">
          {QUICK.map((q) => (
            <button
              key={q.key}
              onClick={() => docAction(q.instruction)}
              disabled={!hasDoc || loading}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-40"
            >
              <MagicWand className="size-3.5" /> {t(`quick.${q.key}` as never)}
            </button>
          ))}
        </div>

        {/* Xabarlar */}
        <div ref={scrollRef} className="scroll-clean min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
              <PenNib weight="fill" className="size-7 text-primary/60" />
              <p className="text-sm font-medium text-foreground">{t("welcome")}</p>
              <p className="text-xs">{t("welcomeSub")}</p>
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
    </div>
  );
}
