"use client";

import { ArrowRight, Buildings, CircleNotch, FileText, PaperPlaneRight, Sparkle, Wallet } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { type ChatResult, sendChat } from "@/app/(app)/chat/actions";
import { cn } from "@/lib/utils";

interface Msg {
  role: "user" | "ai";
  text: string;
  at: Date;
  results?: ChatResult[];
}

const RESULT_ICON = { company: Buildings, receivable: Wallet, document: FileText } as const;

export function ChatClient() {
  const t = useTranslations("chat");
  const locale = useLocale();
  const [messages, setMessages] = useState<Msg[]>([{ role: "ai", text: t("greeting"), at: new Date() }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fmtTime = (d: Date) => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(d);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q, at: new Date() }]);
    setLoading(true);
    const res = await sendChat(q);
    setMessages((m) => [...m, { role: "ai", text: res.reply, results: res.results, at: new Date() }]);
    setLoading(false);
  }

  const suggestions = [t("s1"), t("s2"), t("s3")];

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
      {/* Header */}
      <div className="mb-3 flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-secondary text-white shadow-sm shadow-primary/30">
          <Sparkle weight="fill" className="size-5" />
        </div>
        <div>
          <h1 className="font-display text-lg font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="scroll-clean min-h-0 flex-1 space-y-1.5 overflow-y-auto py-2">
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex flex-col gap-1", msg.role === "user" ? "items-end" : "items-start")}>
            <div className={cn("min-w-0 space-y-2", msg.role === "user" ? "flex max-w-[80%] flex-col items-end" : "max-w-[94%]")}>
              <div
                className={cn(
                  "inline-block whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                  msg.role === "ai" ? "bg-card ring-1 ring-border" : "bg-primary text-primary-foreground",
                )}
              >
                {msg.text}
                <span
                  className={cn(
                    "float-right ml-3 mt-2 translate-y-1 select-none text-[10px] leading-none",
                    msg.role === "ai" ? "text-muted-foreground/55" : "text-primary-foreground/70",
                  )}
                >
                  {fmtTime(msg.at)}
                </span>
              </div>
              {msg.results && msg.results.length > 0 && (
                <div className="space-y-1.5">
                  {msg.results.map((r, j) => {
                    const Ic = RESULT_ICON[r.kind] ?? FileText;
                    const inner = (
                      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5 transition-colors hover:border-primary/40 hover:bg-primary-soft/30">
                        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                          <Ic className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{r.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
                        </div>
                        {r.href && <ArrowRight className="size-4 shrink-0 text-primary" />}
                      </div>
                    );
                    return r.href ? (
                      <Link key={j} href={r.href}>
                        {inner}
                      </Link>
                    ) : (
                      <div key={j}>{inner}</div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 rounded-2xl bg-card px-4 py-2.5 text-sm text-muted-foreground ring-1 ring-border self-start">
            <CircleNotch className="size-4 animate-spin" /> {t("thinking")}
          </div>
        )}
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex items-center gap-2 rounded-xl border border-border bg-card p-1.5 shadow-sm focus-within:ring-4 focus-within:ring-primary/10"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("placeholder")}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/55"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <PaperPlaneRight weight="fill" className="size-4" />
        </button>
      </form>
    </div>
  );
}
