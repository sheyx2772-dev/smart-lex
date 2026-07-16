"use client";

import { ArrowLeft, Buildings, FilePlus, Receipt, Scroll } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createContract } from "@/app/(app)/contracts/new/actions";
import { formatMoneyInput, formatPhoneInput, unformatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function daysFromNow(n: number) {
  // Deterministik emas — faqat default sifatida (foydalanuvchi o'zgartiradi).
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function NewContractForm() {
  const t = useTranslations("newContract");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    name: "",
    tin: "",
    phone: "",
    number: "",
    signedAt: new Date().toISOString().slice(0, 10),
    penaltyDailyBps: "5",
    penaltyCapBps: "5000",
    invNumber: "",
    amount: "",
    issuedAt: new Date().toISOString().slice(0, 10),
    dueDate: daysFromNow(30),
  });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const valid = f.name && f.tin && f.number && f.invNumber && f.amount && f.dueDate;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || pending) {
      if (!valid) setError(t("required"));
      return;
    }
    setError(null);
    setPending(true);
    const amountMinor = (BigInt(unformatMoney(f.amount) || "0") * 100n).toString();
    const res = await createContract({
      contractor: { name: f.name.trim(), tin: f.tin.trim(), phone: f.phone.trim() || undefined },
      number: f.number.trim(),
      signedAt: f.signedAt ? new Date(f.signedAt).toISOString() : undefined,
      penaltyDailyBps: Number(f.penaltyDailyBps) || 0,
      penaltyCapBps: f.penaltyCapBps ? Number(f.penaltyCapBps) : null,
      invoice: {
        number: f.invNumber.trim(),
        amountMinor,
        issuedAt: new Date(f.issuedAt).toISOString(),
        dueDate: new Date(f.dueDate).toISOString(),
      },
    });
    if (res.success && res.data) {
      router.push(`/companies/${res.data.contractorId}`);
      router.refresh();
    } else {
      setError(res.message || t("required"));
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link href="/companies" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" /> {t("contractorHeading")}
      </Link>
      <div className="mb-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <fieldset disabled={pending} className="space-y-4">
          {/* Contractor */}
          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <Buildings weight="fill" className="size-4 text-primary" />
              <CardTitle>{t("contractorHeading")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("name")} *</Label>
                <Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder={t("namePh")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("tin")} *</Label>
                <Input value={f.tin} onChange={(e) => set("tin", e.target.value)} placeholder="301234567" />
                <p className="text-xs text-muted-foreground">{t("tinHint")}</p>
              </div>
              <div className="space-y-1.5">
                <Label>{t("phone")}</Label>
                <Input value={f.phone} onChange={(e) => set("phone", formatPhoneInput(e.target.value))} placeholder="+998 90 123 45 67" />
              </div>
            </CardContent>
          </Card>

          {/* Contract */}
          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <Scroll weight="fill" className="size-4 text-primary" />
              <CardTitle>{t("contractHeading")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("number")} *</Label>
                <Input value={f.number} onChange={(e) => set("number", e.target.value)} placeholder="SH-2026-100" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("signedAt")}</Label>
                <Input type="date" value={f.signedAt} onChange={(e) => set("signedAt", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("penaltyDaily")}</Label>
                <Input type="number" value={f.penaltyDailyBps} onChange={(e) => set("penaltyDailyBps", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("penaltyCap")}</Label>
                <Input type="number" value={f.penaltyCapBps} onChange={(e) => set("penaltyCapBps", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* Invoice */}
          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <Receipt weight="fill" className="size-4 text-primary" />
              <CardTitle>{t("invoiceHeading")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("invoiceNumber")} *</Label>
                <Input value={f.invNumber} onChange={(e) => set("invNumber", e.target.value)} placeholder="INV-1100" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("amount")} *</Label>
                <Input inputMode="numeric" value={f.amount} onChange={(e) => set("amount", formatMoneyInput(e.target.value))} placeholder="5 000 000" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("issuedAt")}</Label>
                <Input type="date" value={f.issuedAt} onChange={(e) => set("issuedAt", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("dueAt")} *</Label>
                <Input type="date" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              <FilePlus weight="fill" className="size-4" />
              {pending ? t("creating") : t("create")}
            </Button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
