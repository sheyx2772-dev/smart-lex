"use client";

import {
  Bell,
  Briefcase,
  ChartBar,
  ClockCounterClockwise,
  CreditCard,
  Files,
  Gavel,
  GearSix,
  HandCoins,
  type Icon,
  NotePencil,
  PaperPlaneTilt,
  Robot,
  ScrollIcon,
  SealCheck,
  ShieldStar,
  SignOut,
  Truck,
  Wallet,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AgentPanel } from "@/components/agent-panel/agent-panel";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { cn } from "@/lib/utils";

// AI-birinchi, sodda tartib. Agent — markaziy sirt (chat + tasks + undiruv
// mantig'i shu yerda). CRM/analitika ekranlari va Boshqaruv markazi navigatsiyadan olib
// tashlandi (route'lar saqlanadi — kerak bo'lsa qaytariladi): Boshqaruv markazining
// portfel/prioritet bo'limi Debitorlikka, AI tasdiq so'rovlari esa Tasdiqlarga ko'chirildi.
//
// Ish rejimi (workMode): "debt" — undiruv-markazlashgan mijozlar (asosiy mahsulot).
// "legal" — yuridik firmalar uchun umumiy ish yuritish (bank/davlat mijozlarining
// so'rovi bilan qo'shildi) — bir xil yadro, faqat navigatsiya boshqacha guruhlangan.
type WorkMode = "debt" | "legal";
interface NavItem {
  href: string;
  key: string;
  icon: Icon;
  badge?: boolean;
  /** "/legal/matters" kabi bir xil yo'lni turli `?filter=` qiymatlari bilan ajratish uchun
   * (pathname o'zi query'ni ko'rmaydi — shuning uchun faollikni aniqlashda alohida solishtiriladi). */
  matterFilter?: string;
}
const DEBT_GROUPS: { label: string; items: NavItem[] }[] = [
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
      { href: "/payables", key: "payables", icon: HandCoins },
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
const LEGAL_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "legalGroupAi",
    items: [
      { href: "/legal", key: "legalAgent", icon: Robot },
      { href: "/legal/matters", key: "allMatters", icon: Briefcase },
    ],
  },
  {
    label: "legalGroupWork",
    items: [
      { href: "/documents", key: "documents", icon: Files },
      { href: "/contracts", key: "contracts", icon: ScrollIcon },
      { href: "/court", key: "courtDisputes", icon: Gavel },
      { href: "/approvals", key: "approvals", icon: SealCheck, badge: true },
    ],
  },
  {
    label: "legalGroupControl",
    items: [
      { href: "/reports", key: "reports", icon: ChartBar },
      { href: "/audit", key: "audit", icon: ClockCounterClockwise },
    ],
  },
  {
    label: "legalGroupSystem",
    items: [
      { href: "/billing", key: "billing", icon: CreditCard },
      { href: "/settings", key: "settings", icon: GearSix },
    ],
  },
];

interface Props {
  user: { fullName: string; role: string };
  tenant: { name: string; type: string };
  pendingApprovals: number;
  isPlatformAdmin?: boolean;
  workMode?: WorkMode;
  children: React.ReactNode;
}

export function AppShell({ user, tenant, pendingApprovals, isPlatformAdmin, workMode = "debt", children }: Props) {
  const t = useTranslations("nav");
  const tAgent = useTranslations("agent");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const GROUPS = workMode === "legal" ? LEGAL_GROUPS : DEBT_GROUPS;
  const ALL_ITEMS = GROUPS.flatMap((g) => g.items);

  // "/legal" alohida ekzakt taqqoslanadi — aks holda "/legal/agent" ham unga mos kelib ketardi.
  const isActive = (href: string) => (href === "/" || href === "/legal" ? pathname === href : pathname.startsWith(href));
  // "/legal/matters" bir nechta nav bandida turli `?filter=` bilan ishlatiladi — pathname
  // query'ni ko'rmaydi, shuning uchun bunday bandlar uchun filtr qiymati ham solishtiriladi.
  function isNavItemActive(item: NavItem): boolean {
    if (item.matterFilter !== undefined) return pathname === item.href && (searchParams.get("filter") ?? "") === item.matterFilter;
    return isActive(item.href);
  }
  function itemHref(item: NavItem): string {
    return item.matterFilter ? `${item.href}?filter=${item.matterFilter}` : item.href;
  }
  const activeItem = ALL_ITEMS.find((i) => isNavItemActive(i)) ?? ALL_ITEMS[0]!;
  const ActiveIcon = activeItem.icon;

  async function logout() {
    await fetch("/api/session", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  const isLegal = workMode === "legal";
  // Sidebar "ink" — Debitorlik: oq matn qorong'i fonda. Yuridik: to'q ko'k matn
  // och oq/ko'k fonda ("ochroq oq va ko'k" — talab qilingan yorug' identifikatsiya).
  // Bitta RGB triplet o'zgaruvchisi orqali butun sidebar rangi bir joydan boshqariladi.
  const ink = isLegal ? "11 40 74" : "255 255 255";
  const sbStyle = { "--sb-ink": ink } as React.CSSProperties;
  const inkC = (opacity: number) => `text-[rgb(var(--sb-ink)/${opacity}%)]`;
  const surfC = (opacity: number) => `bg-[rgb(var(--sb-ink)/${opacity}%)]`;
  const borderC = (opacity: number) => `border-[rgb(var(--sb-ink)/${opacity}%)]`;

  return (
    <div
      data-work-mode={workMode}
      className="grid h-screen grid-cols-[248px_1fr] overflow-hidden bg-background"
      style={{ "--font-display": "var(--font-inter), ui-sans-serif, system-ui, sans-serif" } as React.CSSProperties}
    >
      {/* ── Sidebar — yumshoq "command rail" ───────────────────── */}
      <aside
        className={cn("relative flex h-screen flex-col overflow-hidden", `text-[rgb(var(--sb-ink))]`)}
        style={{
          ...sbStyle,
          background: isLegal
            ? "linear-gradient(178deg, #ffffff 0%, #f2f7fd 55%, #e7f0fb 100%)"
            : "linear-gradient(178deg, #282a31 0%, #202228 55%, #191b20 100%)",
        }}
      >
        {/* Ambient glow — rejimga qarab: Debitorlik=binafsha/pushti, Yuridik=ko'k/azure — sekin nafas oladi */}
        <div
          className="ai-breathe pointer-events-none absolute inset-x-0 top-0 h-72 opacity-80"
          style={{
            background: isLegal
              ? "radial-gradient(120% 80% at 15% 0%, rgba(61,90,254,0.16), rgba(47,95,224,0.08) 45%, transparent 72%)"
              : "radial-gradient(120% 80% at 15% 0%, rgba(139,92,246,0.16), rgba(236,72,153,0.08) 45%, transparent 72%)",
          }}
        />
        <div className={cn("pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b to-transparent", isLegal ? "from-[rgb(var(--sb-ink)/16%)] via-[rgb(var(--sb-ink)/8%)]" : "from-white/12 via-white/6")} />

        {/* Logo */}
        <div className="relative flex items-center gap-2.5 px-5 pb-4 pt-5">
          <div className={cn("flex h-11 items-center rounded-xl px-2.5 shadow-lg ring-1", isLegal ? "bg-white ring-primary/20" : "bg-white ring-white/20")}>
            <Image src="/brand/lex-ai-logo-full.png" alt="Lex.AI" width={1049} height={426} className="h-6 w-auto object-contain" />
          </div>
          <div className="leading-tight">
            <span className={cn("block text-[10px] uppercase tracking-[0.14em]", inkC(45))}>{tenant.type}</span>
          </div>
        </div>

        {/* Ish rejimi almashtirgichi olib tashlandi — Yuridik bo'lim vaqtincha yopiq
            (Oliy sud integratsiyasi kechiktirildi). Faqat Debitorlik rejimi ishlaydi. */}

        {/* Agent status */}
        <div className={cn("relative mx-3.5 mb-4 overflow-hidden rounded-xl border p-3 backdrop-blur", borderC(10), surfC(isLegal ? 3 : 4))}>
          <div
            className="pointer-events-none absolute -left-8 -bottom-8 size-24 rounded-full opacity-50"
            style={{ background: isLegal ? "radial-gradient(circle, rgba(61,90,254,0.25), transparent 70%)" : "radial-gradient(circle, rgba(139,92,246,0.3), transparent 70%)" }}
          />
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
          <p className="relative mt-1.5 truncate font-display text-sm font-semibold">{tenant.name}</p>
          <p className={cn("relative mt-0.5 text-[11px]", inkC(55))}>{tAgent("monitoring")}</p>
        </div>

        {/* Nav */}
        <nav className="relative flex-1 space-y-5 overflow-y-auto px-3 pb-3">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <p className={cn("mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em]", inkC(40))}>
                {t(group.label)}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isNavItemActive(item);
                  const ItemIcon = item.icon;
                  const showBadge = item.badge && pendingApprovals > 0;
                  return (
                    <Link
                      key={item.key}
                      href={itemHref(item)}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg py-2 pl-2.5 pr-2.5 text-[13px] font-medium transition-all",
                        active ? surfC(isLegal ? 6 : 10) : cn(inkC(65), "hover:opacity-90"),
                      )}
                    >
                      {active && <span className={cn("absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary")} />}
                      <span
                        className={cn(
                          "grid size-7 shrink-0 place-items-center rounded-lg transition-all",
                          active ? "bg-primary text-primary-foreground shadow-sm" : cn(surfC(isLegal ? 5 : 6), inkC(65), "group-hover:opacity-100"),
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
              <p className={cn("mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em]", inkC(40))}>Platforma</p>
              <div className="space-y-0.5">
                <Link
                  href="/admin/financing"
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg py-2 pl-2.5 pr-2.5 text-[13px] font-medium transition-all",
                    isActive("/admin/financing") ? surfC(isLegal ? 6 : 10) : cn(inkC(65), "hover:opacity-90"),
                  )}
                >
                  {isActive("/admin/financing") && <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />}
                  <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg transition-all", isActive("/admin/financing") ? "bg-primary text-primary-foreground shadow-sm" : cn(surfC(isLegal ? 5 : 6), inkC(65)))}>
                    <HandCoins weight={isActive("/admin/financing") ? "fill" : "regular"} className="size-[16px]" />
                  </span>
                  <span className="flex-1">Factoring (B2B)</span>
                </Link>
                <Link
                  href="/admin"
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg py-2 pl-2.5 pr-2.5 text-[13px] font-medium transition-all",
                    pathname === "/admin" ? surfC(isLegal ? 6 : 10) : cn(inkC(65), "hover:opacity-90"),
                  )}
                >
                  {pathname === "/admin" && <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />}
                  <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg transition-all", pathname === "/admin" ? "bg-primary text-primary-foreground shadow-sm" : cn(surfC(isLegal ? 5 : 6), inkC(65)))}>
                    <ShieldStar weight={pathname === "/admin" ? "fill" : "regular"} className="size-[16px]" />
                  </span>
                  <span className="flex-1">Boshqaruv</span>
                </Link>
              </div>
            </div>
          )}
        </nav>

        {/* User footer */}
        <div className={cn("relative border-t p-3", borderC(10))}>
          <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1">
            <div className={cn("grid size-9 shrink-0 place-items-center rounded-full font-display text-xs font-semibold ring-1", surfC(isLegal ? 6 : 10), borderC(20))}>
              {user.fullName.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-[13px] font-medium", inkC(90))}>{user.fullName}</p>
              <p className={cn("truncate text-[11px] capitalize", inkC(45))}>{user.role}</p>
            </div>
            <button
              onClick={logout}
              className={cn("grid size-8 place-items-center rounded-lg transition-colors hover:bg-danger/20 hover:text-danger", inkC(55))}
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
