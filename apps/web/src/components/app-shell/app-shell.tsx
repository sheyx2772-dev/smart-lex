"use client";

import {
  Bell,
  Buildings,
  ChatCircleDots,
  FileText,
  Gavel,
  GearSix,
  type Icon,
  PaperPlaneTilt,
  Pulse,
  SealCheck,
  SignOut,
  Sparkle,
  SquaresFour,
  Timer,
  Wallet,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { cn } from "@/lib/utils";

const GROUPS: { label: string; items: { href: string; key: string; icon: Icon; badge?: boolean }[] }[] = [
  {
    label: "groupMain",
    items: [
      { href: "/", key: "dashboard", icon: SquaresFour },
      { href: "/chat", key: "chat", icon: ChatCircleDots },
      { href: "/companies", key: "companies", icon: Buildings },
      { href: "/receivables", key: "receivables", icon: Wallet },
      { href: "/overdue", key: "overdue", icon: Timer },
      { href: "/approvals", key: "approvals", icon: SealCheck, badge: true },
      { href: "/court", key: "court", icon: Gavel },
    ],
  },
  {
    label: "groupSystem",
    items: [
      { href: "/documents", key: "documents", icon: FileText },
      { href: "/reminders", key: "reminders", icon: PaperPlaneTilt },
      { href: "/audit", key: "audit", icon: Pulse },
      { href: "/settings", key: "settings", icon: GearSix },
    ],
  },
];

const ALL_ITEMS = GROUPS.flatMap((g) => g.items);

interface Props {
  user: { fullName: string; role: string };
  tenant: { name: string; type: string };
  pendingApprovals: number;
  children: React.ReactNode;
}

export function AppShell({ user, tenant, pendingApprovals, children }: Props) {
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
    <div className="grid h-screen grid-cols-[248px_1fr] overflow-hidden bg-background">
      {/* ── Sidebar — yumshoq "command rail" ───────────────────── */}
      <aside
        className="relative flex h-screen flex-col overflow-hidden text-white"
        style={{ background: "linear-gradient(178deg, #232a44 0%, #1b2136 55%, #171c2e 100%)" }}
      >
        {/* Ambient glow — yumshoq */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-60"
          style={{ background: "radial-gradient(120% 80% at 25% 0%, rgba(99,102,241,0.20), transparent 72%)" }}
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-white/12 via-white/6 to-transparent" />

        {/* Logo */}
        <div className="relative flex items-center gap-2.5 px-5 pb-4 pt-5">
          <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-lg shadow-primary/30 ring-1 ring-white/10">
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
                          className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary"
                          style={{ boxShadow: "0 0 10px 0 rgba(99,102,241,0.5)" }}
                        />
                      )}
                      <span
                        className={cn(
                          "grid size-7 shrink-0 place-items-center rounded-lg transition-all",
                          active
                            ? "bg-gradient-to-br from-primary to-secondary text-white shadow-md shadow-primary/40"
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
        </nav>

        {/* User footer */}
        <div className="relative border-t border-white/10 p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-secondary to-primary font-display text-xs font-semibold text-white ring-1 ring-white/15">
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
      <div className="flex min-h-0 min-w-0 flex-col">
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
    </div>
  );
}
