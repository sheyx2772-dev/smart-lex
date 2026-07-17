"use client";

import { ArrowLeft, CheckCircle, CircleNotch, Table, UploadSimple, Warning } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { createContract } from "@/app/(app)/contracts/actions";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

interface Row {
  i: number;
  name: string;
  tin: string;
  phone: string;
  contractNo: string;
  invoiceNo: string;
  som: string;
  issuedAt: string;
  dueDate: string;
  valid: boolean;
}

function parseRows(text: string): Row[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: Row[] = [];
  lines.forEach((line, idx) => {
    const cells = line.split(/\t|;|,/).map((c) => c.trim());
    const [name = "", tinRaw = "", phone = "", contractNo = "", invoiceNo = "", amount = "", issuedAt = "", dueDate = ""] = cells;
    const tin = tinRaw.replace(/\D/g, "");
    // Sarlavha qatorini o'tkazib yuboramiz (STIR raqam bo'lmasa).
    if (idx === 0 && !tin && /stir|инн|tin|nom|назв|name/i.test(line)) return;
    const som = amount.replace(/\s/g, "").replace(/\D/g, "");
    out.push({
      i: out.length,
      name,
      tin,
      phone,
      contractNo,
      invoiceNo,
      som,
      issuedAt,
      dueDate,
      valid: !!(name && tin && som),
    });
  });
  return out;
}

export function BulkImportForm() {
  const t = useTranslations("bulkImport");
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<{ ok: number; fail: number } | null>(null);

  const rows = useMemo(() => parseRows(text), [text]);
  const validRows = rows.filter((r) => r.valid);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  async function createAll() {
    if (!validRows.length || busy) return;
    setBusy(true);
    setResult(null);
    let ok = 0;
    let fail = 0;
    setProgress({ done: 0, total: validRows.length });
    for (const r of validRows) {
      const res = await createContract({
        contractor: { name: r.name, tin: r.tin, phone: r.phone || undefined },
        number: r.contractNo || `SH-${r.i + 1}`,
        signedAt: undefined,
        penaltyDailyBps: 5,
        invoice: {
          number: r.invoiceNo || `INV-${r.i + 1}`,
          amountMinor: `${r.som}00`,
          issuedAt: r.issuedAt || today(),
          dueDate: r.dueDate || plusDays(15),
        },
      });
      if (res.success) ok++;
      else fail++;
      setProgress({ done: ok + fail, total: validRows.length });
    }
    setResult({ ok, fail });
    setBusy(false);
    if (ok > 0) router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <Link href="/contracts/new" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" /> {t("back")}
        </Link>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Rejim tanlash */}
      <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-sm">
        <Link href="/contracts/new" className="rounded-md px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground">
          {t("single")}
        </Link>
        <span className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground">{t("bulk")}</span>
      </div>

      <Card className="p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{t("formatHint")}</p>
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary"
          >
            <UploadSimple className="size-3.5" /> {t("upload")}
          </button>
          <input ref={fileRef} type="file" accept=".csv,.txt,text/csv" onChange={onFile} className="hidden" />
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"GLOBAL SNAB MCHJ, 305111222, +998901112233, SH-001, INV-001, 5 000 000, 2026-06-01, 2026-06-15"}
          rows={6}
          className="scroll-clean w-full resize-y rounded-lg border border-border bg-background px-3 py-2 font-mono text-[13px] outline-none focus:border-primary/50"
        />
      </Card>

      {/* Ko'rib chiqish */}
      {rows.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-sm font-medium">
            <Table weight="fill" className="size-4 text-primary" /> {t("preview")}
            <span className="ml-auto text-xs text-muted-foreground">
              {validRows.length}/{rows.length}
            </span>
          </div>
          <div className="scroll-clean max-h-72 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{t("colRow")}</th>
                  <th className="px-3 py-2 font-medium">{t("colName")}</th>
                  <th className="px-3 py-2 font-medium">{t("colTin")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("colAmount")}</th>
                  <th className="px-3 py-2 font-medium">{t("colState")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.i} className="border-t border-border">
                    <td className="px-3 py-2 text-muted-foreground">{r.i + 1}</td>
                    <td className="max-w-[200px] truncate px-3 py-2">{r.name || "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{r.tin || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.som ? `${Number(r.som).toLocaleString("ru-RU")}` : "—"}</td>
                    <td className="px-3 py-2">
                      {r.valid ? (
                        <span className="inline-flex items-center gap-1 text-xs text-success">
                          <CheckCircle weight="fill" className="size-3.5" /> {t("stOk")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-danger">
                          <Warning weight="fill" className="size-3.5" /> {t("stErr")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {result && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-success/30 bg-success-soft px-4 py-2.5 text-sm">
          <span className="flex items-center gap-1.5 font-medium text-success">
            <CheckCircle weight="fill" className="size-4" /> {t("resultOk", { ok: result.ok })}
          </span>
          {result.fail > 0 && <span className="text-danger">{t("resultFail", { fail: result.fail })}</span>}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={createAll}
          disabled={busy || !validRows.length}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? <CircleNotch className="size-4 animate-spin" /> : <UploadSimple weight="fill" className="size-4" />}
          {busy ? `${t("creating")} ${progress.done}/${progress.total}` : `${t("createAll")} (${validRows.length})`}
        </button>
      </div>
    </div>
  );
}
