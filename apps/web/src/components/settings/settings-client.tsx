"use client";

import {
  BellRinging,
  Buildings,
  ChatText,
  FileText,
  type Icon as PhIcon,
  Percent,
  PuzzlePiece,
  UserCircle,
  UsersThree,
} from "@phosphor-icons/react";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { cloneElement, isValidElement, type ReactElement, useRef, useState, useTransition } from "react";
import { type Editor } from "@tiptap/react";
import { connectDidox, createUser, saveCollection, saveCompany, saveDocTemplates, saveIntegrations, savePassword, saveProfile, updateUser } from "@/app/(app)/settings/actions";
import { plainToHtml } from "@/lib/doc-html";
import { DEFAULT_DOC_TEMPLATES, DOC_TEMPLATE_VARS, type DocTemplateType } from "@/lib/doc-templates";
import { type EimzoKeyOption, listEimzoKeys, signTinForDidox } from "@/lib/eimzo";
import { formatPhoneInput } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { RichEditor } from "@/components/ui/rich-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_TEMPLATES, type LocalizedText, TemplateEditor } from "@/components/settings/template-editor";
import { cn } from "@/lib/utils";

const LOCALES = ["uz", "ru", "en"] as const;
const STAGES = ["soft_reminder", "firm_reminder", "demand_letter", "court"] as const;

// Preset qiymatlar — number input o'rniga Select uchun.
const OFFSET_PRESETS = [-30, -15, -10, -7, -5, -3, -1, 0, 1, 3, 5, 7, 10, 15, 30, 45, 60, 90];
const DAILY_BPS_PRESETS = [0, 1, 3, 5, 7, 10, 15, 20, 30];
const CAP_BPS_PRESETS = [1000, 2000, 3000, 5000, 10000];
const bpsToPercent = (bps: number) => `${(bps / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;

interface Penalty {
  dailyBps: number;
  capBps: number | null;
}
interface Channels {
  sms: boolean;
  email: boolean;
  telegram: boolean;
  hybridPost: boolean;
}
interface Step {
  stage: (typeof STAGES)[number];
  offsetDays: number;
  requiresApproval: boolean;
}
export interface SettingsData {
  profile: { id: string; fullName: string; email: string; locale: string; role: string };
  company: {
    name: string;
    tin: string;
    type: string;
    legalAddress: string;
    bankAccount: string;
    bankMfo: string;
    phone: string;
    email: string;
    defaultLocale: string;
    settings: { penalty?: Penalty; channels?: Channels; templates?: Templates; signatory?: Signatory; docTemplates?: Record<string, string> };
    integrations: IntegrationStatus;
  };
  collection: { steps: Step[] };
}
interface Signatory {
  name: string;
  position: string;
}
interface IntegrationStatus {
  didoxSet: boolean;
  bankSet: boolean;
  eimzoSiteId: string;
  smsProvider: string;
  smsSet: boolean;
  telegramSet: boolean;
  telegramChatId: string;
  telegramTopicId: string;
}
interface Templates {
  soft: LocalizedText;
  firm: LocalizedText;
}

const TABS: { key: string; icon: PhIcon }[] = [
  { key: "profile", icon: UserCircle },
  { key: "company", icon: Buildings },
  { key: "team", icon: UsersThree },
  { key: "collection", icon: BellRinging },
  { key: "penalty", icon: Percent },
  { key: "channels", icon: ChatText },
  { key: "templates", icon: FileText },
  { key: "integrations", icon: PuzzlePiece },
];

export interface TeamUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
}

export function SettingsClient({
  data,
  users,
  currentRole,
  currentUserId,
}: {
  data: SettingsData;
  users: TeamUser[];
  currentRole: string;
  currentUserId: string;
}) {
  const t = useTranslations("settings");
  const searchParams = useSearchParams();
  const TAB_KEYS = TABS.map((x) => x.key);
  const initialTab = searchParams.get("tab");
  const [tab, setTabState] = useState<string>(initialTab && TAB_KEYS.includes(initialTab) ? initialTab : "profile");
  // Aktiv tab URL param'да saqlanadi (refreshdan keyin qoladi). Server round-trip yo'q.
  function setTab(key: string) {
    setTabState(key);
    window.history.replaceState(null, "", `?tab=${key}`);
  }
  // Kompaniya + settings umumiy holatда (penalty/channels ham shu orqali saqlanadi).
  const [company, setCompany] = useState(data.company);

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[188px_1fr]">
        {/* Left tabs — sticky (mahkam turadi, faqat o'ng skroll) */}
        <nav className="flex gap-1 overflow-x-auto lg:sticky lg:top-0 lg:flex-col lg:self-start lg:overflow-visible">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={cn(
                  "flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon weight={active ? "fill" : "regular"} className="size-5 shrink-0" />
                {t(`tabs.${item.key}`)}
              </button>
            );
          })}
        </nav>

        {/* Active section */}
        <div className="min-w-0">
          {tab === "profile" && <ProfileSection profile={data.profile} />}
          {tab === "company" && <CompanySection company={company} setCompany={setCompany} />}
          {tab === "team" && <TeamSection users={users} currentRole={currentRole} currentUserId={currentUserId} />}
          {tab === "collection" && <CollectionSection steps={data.collection.steps} />}
          {tab === "penalty" && <PenaltySection company={company} setCompany={setCompany} />}
          {tab === "channels" && <ChannelsSection company={company} setCompany={setCompany} />}
          {tab === "templates" && <DocTemplatesSection saved={(data.company.settings?.docTemplates ?? {}) as Record<string, string>} />}
          {tab === "integrations" && <IntegrationsSection integrations={data.company.integrations} tin={company.tin} />}
        </div>
      </div>
    </div>
  );
}

/** Saqlash tugmasi + holat (saving/saved). */
function useSaver() {
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  function run(fn: () => Promise<{ success: boolean; message: string }>) {
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await fn();
      if (res.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        setError(res.message);
      }
    });
  }
  return { pending, saved, error, run };
}

function SaveBar({ pending, saved, error, label, savingLabel, savedLabel }: {
  pending: boolean; saved: boolean; error: string | null; label: string; savingLabel: string; savedLabel: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {pending ? savingLabel : label}
      </Button>
      {saved && (
        <span className="flex items-center gap-1.5 text-sm text-success">
          <Check className="size-4" /> {savedLabel}
        </span>
      )}
      {error && <span className="text-sm text-danger">{error}</span>}
    </div>
  );
}

/** Form + fieldset — saqlash paytida (pending) ICHIDAGI hamma kontrol disabled bo'ladi. */
function Form({
  pending,
  onSubmit,
  className,
  children,
}: {
  pending: boolean;
  onSubmit: (e: React.FormEvent) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <form onSubmit={onSubmit}>
      <fieldset disabled={pending} className={cn("min-w-0 disabled:opacity-70", className)}>
        {children}
      </fieldset>
    </form>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  // Placeholder bo'lmasa — label'ni placeholder sifatida beradi.
  const child =
    isValidElement(children) && (children.props as { placeholder?: unknown }).placeholder === undefined
      ? cloneElement(children as ReactElement<{ placeholder?: string }>, { placeholder: label })
      : children;
  return (
    <div className="space-y-1.5">
      <Label required={required}>{label}</Label>
      {child}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

// ── Profil ────────────────────────────────────────────────
function ProfileSection({ profile }: { profile: SettingsData["profile"] }) {
  const t = useTranslations("settings");
  const [fullName, setFullName] = useState(profile.fullName);
  const [locale, setLocale] = useState(profile.locale);
  const saver = useSaver();
  const pw = useSaver();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("profile.heading")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("profile.desc")}</p>
        </CardHeader>
        <CardContent>
          <Form
            pending={saver.pending}
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saver.run(() => saveProfile({ fullName, locale }));
            }}
          >
            <Field label={t("profile.fullName")} required>
              <Input placeholder={t("profile.fullNamePh")} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
            <Field label={t("profile.email")}>
              <Input value={profile.email} disabled />
            </Field>
            <Field label={t("profile.language")}>
              <Select value={locale} onChange={(e) => setLocale(e.target.value)}>
                {LOCALES.map((l) => (
                  <option key={l} value={l}>
                    {l.toUpperCase()}
                  </option>
                ))}
              </Select>
            </Field>
            <SaveBar {...saver} label={t("save")} savingLabel={t("saving")} savedLabel={t("saved")} />
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.passwordHeading")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("profile.passwordDesc")}</p>
        </CardHeader>
        <CardContent>
          <Form
            pending={pw.pending}
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              pw.run(async () => {
                const res = await savePassword({ currentPassword: current, newPassword: next });
                if (res.success) {
                  setCurrent("");
                  setNext("");
                }
                return res;
              });
            }}
          >
            <Field label={t("profile.currentPassword")} required error={pw.error ? t("profile.wrongCurrent") : undefined}>
              <PasswordInput value={current} onChange={(e) => setCurrent(e.target.value)} />
            </Field>
            <Field label={t("profile.newPassword")} required>
              <PasswordInput value={next} onChange={(e) => setNext(e.target.value)} />
            </Field>
            <SaveBar pending={pw.pending} saved={pw.saved} error={null} label={t("profile.updatePassword")} savingLabel={t("saving")} savedLabel={t("saved")} />
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Kompaniya ─────────────────────────────────────────────
function CompanySection({ company, setCompany }: { company: SettingsData["company"]; setCompany: (c: SettingsData["company"]) => void }) {
  const t = useTranslations("settings");
  const saver = useSaver();
  const set = (k: keyof SettingsData["company"], v: string) => setCompany({ ...company, [k]: v });
  const signatory = company.settings.signatory ?? { name: "", position: "" };
  const setSignatory = (patch: Partial<Signatory>) =>
    setCompany({ ...company, settings: { ...company.settings, signatory: { ...signatory, ...patch } } });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("company.heading")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("company.desc")}</p>
      </CardHeader>
      <CardContent>
        <Form
          pending={saver.pending}
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            saver.run(() => saveCompany(company));
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("company.name")} required>
              <Input placeholder={t("company.namePh")} value={company.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label={t("company.tin")}>
              <Input value={company.tin} disabled />
            </Field>
            <Field label={t("company.legalAddress")}>
              <Input placeholder={t("company.addressPh")} value={company.legalAddress} onChange={(e) => set("legalAddress", e.target.value)} />
            </Field>
            <Field label={t("company.phone")}>
              <Input placeholder="+998 90 123 45 67" value={company.phone} onChange={(e) => set("phone", formatPhoneInput(e.target.value))} />
            </Field>
            <Field label={t("company.bankAccount")}>
              <Input placeholder="2020 8000 9001 2345 6789" value={company.bankAccount} onChange={(e) => set("bankAccount", e.target.value)} />
            </Field>
            <Field label={t("company.bankMfo")}>
              <Input placeholder="00014" value={company.bankMfo} onChange={(e) => set("bankMfo", e.target.value)} />
            </Field>
            <Field label={t("company.contactEmail")}>
              <Input placeholder="info@company.uz" value={company.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label={t("company.defaultLocale")}>
              <Select value={company.defaultLocale} onChange={(e) => set("defaultLocale", e.target.value)}>
                {LOCALES.map((l) => (
                  <option key={l} value={l}>
                    {l.toUpperCase()}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {/* Imzolovchi rahbar (hujjatlar/talabnoma uchun) */}
          <div className="border-t border-border pt-4">
            <p className="mb-3 text-sm font-semibold">{t("company.signatoryHeading")}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("company.signatoryName")}>
                <Input placeholder={t("company.namePh")} value={signatory.name} onChange={(e) => setSignatory({ name: e.target.value })} />
              </Field>
              <Field label={t("company.signatoryPosition")}>
                <Input placeholder={t("company.signatoryPositionPh")} value={signatory.position} onChange={(e) => setSignatory({ position: e.target.value })} />
              </Field>
            </div>
          </div>

          <SaveBar {...saver} label={t("save")} savingLabel={t("saving")} savedLabel={t("saved")} />
        </Form>
      </CardContent>
    </Card>
  );
}

// ── Jamoa / Foydalanuvchilar ──────────────────────────────
const ROLES = ["owner", "admin", "finance", "legal", "viewer"] as const;
const ROLE_TONE: Record<string, "primary" | "secondary" | "success" | "warning" | "neutral"> = {
  owner: "primary",
  admin: "secondary",
  finance: "success",
  legal: "warning",
  viewer: "neutral",
};

function TeamSection({ users, currentRole, currentUserId }: { users: TeamUser[]; currentRole: string; currentUserId: string }) {
  const t = useTranslations("settings");
  const canManage = currentRole === "owner" || currentRole === "admin";
  const adder = useSaver();
  const [, startUpdate] = useTransition();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [password, setPassword] = useState("");
  const [emailErr, setEmailErr] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("team.heading")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("team.desc")}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Ro'yxat */}
        <div className="divide-y divide-border rounded-lg border border-border">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-secondary to-primary font-display text-xs font-semibold text-white">
                {u.fullName.slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {u.fullName}
                  {u.id === currentUserId && <span className="ml-1.5 text-xs text-muted-foreground">({t("team.you")})</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
              </div>
              {canManage ? (
                <Select
                  className="h-9 w-36"
                  value={u.role}
                  onChange={(e) => startUpdate(() => void updateUser(u.id, { role: e.target.value }))}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {t(`team.roles.${r}`)}
                    </option>
                  ))}
                </Select>
              ) : (
                <Badge tone={ROLE_TONE[u.role]}>{t(`team.roles.${u.role}`)}</Badge>
              )}
              {canManage && (
                <span title={u.isActive ? t("team.active") : t("team.inactive")}>
                  <Switch checked={u.isActive} onCheckedChange={(v) => startUpdate(() => void updateUser(u.id, { isActive: v }))} />
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Qo'shish formasi */}
        {canManage && (
          <Form
            pending={adder.pending}
            className="rounded-lg border border-dashed border-border p-4"
            onSubmit={(e) => {
              e.preventDefault();
              setEmailErr(null);
              adder.run(async () => {
                const res = await createUser({ fullName, email, role, password });
                if (res.success) {
                  setFullName("");
                  setEmail("");
                  setPassword("");
                  setRole("viewer");
                } else if (res.error?.code === "CONFLICT") {
                  setEmailErr(t("team.emailExists"));
                }
                return res;
              });
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("team.fullName")} required>
                <Input placeholder={t("team.namePh")} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </Field>
              <Field label={t("team.email")} required error={emailErr ?? undefined}>
                <Input type="email" placeholder="xodim@company.uz" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </Field>
              <Field label={t("team.role")}>
                <Select value={role} onChange={(e) => setRole(e.target.value)}>
                  {ROLES.filter((r) => r !== "owner").map((r) => (
                    <option key={r} value={r}>
                      {t(`team.roles.${r}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("team.password")} required>
                <Input type="password" placeholder="••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </Field>
            </div>
            <div className="mt-4">
              <SaveBar pending={adder.pending} saved={adder.saved} error={adder.error} label={t("team.addUser")} savingLabel={t("saving")} savedLabel={t("saved")} />
            </div>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}

// ── Hujjat shablonlari ────────────────────────────────────
const DOC_TYPES: DocTemplateType[] = ["demand_letter", "court_claim", "reconciliation_act"];

function DocTemplatesSection({ saved }: { saved: Record<string, string> }) {
  const t = useTranslations("settings");
  const dt = useTranslations("settings.docTemplates");
  const saver = useSaver();
  const editorRef = useRef<Editor | null>(null);
  const [type, setType] = useState<DocTemplateType>("demand_letter");
  const [tpl, setTpl] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const ty of DOC_TYPES) init[ty] = saved[ty] || plainToHtml(DEFAULT_DOC_TEMPLATES[ty]);
    return init;
  });

  const setCurrent = (html: string) => setTpl((s) => ({ ...s, [type]: html }));
  const insertVar = (v: string) => editorRef.current?.chain().focus().insertContent(`{${v}}`).run();
  const resetDefault = () => setCurrent(plainToHtml(DEFAULT_DOC_TEMPLATES[type]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{dt("heading")}</CardTitle>
        <p className="text-sm text-muted-foreground">{dt("desc")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Doc type tabs */}
        <div className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
          {DOC_TYPES.map((ty) => (
            <button
              key={ty}
              onClick={() => setType(ty)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                type === ty ? "bg-primary-soft text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {dt(`type.${ty}` as never)}
            </button>
          ))}
        </div>

        {/* Variable chips */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">{dt("variables")}</p>
          <div className="flex flex-wrap gap-1.5">
            {DOC_TEMPLATE_VARS[type].map((v) => (
              <button
                key={v}
                onClick={() => insertVar(v)}
                title={dt("insert")}
                className="tabular rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                {`{${v}}`}
              </button>
            ))}
          </div>
        </div>

        {/* Editor */}
        <RichEditor value={tpl[type]} onChange={setCurrent} onReady={(e) => (editorRef.current = e)} className="h-[440px]" />

        <div className="flex items-center justify-between">
          <button onClick={resetDefault} className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            {dt("reset")}
          </button>
        </div>

        <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{dt("note")}</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            saver.run(() => saveDocTemplates(tpl));
          }}
        >
          <SaveBar {...saver} label={t("save")} savingLabel={t("saving")} savedLabel={t("saved")} />
        </form>
      </CardContent>
    </Card>
  );
}

// ── Integratsiyalar ───────────────────────────────────────
function IntegrationBadge({ set, tOn, tOff }: { set: boolean; tOn: string; tOff: string }) {
  return set ? <Badge tone="success">{tOn}</Badge> : <Badge tone="neutral">{tOff}</Badge>;
}

function IntegrationsSection({ integrations, tin }: { integrations: IntegrationStatus; tin: string }) {
  const t = useTranslations("settings");
  const ui = useTranslations("settings.integrations_ui");
  const router = useRouter();
  const [didoxConnecting, setDidoxConnecting] = useState(false);
  const [didoxError, setDidoxError] = useState<string | null>(null);
  const [eimzoKeys, setEimzoKeys] = useState<EimzoKeyOption[] | null>(null);

  async function connectDidoxViaEimzo() {
    if (didoxConnecting) return;
    setDidoxError(null);
    if (!tin) {
      setDidoxError(ui("didoxTinMissing"));
      return;
    }
    setDidoxConnecting(true);
    try {
      const { keys } = await listEimzoKeys();
      if (keys.length > 1) {
        setEimzoKeys(keys);
        setDidoxConnecting(false);
        return;
      }
      await finishDidoxConnect(keys[0]!);
    } catch (e) {
      setDidoxError(e instanceof Error ? e.message : String(e));
      setDidoxConnecting(false);
    }
  }

  async function finishDidoxConnect(key: EimzoKeyOption) {
    setEimzoKeys(null);
    setDidoxConnecting(true);
    try {
      const sig = await signTinForDidox(tin, key);
      const res = await connectDidox({ pkcs7: sig.pkcs7, signatureHex: sig.signatureHex });
      if (!res.success) throw new Error(res.message);
      router.refresh();
    } catch (e) {
      setDidoxError(e instanceof Error ? e.message : String(e));
    } finally {
      setDidoxConnecting(false);
    }
  }

  const saver = useSaver();
  const [form, setForm] = useState<Record<string, string>>({
    eimzoSiteId: integrations.eimzoSiteId,
    smsProvider: integrations.smsProvider,
    telegramChatId: integrations.telegramChatId,
    telegramTopicId: integrations.telegramTopicId,
  });
  const set = (k: string, v: string) => setForm({ ...form, [k]: v });

  const secretFields: { key: string; label: string; configured: boolean }[] = [
    { key: "didoxToken", label: ui("didoxToken"), configured: integrations.didoxSet },
    { key: "bankApiKey", label: ui("bankApiKey"), configured: integrations.bankSet },
    { key: "smsApiKey", label: ui("smsApiKey"), configured: integrations.smsSet },
    { key: "telegramBotToken", label: ui("telegramBotToken"), configured: integrations.telegramSet },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ui("heading")}</CardTitle>
        <p className="text-sm text-muted-foreground">{ui("desc")}</p>
      </CardHeader>
      <CardContent>
        <Form
          pending={saver.pending}
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            saver.run(async () => {
              // Faqat bo'sh bo'lmagan qiymatlarni yuborish.
              const payload: Record<string, string> = {};
              for (const [k, v] of Object.entries(form)) if (v.trim()) payload[k] = v.trim();
              const res = await saveIntegrations(payload);
              // Maxfiy inputlarni tozalash.
              if (res.success) setForm((f) => ({ ...f, didoxToken: "", bankApiKey: "", smsApiKey: "", telegramBotToken: "" }));
              return res;
            });
          }}
        >
          {/* Ochiq maydonlar */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={ui("eimzoSiteId")}>
              <Input value={form.eimzoSiteId ?? ""} onChange={(e) => set("eimzoSiteId", e.target.value)} placeholder="site-xxxx" />
            </Field>
            <Field label={ui("smsProvider")}>
              <Input value={form.smsProvider ?? ""} onChange={(e) => set("smsProvider", e.target.value)} placeholder="eskiz / playmobile" />
            </Field>
          </div>

          {/* Didox — E-IMZO orqali o'z-o'zini ulash */}
          <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{ui("didoxConnectTitle")}</p>
                <p className="text-xs text-muted-foreground">{ui("didoxConnectDesc")}</p>
              </div>
              <IntegrationBadge set={integrations.didoxSet} tOn={ui("configured")} tOff={ui("notConfigured")} />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={connectDidoxViaEimzo} disabled={didoxConnecting}>
              {didoxConnecting ? ui("didoxConnecting") : ui("didoxConnectButton")}
            </Button>
            {didoxError && <p className="text-xs text-danger">{didoxError}</p>}
            {eimzoKeys && (
              <div className="space-y-1.5 rounded-lg border border-border bg-card p-2">
                <p className="px-1 text-xs font-medium text-muted-foreground">{ui("didoxChooseKey")}</p>
                {eimzoKeys.map((k, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => finishDidoxConnect(k)}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <span className="font-medium">{k.CN || k.O}</span>
                    <span className="text-xs text-muted-foreground">{k.TIN || k.PINFL}{k.validTo ? ` · ${k.validTo}` : ""}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Maxfiy kalitlar */}
          <div className="space-y-3">
            {secretFields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>{f.label}</Label>
                  <IntegrationBadge set={f.configured} tOn={ui("configured")} tOff={ui("notConfigured")} />
                </div>
                <PasswordInput
                  value={form[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  placeholder={f.configured ? `••••••••  (${ui("replaceHint")})` : f.label}
                />
              </div>
            ))}
          </div>

          {/* Telegram manzili — bot qayerga yozadi */}
          <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
            <div>
              <p className="text-sm font-medium">{ui("telegramDest")}</p>
              <p className="text-xs text-muted-foreground">{ui("telegramDestHint")}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={ui("telegramChatId")}>
                <Input value={form.telegramChatId ?? ""} onChange={(e) => set("telegramChatId", e.target.value)} placeholder="-1001234567890" />
              </Field>
              <Field label={ui("telegramTopicId")}>
                <Input value={form.telegramTopicId ?? ""} onChange={(e) => set("telegramTopicId", e.target.value)} placeholder="12" />
              </Field>
            </div>
          </div>

          <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{ui("secretNote")}</p>
          <SaveBar {...saver} label={t("save")} savingLabel={t("saving")} savedLabel={t("saved")} />
        </Form>
      </CardContent>
    </Card>
  );
}

// ── Undirish siyosati ─────────────────────────────────────
function CollectionSection({ steps: initial }: { steps: Step[] }) {
  const t = useTranslations("settings");
  const [steps, setSteps] = useState<Step[]>(initial);
  const saver = useSaver();

  const update = (i: number, patch: Partial<Step>) => setSteps(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const remove = (i: number) => setSteps(steps.filter((_, idx) => idx !== i));
  const add = () => setSteps([...steps, { stage: "soft_reminder", offsetDays: 0, requiresApproval: false }]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("collection.heading")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("collection.desc")}</p>
      </CardHeader>
      <CardContent>
        <Form
          pending={saver.pending}
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            saver.run(() => saveCollection({ steps }));
          }}
        >
          {steps.map((step, i) => (
            <div key={i} className="grid grid-cols-1 items-end gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-[1.4fr_1.4fr_auto_auto]">
              <Field label={t("collection.stage")}>
                <Select value={step.stage} onChange={(e) => update(i, { stage: e.target.value as Step["stage"] })}>
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {t(`collection.stages.${s}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("collection.timing")}>
                <div className="flex items-center gap-2">
                  <Select
                    className="w-28"
                    value={String(step.offsetDays)}
                    onChange={(e) => update(i, { offsetDays: Number(e.target.value) })}
                  >
                    {OFFSET_PRESETS.map((d) => (
                      <option key={d} value={d}>
                        {d > 0 ? `+${d}` : d} {t("collection.offsetDays").toLowerCase()}
                      </option>
                    ))}
                  </Select>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {step.offsetDays < 0 ? t("collection.before") : step.offsetDays > 0 ? t("collection.after") : t("collection.onDue")}
                  </span>
                </div>
              </Field>
              <div className="flex items-center gap-2 pb-2.5">
                <Switch checked={step.requiresApproval} onCheckedChange={(v) => update(i, { requiresApproval: v })} />
                <span className="text-xs text-muted-foreground">{t("collection.requiresApproval")}</span>
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="mb-1 grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-danger-soft hover:text-danger"
                title={t("collection.remove")}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" onClick={add}>
            <Plus className="size-4" /> {t("collection.addStep")}
          </Button>

          <div className="pt-2">
            <SaveBar {...saver} label={t("save")} savingLabel={t("saving")} savedLabel={t("saved")} />
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}

// ── Penya ─────────────────────────────────────────────────
function PenaltySection({ company, setCompany }: { company: SettingsData["company"]; setCompany: (c: SettingsData["company"]) => void }) {
  const t = useTranslations("settings");
  const saver = useSaver();
  const penalty = company.settings.penalty ?? { dailyBps: 5, capBps: 5000 };
  const setPenalty = (p: Penalty) => setCompany({ ...company, settings: { ...company.settings, penalty: p } });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("penalty.heading")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("penalty.desc")}</p>
      </CardHeader>
      <CardContent>
        <Form
          pending={saver.pending}
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            saver.run(() => saveCompany(company));
          }}
        >
          <Field label={t("penalty.dailyBps")}>
            <Select
              value={String(penalty.dailyBps)}
              onChange={(e) => setPenalty({ ...penalty, dailyBps: Number(e.target.value) })}
            >
              {DAILY_BPS_PRESETS.map((b) => (
                <option key={b} value={b}>
                  {bpsToPercent(b)} / {t("penalty.perDay")} ({b} bps)
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">{t("penalty.dailyBpsHint")}</p>
          </Field>
          <Field label={t("penalty.capBps")}>
            <Select
              value={penalty.capBps === null ? "" : String(penalty.capBps)}
              onChange={(e) => setPenalty({ ...penalty, capBps: e.target.value === "" ? null : Number(e.target.value) })}
            >
              <option value="">{t("penalty.noCap")}</option>
              {CAP_BPS_PRESETS.map((b) => (
                <option key={b} value={b}>
                  {bpsToPercent(b)}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">{t("penalty.capBpsHint")}</p>
          </Field>
          <SaveBar {...saver} label={t("save")} savingLabel={t("saving")} savedLabel={t("saved")} />
        </Form>
      </CardContent>
    </Card>
  );
}

// ── Kanallar ──────────────────────────────────────────────
function ChannelsSection({ company, setCompany }: { company: SettingsData["company"]; setCompany: (c: SettingsData["company"]) => void }) {
  const t = useTranslations("settings");
  const saver = useSaver();
  const channels = company.settings.channels ?? { sms: true, email: true, telegram: false, hybridPost: false };
  const setChannels = (c: Channels) => setCompany({ ...company, settings: { ...company.settings, channels: c } });

  const templates: Templates = company.settings.templates ?? DEFAULT_TEMPLATES;
  const setTemplate = (kind: keyof Templates, v: LocalizedText) =>
    setCompany({ ...company, settings: { ...company.settings, templates: { ...templates, [kind]: v } } });

  const rows: { key: keyof Channels; label: string }[] = [
    { key: "sms", label: t("channels.sms") },
    { key: "email", label: t("channels.email") },
    { key: "telegram", label: t("channels.telegram") },
    { key: "hybridPost", label: t("channels.hybridPost") },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("channels.heading")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("channels.desc")}</p>
      </CardHeader>
      <CardContent>
        <Form
          pending={saver.pending}
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            saver.run(() => saveCompany(company));
          }}
        >
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {rows.map((row) => {
              const toggle = () => setChannels({ ...channels, [row.key]: !channels[row.key] });
              return (
                <div
                  key={row.key}
                  role="button"
                  tabIndex={0}
                  aria-pressed={channels[row.key]}
                  onClick={toggle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggle();
                    }
                  }}
                  className="flex cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                >
                  <span className="text-sm font-medium">{row.label}</span>
                  <span className="pointer-events-none">
                    <Switch checked={channels[row.key]} onCheckedChange={() => {}} tabIndex={-1} aria-hidden />
                  </span>
                </div>
              );
            })}
          </div>

          {/* Xabar shablonlari (rich, 3 til, o'zgaruvchilar + preview) */}
          <div className="pt-2">
            <h3 className="text-sm font-semibold">{t("channels.templatesHeading")}</h3>
            <p className="mb-3 text-sm text-muted-foreground">{t("channels.templatesDesc")}</p>
            <div className="space-y-4">
              <TemplateEditor
                title={t("channels.softTemplate")}
                value={templates.soft}
                onChange={(v) => setTemplate("soft", v)}
                onReset={() => setTemplate("soft", DEFAULT_TEMPLATES.soft)}
              />
              <TemplateEditor
                title={t("channels.firmTemplate")}
                value={templates.firm}
                onChange={(v) => setTemplate("firm", v)}
                onReset={() => setTemplate("firm", DEFAULT_TEMPLATES.firm)}
              />
            </div>
          </div>

          <SaveBar {...saver} label={t("save")} savingLabel={t("saving")} savedLabel={t("saved")} />
        </Form>
      </CardContent>
    </Card>
  );
}
