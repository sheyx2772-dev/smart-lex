"use client";

import {
  ArrowRight,
  CaretDown,
  CircleNotch,
  ClipboardText,
  DownloadSimple,
  Envelope,
  FileDoc,
  FileHtml,
  FilePdf,
  FileDashed,
  Gavel,
  Handshake,
  type Icon,
  MagicWand,
  PenNib,
  Plus,
  Scroll,
  Sparkle,
  SquaresFour,
  WarningCircle,
} from "@phosphor-icons/react";
import type { Editor } from "@tiptap/react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { sendChat } from "@/app/(app)/chat/actions";
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

// Tayyor huquqiy shablonlar — LLM'siz ham to'liq ishlaydi (foydalanuvchi tahrirlaydi).
// [...] — to'ldiriladigan joylar. Matn O'zbekiston huquqiga mos.
interface Template {
  key: string;
  icon: Icon;
  html: string;
}
const TEMPLATES: Template[] = [
  {
    key: "demand",
    icon: Scroll,
    html: `<h2>TALABNOMA</h2><p>Hurmatli [Qarzdor nomi]!</p><p>"[Kreditor nomi]" Siz bilan tuzilgan shartnoma bo'yicha muddati o'tgan qarzdorlik yuzaga kelganini ma'lum qiladi.</p><p><strong>Shartnoma:</strong> № [Shartnoma raqami]<br><strong>Hisob-faktura:</strong> [Faktura raqami]</p><p><strong>Asosiy qarz:</strong> [Asosiy qarz]<br><strong>Penya ([Kechikish kunlari] kun):</strong> [Penya]<br><strong>Jami to'lanishi lozim:</strong> [Jami summa]</p><p>Ushbu talabnoma olingan kundan boshlab [Muddat] kalendar kun ichida qarzni to'liq to'lashingizni talab qilamiz. Aks holda kreditor O'zbekiston Respublikasi qonunchiligiga muvofiq iqtisodiy sudga da'vo arizasi bilan murojaat qilish huquqini o'zida saqlaydi.</p><p>Hurmat bilan,<br>[Kreditor nomi]<br>[Imzolovchi F.I.Sh, lavozim]</p>`,
  },
  {
    key: "lawsuit",
    icon: Gavel,
    html: `<h2>IQTISODIY SUDGA DA'VO ARIZASI</h2><p><strong>Da'vogar:</strong> "[Kreditor nomi]", STIR: [Da'vogar STIR]<br><strong>Javobgar:</strong> "[Qarzdor nomi]", STIR: [Qarzdor STIR]<br><strong>Da'vo narxi:</strong> [Jami summa]<br><strong>Davlat boji:</strong> [Davlat boji]</p><p>Da'vogar va javobgar o'rtasida [Shartnoma raqami] shartnoma tuzilgan. [Faktura raqami] hisob-faktura bo'yicha javobgar zimmasiga to'lov majburiyati yuklatilgan.</p><p>Javobgar to'lovni belgilangan muddatda bajarmagan. Asosiy qarz [Asosiy qarz], [Kechikish kunlari] kun kechikish uchun penya [Penya].</p><p><strong>Huquqiy asos:</strong> O'zbekiston Respublikasi Fuqarolik kodeksi va Iqtisodiy protsessual kodeksi.</p><p><strong>SO'RAYMAN:</strong> Javobgardan da'vogar foydasiga jami [Jami summa] undirilsin. Davlat boji javobgar zimmasiga yuklatilsin.</p><p>Da'vogar nomidan: [Imzolovchi] _________________ (imzo, sana)</p>`,
  },
  {
    key: "reconciliation",
    icon: ClipboardText,
    html: `<h2>SOLISHTIRMA DALOLATNOMA (AKT-SVERKA)</h2><p>"[Kreditor nomi]" va "[Qarzdor nomi]" (STIR [Qarzdor STIR]) o'rtasida [Sana] holatiga tuzildi.</p><p>Shartnoma: [Shartnoma raqami] · Hisob-faktura: [Faktura raqami]</p><p><strong>Asosiy qarz:</strong> [Asosiy qarz]<br><strong>Penya:</strong> [Penya]<br><strong>Yakuniy qoldiq (saldo):</strong> [Jami summa]</p><p>Kreditor nomidan: _________________ (imzo, sana)<br>Qarzdor nomidan: _________________ (imzo, sana)</p>`,
  },
  {
    key: "reply",
    icon: Envelope,
    html: `<h2>JAVOB XATI</h2><p>[Sana], № [Chiquvchi raqam]</p><p>Kimga: "[Qarzdor nomi]"</p><p>Hurmatli [F.I.Sh]!</p><p>Sizning [Sana] dagi № [Kiruvchi raqam] xatingizga javoban quyidagilarni ma'lum qilamiz:</p><p>[Javob matnini shu yerga yozing]</p><p>Hurmat bilan,<br>[Kreditor nomi]<br>[Imzolovchi F.I.Sh, lavozim]</p>`,
  },
  {
    key: "contract",
    icon: Handshake,
    html: `<h2>SHARTNOMA № [Shartnoma raqami]</h2><p>[Shahar], [Sana]</p><p>"[Kreditor nomi]" (bundan buyon "Sotuvchi"), bir tomondan, va "[Qarzdor nomi]" (STIR [Qarzdor STIR], bundan buyon "Xaridor"), ikkinchi tomondan, quyidagilar haqida ushbu shartnomani tuzdilar:</p><h3>1. Shartnoma predmeti</h3><p>1.1. Sotuvchi tovarni (xizmatni) topshirish, Xaridor esa uni qabul qilib, [Jami summa] to'lash majburiyatini oladi.</p><h3>2. To'lov tartibi</h3><p>2.1. To'lov [Muddat] ichida amalga oshiriladi.</p><h3>3. Tomonlar javobgarligi</h3><p>3.1. To'lov kechiktirilsa, har kun uchun [Foiz]% penya hisoblanadi.</p><p>Sotuvchi: _________________  Xaridor: _________________</p>`,
  },
  { key: "blank", icon: FileDashed, html: "" },
];

// Shartnoma sub-turlari — galereyada emas, lekin ?template=<key> bilan
// to'g'ridan-to'g'ri ochiladi (Shartnomalar hub kartalaridan).
const EXTRA_TEMPLATES: Record<string, string> = {
  nasiya: `<h2>NASIYA (BO'LIB TO'LASH) OLDI-SOTDI SHARTNOMASI № [Shartnoma raqami]</h2><p>[Shahar], [Sana]</p><p>"[Kreditor nomi]" (Sotuvchi), bir tomondan, va "[Qarzdor nomi]" (STIR [Qarzdor STIR], Xaridor), ikkinchi tomondan, quyidagilar haqida shartnoma tuzdilar:</p><h3>1. Shartnoma predmeti</h3><p>1.1. Sotuvchi tovarni bo'lib-bo'lib to'lash sharti bilan Xaridorga sotadi. Umumiy narx: [Jami summa].</p><h3>2. To'lov jadvali</h3><p>2.1. Boshlang'ich to'lov: [Boshlang'ich to'lov]. Qolgan summa [Muddat] oy davomida teng ulushlarda to'lanadi (to'lov jadvali ilova qilinadi).</p><h3>3. Tomonlar javobgarligi</h3><p>3.1. To'lov kechiktirilsa, har kun uchun [Foiz]% penya hisoblanadi.</p><p>Sotuvchi: _________________  Xaridor: _________________</p>`,
  supply: `<h2>YETKAZIB BERISH SHARTNOMASI № [Shartnoma raqami]</h2><p>[Shahar], [Sana]</p><p>"[Kreditor nomi]" (Yetkazib beruvchi) va "[Qarzdor nomi]" (STIR [Qarzdor STIR], Xaridor) o'rtasida tuzildi.</p><h3>1. Shartnoma predmeti</h3><p>1.1. Yetkazib beruvchi tovarni kelishilgan muddatda va assortimentda yetkazib beradi. Umumiy qiymat: [Jami summa].</p><h3>2. Yetkazib berish va to'lov</h3><p>2.1. To'lov [Muddat] ichida amalga oshiriladi.</p><h3>3. Javobgarlik</h3><p>3.1. Kechikish uchun har kun [Foiz]% penya.</p><p>Yetkazib beruvchi: _________________  Xaridor: _________________</p>`,
  service: `<h2>XIZMAT KO'RSATISH SHARTNOMASI № [Shartnoma raqami]</h2><p>[Shahar], [Sana]</p><p>"[Kreditor nomi]" (Ijrochi) va "[Qarzdor nomi]" (STIR [Qarzdor STIR], Buyurtmachi) o'rtasida.</p><h3>1. Shartnoma predmeti</h3><p>1.1. Ijrochi xizmatni ko'rsatadi, Buyurtmachi esa [Jami summa] to'laydi.</p><h3>2. To'lov tartibi</h3><p>2.1. To'lov [Muddat] ichida amalga oshiriladi.</p><h3>3. Javobgarlik</h3><p>3.1. Kechikish uchun har kun [Foiz]% penya.</p><p>Ijrochi: _________________  Buyurtmachi: _________________</p>`,
  rent: `<h2>IJARA SHARTNOMASI № [Shartnoma raqami]</h2><p>[Shahar], [Sana]</p><p>"[Kreditor nomi]" (Ijaraga beruvchi) va "[Qarzdor nomi]" (STIR [Qarzdor STIR], Ijarachi) o'rtasida.</p><h3>1. Shartnoma predmeti</h3><p>1.1. Ijaraga beruvchi mol-mulkni vaqtinchalik foydalanishga beradi. Oylik ijara haqi: [Jami summa].</p><h3>2. Muddat va to'lov</h3><p>2.1. Ijara muddati: [Muddat] oy. To'lov har oy amalga oshiriladi.</p><h3>3. Javobgarlik</h3><p>3.1. Kechikish uchun har kun [Foiz]% penya.</p><p>Ijaraga beruvchi: _________________  Ijarachi: _________________</p>`,
  employment: `<h2>MEHNAT SHARTNOMASI № [Shartnoma raqami]</h2><p>[Shahar], [Sana]</p><p>"[Kreditor nomi]" (Ish beruvchi) va [Qarzdor nomi] (Xodim) o'rtasida.</p><h3>1. Lavozim</h3><p>1.1. Xodim [Lavozim] lavozimiga qabul qilinadi.</p><h3>2. Mehnat haqi</h3><p>2.1. Oylik ish haqi: [Jami summa]. To'lov oyiga bir marta.</p><h3>3. Ish vaqti</h3><p>3.1. Ish vaqti qonunchilikka muvofiq belgilanadi.</p><p>Ish beruvchi: _________________  Xodim: _________________</p>`,
  multiparty: `<h2>KO'P TOMONLAMA SHARTNOMA № [Shartnoma raqami]</h2><p>[Shahar], [Sana]</p><p>Quyidagi tomonlar o'rtasida tuzildi:<br>Tomon 1: "[Kreditor nomi]"<br>Tomon 2: "[Qarzdor nomi]" (STIR [Qarzdor STIR])<br>Tomon 3: [Uchinchi tomon]</p><h3>1. Shartnoma predmeti</h3><p>1.1. Tomonlar quyidagi majburiyatlar bo'yicha kelishdilar. Umumiy qiymat: [Jami summa].</p><h3>2. Har tomon majburiyati</h3><p>2.1. [Majburiyatlarni shu yerga yozing]</p><p>Tomon 1: _________  Tomon 2: _________  Tomon 3: _________</p>`,
};

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

function TemplateGallery({ t, onPick }: { t: ReturnType<typeof useTranslations>; onPick: (tpl: Template) => void }) {
  return (
    <div className="scroll-clean min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-background p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-secondary text-white shadow-lg shadow-primary/25">
            <PenNib weight="fill" className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">{t("pickTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("pickSub")}</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {TEMPLATES.map((tpl) => {
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
                  <p className="text-sm font-semibold">{t(`tpl.${tpl.key}` as never)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t(`tplDesc.${tpl.key}` as never)}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function DocumentStudio({ debtors }: { debtors: StudioDebtor[] }) {
  const t = useTranslations("studio");
  const searchParams = useSearchParams();

  // ?template=<key> — galereya shabloni yoki shartnoma sub-turi (EXTRA_TEMPLATES).
  const initTplKey = searchParams.get("template");
  const initHtml = (() => {
    if (!initTplKey) return undefined;
    const g = TEMPLATES.find((x) => x.key === initTplKey);
    return g ? g.html : EXTRA_TEMPLATES[initTplKey];
  })();
  const isGalleryTpl = TEMPLATES.some((x) => x.key === initTplKey && x.key !== "blank");
  // ?debtor=<id> — ochilishda o'sha qarzdor bilan avtomatik to'ldirish (akt-sverka, talabnoma...).
  const initDebtor = debtors.find((x) => x.id === searchParams.get("debtor"));

  const [debtorId, setDebtorId] = useState(initDebtor?.id ?? "");
  const [title, setTitle] = useState(searchParams.get("title") ?? (isGalleryTpl ? t(`tpl.${initTplKey}` as never) : ""));
  const [docHtml, setDocHtml] = useState(initHtml !== undefined ? (initDebtor ? applyDebtor(initHtml, initDebtor) : initHtml) : "");
  const [picker, setPicker] = useState(initHtml === undefined);
  const [messages, setMessages] = useState<AiMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const editorRef = useRef<Editor | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  async function ask(prompt: string) {
    const q = prompt.trim();
    if (!q || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const res = await sendChat(q);
      setMessages((m) => [...m, { role: "ai", text: res.reply }]);
    } catch {
      setMessages((m) => [...m, { role: "ai", text: t("aiError") }]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
    }
  }

  // Hujjat matni bilan birga so'raladigan tez amallar.
  function docAction(instruction: string) {
    ask(`${instruction}\n\n"""\n${text}\n"""`);
  }

  function insertToDoc(aiText: string) {
    const html = toHtml(aiText);
    if (editorRef.current) editorRef.current.chain().focus().insertContent(html).run();
    else setDocHtml((h) => h + html);
  }

  function chooseTemplate(tpl: Template) {
    const d = debtors.find((x) => x.id === debtorId);
    setDocHtml(d ? applyDebtor(tpl.html, d) : tpl.html);
    if (!title.trim() && tpl.key !== "blank") setTitle(t(`tpl.${tpl.key}` as never));
    setPicker(false);
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
          <TemplateGallery t={t} onPick={chooseTemplate} />
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
              </div>
              {m.role === "ai" && (
                <button
                  onClick={() => insertToDoc(m.text)}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary-soft"
                >
                  <Plus className="size-3" /> {t("insert")}
                </button>
              )}
            </div>
          ))}
          {loading && (
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
