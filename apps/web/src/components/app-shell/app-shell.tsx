"use client";

import {
  Bell,
  CreditCard,
  Files,
  Gavel,
  GearSix,
  type Icon,
  NotePencil,
  PaperPlaneTilt,
  Robot,
  SealCheck,
  ShieldStar,
  SignOut,
  Sparkle,
  Truck,
  Wallet,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AgentPanel } from "@/components/agent-panel/agent-panel";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { cn } from "@/lib/utils";

// AI-birinchi, sodda tartib (7 menyu). Agent — markaziy sirt (chat + tasks + undiruv
// mantig'i shu yerda). CRM/analitika ekranlari navigatsiyadan olib tashlandi (route'lar
// saqlanadi — kerak bo'lsa qaytariladi). Undiruvning huquqiy bosqichlari (Sud/Ijro) ko'rinadi.
const GROUPS: { label: string; items: { href: string; key: string; icon: Icon; badge?: boolean }[] }[] = [
  {
    label: "groupMain",
    items: [
      { href: "/agent", key: "agent", icon: Robot },
      { href: "/studio", key: "studio", icon: NotePencil },
      { href: "/documents", key: "documents", icon: Files },
      { href: "/approvals", key: "approvals", icon: SealCheck, badge: true },
    ],
  },
  {
    label: "groupWork",
    items: [
      { href: "/receivables", key: "receivables", icon: Wallet },
      { href: "/reminders", key: "reminders", icon: PaperPlaneTilt },
      { href: "/court", key: "court", icon: Gavel },
      { href: "/enforcement", key: "enforcement", icon: Truck },
    ],
  },
  {
    label: "groupSystem",
    items: [
      { href: "/billing", key: "billing", icon: CreditCard },
      { href: "/settings", key: "settings", icon: GearSix },
    ],
  },
];

const ALL_ITEMS = GROUPS.flatMap((g) => g.items);

interface Props {
  user: { fullName: string; role: string };
  tenant: { name: string; type: string };
  pendingApprovals: number;
  isPlatformAdmin?: boolean;
  children: React.ReactNode;
}

export function AppShell({ user, tenant, pendingApprovals, isPlatformAdmin, children }: Props) {
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  const tAgent = useTranslations("agent");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const activeItem = ALL_ITEMS.find((i) => isActive(i.href)) ?? ALL_ITEMS[0]!;
  const ActiveIcon = activeItem.icon;

  async function logout() {
    await fetch("/api/session", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div
      className="grid h-screen grid-cols-[248px_1fr] overflow-hidden bg-background"
      style={{ "--font-display": "var(--font-inter), ui-sans-serif, system-ui, sans-serif" } as React.CSSProperties}
    >
      {/* ── Sidebar — yumshoq "command rail" ───────────────────── */}
      <aside
        className="relative flex h-screen flex-col overflow-hidden text-white"
        style={{ background: "linear-gradient(178deg, #282a31 0%, #202228 55%, #191b20 100%)" }}
      >
        {/* Ambient glow — yumshoq, neytral */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-70"
          style={{ background: "radial-gradient(120% 80% at 25% 0%, rgba(255,255,255,0.06), transparent 72%)" }}
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-white/12 via-white/6 to-transparent" />

        {/* Logo */}
        <div className="relative flex items-center gap-2.5 px-5 pb-4 pt-5">
          <div className="grid size-9 place-items-center rounded-xl bg-white text-zinc-900 shadow-lg ring-1 ring-white/20">
            <Sparkle weight="fill" className="size-[18px]" />
          </div>
          <div className="leading-tight">
            <span className="block font-display text-[15px] font-semibold tracking-tight">{tApp("name")}</span>
            <span className="block text-[10px] uppercase tracking-[0.14em] text-white/35">{tenant.type}</span>
          </div>
        </div>

        {/* Agent status */}
        <div className="relative mx-3.5 mb-4 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur">
          <div
            className="pointer-events-none absolute -right-6 -top-6 size-20 rounded-full opacity-40"
            style={{ background: "radial-gradient(circle, rgba(34,197,94,0.35), transparent 70%)" }}
          />
          <div className="relative flex items-center gap-1.5">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-70" />
              <span className="relative inline-flex size-1.5 rounded-full bg-success" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-success">{tAgent("active")}</span>
          </div>
          <p className="relative mt-1.5 truncate font-display text-sm font-semibold text-white">{tenant.name}</p>
          <p className="relative mt-0.5 text-[11px] text-white/45">{tAgent("monitoring")}</p>
        </div>

        {/* Nav */}
        <nav className="relative flex-1 space-y-5 overflow-y-auto px-3 pb-3">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                {t(group.label)}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  const ItemIcon = item.icon;
                  const showBadge = item.badge && pendingApprovals > 0;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg py-2 pl-2.5 pr-2.5 text-[13px] font-medium transition-all",
                        active ? "bg-white/[0.10] text-white" : "text-white/60 hover:bg-white/[0.05] hover:text-white/90",
                      )}
                    >
                      {active && (
                        <span
                          className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-white"
                          style={{ boxShadow: "0 0 10px 0 rgba(255,255,255,0.4)" }}
                        />
                      )}
                      <span
                        className={cn(
                          "grid size-7 shrink-0 place-items-center rounded-lg transition-all",
                          active
                            ? "bg-white text-zinc-900 shadow-sm"
                            : "bg-white/[0.06] text-white/60 group-hover:text-white",
                        )}
                      >
                        <ItemIcon weight={active ? "fill" : "regular"} className="size-[16px]" />
                      </span>
                      <span className="flex-1">{t(item.key)}</span>
                      {showBadge && (
                        <span className="grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white shadow-sm shadow-danger/40">
                          {pendingApprovals}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Platforma admin — faqat platforma egasiga ko'rinadi (mijozlarga emas) */}
          {isPlatformAdmin && (
            <div>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">Platforma</p>
              <Link
                href="/admin"
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg py-2 pl-2.5 pr-2.5 text-[13px] font-medium transition-all",
                  isActive("/admin") ? "bg-white/[0.10] text-white" : "text-white/60 hover:bg-white/[0.05] hover:text-white/90",
                )}
              >
                {isActive("/admin") && (
                  <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-white" style={{ boxShadow: "0 0 10px 0 rgba(255,255,255,0.4)" }} />
                )}
                <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg transition-all", isActive("/admin") ? "bg-white text-zinc-900 shadow-sm" : "bg-white/[0.06] text-white/60 group-hover:text-white")}>
                  <ShieldStar weight={isActive("/admin") ? "fill" : "regular"} className="size-[16px]" />
                </span>
                <span className="flex-1">Boshqaruv</span>
              </Link>
            </div>
          )}
        </nav>

        {/* User footer */}
        <div className="relative border-t border-white/10 p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.10] font-display text-xs font-semibold text-white ring-1 ring-white/20">
              {user.fullName.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-white/90">{user.fullName}</p>
              <p className="truncate text-[11px] capitalize text-white/40">{user.role}</p>
            </div>
            <button
              onClick={logout}
              className="grid size-8 place-items-center rounded-lg text-white/50 transition-colors hover:bg-danger/20 hover:text-danger"
              title={tCommon("logout")}
            >
              <SignOut className="size-[18px]" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ───────────────────────────────────────────── */}
      <div className="relative flex min-h-0 min-w-0 flex-col bg-gradient-to-b from-primary-soft/25 via-background to-background">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-card/85 px-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary ring-1 ring-primary/10">
              <ActiveIcon weight="fill" className="size-[18px]" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-display text-[16px] font-semibold leading-tight tracking-tight">{t(activeItem.key)}</h1>
              <p className="truncate text-[11px] text-muted-foreground">{tenant.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/approvals"
              className="relative grid size-9 place-items-center rounded-lg border border-border bg-background/80 text-muted-foreground transition-colors hover:border-muted-foreground/30 hover:text-foreground"
              title={t("approvals")}
            >
              <Bell weight={pendingApprovals > 0 ? "fill" : "regular"} className="size-[18px]" />
              {pendingApprovals > 0 && (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white ring-2 ring-card">
                  {pendingApprovals}
                </span>
              )}
            </Link>

            <div className="h-6 w-px bg-border" />
            <LocaleSwitcher />
          </div>
        </header>
        <main className="scroll-clean min-h-0 min-w-0 flex-1 overflow-y-auto px-6 pb-2 pt-6">{children}</main>
      </div>

      {/* Doimiy AI Agent paneli — o'ngdagi dumaloq tugma + o'ng sheet + notification */}
      <AgentPanel initialFeed={[]} initialApprovals={[]} />
    </div>
  );
}
