"use client";

import { ArrowRight, Briefcase, CircleNotch, Gavel, type Icon, MagnifyingGlass, Paperclip, Robot, SealCheck, Sparkle, X } from "@phosphor-icons/react";
import { useLocale } from "next-intl";
import { useRef, useState } from "react";
import { legalAgentChat, type AgentStep } from "@/app/(app)/chat/actions";
import { extractFileText, MAX_ATTACH_BYTES } from "@/lib/file-extract";
import { cn } from "@/lib/utils";

interface Msg {
  role: "user" | "assistant";
  content: string;
  steps?: AgentStep[];
}

const STEP_ICON: Record<string, Icon> = {
  findMatter: Briefcase,
  findContract: MagnifyingGlass,
  analyzeContractRisk: SealCheck,
  draftCourtFiling: Gavel,
  queueApproval: SealCheck,
};

/** Yuridik AI Agent chat — apps/web/src/components/agent/agent-chat.tsx bilan bir xil
 * arxitektura (o'zgarmas), lekin /api/legal/agent/chat'ga ulanadi va legal-agent.ts'dagi
 * asboblarga mos step ikonka/matnlarga ega. Debitorlik chat komponentiga hech qanday
 * ta'sir qilmaydi — mustaqil fayl. */
export function LegalAgentChat() {
  const locale = useLocale();
  const ru = locale === "ru";
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; text: string }[]>([]);
  const [attaching, setAttaching] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const suggestions = ru
    ? ["Найди дело по ABC MCHJ", "Проверь риски договора с ABC MCHJ", "Составь исковое заявление"]
    : ["ABC MCHJ bo'yicha ishni top", "ABC MCHJ shartnomasi xavfini tekshir", "Da'vo arizasi tuz"];

  const stepLabel = (s: AgentStep) =>
    s.tool === "findMatter"
      ? ru ? "нашёл дело" : "ishni topdi"
      : s.tool === "findContract"
        ? ru ? "нашёл договор" : "shartnomani topdi"
        : s.tool === "analyzeContractRisk"
          ? ru ? "проанализировал риск" : "xavfni tahlil qildi"
          : s.tool === "draftCourtFiling"
            ? ru ? "составил иск" : "da'vo arizasi tuzdi"
            : s.tool === "queueApproval"
              ? ru ? "поставил на подтверждение" : "tasdiqqa qo'ydi"
              : s.tool;

  async function send(text: string, context?: string) {
    const q = text.trim();
    if (!q || loading) return;
    setInput("");
    const history: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(history);
    setLoading(true);
    try {
      const api = history.map((m, i) =>
        i === history.length - 1 && context ? { role: m.role, content: `${m.content}\n\n${context}` } : { role: m.role, content: m.content },
      );
      const res = await legalAgentChat(api);
      setMessages((m) => [...m, { role: "assistant", content: res.reply || (ru ? "Пустой ответ." : "Bo'sh javob."), steps: res.steps }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: ru ? "Ошибка. Повторите." : "Xato. Qayta urinib ko'ring." }]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
    }
  }

  async function attachFiles(files: FileList | File[]) {
    const list = Array.from(files).slice(0, 5);
    if (!list.length || attaching) return;
    setAttaching(true);
    for (const file of list) {
      if (file.size > MAX_ATTACH_BYTES) continue;
      try {
        const txt = (await extractFileText(file)).trim();
        if (txt) setAttachments((a) => [...a, { name: file.name, text: txt }]);
      } catch {
        /* o'qib bo'lmadi — jimgina o'tkazamiz */
      }
    }
    setAttaching(false);
  }

  function submitAgent() {
    if (loading || attaching) return;
    const hasAtt = attachments.length > 0;
    if (!input.trim() && !hasAtt) return;
    const base = input.trim() || (ru ? "Проанализируй прикреплённый документ." : "Biriktirilgan hujjatni tahlil qil.");
    const names = attachments.map((a) => a.name).join(", ");
    const visible = hasAtt ? `${base}\n📎 ${names}` : base;
    const context = hasAtt ? attachments.map((a) => `[Fayl: ${a.name}]\n${a.text}`).join("\n\n") : undefined;
    setAttachments([]);
    send(visible, context);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-7rem)] min-h-0 w-full max-w-3xl flex-col">
      <div ref={scrollRef} className="scroll-clean min-h-0 flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-brand text-white shadow-lg shadow-primary/25">
              <Robot weight="fill" className="size-7" />
            </span>
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight">Yuridik AI Agent</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {ru ? "Читаю дела и договоры, анализирую риски, составляю судебные документы." : "Ishlar va shartnomalarni o'qiyman, xavfni tahlil qilaman, sud hujjatlarini tuzaman."}
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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitAgent();
        }}
        className="shrink-0 border-t border-border pt-3"
      >
        {(attachments.length > 0 || attaching) && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {attachments.map((a, i) => (
              <span key={i} className="inline-flex max-w-[200px] items-center gap-1 rounded-md bg-primary-soft px-2 py-1 text-[11px] font-medium text-foreground">
                <Paperclip className="size-3 shrink-0 text-primary" />
                <span className="truncate">{a.name}</span>
                <button type="button" onClick={() => setAttachments((x) => x.filter((_, j) => j !== i))} className="shrink-0 opacity-60 hover:opacity-100">
                  <X className="size-3" />
                </button>
              </span>
            ))}
            {attaching && (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                <CircleNotch className="size-3 animate-spin" /> {ru ? "Чтение…" : "O'qilmoqda…"}
              </span>
            )}
          </div>
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 focus-within:border-primary/40">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.doc,.rtf,.html,.htm,.txt,.md,.csv,image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) attachFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={attaching || loading}
            title={ru ? "Прикрепить (изображение, Word, PDF)" : "Biriktirish (rasm, Word, PDF)"}
            className="grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <Paperclip className="size-4" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={(e) => {
              const files = e.clipboardData?.files;
              if (files && files.length) {
                e.preventDefault();
                attachFiles(files);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitAgent();
              }
            }}
            rows={1}
            placeholder={ru ? "Поручите агенту задачу…" : "Agentga vazifa bering…"}
            className="scroll-clean max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={(!input.trim() && attachments.length === 0) || loading || attaching}
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <ArrowRight weight="bold" className="size-4" />
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
          {ru ? "Внешние действия (подача, отправка) — только после вашего подтверждения." : "Tashqi amallar (topshirish, yuborish) — faqat sizning tasdig'ingizdan keyin."}
        </p>
      </form>
    </div>
  );
}
