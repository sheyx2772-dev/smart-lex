"use client";

import { ArrowRight, ArrowUpRight, Eye, EyeSlash, ShieldCheck, Sparkle, X } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STEPS = [
  { n: "01", t: "Yuklash", q: ["Shartnoma va hujjatlarni yuklaysiz — AI ularni o'qib, ", "tomonlar va shartlarni", " ajratadi."], d: "Har bir hujjat — jarayonning boshlanishi." },
  { n: "02", t: "Tahlil", q: ["Qarzdorlik, muddat va ", "xavf darajasi", " avtomatik hisoblanadi."], d: "Skoring bir zumda — qaysi qarz birinchi undirilishini tizim aytadi." },
  { n: "03", t: "Hujjat", q: ["Talabnoma, da'vo arizasi, order — ", "bir zumda", " tayyorlanadi."], d: "Tayyor shablonlar bo'yicha, xatosiz." },
  { n: "04", t: "Ijro", q: ["E-SUD va E-IMZO orqali yuboriladi, ", "ijro nazorat", " qilinadi."], d: "Butun jarayon bir markazdan." },
];
const ROLES = [
  { n: "01", t: "Yuristlar", q: ["Da'vo va talabnomani ", "qo'lda yozmang", " — AI tayyorlaydi, siz strategiyaga e'tibor berasiz."] },
  { n: "02", t: "Kredit bo'limi", q: ["Portfelni ", "real vaqtda", " nazorat qiling — qaysi mijoz xavfli, tizim ogohlantiradi."] },
  { n: "03", t: "Kollektorlar", q: ["Undiruv bosqichlari ", "avtomatik", " — eslatma, talabnoma, sud — ketma-ket."] },
  { n: "04", t: "Rahbariyat", q: ["Butun debitor holati ", "bitta ekranda", " — hisobot va tahlil bir markazda."] },
];
const WHY = [
  { n: "01", t: "Bir markazda", q: ["Didox, E-SUD, E-IMZO, pochta — ", "hammasi bitta oynada", ", o'tib-o'tib yurmaysiz."] },
  { n: "02", t: "AI tahlil", q: ["Hujjatni ", "o'qiydi va tushunadi", " — summa, muddat, xavf o'zi hisoblanadi."] },
  { n: "03", t: "Xatosiz hujjat", q: ["Tayyor shablon bo'yicha ", "huquqiy jihatdan to'g'ri", " hujjatlar."] },
  { n: "04", t: "Tezlik", q: ["Kunlar emas, ", "daqiqalar", " — da'vo tayyorlash 5 daqiqada."] },
  { n: "05", t: "Xavfsizlik", q: ["Multi-tenant, RLS, E-IMZO — ", "ma'lumot himoyada", ", imzo o'zingizda."] },
];
const CHIPS = ["Didox", "E-SUD", "E-IMZO", "Hybrid Post", "Xarid.uzex", "TrustContract"];
const REVIEWS = [
  { a: "A", n: "Alisher R.", r: "Bosh yurist, Kredit tashkiloti", txt: "Lex.AI bilan da'vo tayyorlash haftalardan daqiqalarga tushdi. Butun bo'lim endi bitta tizimda ishlaydi." },
  { a: "D", n: "Dilnoza K.", r: "Moliyaviy direktor", txt: "E-SUD va E-IMZO integratsiyasi — aynan bizga kerak bo'lgan narsa." },
  { a: "M", n: "Murod T.", r: "Kollektor bo'limi boshlig'i", txt: "AI skoring qaysi qarzni birinchi undirishni o'zi aytadi. Vaqtni tejaydi." },
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

  // Oqadigan smoke fon (canvas).
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
    for (let i = 0; i < 13; i++)
      puffs.push({ ax: 0.05 + Math.random() * 0.9, ay: 0.05 + Math.random() * 0.9, bx: 0.09 + Math.random() * 0.26, by: 0.06 + Math.random() * 0.18, r: 0.28 + Math.random() * 0.4, sp: 0.28 + Math.random() * 0.6, ph: Math.random() * 6.28, al: 0.1 + Math.random() * 0.14, drift: (0.02 + Math.random() * 0.05) * (Math.random() < 0.5 ? -1 : 1) });
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
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      const M = Math.max(w, h);
      ctx.globalCompositeOperation = "lighter";
      for (const p of puffs) {
        const fx = (((p.ax + p.drift * t) % 1.2) + 1.2) % 1.2 - 0.1;
        const cx = (fx + Math.cos(t * p.sp + p.ph) * p.bx) * w;
        const cy = (p.ay + Math.sin(t * p.sp * 0.9 + p.ph * 1.3) * p.by) * h;
        const r = p.r * M * (0.9 + 0.14 * Math.sin(t * p.sp + p.ph));
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `rgba(235,235,240,${p.al})`);
        g.addColorStop(0.4, `rgba(150,150,160,${p.al * 0.5})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "screen";
      for (let b = 0; b < 6; b++) {
        const yB = h * (0.12 + b * 0.14);
        const amp = h * (0.06 + (b % 3) * 0.03);
        const sp = 0.3 + b * 0.1;
        const a = 0.1 - b * 0.008;
        const gr = ctx.createLinearGradient(0, 0, w, 0);
        gr.addColorStop(0, "rgba(255,255,255,0)");
        gr.addColorStop(0.5, `rgba(255,255,255,${a > 0 ? a : 0.02})`);
        gr.addColorStop(1, "rgba(255,255,255,0)");
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
      ctx.globalCompositeOperation = "source-over";
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
        if (P.veil) P.veil.style.opacity = (0.85 - 0.45 * p).toFixed(3);
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

  const Pinned = ({ id, kicker, total, items }: { id: string; kicker: string; total: string; items: { n: string; t: string; q: string[]; d?: string }[] }) => (
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
        @import url('https://fonts.googleapis.com/css2?family=Anton&display=swap');
        .lx-root{--red:#ff0000;--ink:#f5f5f6;--muted:rgba(235,235,238,.5);--line:rgba(255,255,255,.13);
          position:relative;min-height:100vh;background:#000;color:var(--ink);overflow-x:clip}
        .lx-root .font-display{font-family:'Anton',var(--font-space-grotesk),Impact,sans-serif;text-transform:uppercase;letter-spacing:.006em;font-weight:400}
        .lx-fx{position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none}
        .lx-prog{position:fixed;left:0;top:0;height:2px;background:var(--red);z-index:60;width:0}
        .lx-wrap{position:relative;z-index:10;width:min(1180px,88%);margin-inline:auto}
        .lx-nav{position:fixed;inset-inline:0;top:0;z-index:50;background:linear-gradient(#000,rgba(0,0,0,0))}
        .lx-nav-in{display:flex;align-items:center;justify-content:space-between;padding:20px 0;width:min(1180px,88%);margin-inline:auto;position:relative;z-index:10}
        .lx-brand{font-family:'Anton',var(--font-space-grotesk),Impact,sans-serif;font-size:25px;letter-spacing:.02em;text-transform:uppercase;color:#fff;background:none;border:0;cursor:pointer}
        .lx-brand s{color:var(--red);text-decoration:none}
        .lx-links{display:flex;gap:30px}
        .lx-links a{color:var(--muted);text-decoration:none;font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase}
        .lx-links a:hover{color:#fff}
        .lx-right{display:flex;align-items:center;gap:12px}
        .lx-enter{border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:9px 20px;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#fff;cursor:pointer;background:none}
        .lx-enter:hover{background:#fff;color:#000}
        .lx-burger{display:none;width:40px;height:40px;border:1px solid var(--line);border-radius:999px;color:#fff;background:none;cursor:pointer}
        @media(max-width:860px){.lx-links{display:none}.lx-burger{display:grid;place-items:center}}
        .lx-mob{border-top:1px solid var(--line);background:#000;padding:16px 6%;display:flex;flex-direction:column;gap:14px;position:relative;z-index:10}
        .lx-mob a{color:var(--muted);text-decoration:none;font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
        .lx-btn{display:inline-flex;align-items:center;gap:9px;border-radius:999px;padding:15px 28px;font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;cursor:pointer;text-decoration:none;border:1px solid transparent;transition:.2s;background:none}
        .lx-btn.solid{background:var(--red);color:#fff}.lx-btn.solid:hover{transform:translateY(-2px)}
        .lx-btn.ghost{border-color:rgba(255,255,255,.25);color:#fff}.lx-btn.ghost:hover{border-color:#fff}
        .lx-hero{position:relative;min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:110px 0 108px}
        .lx-kick{display:flex;align-items:center;gap:16px;margin-bottom:20px}
        .lx-kick span{height:1px;width:52px;background:var(--red)}
        .lx-kick b{font-size:11px;font-weight:800;letter-spacing:.4em;color:var(--red);text-transform:uppercase}
        .lx-h1{font-size:clamp(2.9rem,10.5vw,9rem);line-height:.98}
        .lx-h1 .l{display:block;overflow:hidden;padding-bottom:.06em}
        .lx-h1 .l>span{display:block;transform:translateY(112%);transition:transform 1s cubic-bezier(.16,.84,.24,1)}
        .lx-root.ready .lx-h1 .l>span{transform:none}
        .lx-h1 .l:nth-child(2)>span{transition-delay:.09s}.lx-h1 .l:nth-child(3)>span{transition-delay:.18s}
        .lx-red{color:var(--red)}
        .lx-herob{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:30px;margin-top:42px}
        .lx-herob p{max-width:520px;color:var(--muted);font-size:16px;line-height:1.6}
        .lx-cta{display:flex;gap:12px;flex-wrap:wrap}
        .lx-strip{position:absolute;left:0;bottom:0;width:100%;border-top:1px solid var(--line);padding:15px 0;overflow:hidden;white-space:nowrap;background:rgba(0,0,0,.4);
          -webkit-mask-image:linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent);mask-image:linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent)}
        .lx-strip .row{display:inline-flex;animation:lxScroll 26s linear infinite}
        .lx-strip s{display:inline-flex;align-items:center;gap:11px;margin:0 24px;font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);text-decoration:none}
        .lx-strip s i{width:5px;height:5px;border-radius:50%;background:var(--red)}
        @keyframes lxScroll{to{transform:translateX(-50%)}}
        .lx-state{position:relative;height:260vh}
        .lx-state .st{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
        .lx-state h2{font-size:clamp(2.6rem,11vw,8.5rem);line-height:.92}
        .lx-state h2 span{display:block}
        .lx-state .sa{color:rgba(245,245,246,.16)}
        .lx-state .sb{color:var(--red)}
        .lx-state .sub{position:absolute;bottom:14vh;width:100%;color:var(--muted);font-size:clamp(11px,1.4vw,14px);letter-spacing:.24em;text-transform:uppercase}
        .lx-pin{position:relative}
        .lx-sticky{position:sticky;top:0;height:100vh;overflow:hidden;display:flex;align-items:center}
        .lx-bg{position:absolute;inset:0;z-index:0;background:radial-gradient(120% 90% at 72% 28%,rgba(255,255,255,.07),transparent 60%),repeating-linear-gradient(115deg,rgba(255,255,255,.03) 0 2px,transparent 2px 26px),#050505}
        .lx-veil{position:absolute;inset:0;z-index:1;background:#000;opacity:.85}
        .lx-phead{position:absolute;top:12vh;left:0;width:100%;z-index:3}
        .lx-phead .lx-wrap{display:flex;align-items:baseline;gap:20px;flex-wrap:wrap}
        .lx-kk{font-size:11px;font-weight:800;letter-spacing:.34em;color:var(--red);text-transform:uppercase}
        .lx-pn{font-size:clamp(2.2rem,5.5vw,4.2rem);line-height:.8;color:var(--muted);margin-left:auto}
        .lx-pn em{color:var(--red);font-style:normal}
        .lx-steps{position:relative;width:100%;z-index:3}
        .lx-step{position:absolute;inset:0;display:flex;align-items:center;opacity:0;transform:translateY(26px);transition:opacity .5s ease,transform .6s cubic-bezier(.16,.84,.24,1);pointer-events:none}
        .lx-step.on{opacity:1;transform:none}
        .lx-step-grid{display:grid;grid-template-columns:auto 1fr;gap:34px;align-items:center}
        .lx-big{font-size:clamp(5rem,15vw,13rem);line-height:.78;color:transparent;-webkit-text-stroke:1.5px rgba(255,255,255,.7)}
        .lx-sh{font-size:clamp(1.8rem,4.4vw,3.2rem);line-height:.95;margin-bottom:14px}
        .lx-q{font-size:clamp(1.1rem,2vw,1.5rem);font-weight:600;line-height:1.3;max-width:640px;color:#fff}
        .lx-q em{color:var(--red);font-style:normal}
        .lx-d{margin-top:18px;padding-left:18px;border-left:2px solid var(--red);color:var(--muted);max-width:520px;font-size:15px;line-height:1.6}
        .lx-counter{position:absolute;right:0;bottom:9vh;z-index:4;width:100%}
        .lx-counter-in{display:flex;flex-direction:column;align-items:flex-end;gap:12px}
        .lx-pct{font-size:clamp(2.4rem,5.5vw,4.2rem);line-height:.8}
        .lx-pct s{color:var(--red);text-decoration:none;font-size:.4em;vertical-align:super;margin-left:4px}
        .lx-cbar{width:min(320px,60vw);height:3px;background:rgba(255,255,255,.16);border-radius:2px;overflow:hidden}
        .lx-cbar i{display:block;height:100%;width:0;background:var(--red)}
        @media(max-width:860px){.lx-step-grid{grid-template-columns:1fr;gap:12px}.lx-big{font-size:26vw}}
        [data-rv]{opacity:0;transform:translateY(40px);transition:opacity .9s cubic-bezier(.16,.84,.24,1),transform .9s}
        [data-rv].in{opacity:1;transform:none}
        @media(prefers-reduced-motion:reduce){[data-rv]{opacity:1;transform:none}.lx-step{transition:opacity .2s}.lx-h1 .l>span{transform:none}}
        .lx-marq{border-block:1px solid var(--line);padding:24px 0;overflow:hidden;white-space:nowrap;position:relative;z-index:10}
        .lx-marq .row{display:inline-flex;animation:lxScroll 30s linear infinite}
        .lx-marq b{font-size:clamp(2.4rem,6vw,4.6rem);margin:0 26px;color:transparent;-webkit-text-stroke:1.5px rgba(255,255,255,.8)}
        .lx-marq b i{-webkit-text-stroke:0;color:var(--red);font-style:normal;margin:0 8px}
        .lx-revs{position:relative;z-index:10;padding:120px 0}
        .lx-revgrid{display:grid;grid-template-columns:1.2fr 1fr;gap:20px;margin-top:40px}
        .lx-rev{border:1px solid var(--line);border-radius:16px;padding:28px}
        .lx-rev p{font-size:16px;line-height:1.5}
        .lx-rev .who{margin-top:20px;display:flex;align-items:center;gap:12px;border-top:1px solid var(--line);padding-top:16px}
        .lx-av{width:42px;height:42px;border-radius:50%;background:var(--red);display:grid;place-items:center;font-family:'Anton',sans-serif;color:#fff}
        .lx-rev .who b{font-size:13px;text-transform:uppercase;letter-spacing:.05em}
        .lx-rev .who span{display:block;color:var(--muted);font-size:12px}
        .lx-revsmall{display:grid;gap:20px}
        @media(max-width:860px){.lx-revgrid{grid-template-columns:1fr}}
        .lx-final{position:relative;z-index:10;text-align:center;padding:150px 0 70px}
        .lx-final h2{font-size:clamp(2.6rem,9vw,7rem);line-height:.88;max-width:960px;margin:18px auto 22px}
        .lx-final p{color:var(--muted);max-width:520px;margin:0 auto 34px;font-size:16px}
        .lx-foot{position:relative;z-index:10;border-top:1px solid var(--line);padding:64px 0 26px;margin-top:80px}
        .lx-footgrid{display:grid;grid-template-columns:1.5fr 1fr 1.1fr 1fr;gap:34px}
        .lx-foot h4{font-size:11px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:var(--red);margin-bottom:16px}
        .lx-foot a{color:var(--muted);text-decoration:none;display:block;margin-bottom:9px;font-size:14px}
        .lx-foot a:hover{color:#fff}
        .lx-foot .info{color:var(--muted);font-size:14px;line-height:1.55;margin-bottom:9px}
        .lx-foot .lead{color:var(--muted);font-size:14px;line-height:1.6;max-width:290px;margin:16px 0 22px}
        .lx-soc{display:flex;gap:10px}
        .lx-soc a{width:40px;height:40px;border:1px solid var(--line);border-radius:50%;display:grid;place-items:center;margin:0;color:#fff}
        .lx-soc a:hover{border-color:var(--red);background:rgba(255,0,0,.1)}
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
          <button className="lx-brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>LEX<s>.AI</s></button>
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
            <span className="l"><span>Debitorlikdan</span></span>
            <span className="l"><span>Undiruvga</span></span>
            <span className="l"><span className="lx-red">Avtomatik</span></span>
          </h1>
          <div className="lx-herob">
            <p>AI agent hujjatlarni tahlil qiladi, qarzdorlikni nazorat qiladi, talabnoma va da&apos;vo tayyorlaydi — Didox, E-SUD va E-IMZO bilan bir markazda.</p>
            <div className="lx-cta">
              <button className="lx-btn solid" onClick={openLogin}>Boshlash <ArrowUpRight weight="bold" className="size-4" /></button>
              <a className="lx-btn ghost" href="#jarayon">Qanday ishlaydi</a>
            </div>
          </div>
        </div>
        <div className="lx-strip">
          <div className="row">
            {[...CHIPS, ...CHIPS].map((c, i) => (
              <s key={i}><i />{c}</s>
            ))}
          </div>
        </div>
      </section>

      {/* Katta bayonot */}
      <section className="lx-state">
        <div className="st">
          <h2 className="font-display">
            <span className="sa">Qarzdan</span>
            <span className="sb">Undiruvgacha</span>
          </h2>
          <div className="sub">Bir platforma · Bir jarayon · To&apos;liq nazorat</div>
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

      <Pinned id="kim" kicker="Kim uchun" total="04" items={ROLES} />
      <Pinned id="nega" kicker="Nega LEX.AI" total="05" items={WHY} />

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
          <h2 data-rv className="font-display">Qarzni undirish — endi avtomatik</h2>
          <p data-rv>Birinchi da&apos;voingizni bugun tayyorlang. Sozlash 5 daqiqa, natija — bir markazda.</p>
          <button data-rv className="lx-btn solid" onClick={openLogin}>Bepul boshlash <ArrowRight weight="bold" className="size-4" /></button>
        </div>
      </section>

      {/* Footer */}
      <footer className="lx-foot">
        <div className="lx-wrap">
          <div className="lx-footgrid">
            <div>
              <div className="lx-brand" style={{ fontSize: 28 }}>LEX<s>.AI</s></div>
              <p className="lead">Debitorlikdan undiruvgacha — bir platformada. AI agent, Didox, E-SUD va E-IMZO bilan.</p>
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
              <a href="#nega">Nega LEX.AI</a>
              <button className="lx-enter" style={{ padding: 0, border: 0, color: "var(--muted)", letterSpacing: ".01em", fontSize: 14, textTransform: "none", fontWeight: 400 }} onClick={openLogin}>Kirish</button>
            </div>
          </div>
          <div className="lx-footbar">
            <div>© 2026 LEX.AI · MC LEGAL yuridik firmasi</div>
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

/** Login — faqat "Kirish" bosilganda ochiladigan modal. */
function LoginModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("login");
  const tApp = useTranslations("app");
  const router = useRouter();
  const oneidError = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("oneid_error") : null;
  const KNOWN_ONEID_ERR = new Set(["not_configured", "invalid_state", "not_valid", "no_pin", "no_legal_entity", "tenant_not_registered", "user_not_found", "exchange_failed", "require_eri", "not_verified"]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(oneidError ? t(`oneid.err.${KNOWN_ONEID_ERR.has(oneidError) ? oneidError : "generic"}`) : null);
  const [loading, setLoading] = useState(false);

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
    "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-[15px] text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/60 focus:bg-white/10";

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="lx-in w-full max-w-[420px] rounded-3xl border border-white/12 bg-[#0a0a0a] p-7 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-[#ff0000] text-white">
              <Sparkle weight="fill" className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold uppercase tracking-tight" style={{ fontFamily: "'Anton',var(--font-space-grotesk),sans-serif" }}>{tApp("name")}</h2>
              <p className="text-xs text-white/45">{t("subtitle")}</p>
            </div>
          </div>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"><X className="size-4" /></button>
        </div>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="lm-email" className="text-xs font-semibold uppercase tracking-widest text-white/55">{t("email")}</label>
            <input id="lm-email" type="email" autoComplete="email" placeholder={t("emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => errors.email && validate()} className={cn(field, errors.email && "border-red-500/70")} />
            {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="lm-pw" className="text-xs font-semibold uppercase tracking-widest text-white/55">{t("password")}</label>
            <div className="relative">
              <input id="lm-pw" type={show ? "text" : "password"} autoComplete="current-password" placeholder={t("passwordPlaceholder")} value={password} onChange={(e) => setPassword(e.target.value)} onBlur={() => errors.password && validate()} className={cn(field, "pr-12", errors.password && "border-red-500/70")} />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-white/40 hover:text-white" title={show ? t("hidePassword") : t("showPassword")}>
                {show ? <EyeSlash className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-400">{errors.password}</p>}
          </div>
          {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{error}</div>}
          <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff0000] px-4 py-3.5 text-sm font-bold uppercase tracking-widest text-white transition-transform hover:scale-[1.02] disabled:opacity-60">
            {loading ? t("signingIn") : t("submit")}
            {!loading && <ArrowRight weight="bold" className="size-4" />}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">
          <span className="h-px flex-1 bg-white/10" />
          {t("oneid.or")}
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <a href="/api/oneid" className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/15 bg-white/5 px-4 py-3.5 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:border-white/50 hover:bg-white/10">
          <ShieldCheck weight="fill" className="size-5 text-emerald-400" />
          {t("oneid.button")}
        </a>
        <p className="mt-3 text-center text-[11px] leading-relaxed text-white/35">{t("oneid.hint")}</p>
      </div>
    </div>
  );
}
