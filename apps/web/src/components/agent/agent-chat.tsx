"use client";

import { ArrowRight, CircleNotch, FileText, type Icon, MagnifyingGlass, Robot, SealCheck, Sparkle } from "@phosphor-icons/react";
import { useLocale } from "next-intl";
import { useRef, useState } from "react";
import { agentChat, type AgentStep } from "@/app/(app)/chat/actions";
import { cn } from "@/lib/utils";

interface Msg {
  role: "user" | "assistant";
  content: string;
  steps?: AgentStep[];
}

const STEP_ICON: Record<string, Icon> = { listReceivables: MagnifyingGlass, draftDocument: FileText, queueApproval: SealCheck };

export function AgentChat() {
  const locale = useLocale();
  const ru = locale === "ru";
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const suggestions = ru
    ? ["Покажи 5 самых просроченных долгов", "Составь требование для крупнейшего должника", "Сколько всего непогашенного долга?"]
    : ["Eng ko'p kechikkan 5 ta qarzni ko'rsat", "Eng katta qarzdor uchun talabnoma yoz", "Jami qancha to'lanmagan qarz bor?"];

  const stepLabel = (s: AgentStep) =>
    s.tool === "listReceivables"
      ? ru
        ? "прочитал долги"
        : "qarzlarni o'qidi"
      : s.tool === "draftDocument"
        ? ru
          ? "составил документ"
          : "hujjat tuzdi"
        : s.tool === "queueApproval"
          ? ru
            ? "поставил на подтверждение"
            : "tasdiqqa qo'ydi"
          : s.tool;

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setInput("");
    const history: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(history);
    setLoading(true);
    try {
      const res = await agentChat(history.map((m) => ({ role: m.role, content: m.content })));
      setMessages((m) => [...m, { role: "assistant", content: res.reply || (ru ? "Пустой ответ." : "Bo'sh javob."), steps: res.steps }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: ru ? "Ошибка. Повторите." : "Xato. Qayta urinib ko'ring." }]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-7rem)] min-h-0 w-full max-w-3xl flex-col">
      {/* Xabarlar */}
      <div ref={scrollRef} className="scroll-clean min-h-0 flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-white shadow-lg shadow-primary/25">
              <Robot weight="fill" className="size-7" />
            </span>
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight">Lex AI Agent</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {ru ? "Читаю ваши долги, составляю документы и предлагаю действия." : "Qarzlaringizni o'qiyman, hujjat tuzaman va harakat taklif qilaman."}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex flex-col gap-1.5", m.role === "user" ? "items-end" : "items-start")}>
            {/* Agent bajargan qadamlar */}
            {m.role === "assistant" && m.steps && m.steps.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {m.steps.map((s, j) => {
                  const Ic = STEP_ICON[s.tool] ?? Sparkle;
                  return (
                    <span
                      key={j}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        s.ok ? "border-success/30 bg-success-soft/40 text-success" : "border-danger/30 bg-danger/10 text-danger",
                      )}
                    >
                      <Ic weight="fill" className="size-3" /> {stepLabel(s)}
                    </span>
                  );
                })}
              </div>
            )}
            <div
              className={cn(
                "max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed",
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card text-foreground ring-1 ring-border",
              )}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleNotch className="size-4 animate-spin" /> {ru ? "Агент работает…" : "Agent ishlayapti…"}
          </div>
        )}
      </div>

      {/* Kiritish */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="shrink-0 border-t border-border pt-3"
      >
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 focus-within:border-primary/40">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder={ru ? "Поручите агенту задачу…" : "Agentga vazifa bering…"}
            className="scroll-clean max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <ArrowRight weight="bold" className="size-4" />
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
          {ru ? "Внешние действия (отправка, суд) — только после вашего подтверждения." : "Tashqi amallar (yuborish, sud) — faqat sizning tasdig'ingizdan keyin."}
        </p>
      </form>
    </div>
  );
}
