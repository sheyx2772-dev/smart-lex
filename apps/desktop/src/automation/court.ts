import { chromium, type BrowserContext, type Page } from "playwright";
import { app } from "electron";
import * as path from "node:path";

/**
 * cabinet.sud.uz (E-SUD / ADOLAT) formasini avtomatik to'ldiradi.
 * - Doimiy profil: E-IMZO bilan bir marta kiriladi, sessiya saqlanadi.
 * - Maydonlar YORLIQ (label/placeholder) bo'yicha topiladi (Angular Material —
 *   barqaror name/id yo'q). Imzoni foydalanuvchi o'zi bosadi.
 */

let context: BrowserContext | null = null;

async function getContext(): Promise<BrowserContext> {
  if (context && context.browser()?.isConnected()) return context;
  const userDataDir = path.join(app.getPath("userData"), "court-profile");
  // channel: "chrome" — tizimdagi Chrome (E-IMZO plagini bilan). Bo'lmasa, olib tashlang.
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

export async function fillCourtForm(claim: CourtClaim): Promise<{ filled: number; url: string }> {
  const ctx = await getContext();
  const page: Page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto("https://cabinet.sud.uz/cases/create", { waitUntil: "domcontentloaded" });
  // Foydalanuvchi E-IMZO bilan kirmaganda — kirishni kutamiz (sahifada forma paydo bo'lguncha).
  await page.waitForTimeout(1500);

  const filled = await page.evaluate((c: CourtClaim) => {
    // — Yorliq matnini yig'ish (Angular Material mat-label, aria, label) —
    function labelText(el: Element): string {
      const parts: string[] = [];
      const id = (el as HTMLElement).id;
      if (id) {
        const l = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (l) parts.push(l.textContent || "");
      }
      const wrap = el.closest("label");
      if (wrap) parts.push(wrap.textContent || "");
      const aria = el.getAttribute("aria-label");
      if (aria) parts.push(aria);
      const mff = el.closest("mat-form-field, .mat-mdc-form-field, .mat-form-field");
      if (mff) {
        const ml = mff.querySelector("mat-label, .mat-mdc-floating-label, .mat-form-field-label");
        if (ml) parts.push(ml.textContent || "");
      }
      return parts.join(" ");
    }

    // Aniq kalitlar — keng so'zlardan qoching (Sud nomi / Foiz summasi'ga tushmasin).
    const MAP: { keys: string[]; val: string | undefined }[] = [
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
    }

    let count = 0;
    const used = new Set<Element>();
    for (const f of Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea"))) {
      const type = (f.getAttribute("type") || "text").toLowerCase();
      if (["hidden", "checkbox", "radio", "submit", "button", "file", "password"].includes(type)) continue;
      if (used.has(f) || f.disabled || f.readOnly || f.value) continue;
      const hay = `${f.name} ${f.id} ${f.getAttribute("formcontrolname") || ""} ${f.placeholder || ""} ${labelText(f)}`.toLowerCase();
      for (const m of MAP) {
        if (m.val && m.keys.some((k) => hay.includes(k))) {
          setValue(f, m.val);
          used.add(f);
          count++;
          break;
        }
      }
    }
    return count;
  }, claim);

  return { filled, url: page.url() };
}
