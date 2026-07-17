"use client";

import { ArrowLeft, Buildings, CircleNotch, CurrencyCircleDollar, FileText, FloppyDisk, Warning } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createContract } from "@/app/(app)/contracts/actions";
import { Card } from "@/components/ui/card";
import { formatPhoneInput } from "@/lib/format";
import { cn } from "@/lib/utils";

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

export function NewContractForm() {
  const t = useTranslations("newContract");
  const router = useRouter();

  const [name, setName] = useState("");
  const [tin, setTin] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [cNumber, setCNumber] = useState("");
  const [signedAt, setSignedAt] = useState(today());
  const [penaltyPct, setPenaltyPct] = useState("0.05");
  const [iNumber, setINumber] = useState("");
  const [amount, setAmount] = useState("");
  const [issuedAt, setIssuedAt] = useState(today());
  const [dueDate, setDueDate] = useState(plusDays(15));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountSom = amount.replace(/\D/g, "");
  const valid = name.trim() && tin.trim() && cNumber.trim() && iNumber.trim() && amountSom && issuedAt && dueDate;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!valid) {
      setError(t("error"));
      return;
    }
    setLoading(true);
    const res = await createContract({
      contractor: { name: name.trim(), tin: tin.trim(), phone: phone || undefined, legalAddress: address || undefined, email: email || undefined },
      number: cNumber.trim(),
      signedAt: signedAt || undefined,
      penaltyDailyBps: Math.max(0, Math.round(Number(penaltyPct || "0") * 100)),
      invoice: {
        number: iNumber.trim(),
        amountMinor: `${amountSom}00`, // so'm → minor (×100)
        issuedAt,
        dueDate,
      },
    });
    if (res.success && res.data) {
      router.push(`/companies/${res.data.contractorId}`);
      router.refresh();
    } else {
      setError(res.message ?? t("error"));
      setLoading(false);
    }
  }

  const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50";
  const label = "mb-1 block text-xs font-medium text-muted-foreground";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <Link href="/contracts" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" /> {t("back")}
        </Link>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {/* Qarzdor */}
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Buildings weight="fill" className="size-4 text-primary" /> {t("secDebtor")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={label}>{t("name")} *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("namePh")} className={field} />
            </div>
            <div>
              <label className={label}>{t("tin")} *</label>
              <input value={tin} onChange={(e) => setTin(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={field} />
            </div>
            <div>
              <label className={label}>{t("phone")}</label>
              <input value={phone} onChange={(e) => setPhone(formatPhoneInput(e.target.value))} placeholder="+998 90 123 45 67" inputMode="tel" className={field} />
            </div>
            <div>
              <label className={label}>{t("address")}</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} className={field} />
            </div>
            <div>
              <label className={label}>{t("email")}</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={field} />
            </div>
          </div>
        </Card>

        {/* Shartnoma */}
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <FileText weight="fill" className="size-4 text-primary" /> {t("secContract")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={label}>{t("cNumber")} *</label>
              <input value={cNumber} onChange={(e) => setCNumber(e.target.value)} placeholder="SH-2026-001" className={field} />
            </div>
            <div>
              <label className={label}>{t("signedAt")}</label>
              <input value={signedAt} onChange={(e) => setSignedAt(e.target.value)} type="date" className={field} />
            </div>
            <div>
              <label className={label}>{t("penaltyRate")}</label>
              <input value={penaltyPct} onChange={(e) => setPenaltyPct(e.target.value)} inputMode="decimal" className={field} />
              <p className="mt-1 text-[11px] text-muted-foreground">{t("penaltyHint")}</p>
            </div>
          </div>
        </Card>

        {/* Qarz (invoice) */}
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <CurrencyCircleDollar weight="fill" className="size-4 text-primary" /> {t("secDebt")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={label}>{t("iNumber")} *</label>
              <input value={iNumber} onChange={(e) => setINumber(e.target.value)} placeholder="INV-1001" className={field} />
            </div>
            <div>
              <label className={label}>{t("amount")} *</label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " "))}
                placeholder={t("amountPh")}
                inputMode="numeric"
                className={cn(field, "tabular-nums")}
              />
            </div>
            <div>
              <label className={label}>{t("issuedAt")} *</label>
              <input value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} type="date" className={field} />
            </div>
            <div>
              <label className={label}>{t("dueDate")} *</label>
              <input value={dueDate} onChange={(e) => setDueDate(e.target.value)} type="date" className={field} />
            </div>
          </div>
        </Card>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger-soft px-4 py-2.5 text-sm text-danger">
            <Warning weight="fill" className="size-4 shrink-0" /> {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || !valid}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {loading ? <CircleNotch className="size-4 animate-spin" /> : <FloppyDisk weight="fill" className="size-4" />}
            {loading ? t("creating") : t("submit")}
          </button>
        </div>
      </form>
    </div>
  );
}
