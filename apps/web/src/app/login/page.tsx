"use client";

import {
  Bank,
  Buildings,
  Car,
  CaretDown,
  ChartLineUp,
  ChartPieSlice,
  Scales,
  BellRinging,
  ArrowRight,
  ArrowUpRight,
  Eye,
  EyeSlash,
  FileText,
  GitFork,
  PlugsConnected,
  ShieldCheck,
  Storefront,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Unsplash — bepul litsenziya (unsplash.com/license), tijorat maqsadida foydalanish uchun ochiq. */
const PH = {
  desk: "https://images.unsplash.com/photo-1630561535290-24c621d6b463?w=1200&q=70&fm=jpg&fit=crop&auto=format",
  office: "https://images.unsplash.com/photo-1606836591695-4d58a73eba1e?w=1200&q=70&fm=jpg&fit=crop&auto=format",
  headset: "https://images.unsplash.com/photo-1553775282-20af80779df7?w=1200&q=70&fm=jpg&fit=crop&auto=format",
  handshake: "https://images.unsplash.com/photo-1672380135241-c024f7fbfa13?w=1200&q=70&fm=jpg&fit=crop&auto=format",
  team: "https://images.unsplash.com/photo-1568992688065-536aad8a12f6?w=1200&q=70&fm=jpg&fit=crop&auto=format",
  boardroom: "https://images.unsplash.com/photo-1758691736424-4b4273948341?w=1200&q=70&fm=jpg&fit=crop&auto=format",
};
/** Har bir soha uchun mos rasm — ICAN'dagi kabi tab bosilganda almashadigan, pastki qismi
 * yarim-oy (elliptik) shaklda kesilgan rasm. Tartib `industries.items`ga mos (index bo'yicha). */
const INDUSTRY_PHOTOS = [PH.boardroom, PH.office, PH.desk, PH.team, PH.handshake, PH.headset];

/** Tarjima kalitlaridagi sohalar/imkoniyatlar ro'yxatlari shu tartibda ikonkalarga bog'lanadi (index bo'yicha). */
const INDUSTRY_ICONS = [Bank, Buildings, Car, UsersThree, Storefront, Scales];
const FEATURE_ICONS = [ChartLineUp, BellRinging, FileText, GitFork, PlugsConnected, ChartPieSlice];

/** Faqat haqiqiy logotip fayli yuklangan hamkorlar — matnli o'rinbosar ishlatilmaydi. */
const LOGO_SUPPORTERS = [
  { t: "Adliya vazirligi", logo: "/brand/supporters/adliya-vazirligi.png", h: 50 },
  { t: "Yoshlar Ventures", logo: "/brand/supporters/yoshlar-ventures.png", h: 40 },
  { t: "Uzcombinator", logo: "/brand/supporters/uzcombinator.png", h: 24 },
  { t: "Didox", logo: "/brand/supporters/didox.png", h: 30 },
  { t: "Soliq xizmati", logo: "/brand/supporters/soliq-xizmati.png", h: 50 },
  { t: "Raqamli texnologiyalar vazirligi", logo: "/brand/supporters/raqamli-tex-vazirligi.png", h: 32 },
];

type NamedItem = { t: string; d: string };

export default function LoginPage() {
  const t = useTranslations("landing");
  const rootRef = useRef<HTMLDivElement>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const openLogin = () => {
    setMenuOpen(false);
    setLoginOpen(true);
  };

  const INDUSTRIES = (t.raw("industries.items") as NamedItem[]).map((it, i) => ({ ...it, Icon: INDUSTRY_ICONS[i] }));
  const FEATURES = (t.raw("features.items") as NamedItem[]).map((it, i) => ({ ...it, Icon: FEATURE_ICONS[i] }));
  const STATS = t.raw("stats.items") as { n: string; d: string }[];
  const FAQS = t.raw("faq.items") as { q: string; a: string }[];
  const SEGMENTS = t.raw("finalCta.segments") as string[];

  // One-ID xato bilan qaytsa — modal ochamiz.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("oneid_error")) setLoginOpen(true);
  }, []);

  // Reveal-on-scroll (bir tomonlama).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))),
      { threshold: 0.15 },
    );
    root.querySelectorAll("[data-rv]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const [faqOpen, setFaqOpen] = useState(0);
  const [activeIndustry, setActiveIndustry] = useState(0);

  return (
    <div ref={rootRef} className="lx-root">
      <style>{`
        .lx-root{--teal:#1CA9BB;--teal-dk:#178E9B;--ink:#0f1f38;--muted:rgba(15,31,56,.58);--line:rgba(15,31,56,.1);--bg:#ffffff;--soft:#f6f9fa;
          position:relative;min-height:100vh;background:var(--bg);color:var(--ink);overflow-x:clip}
        .lx-root .font-display{font-family:var(--font-space-grotesk),Arial,sans-serif;letter-spacing:-.01em;font-weight:700}
        .lx-wrap{position:relative;z-index:10;width:min(1180px,90%);margin-inline:auto}
        .lx-nav{position:sticky;inset-inline:0;top:0;z-index:50;background:rgba(255,255,255,.9);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
        .lx-nav-in{display:flex;align-items:center;justify-content:space-between;padding:16px 0;width:min(1180px,90%);margin-inline:auto}
        .lx-brand{display:flex;align-items:center;background:none;border:0;cursor:pointer;padding:0}
        .lx-links{display:flex;gap:30px}
        .lx-links a{color:var(--muted);text-decoration:none;font-size:14px;font-weight:600}
        .lx-links a:hover{color:var(--ink)}
        .lx-right{display:flex;align-items:center;gap:12px}
        .lx-enter{border:0;border-radius:999px;padding:10px 22px;font-size:13px;font-weight:700;color:#fff;cursor:pointer;background:var(--teal);transition:.2s}
        .lx-enter:hover{background:var(--teal-dk)}
        .lx-burger{display:none;width:40px;height:40px;border:1px solid var(--line);border-radius:999px;color:var(--ink);background:none;cursor:pointer}
        @media(max-width:860px){.lx-links{display:none}.lx-burger{display:grid;place-items:center}}
        .lx-mob{border-top:1px solid var(--line);background:var(--bg);padding:16px 5%;display:flex;flex-direction:column;gap:14px}
        .lx-mob a{color:var(--muted);text-decoration:none;font-size:14px;font-weight:600}
        .lx-btn{display:inline-flex;align-items:center;gap:9px;border-radius:999px;padding:15px 28px;font-size:14px;font-weight:700;cursor:pointer;text-decoration:none;border:1px solid transparent;transition:.2s;background:none}
        .lx-btn.solid{background:var(--teal);color:#fff}.lx-btn.solid:hover{background:var(--teal-dk)}
        .lx-btn.ghost{border-color:var(--line);color:var(--ink)}.lx-btn.ghost:hover{border-color:var(--ink)}
        .lx-hero{position:relative;padding:96px 0 0;text-align:center}
        .lx-kick{display:inline-flex;align-items:center;gap:10px;margin-bottom:18px;font-size:12px;font-weight:700;letter-spacing:.14em;color:var(--teal-dk);text-transform:uppercase}
        .lx-h1{font-size:clamp(2.1rem,5.6vw,4.2rem);line-height:1.1;max-width:820px;margin:0 auto;color:var(--ink)}
        .lx-h1 .u{color:var(--teal)}
        .lx-body{max-width:640px;margin:22px auto 0;color:var(--muted);font-size:17px;line-height:1.6}
        .lx-cta{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:30px}
        .lx-tabs{display:flex;gap:28px;border-bottom:1px solid var(--line);overflow-x:auto;white-space:nowrap;margin-top:56px}
        .lx-tabs::-webkit-scrollbar{display:none}
        .lx-tab{flex:0 0 auto;background:none;border:0;cursor:pointer;padding:14px 2px 15px;font-size:14px;font-weight:600;color:var(--muted);border-bottom:3px solid transparent;transition:.2s}
        .lx-tab.active{color:var(--ink);border-bottom-color:var(--teal)}
        .lx-tab.active,.lx-tab:hover{color:var(--ink)}
        .lx-tab-photo{border-radius:0 0 32% 32%;overflow:hidden;height:clamp(220px,40vw,440px);margin-top:0;background:var(--soft)}
        .lx-tab-photo img{display:block;width:100%;height:100%;object-fit:cover}
        .lx-tab-desc{text-align:center;color:var(--muted);font-size:15px;line-height:1.6;margin:26px auto 0;max-width:560px;padding-bottom:70px}
        .lx-strip{border-top:1px solid var(--line);margin-top:64px;padding:20px 0;overflow:hidden}
        .lx-strip-label{text-align:center;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:16px}
        .lx-strip-row{display:flex;align-items:center;justify-content:center;gap:44px;flex-wrap:wrap}
        .lx-strip-row img{display:block;filter:grayscale(1);opacity:.55}
        .lx-demo{max-width:560px;margin:36px auto 0;background:#0f1f38;border-radius:16px;overflow:hidden;text-align:left}
        .lx-demo-chrome{display:flex;align-items:center;gap:5px;padding:11px 13px;border-bottom:1px solid rgba(255,255,255,.08)}
        .lx-demo-chrome i{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.18)}
        .lx-demo-chrome span{margin-left:8px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.4)}
        .lx-demo-body{padding:20px;min-height:120px;display:flex;flex-direction:column;gap:10px}
        .lx-demo-msg{max-width:82%;padding:9px 13px;border-radius:11px;font-size:13.5px;line-height:1.45;white-space:pre-wrap;word-break:break-word}
        .lx-demo-msg.u{align-self:flex-end;background:var(--teal);color:#fff;border-bottom-right-radius:3px}
        .lx-demo-msg.a{align-self:flex-start;background:rgba(255,255,255,.08);color:rgba(255,255,255,.92);border-bottom-left-radius:3px}
        .lx-demo-caret{display:inline-block;width:2px;height:13px;background:currentColor;margin-left:2px;vertical-align:-2px;animation:lxCaret .8s step-end infinite}
        @keyframes lxCaret{50%{opacity:0}}
        .lx-sec{position:relative;padding:88px 0}
        .lx-sec.soft{background:var(--soft)}
        .lx-sec-head{text-align:center;max-width:640px;margin:0 auto 48px}
        .lx-sec-head h2{font-size:clamp(1.7rem,3.6vw,2.5rem);line-height:1.2;color:var(--ink);margin-top:8px}
        .lx-sec-head p{color:var(--muted);margin-top:12px;font-size:15px}
        .lx-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
        @media(max-width:900px){.lx-grid3{grid-template-columns:1fr 1fr}}
        @media(max-width:600px){.lx-grid3{grid-template-columns:1fr}}
        .lx-card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:26px}
        .lx-card .ic{width:44px;height:44px;border-radius:12px;background:rgba(28,169,187,.12);color:var(--teal-dk);display:grid;place-items:center;margin-bottom:16px}
        .lx-card h3{font-size:16px;font-weight:700;color:var(--ink);margin-bottom:8px}
        .lx-card p{font-size:14px;line-height:1.55;color:var(--muted)}
        .lx-stats{background:var(--ink);border-radius:28px;padding:64px 6%;text-align:center}
        .lx-stats h2{color:#fff;font-size:clamp(1.6rem,3.2vw,2.2rem)}
        .lx-stats-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:30px;margin-top:44px}
        @media(max-width:760px){.lx-stats-grid{grid-template-columns:1fr}}
        .lx-stat-n{font-size:clamp(2.2rem,4.5vw,3.4rem);color:var(--teal);font-weight:700}
        .lx-stat-d{color:rgba(255,255,255,.65);font-size:14px;margin-top:8px;max-width:220px;margin-inline:auto}
        .lx-faq{max-width:760px;margin:0 auto}
        .lx-faq-item{border-bottom:1px solid var(--line);padding:20px 0}
        .lx-faq-q{display:flex;align-items:center;justify-content:space-between;gap:16px;cursor:pointer;background:none;border:0;width:100%;text-align:left;font-size:16px;font-weight:600;color:var(--ink)}
        .lx-faq-q svg{flex:0 0 auto;transition:transform .2s;color:var(--teal-dk)}
        .lx-faq-item.open .lx-faq-q svg{transform:rotate(180deg)}
        .lx-faq-a{max-height:0;overflow:hidden;transition:max-height .25s ease}
        .lx-faq-item.open .lx-faq-a{max-height:200px}
        .lx-faq-a p{padding-top:12px;color:var(--muted);font-size:14.5px;line-height:1.6}
        .lx-final{border-radius:28px;background:linear-gradient(135deg,var(--teal),var(--teal-dk));padding:64px 6%;text-align:center;color:#fff}
        .lx-final h2{font-size:clamp(1.9rem,4.2vw,2.8rem);line-height:1.15;max-width:640px;margin:12px auto 14px}
        .lx-final p{opacity:.92;max-width:520px;margin:0 auto 30px;font-size:15px}
        .lx-seg{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-bottom:26px}
        .lx-seg span{border:1px solid rgba(255,255,255,.4);border-radius:999px;padding:8px 18px;font-size:13px;font-weight:600}
        .lx-final .lx-btn.solid{background:#fff;color:var(--teal-dk)}
        .lx-final .lx-btn.solid:hover{opacity:.92;background:#fff}
        .lx-foot{position:relative;border-top:1px solid var(--line);padding:64px 0 26px;margin-top:80px}
        .lx-footgrid{display:grid;grid-template-columns:1.5fr 1fr 1.1fr 1fr;gap:34px}
        .lx-foot h4{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--teal-dk);margin-bottom:16px}
        .lx-foot a{color:var(--muted);text-decoration:none;display:block;margin-bottom:9px;font-size:14px}
        .lx-foot a:hover{color:var(--ink)}
        .lx-foot .info{color:var(--muted);font-size:14px;line-height:1.55;margin-bottom:9px}
        .lx-foot .lead{color:var(--muted);font-size:14px;line-height:1.6;max-width:290px;margin:16px 0 22px}
        .lx-soc{display:flex;gap:10px}
        .lx-soc a{width:40px;height:40px;border:1px solid var(--line);border-radius:50%;display:grid;place-items:center;margin:0;color:var(--ink)}
        .lx-soc a:hover{border-color:var(--teal);background:rgba(28,169,187,.08);color:var(--teal-dk)}
        .lx-soc svg{width:18px;height:18px}
        .lx-footbar{margin-top:46px;padding-top:22px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;color:var(--muted);font-size:11px;letter-spacing:.08em;text-transform:uppercase}
        @media(max-width:860px){.lx-footgrid{grid-template-columns:1fr 1fr}}
        @media(max-width:520px){.lx-footgrid{grid-template-columns:1fr}}
        [data-rv]{opacity:0;transform:translateY(28px);transition:opacity .7s cubic-bezier(.16,.84,.24,1),transform .7s}
        [data-rv].in{opacity:1;transform:none}
        @media(prefers-reduced-motion:reduce){[data-rv]{opacity:1;transform:none}}
        .lx-in{animation:lxIn .3s ease}@keyframes lxIn{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}
      `}</style>

      {/* Navbar */}
      <header className="lx-nav">
        <div className="lx-nav-in">
          <button className="lx-brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <Image src="/brand/smartlex-logo-teal.png" alt="Smartlex" width={1942} height={617} className="h-7 w-auto object-contain" />
          </button>
          <nav className="lx-links">
            <a href="#jarayon">{t("nav.jarayon")}</a>
            <a href="#kim">{t("nav.kim")}</a>
            <a href="#nega">{t("nav.nega")}</a>
          </nav>
          <div className="lx-right">
            <div className="hidden sm:block"><LocaleSwitcher variant="ghost" /></div>
            <button className="lx-enter" onClick={openLogin}>{t("nav.kirish")}</button>
            <button className="lx-burger" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">{menuOpen ? <X className="size-5" /> : "≡"}</button>
          </div>
        </div>
        {menuOpen && (
          <div className="lx-mob">
            <a href="#jarayon" onClick={() => setMenuOpen(false)}>{t("nav.jarayon")}</a>
            <a href="#kim" onClick={() => setMenuOpen(false)}>{t("nav.kim")}</a>
            <a href="#nega" onClick={() => setMenuOpen(false)}>{t("nav.nega")}</a>
            <div><LocaleSwitcher variant="ghost" /></div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="lx-hero">
        <div className="lx-wrap">
          <div className="lx-kick">{t("hero.kicker")}</div>
          <h1 className="lx-h1 font-display">
            {t("hero.h1a")} <span className="u">{t("hero.h1b")}</span> {t("hero.h1c")}
          </h1>
          <p className="lx-body">{t("hero.body")}</p>
          <div className="lx-cta">
            <button className="lx-btn solid" onClick={openLogin}>{t("hero.ctaStart")} <ArrowUpRight weight="bold" className="size-4" /></button>
            <a className="lx-btn ghost" href="#jarayon">{t("hero.ctaHow")}</a>
          </div>

          <div className="lx-strip">
            <div className="lx-strip-label">{t("hero.supporters")}</div>
            <div className="lx-strip-row">
              {LOGO_SUPPORTERS.map((s) => (
                <img key={s.t} src={s.logo} alt={s.t} loading="lazy" style={{ height: s.h }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Mahsulot ko'rinishi — AI agent demo */}
      <section className="lx-sec" style={{ paddingTop: 24 }}>
        <div className="lx-wrap">
          <div data-rv style={{ textAlign: "center" }}>
            <h2 className="font-display" style={{ fontSize: "clamp(1.4rem,2.6vw,1.9rem)" }}>{t("banner.heading")}</h2>
            <AgentDemo demoName={t("banner.demoName")} script={[t("banner.demoUser"), t("banner.demoAi1"), t("banner.demoAi2")]} />
          </div>
        </div>
      </section>

      {/* Sohalar — ICAN'dagidek tab bosilganda almashadigan, pastki qismi yarim-oy shaklidagi rasm */}
      <section id="kim" className="lx-sec" style={{ paddingBottom: 0 }}>
        <div className="lx-wrap">
          <div className="lx-tabs">
            {INDUSTRIES.map((it, i) => (
              <button key={it.t} className={cn("lx-tab", activeIndustry === i && "active")} onClick={() => setActiveIndustry(i)}>
                {it.t}
              </button>
            ))}
          </div>
          <div data-rv className="lx-tab-photo">
            <img src={INDUSTRY_PHOTOS[activeIndustry]} alt={INDUSTRIES[activeIndustry]!.t} />
          </div>
          <p className="lx-tab-desc">{INDUSTRIES[activeIndustry]!.d}</p>
        </div>
      </section>

      {/* Imkoniyatlar */}
      <section id="jarayon" className="lx-sec">
        <div className="lx-wrap">
          <div data-rv className="lx-sec-head">
            <span className="lx-kick" style={{ marginBottom: 0 }}>{t("features.kicker")}</span>
            <h2 className="font-display">{t("features.heading")}</h2>
          </div>
          <div className="lx-grid3">
            {FEATURES.map((it) => (
              <div data-rv key={it.t} className="lx-card">
                <div className="ic"><it.Icon weight="bold" className="size-5" /></div>
                <h3>{it.t}</h3>
                <p>{it.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Raqamlarda */}
      <section className="lx-sec">
        <div className="lx-wrap">
          <div data-rv className="lx-stats">
            <span className="lx-kick" style={{ color: "var(--teal)", marginBottom: 0 }}>{t("stats.kicker")}</span>
            <h2 className="font-display">{t("stats.heading")}</h2>
            <div className="lx-stats-grid">
              {STATS.map((s) => (
                <div key={s.d}>
                  <div className="lx-stat-n font-display">{s.n}</div>
                  <div className="lx-stat-d">{s.d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="nega" className="lx-sec soft">
        <div className="lx-wrap">
          <div data-rv className="lx-sec-head">
            <span className="lx-kick" style={{ marginBottom: 0 }}>{t("faq.kicker")}</span>
            <h2 className="font-display">{t("faq.heading")}</h2>
          </div>
          <div data-rv className="lx-faq">
            {FAQS.map((f, i) => (
              <div key={f.q} className={cn("lx-faq-item", faqOpen === i && "open")}>
                <button className="lx-faq-q" onClick={() => setFaqOpen(faqOpen === i ? -1 : i)}>
                  {f.q}
                  <CaretDown weight="bold" className="size-4" />
                </button>
                <div className="lx-faq-a"><p>{f.a}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="lx-sec" style={{ paddingTop: 0 }}>
        <div className="lx-wrap">
          <div data-rv className="lx-final">
            <span className="lx-kick" style={{ color: "#fff", opacity: 0.85, marginBottom: 0 }}>{t("finalCta.kicker")}</span>
            <h2 className="font-display">{t("finalCta.heading")}</h2>
            <p>{t("finalCta.body")}</p>
            <div className="lx-seg">
              {SEGMENTS.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
            <button className="lx-btn solid" onClick={openLogin}>{t("finalCta.button")} <ArrowRight weight="bold" className="size-4" /></button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="lx-foot">
        <div className="lx-wrap">
          <div className="lx-footgrid">
            <div>
              <Image src="/brand/smartlex-logo-teal.png" alt="Smartlex" width={1942} height={617} className="h-7 w-auto object-contain" />
              <p className="lead">{t("footer.lead")}</p>
              <div className="lx-soc">
                <a href="https://instagram.com/smartlex.uz" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>
                </a>
                <a href="https://t.me/smartlex_uz" target="_blank" rel="noopener noreferrer" aria-label="Telegram">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3 2.7 11.7c-.9.36-.9 1.62.03 1.94l4.9 1.53 1.86 5.6c.24.72 1.15.94 1.68.4l2.53-2.63 4.77 3.5c.6.44 1.46.1 1.6-.64l3.02-14.4c.2-.9-.68-1.6-1.4-1.2zM9.9 14.7l-.35 3.5-1.2-3.8 9.1-5.9-7.55 6.2z" /></svg>
                </a>
                <a href="https://facebook.com/smartlex.uz" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5H17V3.6c-.3-.04-1.3-.13-2.47-.13-2.45 0-4.13 1.5-4.13 4.25V9.9H7.7V13h2.7v8z" /></svg>
                </a>
              </div>
            </div>
            <div>
              <h4>{t("footer.contact")}</h4>
              <a href="mailto:smartlex.uzbekistan@gmail.com">smartlex.uzbekistan@gmail.com</a>
              <a href="tel:+998977247999">+998 97 724 79 99</a>
              <a href="https://t.me/smartlex_uz" target="_blank" rel="noopener noreferrer">Telegram: @smartlex_uz</a>
            </div>
            <div>
              <h4>{t("footer.address")}</h4>
              <div className="info">{t("footer.addressLine1")}<br />{t("footer.addressLine2")}</div>
              <h4 style={{ marginTop: 22 }}>{t("footer.org")}</h4>
              <div className="info">{t("footer.orgName")}</div>
              <div className="info">{t("footer.orgTin")}</div>
            </div>
            <div>
              <h4>{t("footer.pages")}</h4>
              <a href="#jarayon">{t("nav.jarayon")}</a>
              <a href="#kim">{t("nav.kim")}</a>
              <a href="#nega">{t("nav.nega")}</a>
              <button className="lx-enter" style={{ padding: 0, background: "none", color: "var(--muted)", fontSize: 14, fontWeight: 400 }} onClick={openLogin}>{t("nav.kirish")}</button>
            </div>
          </div>
          <div className="lx-footbar">
            <div>{t("footer.copyright")}</div>
            <div>{t("footer.badge")}</div>
          </div>
        </div>
      </footer>

      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
    </div>
  );
}

/** Haqiqiy AI agent suhbatiga o'xshab "yozib" ko'rsatadigan, sikllanuvchi animatsiya — video o'rnini bosadi.
 * `script[0]` — foydalanuvchi xabari, qolganlari — AI javoblari (tilga qarab tarjima qilinadi). */
function AgentDemo({ demoName, script }: { demoName: string; script: string[] }) {
  const lines = script.map((text, i) => ({ who: i === 0 ? ("user" as const) : ("ai" as const), text }));
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);

  useEffect(() => {
    setLineIdx(0);
    setCharIdx(0);
  }, [script.join("|")]);

  useEffect(() => {
    const line = lines[lineIdx]?.text ?? "";
    if (charIdx < line.length) {
      const t = setTimeout(() => setCharIdx((c) => c + 1), 28);
      return () => clearTimeout(t);
    }
    const pause = lineIdx === lines.length - 1 ? 2600 : 700;
    const t = setTimeout(() => {
      if (lineIdx === lines.length - 1) {
        setLineIdx(0);
        setCharIdx(0);
      } else {
        setLineIdx((i) => i + 1);
        setCharIdx(0);
      }
    }, pause);
    return () => clearTimeout(t);
  }, [lineIdx, charIdx, lines]);

  return (
    <div className="lx-demo">
      <div className="lx-demo-chrome"><i /><i /><i /><span>{demoName}</span></div>
      <div className="lx-demo-body">
        {lines.slice(0, lineIdx + 1).map((m, i) => {
          const isCurrent = i === lineIdx;
          const shown = isCurrent ? m.text.slice(0, charIdx) : m.text;
          return (
            <div key={i} className={cn("lx-demo-msg", m.who === "user" ? "u" : "a")}>
              {shown}
              {isCurrent && charIdx < m.text.length && <span className="lx-demo-caret" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Login — faqat "Kirish" bosilganda ochiladigan modal. */
function LoginModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("login");
  const router = useRouter();
  const oneidError = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("oneid_error") : null;
  const KNOWN_ONEID_ERR = new Set(["not_configured", "invalid_state", "not_valid", "no_pin", "no_legal_entity", "tenant_not_registered", "user_not_found", "exchange_failed", "require_eri", "not_verified"]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(oneidError ? t(`oneid.err.${KNOWN_ONEID_ERR.has(oneidError) ? oneidError : "generic"}`) : null);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [showOferta, setShowOferta] = useState(false);
  // Parol-kirish: ?staff=1, localhost, yoki One-ID sozlanmagan bo'lsa.
  const [staffMode, setStaffMode] = useState(false);
  const [isLocalDev, setIsLocalDev] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const host = window.location.hostname;
    const localDev = host === "localhost" || host === "127.0.0.1";
    const oneIdBroken = params.has("oneid_error");
    setIsLocalDev(localDev);
    setStaffMode(params.has("staff") || localDev || oneIdBroken);
  }, []);

  function validate(): boolean {
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) next.email = t("emailRequired");
    else if (!EMAIL_RE.test(email)) next.email = t("emailInvalid");
    if (!password) next.password = t("passwordRequired");
    else if (password.length < 6) next.password = t("passwordShort");
    setErrors(next);
    return Object.keys(next).length === 0;
  }
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!agreed) {
      setError("Iltimos, ommaviy oferta shartlariga rozilik bering.");
      return;
    }
    if (!validate()) return;
    setLoading(true);
    const res = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await res.json();
    if (data.success) {
      router.push("/agent");
      router.refresh();
    } else {
      setError(data.message ?? t("error"));
      setLoading(false);
    }
  }

  const field =
    "w-full rounded-xl border border-black/10 bg-black/[0.02] px-4 py-3 text-[15px] text-[#0b1220] outline-none transition-colors placeholder:text-black/30 focus:border-[#0a56fe]/50 focus:bg-white";

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="lx-in w-full max-w-[420px] rounded-3xl border border-black/10 bg-white p-7 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <Image src="/brand/smartlex-logo-teal.png" alt="Smartlex" width={1942} height={617} className="h-7 w-auto object-contain" />
          </div>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-black/40 hover:bg-black/5 hover:text-black"><X className="size-4" /></button>
        </div>
        <p className="-mt-4 mb-6 text-sm text-black/50">{t("subtitle")}</p>

        {/* Email/parol — localhost va xodim rejimida */}
        {staffMode && (
          <form onSubmit={onSubmit} noValidate className="mb-5 space-y-4 rounded-2xl border border-black/10 bg-black/[0.015] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-black/40">
              {isLocalDev ? "Lokal dev kirish (demo)" : "Xodim kirishi"}
            </p>
            {isLocalDev && (
              <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-700">
                Demo: <strong>rahbar@alfatrade.uz</strong> / <strong>Parol123!</strong>
              </p>
            )}
            <div className="space-y-1.5">
              <label htmlFor="lm-email" className="text-xs font-semibold uppercase tracking-widest text-black/55">{t("email")}</label>
              <input id="lm-email" type="email" autoComplete="email" placeholder={t("emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => errors.email && validate()} className={cn(field, errors.email && "border-red-500/70")} />
              {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="lm-pw" className="text-xs font-semibold uppercase tracking-widest text-black/55">{t("password")}</label>
              <div className="relative">
                <input id="lm-pw" type={show ? "text" : "password"} autoComplete="current-password" placeholder={t("passwordPlaceholder")} value={password} onChange={(e) => setPassword(e.target.value)} onBlur={() => errors.password && validate()} className={cn(field, "pr-12", errors.password && "border-red-500/70")} />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-black/40 hover:text-black" title={show ? t("hidePassword") : t("showPassword")}>
                  {show ? <EyeSlash className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-600">{errors.password}</p>}
            </div>
            <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0a56fe] px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60">
              {loading ? t("signingIn") : t("submit")}
              {!loading && <ArrowRight weight="bold" className="size-4" />}
            </button>
          </form>
        )}

        {/* Oferta rozilik (One-ID uchun) */}
        <div className="mb-4 flex items-start gap-2.5 text-xs leading-relaxed text-black/55">
          <input id="agree-oferta" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[#0a56fe]" />
          <span>
            <button type="button" onClick={() => setShowOferta(true)} className="text-black/80 underline hover:text-black">Ommaviy oferta</button>{" "}
            <label htmlFor="agree-oferta" className="cursor-pointer">shartlari bilan tanishdim va roziman</label>
          </span>
        </div>

        {error && <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-700">{error}</div>}

        {/* One-ID — production; lokalda sozlanmagan bo'lsa email/parol ishlating */}
        {!isLocalDev && (
        <a href="/api/oneid" onClick={(e) => { if (!agreed) { e.preventDefault(); setError("Iltimos, ommaviy oferta shartlariga rozilik bering."); } }} className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#0a56fe] px-4 py-4 text-sm font-bold text-white transition-transform hover:scale-[1.02]">
          <ShieldCheck weight="fill" className="size-5" />
          {t("oneid.button")}
        </a>
        )}
        {!isLocalDev && <p className="mt-3 text-center text-[11px] leading-relaxed text-black/40">{t("oneid.hint")}</p>}
        {isLocalDev && (
          <p className="mt-2 text-center text-[11px] leading-relaxed text-black/40">
            One-ID lokalda ishlamaydi — yuqoridagi email va parol bilan kiring.
          </p>
        )}
      </div>

      {/* Ommaviy oferta — sahifani tark etmasdan, ichki modal (login/parol saqlanadi) */}
      {showOferta && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 sm:p-6" onClick={() => setShowOferta(false)}>
          <div className="relative flex h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-3">
              <span className="text-sm font-bold text-black">Ommaviy oferta</span>
              <button type="button" onClick={() => setShowOferta(false)} aria-label="Yopish" className="grid size-9 place-items-center rounded-lg text-lg text-black/50 transition-colors hover:bg-black/5 hover:text-black">✕</button>
            </div>
            <iframe src="/oferta" title="Ommaviy oferta" className="min-h-0 w-full flex-1 border-0 bg-white" />
            <div className="border-t border-black/10 px-5 py-3">
              <button type="button" onClick={() => { setAgreed(true); setShowOferta(false); }} className="inline-flex w-full items-center justify-center rounded-xl bg-[#0a56fe] px-4 py-3 text-sm font-bold text-white transition-transform hover:scale-[1.01]">
                Roziman va yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
