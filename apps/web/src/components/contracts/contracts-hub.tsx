"use client";

import { CheckCircle, Copy, DeviceMobile, FilePlus, Handshake, House, PaperPlaneTilt, ShieldCheck, Truck, UsersThree, Wrench, type Icon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { formatPhoneInput } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TEMPLATES: { key: string; icon: Icon }[] = [
  { key: "nasiya", icon: Handshake },
  { key: "supply", icon: Truck },
  { key: "service", icon: Wrench },
  { key: "rent", icon: House },
  { key: "employment", icon: FilePlus },
  { key: "multiparty", icon: UsersThree },
];

const METHODS: { key: "sms" | "eimzo" | "telegram"; icon: Icon }[] = [
  { key: "sms", icon: DeviceMobile },
  { key: "eimzo", icon: ShieldCheck },
  { key: "telegram", icon: PaperPlaneTilt },
];

export function ContractsHub() {
  const t = useTranslations("contractsHub");
  const [party, setParty] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<"sms" | "eimzo" | "telegram">("sms");
  const [invite, setInvite] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function buildInvite() {
    if (!party.trim()) return;
    const msg = t("inviteMsg", { name: party.trim(), method: t(`methods.${method}` as never) });
    setInvite(msg);
    setCopied(false);
  }
  async function copy() {
    if (!invite) return;
    await navigator.clipboard.writeText(invite);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Link
          href="/contracts/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <FilePlus weight="fill" className="size-4" /> {t("newContract")}
        </Link>
      </div>

      {/* Namunalar (Templates) */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("templates")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((tpl) => {
            const Ic = tpl.icon;
            return (
              <Link
                key={tpl.key}
                href="/studio"
                className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary-soft/20"
              >
                <span className="grid size-9 place-items-center rounded-lg bg-primary-soft text-primary">
                  <Ic weight="fill" className="size-5" />
                </span>
                <p className="text-sm font-semibold">{t(`tpl.${tpl.key}.name` as never)}</p>
                <p className="text-xs text-muted-foreground">{t(`tpl.${tpl.key}.desc` as never)}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Masofadan imzolash */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("remoteSign")}</h2>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{t("remoteSignDesc")}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">{t("partyName")}</span>
              <input
                value={party}
                onChange={(e) => setParty(e.target.value)}
                placeholder={t("partyNamePh")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">{t("partyPhone")}</span>
              <input
                value={phone}
                onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                placeholder="+998 90 123 45 67"
                inputMode="tel"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
              />
            </label>
          </div>

          {/* Imzo usuli */}
          <div className="mt-4">
            <span className="text-xs font-medium text-muted-foreground">{t("signMethod")}</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {METHODS.map((m) => {
                const Ic = m.icon;
                const active = method === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => setMethod(m.key)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                      active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Ic weight={active ? "fill" : "regular"} className="size-4" /> {t(`methods.${m.key}` as never)}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={buildInvite}
            disabled={!party.trim()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Handshake weight="fill" className="size-4" /> {t("buildInvite")}
          </button>

          {invite && (
            <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
              <p className="whitespace-pre-wrap text-sm">{invite}</p>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  onClick={copy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:border-muted-foreground/30"
                >
                  {copied ? <CheckCircle weight="fill" className="size-4 text-success" /> : <Copy className="size-4" />}
                  {copied ? t("copied") : t("copyInvite")}
                </button>
                <span className="text-[11px] text-muted-foreground">{t("sendHint")}</span>
              </div>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
