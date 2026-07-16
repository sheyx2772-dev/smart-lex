"use client";

import { ArrowRight, CircleNotch, DownloadSimple, MagicWand, PenNib, Plus, Sparkle, WarningCircle } from "@phosphor-icons/react";
import type { Editor } from "@tiptap/react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
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

export function DocumentStudio() {
  const t = useTranslations("studio");
  const [title, setTitle] = useState("");
  const [docHtml, setDocHtml] = useState("");
  const [messages, setMessages] = useState<AiMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const editorRef = useRef<Editor | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  function download() {
    const name = (title.trim() || t("untitled")).replace(/[^\p{L}\p{N} _-]/gu, "");
    const html = `<!doctype html><meta charset="utf-8"><title>${escapeHtml(name)}</title><body>${docHtml || `<p>${escapeHtml(text)}</p>`}</body>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.html`;
    a.click();
    URL.revokeObjectURL(url);
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
          <button
            onClick={download}
            disabled={!hasDoc}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:border-muted-foreground/30 disabled:opacity-40"
          >
            <DownloadSimple className="size-4" /> {t("export")}
          </button>
        </div>
        <RichEditor value={docHtml} onChange={setDocHtml} onReady={(e) => (editorRef.current = e)} className="min-h-0 flex-1" />
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
