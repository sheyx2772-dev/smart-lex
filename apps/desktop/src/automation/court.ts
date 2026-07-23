import { chromium, type BrowserContext, type Page } from "playwright";
import { app } from "electron";
import * as path from "node:path";

/**
 * cabinet.sud.uz (E-SUD / ADOLAT) — ko'p bosqichli sihirgar.
 * Model: brauzerni ochamiz, sahifaga DOIMIY panel joylashtiramiz. Foydalanuvchi
 * bosqichdan bosqichga o'tadi; har qadamda «Shu bosqichni to'ldirish» bosiladi —
 * dastur ko'rinib turgan maydonlarni yorliq bo'yicha to'ldiradi. Ochilaydigan
 * ro'yxatlar (mat-select), sanalar va E-IMZO — foydalanuvchi o'zi.
 * Bu — «blind full-auto»dan ishonchliroq (Angular Material barqaror id bermaydi).
 */

let context: BrowserContext | null = null;

async function getContext(): Promise<BrowserContext> {
  if (context && context.browser()?.isConnected()) return context;
  const userDataDir = path.join(app.getPath("userData"), "court-profile");
  context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: null,
    args: ["--start-maximized"],
  });
  return context;
}

export interface CourtClaim {
  debtor?: string;
  tin?: string;
  amount?: string;
  amountNumber?: string;
  principal?: string;
  penalty?: string;
  court?: string;
  contractNumber?: string;
  body?: string;
}

/** Brauzerni ochib, da'vo ma'lumotini beradi va doimiy panelni joylashtiradi. */
export async function fillCourtForm(claim: CourtClaim): Promise<{ url: string }> {
  const ctx = await getContext();
  const page: Page = ctx.pages()[0] ?? (await ctx.newPage());

  // Da'vo ma'lumotini har navigatsiyada mavjud qilish + panelni qayta joylashtirish.
  await page.exposeFunction("__lexClaim", () => claim).catch(() => {});
  await page.addInitScript(injectPanel, claim);
  await page.goto("https://cabinet.sud.uz/cases/create", { waitUntil: "domcontentloaded" });
  // Joriy sahifaga ham (init script faqat keyingi navigatsiyalarda ishlaydi).
  await page.evaluate(injectPanel, claim).catch(() => {});
  return { url: page.url() };
}

/**
 * Sahifaga joylashtiriladigan panel + to'ldirish mantig'i (brauzer kontekstida
 * ishlaydi). SPA navigatsiyasida panel yo'qolmasligi uchun kuzatuvchi bilan.
 */
function injectPanel(claim: CourtClaim): void {
  const KEY = "__lexCourtPanel";
  const w = window as unknown as Record<string, unknown>;
  function mount(): void {
    if (document.getElementById("lex-court-panel")) return;
    const p = document.createElement("div");
    p.id = "lex-court-panel";
    p.style.cssText =
      "position:fixed;right:16px;bottom:16px;z-index:2147483647;width:260px;font-family:system-ui,sans-serif;" +
      "background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 10px 30px rgba(2,6,23,.18);overflow:hidden";
    p.innerHTML =
      '<div style="background:linear-gradient(135deg,#4f46e5,#6366f1);color:#fff;padding:10px 12px;font-weight:700;font-size:13px">◆ SmartLex</div>' +
      '<div style="padding:10px 12px;font-size:12.5px;line-height:1.5">' +
      "<b>" + (claim.debtor || "—") + "</b><br>STIR: " + (claim.tin || "—") + "<br>Summa: " + (claim.amount || "—") +
      '</div>' +
      '<button id="lex-fill" style="width:calc(100% - 20px);margin:0 10px 8px;padding:9px;border:0;border-radius:10px;background:#4f46e5;color:#fff;font-weight:600;cursor:pointer">Shu bosqichni to\'ldirish</button>' +
      '<div id="lex-note" style="padding:0 12px 10px;font-size:11.5px;color:#64748b"></div>';
    document.documentElement.appendChild(p);
    const note = p.querySelector<HTMLDivElement>("#lex-note")!;
    p.querySelector<HTMLButtonElement>("#lex-fill")!.onclick = () => {
      const n = fillCurrentStep(claim);
      note.textContent = n > 0 ? n + " ta maydon to'ldirildi. Ro'yxat/sana va E-IMZO — o'zingiz." : "Mos maydon topilmadi.";
    };
  }
  function labelText(el: Element): string {
    const parts: string[] = [];
    const id = (el as HTMLElement).id;
    if (id) { const l = document.querySelector('label[for="' + (window.CSS ? CSS.escape(id) : id) + '"]'); if (l) parts.push(l.textContent || ""); }
    const wrap = el.closest("label"); if (wrap) parts.push(wrap.textContent || "");
    const aria = el.getAttribute("aria-label"); if (aria) parts.push(aria);
    const mff = el.closest("mat-form-field, .mat-mdc-form-field, .mat-form-field");
    if (mff) { const ml = mff.querySelector("mat-label, .mat-mdc-floating-label, .mat-form-field-label"); if (ml) parts.push(ml.textContent || ""); }
    return parts.join(" ");
  }
  function fillCurrentStep(c: CourtClaim): number {
    const MAP: { keys: string[]; val?: string }[] = [
      { keys: ["stir", "инн", "jshshir"], val: c.tin },
      { keys: ["javobgar", "ответчик", "otvetchik", "respondent"], val: c.debtor },
      { keys: ["vo summasi", "сумма иска"], val: c.amountNumber || c.amount },
      { keys: ["asosiy qarz", "основной долг"], val: c.principal },
      { keys: ["penya", "пеня"], val: c.penalty },
      { keys: ["shartnoma raqami", "договор"], val: c.contractNumber },
    ];
    function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) setter.call(el, value); else el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.style.outline = "2px solid #22c55e";
      setTimeout(() => (el.style.outline = ""), 2500);
    }
    let count = 0; const used = new Set<Element>();
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea").forEach((f) => {
      const type = (f.getAttribute("type") || "text").toLowerCase();
      if (["hidden", "checkbox", "radio", "submit", "button", "file", "password"].includes(type)) return;
      if (used.has(f) || f.disabled || f.readOnly || f.value) return;
      const hay = (f.name + " " + f.id + " " + (f.getAttribute("formcontrolname") || "") + " " + (f.placeholder || "") + " " + labelText(f)).toLowerCase();
      for (const m of MAP) if (m.val && m.keys.some((k) => hay.includes(k))) { setValue(f, m.val); used.add(f); count++; break; }
    });
    return count;
  }
  if (w[KEY]) return;
  w[KEY] = true;
  const boot = () => { mount(); new MutationObserver(mount).observe(document.documentElement, { childList: true, subtree: true }); };
  if (document.body) boot(); else document.addEventListener("DOMContentLoaded", boot);
}
