"use client";

import { ArrowRight, ArrowUpRight, Eye, EyeSlash, ShieldCheck, X } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Unsplash — bepul litsenziya (unsplash.com/license), tijorat maqsadida foydalanish uchun ochiq. */
const PH = {
  typewriter: "https://images.unsplash.com/photo-1560415903-cca53660d61d?w=700&q=70&fm=jpg&fit=crop&auto=format",
  books: "https://images.unsplash.com/photo-1576414160011-98dfab3aa889?w=700&q=70&fm=jpg&fit=crop&auto=format",
  office: "https://images.unsplash.com/photo-1606836591695-4d58a73eba1e?w=700&q=70&fm=jpg&fit=crop&auto=format",
  columns: "https://images.unsplash.com/photo-1719663478770-0e2857069b1b?w=700&q=70&fm=jpg&fit=crop&auto=format",
  headset: "https://images.unsplash.com/photo-1553775282-20af80779df7?w=700&q=70&fm=jpg&fit=crop&auto=format",
  desk: "https://images.unsplash.com/photo-1630561535290-24c621d6b463?w=700&q=70&fm=jpg&fit=crop&auto=format",
  handshake: "https://images.unsplash.com/photo-1672380135241-c024f7fbfa13?w=700&q=70&fm=jpg&fit=crop&auto=format",
  lawyerDesk: "https://images.unsplash.com/photo-1762417691650-f2e4bcca7eaf?w=700&q=70&fm=jpg&fit=crop&auto=format",
  team: "https://images.unsplash.com/photo-1568992688065-536aad8a12f6?w=700&q=70&fm=jpg&fit=crop&auto=format",
  boardroom: "https://images.unsplash.com/photo-1758691736424-4b4273948341?w=700&q=70&fm=jpg&fit=crop&auto=format",
};

const STEPS = [
  { n: "01", t: "Yuklash", q: ["Shartnoma, hujjat yoki ishni yuklaysiz — AI ularni o'qib, ", "tomonlar va shartlarni", " ajratadi."], d: "Har bir hujjat — jarayonning boshlanishi.", photo: PH.desk },
  { n: "02", t: "Tahlil", q: ["Ish yoki qarz bo'yicha ", "xavf va muddat", " avtomatik hisoblanadi."], d: "Tahlil bir zumda — nima birinchi bajarilishi kerakligini tizim aytadi.", photo: PH.books },
  { n: "03", t: "Hujjat", q: ["Talabnoma, da'vo arizasi, yuridik xulosa — ", "bir zumda", " tayyorlanadi."], d: "Tayyor shablonlar bo'yicha, xatosiz.", photo: PH.typewriter },
  { n: "04", t: "Ijro", q: ["E-SUD va E-IMZO orqali yuboriladi, ", "ijro nazorat", " qilinadi."], d: "Butun jarayon bir markazdan — siz tasdiqlaysiz.", photo: PH.handshake },
];
const ROLES = [
  { n: "01", t: "Yuristlar", q: ["Da'vo, xulosa va talabnomani ", "qo'lda yozmang", " — AI tayyorlaydi, siz strategiyaga e'tibor berasiz."], photo: PH.lawyerDesk },
  { n: "02", t: "Kredit va kollektor bo'limi", q: ["Portfelni ", "real vaqtda", " nazorat qiling — qaysi mijoz xavfli, tizim ogohlantiradi."], photo: PH.headset },
  { n: "03", t: "Davlat tashkilotlari", q: ["Ariza, murojaat va tekshiruv jarayonlarini ", "AI agent orqali", " tezlashtiring — inson resursini tejang."], photo: PH.columns },
  { n: "04", t: "Banklar va NBKT", q: ["Kredit shartnomasi, garov va undiruv ishlarini ", "bitta tizimda", " boshqaring."], photo: PH.office },
  { n: "05", t: "Bizneslar", q: ["Shartnoma tahlili va ichki huquqiy ishlarni ", "maxsus yurist yollamasdan", " avtomatlashtiring."], photo: PH.team },
  { n: "06", t: "Rahbariyat", q: ["Butun huquqiy va moliyaviy holat ", "bitta ekranda", " — hisobot va tahlil bir markazda."], photo: PH.boardroom },
];
const WHY = [
  { n: "01", t: "Bir markazda", q: ["Didox, E-SUD, E-IMZO, pochta — ", "hammasi bitta oynada", ", o'tib-o'tib yurmaysiz."] },
  { n: "02", t: "AI tahlil", q: ["Hujjatni ", "o'qiydi va tushunadi", " — summa, muddat, xavf o'zi hisoblanadi."] },
  { n: "03", t: "Xatosiz hujjat", q: ["Tayyor shablon bo'yicha ", "huquqiy jihatdan to'g'ri", " hujjatlar."] },
  { n: "04", t: "Tezlik", q: ["Kunlar emas, ", "daqiqalar", " — hujjat tayyorlash 5 daqiqada."] },
  { n: "05", t: "Xavfsizlik", q: ["Multi-tenant, RLS, E-IMZO — ", "ma'lumot himoyada", ", imzo o'zingizda."] },
];
const CHIPS = ["Didox", "E-SUD", "E-IMZO", "Hybrid Post", "Xarid.uzex", "TrustContract"];
const PHOTOS = [
  { src: "https://images.unsplash.com/photo-1560415903-cca53660d61d?w=900&q=70&fm=jpg&fit=crop&auto=format", cap: "Hujjat tayyorlash" },
  { src: "https://images.unsplash.com/photo-1576414160011-98dfab3aa889?w=900&q=70&fm=jpg&fit=crop&auto=format", cap: "Huquqiy tahlil" },
  { src: "https://images.unsplash.com/photo-1606836591695-4d58a73eba1e?w=900&q=70&fm=jpg&fit=crop&auto=format", cap: "Banklar va bizneslar" },
  { src: "https://images.unsplash.com/photo-1719663478770-0e2857069b1b?w=900&q=70&fm=jpg&fit=crop&auto=format", cap: "Sud tizimi" },
];
const REVIEWS = [
  { a: "A", n: "Alisher R.", r: "Bosh yurist, Kredit tashkiloti", txt: "Lex.AI bilan da'vo tayyorlash haftalardan daqiqalarga tushdi. Butun bo'lim endi bitta tizimda ishlaydi." },
  { a: "D", n: "Dilnoza K.", r: "Moliyaviy direktor, Bank", txt: "E-SUD va E-IMZO integratsiyasi — aynan bizga kerak bo'lgan narsa." },
  { a: "M", n: "Murod T.", r: "Yuridik bo'lim boshlig'i, davlat tashkiloti", txt: "Endi har bir ish AI yordamida boshlanadi — tahlil, hujjat, kuzatuv bitta joyda. Jamoaning yuki sezilarli kamaydi." },
];
/** Faqat haqiqiy logotip fayli yuklangan hamkorlar — matnli o'rinbosar ishlatilmaydi.
 * Yoshlar ishlari agentligi logotipi kelgach shu yerga qo'shiladi. */
/** `h` — har bir logotipning o'z nisbatiga qarab qo'lda kalibrlangan balandligi (px),
 * shunda barchasi bir xil vizual og'irlikda ko'rinadi (kvadrat belgilar tor logotiplarga teng kelishi uchun). */
const LOGO_SUPPORTERS = [
  { t: "Oliy sud", logo: "/brand/supporters/oliy-sud.png", h: 40 },
  { t: "Adliya vazirligi", logo: "/brand/supporters/adliya-vazirligi.png", h: 54 },
  { t: "Yoshlar Ventures", logo: "/brand/supporters/yoshlar-ventures.png", h: 44 },
  { t: "Uzcombinator", logo: "/brand/supporters/uzcombinator.png", h: 26 },
  { t: "Didox", logo: "/brand/supporters/didox.png", h: 32 },
  { t: "Soliq xizmati", logo: "/brand/supporters/soliq-xizmati.png", h: 54 },
  { t: "Raqamli texnologiyalar vazirligi", logo: "/brand/supporters/raqamli-tex-vazirligi.png", h: 34 },
];

export default function LoginPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const openLogin = () => {
    setMenuOpen(false);
    setLoginOpen(true);
  };

  // One-ID xato bilan qaytsa — modal ochamiz.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("oneid_error")) setLoginOpen(true);
  }, []);

  // Oqadigan bulut fon (canvas) — och (light) tema uchun moslashtirilgan.
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    let raf = 0;
    let w = 0;
    let h = 0;
    type Puff = { ax: number; ay: number; bx: number; by: number; r: number; sp: number; ph: number; al: number; drift: number };
    const puffs: Puff[] = [];
    for (let i = 0; i < 11; i++)
      puffs.push({ ax: 0.05 + Math.random() * 0.9, ay: 0.05 + Math.random() * 0.9, bx: 0.09 + Math.random() * 0.26, by: 0.06 + Math.random() * 0.18, r: 0.28 + Math.random() * 0.4, sp: 0.28 + Math.random() * 0.6, ph: Math.random() * 6.28, al: 0.05 + Math.random() * 0.07, drift: (0.02 + Math.random() * 0.05) * (Math.random() < 0.5 ? -1 : 1) });
    const resize = () => {
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = Math.max(1, Math.floor(w * DPR));
      cv.height = Math.max(1, Math.floor(h * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    const frame = (now: number) => {
      const t = now * 0.00015;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#f5f5f4";
      ctx.fillRect(0, 0, w, h);
      const M = Math.max(w, h);
      for (const p of puffs) {
        const fx = (((p.ax + p.drift * t) % 1.2) + 1.2) % 1.2 - 0.1;
        const cx = (fx + Math.cos(t * p.sp + p.ph) * p.bx) * w;
        const cy = (p.ay + Math.sin(t * p.sp * 0.9 + p.ph * 1.3) * p.by) * h;
        const r = p.r * M * (0.9 + 0.14 * Math.sin(t * p.sp + p.ph));
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `rgba(11,18,32,${p.al})`);
        g.addColorStop(0.5, `rgba(11,18,32,${p.al * 0.4})`);
        g.addColorStop(1, "rgba(11,18,32,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 6.2832);
        ctx.fill();
      }
      for (let b = 0; b < 6; b++) {
        const yB = h * (0.12 + b * 0.14);
        const amp = h * (0.06 + (b % 3) * 0.03);
        const sp = 0.3 + b * 0.1;
        const a = 0.05 - b * 0.004;
        const gr = ctx.createLinearGradient(0, 0, w, 0);
        gr.addColorStop(0, "rgba(11,18,32,0)");
        gr.addColorStop(0.5, `rgba(11,18,32,${a > 0 ? a : 0.01})`);
        gr.addColorStop(1, "rgba(11,18,32,0)");
        ctx.strokeStyle = gr;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 9) {
          const y = yB + Math.sin(x * 0.0038 + t * sp + b) * amp + Math.sin(x * 0.011 - t * sp * 0.7 + b * 1.7) * amp * 0.4;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    resize();
    if (reduce) frame(0);
    else raf = requestAnimationFrame(frame);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Pinned bo'limlar (qadam almashish + % + progress) va progress chizig'i.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const prog = root.querySelector<HTMLElement>("[data-prog]");
    const pins = Array.from(root.querySelectorAll<HTMLElement>("[data-pin]")).map((sec) => ({
      sec,
      steps: Array.from(sec.querySelectorAll<HTMLElement>("[data-step]")),
      cn: sec.querySelector<HTMLElement>("[data-cn]"),
      pc: sec.querySelector<HTMLElement>("[data-pc]"),
      pb: sec.querySelector<HTMLElement>("[data-pb]"),
      veil: sec.querySelector<HTMLElement>("[data-veil]"),
    }));
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (prog) prog.style.width = `${max > 0 ? (window.scrollY / max) * 100 : 0}%`;
      for (const P of pins) {
        const rect = P.sec.getBoundingClientRect();
        const total = P.sec.offsetHeight - window.innerHeight;
        const p = Math.min(1, Math.max(0, -rect.top / total));
        const n = P.steps.length;
        const idx = Math.min(n - 1, Math.floor(p * n + 0.0001));
        P.steps.forEach((s, i) => s.classList.toggle("on", i === idx));
        if (P.cn) P.cn.textContent = `0${idx + 1}`;
        const perc = Math.round(p * 100);
        if (P.pc) P.pc.textContent = String(perc);
        if (P.pb) P.pb.style.width = `${perc}%`;
        if (P.veil) P.veil.style.opacity = (0.9 - 0.75 * p).toFixed(3);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    // Reveal (bir tomonlama)
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))),
      { threshold: 0.2 },
    );
    root.querySelectorAll("[data-rv]").forEach((el) => io.observe(el));
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      io.disconnect();
    };
  }, []);

  const Pinned = ({ id, kicker, total, items }: { id: string; kicker: string; total: string; items: { n: string; t: string; q: string[]; d?: string; photo?: string }[] }) => (
    <section data-pin id={id} className="lx-pin" style={{ height: `${(items.length + 1) * 100}vh` }}>
      <div className="lx-sticky">
        <div className="lx-bg" />
        <div data-veil className="lx-veil" />
        <div className="lx-phead">
          <div className="lx-wrap">
            <span className="lx-kk">{kicker}</span>
            <span className="lx-pn font-display">
              <em data-cn>01</em> / {total}
            </span>
          </div>
        </div>
        <div className="lx-steps">
          {items.map((s, i) => (
            <div data-step key={s.n} className={cn("lx-step", i === 0 && "on")}>
              <div className="lx-wrap lx-step-grid">
                <div className="lx-big font-display">{s.n}</div>
                <div>
                  <h3 className="lx-sh font-display">{s.t}</h3>
                  <p className="lx-q">
                    {s.q[0]}
                    <em>{s.q[1]}</em>
                    {s.q[2]}
                  </p>
                  {s.d && <p className="lx-d">{s.d}</p>}
                </div>
                {s.photo && (
                  <div className="lx-step-photo">
                    <img src={s.photo} alt={s.t} loading="lazy" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="lx-counter">
          <div className="lx-wrap lx-counter-in">
            <div className="lx-pct font-display">
              <span data-pc>0</span>
              <s>%</s>
            </div>
            <div className="lx-cbar">
              <i data-pb />
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <div ref={rootRef} className="lx-root">
      <style>{`
        .lx-root{--blue:#111318;--ink:#0b1220;--muted:rgba(11,18,32,.52);--line:rgba(11,18,32,.1);--bg:#f5f5f4;
          position:relative;min-height:100vh;background:var(--bg);color:var(--ink);overflow-x:clip}
        .lx-root .font-display{font-family:Georgia,'Times New Roman',var(--font-space-grotesk),serif;letter-spacing:-.006em;font-weight:600}
        .lx-fx{position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none}
        .lx-prog{position:fixed;left:0;top:0;height:2px;background:var(--blue);z-index:60;width:0}
        .lx-wrap{position:relative;z-index:10;width:min(1180px,88%);margin-inline:auto}
        .lx-nav{position:fixed;inset-inline:0;top:0;z-index:50;background:linear-gradient(var(--bg),rgba(245,245,244,0))}
        .lx-nav-in{display:flex;align-items:center;justify-content:space-between;padding:20px 0;width:min(1180px,88%);margin-inline:auto;position:relative;z-index:10}
        .lx-brand{display:flex;align-items:center;background:none;border:0;cursor:pointer;padding:0}
        .lx-links{display:flex;gap:30px}
        .lx-links a{color:var(--muted);text-decoration:none;font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase}
        .lx-links a:hover{color:var(--ink)}
        .lx-right{display:flex;align-items:center;gap:12px}
        .lx-enter{border:0;border-radius:999px;padding:9px 20px;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#fff;cursor:pointer;background:var(--blue);transition:.2s}
        .lx-enter:hover{opacity:.88}
        .lx-burger{display:none;width:40px;height:40px;border:1px solid var(--line);border-radius:999px;color:var(--ink);background:none;cursor:pointer}
        @media(max-width:860px){.lx-links{display:none}.lx-burger{display:grid;place-items:center}}
        .lx-mob{border-top:1px solid var(--line);background:var(--bg);padding:16px 6%;display:flex;flex-direction:column;gap:14px;position:relative;z-index:10}
        .lx-mob a{color:var(--muted);text-decoration:none;font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
        .lx-btn{display:inline-flex;align-items:center;gap:9px;border-radius:999px;padding:15px 28px;font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;cursor:pointer;text-decoration:none;border:1px solid transparent;transition:.2s;background:none}
        .lx-btn.solid{background:var(--blue);color:#fff}.lx-btn.solid:hover{transform:translateY(-2px)}
        .lx-btn.ghost{border-color:var(--line);color:var(--ink)}.lx-btn.ghost:hover{border-color:var(--ink)}
        .lx-hero{position:relative;min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:110px 0 108px}
        .lx-kick{display:flex;align-items:center;gap:16px;margin-bottom:20px}
        .lx-kick span{height:1px;width:52px;background:var(--blue)}
        .lx-kick b{font-size:11px;font-weight:800;letter-spacing:.4em;color:var(--blue);text-transform:uppercase}
        .lx-h1{font-size:clamp(2.2rem,6.4vw,5.4rem);line-height:1.08;max-width:920px}
        .lx-h1 .l{display:block;overflow:hidden;padding-bottom:.06em}
        .lx-h1 .l>span{display:block;transform:translateY(112%);transition:transform 1s cubic-bezier(.16,.84,.24,1)}
        .lx-root.ready .lx-h1 .l>span{transform:none}
        .lx-h1 .l:nth-child(2)>span{transition-delay:.09s}.lx-h1 .l:nth-child(3)>span{transition-delay:.18s}
        .lx-red{color:var(--blue)}
        .lx-u{text-decoration:underline;text-decoration-color:var(--blue);text-decoration-thickness:3px;text-underline-offset:6px}
        .lx-herob{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:30px;margin-top:42px}
        .lx-herob p{max-width:520px;color:var(--muted);font-size:16px;line-height:1.6}
        .lx-cta{display:flex;gap:12px;flex-wrap:wrap}
        .lx-strip{position:absolute;left:0;bottom:0;width:100%;display:flex;align-items:center;gap:16px;border-top:1px solid var(--line);padding:12px 0;background:rgba(245,245,244,.75);backdrop-filter:blur(4px)}
        .lx-strip-label{flex:0 0 auto;max-width:92px;padding-left:6%;font-size:9.5px;line-height:1.35;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);white-space:normal}
        .lx-strip-viewport{flex:1;min-width:0;overflow:hidden;white-space:nowrap;-webkit-mask-image:linear-gradient(90deg,transparent,#000 4%,#000 96%,transparent);mask-image:linear-gradient(90deg,transparent,#000 4%,#000 96%,transparent)}
        .lx-strip .row{display:inline-flex;align-items:center;height:54px;animation:lxScroll 26s linear infinite}
        .lx-strip-logo{display:inline-flex;align-items:center;margin:0 22px;flex-shrink:0}
        .lx-strip-logo img{display:block;width:auto;object-fit:contain;filter:grayscale(1);opacity:.6;transition:filter .2s,opacity .2s}
        .lx-strip-logo:hover img{filter:grayscale(0);opacity:1}
        @media(max-width:700px){.lx-strip-label{display:none}}
        @keyframes lxScroll{to{transform:translateX(-50%)}}
        .lx-banner{position:relative;z-index:10;padding:80px 0}
        .lx-banner-in{background:#0b0b0c;border-radius:28px;padding:64px 6% 56px;text-align:center}
        .lx-banner-in h2{color:#fff;font-size:clamp(1.6rem,3.6vw,2.6rem);line-height:1.25;max-width:680px;margin:0 auto}
        .lx-demo{max-width:560px;margin:40px auto 0;background:#151517;border:1px solid rgba(255,255,255,.08);border-radius:16px;overflow:hidden;text-align:left}
        .lx-demo-chrome{display:flex;align-items:center;gap:5px;padding:11px 13px;border-bottom:1px solid rgba(255,255,255,.06)}
        .lx-demo-chrome i{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.15)}
        .lx-demo-chrome span{margin-left:8px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.35)}
        .lx-demo-body{padding:20px;min-height:120px;display:flex;flex-direction:column;gap:10px}
        .lx-demo-msg{max-width:82%;padding:9px 13px;border-radius:11px;font-size:13.5px;line-height:1.45;white-space:pre-wrap;word-break:break-word}
        .lx-demo-msg.u{align-self:flex-end;background:var(--blue);color:#fff;border-bottom-right-radius:3px}
        .lx-demo-msg.a{align-self:flex-start;background:rgba(255,255,255,.06);color:rgba(255,255,255,.9);border-bottom-left-radius:3px}
        .lx-demo-caret{display:inline-block;width:2px;height:13px;background:currentColor;margin-left:2px;vertical-align:-2px;animation:lxCaret .8s step-end infinite}
        @keyframes lxCaret{50%{opacity:0}}
        .lx-shots{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;max-width:1040px;margin:48px auto 0}
        @media(max-width:900px){.lx-shots{grid-template-columns:1fr 1fr}}
        @media(max-width:520px){.lx-shots{grid-template-columns:1fr}}
        .lx-shot{background:#151517;border:1px solid rgba(255,255,255,.08);border-radius:16px;overflow:hidden;text-align:left}
        .lx-shot img{display:block;width:100%;aspect-ratio:3/4;object-fit:cover}
        .lx-shot-cap{padding:12px 14px;border-top:1px solid rgba(255,255,255,.06);color:rgba(255,255,255,.6);font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
        .lx-sec{position:relative;z-index:10;padding:70px 0}
        .lx-sec-head h2{font-size:clamp(1.7rem,3.6vw,2.6rem);line-height:1.2;color:var(--ink)}
        .lx-split{display:grid;grid-template-columns:1fr auto 1fr;gap:22px;align-items:center;max-width:1040px;margin:0 auto}
        @media(max-width:760px){.lx-split{grid-template-columns:1fr}}
        .lx-split-card{background:#fff;border:1px solid var(--line);border-radius:20px;overflow:hidden}
        .lx-split-card img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}
        .lx-split-in{padding:24px}
        .lx-split-tag{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--blue);border:1px solid var(--line);border-radius:999px;padding:5px 14px;margin-bottom:14px}
        .lx-split-in p{color:var(--muted);font-size:15px;line-height:1.55}
        .lx-split-or{font-family:Georgia,'Times New Roman',serif;font-style:italic;color:var(--muted);font-size:15px}
        @media(max-width:760px){.lx-split-or{text-align:center}}
        .lx-state{position:relative;height:260vh}
        .lx-state .st{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
        .lx-state h2{font-size:clamp(2.6rem,11vw,8.5rem);line-height:.92}
        .lx-state h2 span{display:block}
        .lx-state .sa{color:rgba(11,18,32,.12)}
        .lx-state .sb{color:var(--blue)}
        .lx-state .sub{position:absolute;bottom:14vh;width:100%;color:var(--muted);font-size:clamp(11px,1.4vw,14px);letter-spacing:.24em;text-transform:uppercase}
        .lx-pin{position:relative}
        .lx-sticky{position:sticky;top:0;height:100vh;overflow:hidden;display:flex;align-items:center}
        .lx-bg{position:absolute;inset:0;z-index:0;background:radial-gradient(120% 90% at 72% 28%,rgba(11,18,32,.045),transparent 60%),repeating-linear-gradient(115deg,rgba(11,18,32,.025) 0 2px,transparent 2px 26px),var(--bg)}
        .lx-veil{position:absolute;inset:0;z-index:1;background:var(--bg);opacity:.9}
        .lx-phead{position:absolute;top:12vh;left:0;width:100%;z-index:3}
        .lx-phead .lx-wrap{display:flex;align-items:baseline;gap:20px;flex-wrap:wrap}
        .lx-kk{font-size:11px;font-weight:800;letter-spacing:.34em;color:var(--blue);text-transform:uppercase}
        .lx-pn{font-size:clamp(2.2rem,5.5vw,4.2rem);line-height:.8;color:var(--muted);margin-left:auto}
        .lx-pn em{color:var(--blue);font-style:normal}
        .lx-steps{position:relative;width:100%;z-index:3}
        .lx-step{position:absolute;inset:0;display:flex;align-items:center;opacity:0;transform:translateY(26px);transition:opacity .5s ease,transform .6s cubic-bezier(.16,.84,.24,1);pointer-events:none}
        .lx-step.on{opacity:1;transform:none}
        .lx-step-grid{display:grid;grid-template-columns:auto 1fr auto;gap:34px;align-items:center}
        .lx-big{font-size:clamp(4rem,10vw,8.5rem);line-height:.78;color:transparent;-webkit-text-stroke:1.5px rgba(11,18,32,.18)}
        .lx-step-photo{width:min(260px,26vw);aspect-ratio:3/4;border-radius:18px;overflow:hidden;box-shadow:0 20px 50px -20px rgba(11,18,32,.35)}
        .lx-step-photo img{display:block;width:100%;height:100%;object-fit:cover}
        @media(max-width:1100px){.lx-step-photo{display:none}}
        .lx-sh{font-size:clamp(1.8rem,4.4vw,3.2rem);line-height:.95;margin-bottom:14px;color:var(--ink)}
        .lx-q{font-size:clamp(1.1rem,2vw,1.5rem);font-weight:600;line-height:1.3;max-width:640px;color:var(--ink)}
        .lx-q em{color:var(--blue);font-style:normal}
        .lx-d{margin-top:18px;padding-left:18px;border-left:2px solid var(--blue);color:var(--muted);max-width:520px;font-size:15px;line-height:1.6}
        .lx-counter{position:absolute;right:0;bottom:9vh;z-index:4;width:100%}
        .lx-counter-in{display:flex;flex-direction:column;align-items:flex-end;gap:12px}
        .lx-pct{font-size:clamp(2.4rem,5.5vw,4.2rem);line-height:.8;color:var(--ink)}
        .lx-pct s{color:var(--blue);text-decoration:none;font-size:.4em;vertical-align:super;margin-left:4px}
        .lx-cbar{width:min(320px,60vw);height:3px;background:rgba(11,18,32,.12);border-radius:2px;overflow:hidden}
        .lx-cbar i{display:block;height:100%;width:0;background:var(--blue)}
        @media(max-width:860px){.lx-step-grid{grid-template-columns:1fr;gap:12px}.lx-big{font-size:26vw}}
        [data-rv]{opacity:0;transform:translateY(40px);transition:opacity .9s cubic-bezier(.16,.84,.24,1),transform .9s}
        [data-rv].in{opacity:1;transform:none}
        @media(prefers-reduced-motion:reduce){[data-rv]{opacity:1;transform:none}.lx-step{transition:opacity .2s}.lx-h1 .l>span{transform:none}}
        .lx-marq{border-block:1px solid var(--line);padding:24px 0;overflow:hidden;white-space:nowrap;position:relative;z-index:10}
        .lx-marq .row{display:inline-flex;animation:lxScroll 30s linear infinite}
        .lx-marq b{font-size:clamp(2.4rem,6vw,4.6rem);margin:0 26px;color:transparent;-webkit-text-stroke:1.5px rgba(11,18,32,.22)}
        .lx-marq b i{-webkit-text-stroke:0;color:var(--blue);font-style:normal;margin:0 8px}
        .lx-revs{position:relative;z-index:10;padding:120px 0}
        .lx-revgrid{display:grid;grid-template-columns:1.2fr 1fr;gap:20px;margin-top:40px}
        .lx-rev{border:1px solid var(--line);background:#fff;border-radius:16px;padding:28px}
        .lx-rev p{font-size:16px;line-height:1.5;color:var(--ink)}
        .lx-rev .who{margin-top:20px;display:flex;align-items:center;gap:12px;border-top:1px solid var(--line);padding-top:16px}
        .lx-av{width:42px;height:42px;border-radius:50%;background:var(--blue);display:grid;place-items:center;font-family:Georgia,serif;color:#fff;font-weight:700}
        .lx-rev .who b{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:var(--ink)}
        .lx-rev .who span{display:block;color:var(--muted);font-size:12px}
        .lx-revsmall{display:grid;gap:20px}
        @media(max-width:860px){.lx-revgrid{grid-template-columns:1fr}}
        .lx-final{position:relative;z-index:10;text-align:center;padding:150px 0 70px}
        .lx-final h2{font-size:clamp(2.6rem,9vw,7rem);line-height:.88;max-width:960px;margin:18px auto 22px}
        .lx-final p{color:var(--muted);max-width:520px;margin:0 auto 34px;font-size:16px}
        .lx-foot{position:relative;z-index:10;border-top:1px solid var(--line);padding:64px 0 26px;margin-top:80px}
        .lx-footgrid{display:grid;grid-template-columns:1.5fr 1fr 1.1fr 1fr;gap:34px}
        .lx-foot h4{font-size:11px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:var(--blue);margin-bottom:16px}
        .lx-foot a{color:var(--muted);text-decoration:none;display:block;margin-bottom:9px;font-size:14px}
        .lx-foot a:hover{color:var(--ink)}
        .lx-foot .info{color:var(--muted);font-size:14px;line-height:1.55;margin-bottom:9px}
        .lx-foot .lead{color:var(--muted);font-size:14px;line-height:1.6;max-width:290px;margin:16px 0 22px}
        .lx-soc{display:flex;gap:10px}
        .lx-soc a{width:40px;height:40px;border:1px solid var(--line);border-radius:50%;display:grid;place-items:center;margin:0;color:var(--ink)}
        .lx-soc a:hover{border-color:var(--blue);background:rgba(11,18,32,.05);color:var(--blue)}
        .lx-soc svg{width:18px;height:18px}
        .lx-footbar{margin-top:46px;padding-top:22px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;color:var(--muted);font-size:11px;letter-spacing:.12em;text-transform:uppercase}
        @media(max-width:860px){.lx-footgrid{grid-template-columns:1fr 1fr}}
        @media(max-width:520px){.lx-footgrid{grid-template-columns:1fr}}
        .lx-in{animation:lxIn .3s ease}@keyframes lxIn{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}
      `}</style>

      <canvas ref={canvasRef} className="lx-fx" aria-hidden />
      <div data-prog className="lx-prog" />

      {/* Navbar */}
      <header className="lx-nav">
        <div className="lx-nav-in">
          <button className="lx-brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <Image src="/brand/lex-ai-logo-full.png" alt="Lex.AI" width={1049} height={426} className="h-7 w-auto object-contain" />
          </button>
          <nav className="lx-links">
            <a href="#jarayon">Jarayon</a>
            <a href="#kim">Kim uchun</a>
            <a href="#nega">Nega</a>
          </nav>
          <div className="lx-right">
            <div className="hidden sm:block"><LocaleSwitcher variant="ghost" /></div>
            <button className="lx-enter" onClick={openLogin}>Kirish</button>
            <button className="lx-burger" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">{menuOpen ? <X className="size-5" /> : "≡"}</button>
          </div>
        </div>
        {menuOpen && (
          <div className="lx-mob">
            <a href="#jarayon" onClick={() => setMenuOpen(false)}>Jarayon</a>
            <a href="#kim" onClick={() => setMenuOpen(false)}>Kim uchun</a>
            <a href="#nega" onClick={() => setMenuOpen(false)}>Nega</a>
            <div><LocaleSwitcher variant="ghost" /></div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="lx-hero">
        <div className="lx-wrap">
          <div className="lx-kick"><span /><b>Faoliyatdan natijaga</b></div>
          <h1 className="lx-h1 font-display">
            <span className="l"><span>Huquqiy va moliyaviy ishlarni</span></span>
            <span className="l"><span><span className="lx-u">boshqaruvchi</span> AI agent</span></span>
          </h1>
          <div className="lx-herob">
            <p>AI agent shartnoma va ishlarni tahlil qiladi, qarzdorlikni nazorat qiladi, sud hujjatlarini tayyorlaydi — davlat, bank va biznes uchun, Didox, E-SUD va E-IMZO bilan bir markazda.</p>
            <div className="lx-cta">
              <button className="lx-btn solid" onClick={openLogin}>Boshlash <ArrowUpRight weight="bold" className="size-4" /></button>
              <a className="lx-btn ghost" href="#jarayon">Qanday ishlaydi</a>
            </div>
          </div>
        </div>
        <div className="lx-strip">
          <div className="lx-strip-label">Bizni qo&apos;llab-quvvatlovchilar</div>
          <div className="lx-strip-viewport">
            <div className="row">
              {[...LOGO_SUPPORTERS, ...LOGO_SUPPORTERS].map((s, i) => (
                <div className="lx-strip-logo" key={i}>
                  <img src={s.logo} alt={s.t} loading="lazy" style={{ height: s.h }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Qog'ozbozorlik natijaga xalaqit bermasin — mahsulot ko'rinishi */}
      <section className="lx-banner">
        <div className="lx-wrap">
          <div data-rv className="lx-banner-in">
            <h2 className="font-display">Qog&apos;ozbozorlik natijaga xalaqit bermasinmi?</h2>
            <AgentDemo />
            <div className="lx-shots">
              {PHOTOS.map((p) => (
                <div className="lx-shot" key={p.cap}>
                  <img src={p.src} alt={p.cap} loading="lazy" />
                  <div className="lx-shot-cap">{p.cap}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Ikki yo'nalish — Debitorlik yoki Yuridik jarayon */}
      <section className="lx-sec lx-split-sec">
        <div className="lx-wrap">
          <div data-rv className="lx-sec-head" style={{ margin: "0 auto 40px", textAlign: "center" }}>
            <span className="lx-kk">Ikki yo&apos;nalish, bitta platforma</span>
            <h2 className="font-display">Debitorlikmi, yoki yuridik jarayonmi?</h2>
          </div>
          <div className="lx-split">
            <div data-rv className="lx-split-card">
              <img src={PH.headset} alt="Debitorlik" loading="lazy" />
              <div className="lx-split-in">
                <span className="lx-split-tag">Debitorlik</span>
                <p>Kredit tashkiloti yoki kollektor bo&apos;limisiz — qarzdorlikni AI kuzatadi, eslatma va talabnomani o&apos;zi tayyorlaydi, sud bosqichigacha olib boradi.</p>
              </div>
            </div>
            <div className="lx-split-or">yoki</div>
            <div data-rv className="lx-split-card">
              <img src={PH.lawyerDesk} alt="Yuridik jarayon" loading="lazy" />
              <div className="lx-split-in">
                <span className="lx-split-tag">Yuridik jarayon</span>
                <p>Davlat tashkiloti, bank yoki biznessiz — har bir ish uchun AI tahlil qiladi, hujjat tayyorlaydi, jarayonni boshidan oxirigacha kuzatadi.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Katta bayonot */}
      <section className="lx-state">
        <div className="st">
          <h2 className="font-display">
            <span className="sa">Jarayondan</span>
            <span className="sb">Natijagacha</span>
          </h2>
          <div className="sub">Yuridik ish · Qarz undirish · Bitta AI agent</div>
        </div>
      </section>

      <Pinned id="jarayon" kicker="Jarayon — 4 qadam" total="04" items={STEPS} />

      <div className="lx-marq">
        <div className="row">
          {[...CHIPS, ...CHIPS].map((c, i) => (
            <b className="font-display" key={i}>{c}<i>◆</i></b>
          ))}
        </div>
      </div>

      <Pinned id="kim" kicker="Kim uchun" total="06" items={ROLES} />
      <Pinned id="nega" kicker="Nega Lex.AI" total="05" items={WHY} />

      {/* Reviews */}
      <section className="lx-revs">
        <div className="lx-wrap">
          <div data-rv className="lx-kick" style={{ marginBottom: 12 }}><span /><b>Ishonch</b></div>
          <h2 data-rv className="font-display" style={{ fontSize: "clamp(2rem,5vw,3.4rem)" }}>Ular ishonadi</h2>
          <div className="lx-revgrid">
            <div data-rv className="lx-rev">
              <p>«{REVIEWS[0].txt}»</p>
              <div className="who"><div className="lx-av">{REVIEWS[0].a}</div><div><b>{REVIEWS[0].n}</b><span>{REVIEWS[0].r}</span></div></div>
            </div>
            <div className="lx-revsmall">
              {REVIEWS.slice(1).map((r) => (
                <div data-rv key={r.n} className="lx-rev">
                  <p>«{r.txt}»</p>
                  <div className="who"><div className="lx-av">{r.a}</div><div><b>{r.n}</b><span>{r.r}</span></div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>


      {/* Final CTA */}
      <section className="lx-final">
        <div className="lx-wrap">
          <div data-rv className="lx-kick" style={{ justifyContent: "center" }}><span /><b>Bugun boshlang</b></div>
          <h2 data-rv className="font-display">Huquqiy va moliyaviy ishlar — endi avtomatik</h2>
          <p data-rv>Birinchi ishingizni bugun boshlang. Sozlash 5 daqiqa, natija — bir markazda.</p>
          <button data-rv className="lx-btn solid" onClick={openLogin}>Bepul boshlash <ArrowRight weight="bold" className="size-4" /></button>
        </div>
      </section>

      {/* Footer */}
      <footer className="lx-foot">
        <div className="lx-wrap">
          <div className="lx-footgrid">
            <div>
              <Image src="/brand/lex-ai-logo-full.png" alt="Lex.AI" width={1049} height={426} className="h-7 w-auto object-contain" />
              <p className="lead">Yuridik ishdan qarz undirishgacha — bir platformada. Davlat, bank va biznes uchun AI agent.</p>
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
              <h4>Bog&apos;lanish</h4>
              <a href="mailto:smartlex.uzbekistan@gmail.com">smartlex.uzbekistan@gmail.com</a>
              <a href="tel:+998977247999">+998 97 724 79 99</a>
              <a href="https://t.me/smartlex_uz" target="_blank" rel="noopener noreferrer">Telegram: @smartlex_uz</a>
            </div>
            <div>
              <h4>Manzil</h4>
              <div className="info">Toshkent shahar,<br />Mirobod tumani, 23-uy</div>
              <h4 style={{ marginTop: 22 }}>Tashkilot</h4>
              <div className="info">MC LEGAL yuridik firmasi</div>
              <div className="info">STIR: 312559000</div>
            </div>
            <div>
              <h4>Sahifalar</h4>
              <a href="#jarayon">Jarayon</a>
              <a href="#kim">Kim uchun</a>
              <a href="#nega">Nega Lex.AI</a>
              <button className="lx-enter" style={{ padding: 0, background: "none", color: "var(--muted)", letterSpacing: ".01em", fontSize: 14, textTransform: "none", fontWeight: 400 }} onClick={openLogin}>Kirish</button>
            </div>
          </div>
          <div className="lx-footbar">
            <div>© 2026 Lex.AI · MC LEGAL yuridik firmasi</div>
            <div>Multi-tenant · RLS · E-IMZO</div>
          </div>
        </div>
      </footer>

      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
      <ReadyFlag rootRef={rootRef} />
    </div>
  );
}

/** Hero sarlavha reveal'ini yuklashdan keyin ishga tushiradi. */
function ReadyFlag({ rootRef }: { rootRef: React.RefObject<HTMLDivElement | null> }) {
  useEffect(() => {
    const r = rootRef.current;
    if (!r) return;
    const id = requestAnimationFrame(() => r.classList.add("ready"));
    return () => cancelAnimationFrame(id);
  }, [rootRef]);
  return null;
}

const DEMO_SCRIPT: { who: "user" | "ai"; text: string }[] = [
  { who: "user", text: "GLOBAL SNAB MCHJ bilan bog'liq ishni boshlang" },
  { who: "ai", text: "Ish ochildi: 2026-LM-014. Shartnoma va kontragent tahlil qilinmoqda…" },
  { who: "ai", text: "Xavf darajasi: past. Talabnoma loyihasi tayyor — tasdiqlaysizmi?" },
];

/** Haqiqiy AI agent suhbatiga o'xshab "yozib" ko'rsatadigan, sikllanuvchi animatsiya — video o'rnini bosadi. */
function AgentDemo() {
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);

  useEffect(() => {
    const line = DEMO_SCRIPT[lineIdx].text;
    if (charIdx < line.length) {
      const t = setTimeout(() => setCharIdx((c) => c + 1), 28);
      return () => clearTimeout(t);
    }
    const pause = lineIdx === DEMO_SCRIPT.length - 1 ? 2600 : 700;
    const t = setTimeout(() => {
      if (lineIdx === DEMO_SCRIPT.length - 1) {
        setLineIdx(0);
        setCharIdx(0);
      } else {
        setLineIdx((i) => i + 1);
        setCharIdx(0);
      }
    }, pause);
    return () => clearTimeout(t);
  }, [lineIdx, charIdx]);

  return (
    <div className="lx-demo">
      <div className="lx-demo-chrome"><i /><i /><i /><span>Yuridik AI Agent</span></div>
      <div className="lx-demo-body">
        {DEMO_SCRIPT.slice(0, lineIdx + 1).map((m, i) => {
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
            <Image src="/brand/lex-ai-logo-full.png" alt="Lex.AI" width={1049} height={426} className="h-7 w-auto object-contain" />
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
