"use client";

import { CalendarBlank, CheckCircle, Copy, DownloadSimple, Table } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { formatMoneyInput, unformatMoney } from "@/lib/format";
import { Card } from "@/components/ui/card";

interface Row {
  n: number;
  date: Date;
  payment: number;
  balance: number;
}

function fmtSom(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// Modul darajasida — render ichida yaratilsa fokus yo'qoladi.
function Field({ label, value, onChange, type = "text", suffix, placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; suffix?: string; placeholder?: string }) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center rounded-lg border border-border bg-background focus-within:border-primary/50">
        <input
          type={type}
          value={value}
          inputMode={type === "text" ? "decimal" : undefined}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent px-3 py-2 text-sm outline-none"
        />
        {suffix && <span className="pr-3 text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </label>
  );
}

export function PaymentSchedule() {
  const t = useTranslations("schedule");
  const locale = useLocale();
  const today = new Date();
  const [total, setTotal] = useState("");
  const [down, setDown] = useState("");
  const [months, setMonths] = useState("6");
  const [markup, setMarkup] = useState("0");
  const [start, setStart] = useState(today.toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[] | null>(null);

  const fmtDate = (d: Date) => new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(d);

  function compute() {
    const totalNum = Number(unformatMoney(total) || "0");
    const downNum = Number(unformatMoney(down) || "0");
    const m = Math.max(1, Math.min(120, parseInt(months || "1", 10)));
    const markupNum = Number(markup || "0");
    const financed = Math.max(0, totalNum - downNum);
    if (financed <= 0) {
      setRows([]);
      return;
    }
    const withMarkup = Math.round(financed * (1 + markupNum / 100));
    const base = Math.floor(withMarkup / m);
    let remaining = withMarkup;
    const startDate = new Date(start);
    const out: Row[] = [];
    for (let i = 1; i <= m; i++) {
      const pay = i === m ? remaining : base;
      remaining -= pay;
      const d = new Date(startDate);
      d.setMonth(startDate.getMonth() + i);
      out.push({ n: i, date: d, payment: pay, balance: remaining });
    }
    setRows(out);
  }

  const monthlyTotal = rows && rows.length > 0 ? rows.reduce((s, r) => s + r.payment, 0) : 0;

  function asText(): string {
    if (!rows) return "";
    const head = `TO'LOV JADVALI\nUmumiy: ${total} · Boshlang'ich: ${down || "0"} · Muddat: ${months} oy · Ustama: ${markup}%\n`;
    const body = rows.map((r) => `${r.n}. ${fmtDate(r.date)} — ${fmtSom(r.payment)} so'm (qoldiq: ${fmtSom(r.balance)})`).join("\n");
    return `${head}\n${body}\n\nJami: ${fmtSom(monthlyTotal)} so'm`;
  }

  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(asText());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  function download() {
    const url = URL.createObjectURL(new Blob([asText()], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "tolov-jadvali.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{t("desc")}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label={t("total")} value={total} onChange={(v) => setTotal(formatMoneyInput(v))} suffix="so'm" placeholder="0" />
        <Field label={t("down")} value={down} onChange={(v) => setDown(formatMoneyInput(v))} suffix="so'm" placeholder="0" />
        <Field label={t("months")} value={months} onChange={(v) => setMonths(v.replace(/\D/g, ""))} suffix={t("mo")} />
        <Field label={t("markup")} value={markup} onChange={(v) => setMarkup(v.replace(/[^\d.]/g, ""))} suffix="%" />
        <Field label={t("start")} value={start} onChange={setStart} type="date" />
      </div>

      <button
        onClick={compute}
        disabled={!total.trim()}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        <CalendarBlank weight="fill" className="size-4" /> {t("generate")}
      </button>

      {rows && (
        <div className="mt-4">
          {rows.length === 0 ? (
            <p className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning">{t("invalid")}</p>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Table className="size-4" /> {t("title")} · {rows.length} {t("mo")}
                </p>
                <div className="flex items-center gap-1.5">
                  <button onClick={copy} className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium transition-colors hover:border-muted-foreground/30">
                    {copied ? <CheckCircle weight="fill" className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                    {copied ? t("copied") : t("copy")}
                  </button>
                  <button onClick={download} className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium transition-colors hover:border-muted-foreground/30">
                    <DownloadSimple className="size-3.5" /> {t("download")}
                  </button>
                </div>
              </div>
              <div className="scroll-clean max-h-80 overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/60 backdrop-blur">
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2 font-medium">№</th>
                      <th className="px-4 py-2 font-medium">{t("dueDate")}</th>
                      <th className="px-4 py-2 text-right font-medium">{t("payment")}</th>
                      <th className="px-4 py-2 text-right font-medium">{t("balance")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.n} className="border-t border-border/60 hover:bg-muted/30">
                        <td className="px-4 py-2 text-muted-foreground">{r.n}</td>
                        <td className="px-4 py-2">{fmtDate(r.date)}</td>
                        <td className="tabular px-4 py-2 text-right font-semibold">{fmtSom(r.payment)}</td>
                        <td className="tabular px-4 py-2 text-right text-muted-foreground">{fmtSom(r.balance)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                      <td className="px-4 py-2" colSpan={2}>
                        {t("total")}
                      </td>
                      <td className="tabular px-4 py-2 text-right text-primary">{fmtSom(monthlyTotal)}</td>
                      <td className="px-4 py-2" />
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
