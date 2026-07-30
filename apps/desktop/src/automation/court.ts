import { chromium, type BrowserContext, type Page } from "playwright";
import { app } from "electron";
import * as path from "node:path";

/**
 * cabinet.sud.uz (E-SUD / ADOLAT) — autopilot.
 * Panel: matn maydonlari + radio (mat-radio) + ochilma (mat-select) ni yorliq
 * bo'yicha tanlaydi va «Oldinga/Keyingi» bilan bosqichdan bosqichga o'tadi.
 * E-IMZO imzosini foydalanuvchi o'zi bosadi.
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

export async function fillCourtForm(claim: CourtClaim): Promise<{ url: string }> {
  const ctx = await getContext();
  const page: Page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.addInitScript(injectPanel, claim);
  await page.goto("https://cabinet.sud.uz/cases/create", { waitUntil: "domcontentloaded" });
  await page.evaluate(injectPanel, claim).catch(() => {});
  return { url: page.url() };
}

/** Sahifaga panel + autopilot mantig'i (brauzer kontekstida). */
function injectPanel(claim: CourtClaim): void {
  const KEY = "__lexCourtPanel";
  const w = window as unknown as Record<string, unknown>;
  if (w[KEY]) return;
  w[KEY] = true;

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const norm = (s: string | null | undefined) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

  function labelText(el: Element): string {
    const parts: string[] = [];
    const id = (el as HTMLElement).id;
    if (id) { const l = document.querySelector('label[for="' + (window.CSS ? CSS.escape(id) : id) + '"]'); if (l) parts.push(l.textContent || ""); }
    const wrap = el.closest("label"); if (wrap) parts.push(wrap.textContent || "");
    const aria = el.getAttribute("aria-label"); if (aria) parts.push(aria);
    const mff = el.closest("mat-form-field, .mat-mdc-form-field, .mat-form-field");
    if (mff) { const ml = mff.querySelector("mat-label, .mat-mdc-floating-label, .mat-form-field-label"); if (ml) parts.push(ml.textContent || ""); }
    return norm(parts.join(" "));
  }

  function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.style.outline = "2px solid #22c55e";
    setTimeout(() => (el.style.outline = ""), 2500);
  }

  // ── Matn maydonlari (aniq kalitlar) ──
  function fillText(c: CourtClaim): number {
    const MAP: { keys: string[]; val?: string }[] = [
      { keys: ["stir", "инн", "jshshir"], val: c.tin },
      { keys: ["javobgar", "ответчик", "otvetchik", "respondent"], val: c.debtor },
      { keys: ["vo summasi", "сумма иска"], val: c.amountNumber || c.amount },
      { keys: ["asosiy qarz", "основной долг"], val: c.principal },
      { keys: ["penya", "пеня"], val: c.penalty },
      { keys: ["shartnoma raqami", "договор"], val: c.contractNumber },
    ];
    let n = 0; const used = new Set<Element>();
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea").forEach((f) => {
      const type = (f.getAttribute("type") || "text").toLowerCase();
      if (["hidden", "checkbox", "radio", "submit", "button", "file", "password"].includes(type)) return;
      if (used.has(f) || f.disabled || f.readOnly || f.value) return;
      const hay = (f.name + " " + f.id + " " + (f.getAttribute("formcontrolname") || "") + " " + (f.placeholder || "") + " " + labelText(f));
      for (const m of MAP) if (m.val && m.keys.some((k) => hay.includes(k))) { setValue(f, m.val); used.add(f); n++; break; }
    });
    return n;
  }

  // ── Radio — yorliq bo'yicha tanlash (mat-radio yoki maxsus karta) ──
  function selectRadio(keywords: string[]): boolean {
    const cand = Array.from(document.querySelectorAll(
      "mat-radio-button, .mat-radio-button, .mat-mdc-radio-button, label, .mat-radio-label, .mdc-form-field",
    ));
    for (const b of cand) {
      const t = norm(b.textContent);
      if (t.length < 40 && keywords.some((k) => t.includes(k))) {
        // Bir necha nishonni bosamiz — Angular qaysısini eshitsa.
        const targets = [
          b.querySelector<HTMLElement>(".mat-radio-container, .mdc-radio, .mat-radio-outer-circle"),
          b.querySelector<HTMLElement>('input[type="radio"]'),
          b.querySelector<HTMLElement>(".mat-radio-label, .mdc-label"),
          b as HTMLElement,
        ].filter(Boolean) as HTMLElement[];
        for (const tg of targets) { tg.click(); }
        const inp = b.querySelector<HTMLInputElement>('input[type="radio"]');
        if (inp && !inp.checked) { inp.checked = true; inp.dispatchEvent(new Event("change", { bubbles: true })); }
        return true;
      }
    }
    // Fallback: matn mos keluvchi eng kichik bosiladigan element
    const els = Array.from(document.querySelectorAll<HTMLElement>("div, span, mat-card, .mat-card"));
    for (const e of els) {
      if (e.children.length <= 6 && keywords.some((k) => norm(e.textContent).includes(k)) && norm(e.textContent).length < 40) {
        e.click(); return true;
      }
    }
    return false;
  }

  // ── Aniq matnli radio (masalan "Ha"/"Yo'q") — qisqa kalitlar xavfli, shuning
  //    uchun normallashgan matn AYNAN teng bo'lishini talab qilamiz. ──
  function clickRadioExact(exactTexts: string[]): boolean {
    const cand = Array.from(document.querySelectorAll<HTMLElement>("mat-radio-button, .mat-radio-button, .mat-mdc-radio-button, .mdc-form-field, label"));
    for (const b of cand) {
      if (exactTexts.includes(norm(b.textContent))) {
        const tg = b.querySelector<HTMLElement>(".mat-radio-container, .mdc-radio, .mat-radio-outer-circle")
          || b.querySelector<HTMLElement>('input[type="radio"]') || b;
        realClick(tg);
        const inp = b.querySelector<HTMLInputElement>('input[type="radio"]');
        if (inp && !inp.checked) { inp.checked = true; inp.dispatchEvent(new Event("change", { bubbles: true })); }
        return true;
      }
    }
    return false;
  }

  // ── mat-select ochilma — VARIANT matni bo'yicha topib tanlash ──
  // Yorliq (mat-label) ishonchsiz, shuning uchun har bir ochilmani ochamiz va
  // variantlari ichidan optionKeywords mos kelganini tanlaymiz (aniqroq usul).
  async function openSelect(s: HTMLElement): Promise<HTMLElement[]> {
    // Input-autocomplete: elementning o'zi input — fokus + bosish.
    // mat-select: ichki inputni EMAS, trigger (yoki elementning o'zi)ni bosamiz.
    let trigger: HTMLElement;
    if (s.matches("input, textarea")) {
      trigger = s;
      try { (s as HTMLInputElement).focus(); } catch { /* noop */ }
    } else {
      trigger = s.querySelector<HTMLElement>(".mat-mdc-select-trigger, .mat-select-trigger") || s;
    }
    realClick(trigger);
    await sleep(600);
    return Array.from(document.querySelectorAll<HTMLElement>("mat-option, .mat-mdc-option, [role='option'], .mat-autocomplete-panel .mat-option, .cdk-overlay-container li"));
  }

  // exact=true bo'lsa — variant matni AYNAN teng bo'lishi kerak (substring emas).
  // Bu "умумий" kabi qisqa qiymatlar "15 - кредиторлар умумий…" ichidan
  // noto'g'ri topilishining oldini oladi.
  async function selectDropdown(optionKeywords: string[], exact = false): Promise<boolean> {
    const selects = Array.from(document.querySelectorAll<HTMLElement>("mat-select, .mat-mdc-select, [role='combobox']"));
    for (const s of selects) {
      if (s.getAttribute("aria-disabled") === "true") continue;
      const opts = await openSelect(s);
      const opt = opts.find((o) => optionKeywords.some((k) => exact ? norm(o.textContent) === k : norm(o.textContent).includes(k)));
      if (opt) {
        realClick(opt);
        opt.style.outline = "2px solid #22c55e";
        await sleep(400);
        closeOverlays(); // qolgan panel ochiq qolmasin
        await sleep(200);
        return true;
      }
      closeOverlays(); await sleep(200); // mos variant yo'q — yopamiz
    }
    closeOverlays();
    return false;
  }

  // ── AYNAN yorliq bo'yicha ochilma tanlash — faqat mos yorliqli selectni ochadi,
  //    boshqa selectlarga tegmaydi (masalan «Qo'shimcha ish turkumi»ni «Asosiy»dan
  //    ajratish uchun). labelKeys — form-field/yorliq matnida bo'lishi kerak. ──
  async function selectByLabel(labelKeys: string[], optionKeywords: string[], exact = false): Promise<boolean> {
    const selects = Array.from(document.querySelectorAll<HTMLElement>("mat-select, .mat-mdc-select, [role='combobox']"));
    for (const s of selects) {
      if (s.getAttribute("aria-disabled") === "true") continue;
      const near = norm(s.textContent) + " " + norm(s.closest("mat-form-field, .mat-form-field")?.textContent) + " " + labelText(s);
      if (!labelKeys.some((k) => near.includes(k))) continue;
      const opts = await openSelect(s);
      const opt = opts.find((o) => optionKeywords.some((k) => exact ? norm(o.textContent) === k : norm(o.textContent).includes(k)));
      if (opt) { realClick(opt); opt.style.outline = "2px solid #22c55e"; await sleep(400); closeOverlays(); await sleep(200); return true; }
      closeOverlays(); await sleep(150);
      return false; // yorliq mos keldi-yu variant topilmadi — boshqa selectlarni ochmaymiz
    }
    return false;
  }

  // Chuqur diagnostika — har bir ochilmani OCHIB, variantlarini ham ko'rsatadi.
  async function deepDiagnose(): Promise<string> {
    const out: string[] = [];
    const radios = Array.from(document.querySelectorAll("mat-radio-button, .mat-radio-button, input[type=radio]")).slice(0, 12).map((r) => norm(r.textContent) || (r as HTMLElement).id).filter(Boolean);
    out.push("RADIO: " + JSON.stringify(radios));
    const selects = Array.from(document.querySelectorAll<HTMLElement>("mat-select, .mat-mdc-select, [role='combobox']"));
    for (let i = 0; i < selects.length; i++) {
      const s = selects[i];
      out.push("SELECT[" + i + "] joriy=\"" + norm(s.textContent) + "\" disabled=" + s.getAttribute("aria-disabled"));
      const opts = await openSelect(s);
      out.push("   VARIANTLAR: " + JSON.stringify(opts.map((o) => norm(o.textContent)).filter(Boolean)));
      document.body.click(); await sleep(200);
    }
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("input,textarea")).slice(0, 25).map((i) => {
      const lbl = labelText(i) || i.placeholder || i.getAttribute("formcontrolname") || "";
      const role = i.getAttribute("role");
      const auto = i.hasAttribute("matautocompletetrigger") || i.getAttribute("autocomplete") === "off" && i.getAttribute("aria-autocomplete");
      return (lbl + (role ? " [role=" + role + "]" : "") + (auto ? " [autocomplete]" : "")).trim();
    }).filter(Boolean);
    out.push("INPUT: " + JSON.stringify(inputs));
    const btns = Array.from(document.querySelectorAll("button")).slice(0, 20).map((b) => norm(b.textContent)).filter(Boolean);
    out.push("BUTTON: " + JSON.stringify(btns));
    return out.join("\n");
  }

  function clickForward(): boolean {
    const btns = Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
    // "Oldinga" / "Keyingi" (oldinga siljish); "Orqaga" (ortga) — teginmaymiz
    const fwd = btns.find((b) => { const t = norm(b.textContent); return (t.includes("oldinga") || t.includes("keyin")) && !t.includes("orqaga") && !b.disabled; });
    if (fwd) { fwd.click(); return true; }
    return false;
  }

  // ── Haqiqiy sichqoncha bosishi (Angular pointer/mousedown hodisalarini eshitadi) ──
  // MUHIM: faqat BITTA marta bosadi (pointer/mouse down+up, so'ng bitta el.click()).
  // toggle elementlar (mat-select) uchun ikki click ochib-yopib yuboradi — shuning
  // uchun sintetik "click" hodisasi YUBORILMAYDI, faqat el.click() ishlatiladi.
  function realClick(el: HTMLElement): void {
    try { el.scrollIntoView({ block: "center", inline: "center" }); } catch { /* noop */ }
    const o = { bubbles: true, cancelable: true, view: window } as MouseEventInit;
    for (const type of ["pointerover", "mouseover", "pointerdown", "mousedown", "pointerup", "mouseup"]) {
      try { el.dispatchEvent(new MouseEvent(type, o)); } catch { /* noop */ }
    }
    if (typeof el.click === "function") { try { el.click(); } catch { /* noop */ } }
    else { try { el.dispatchEvent(new MouseEvent("click", o)); } catch { /* noop */ } }
  }

  // ── Ochiq ochilma/overlay panellarni yopish (Escape + backdrop) ──
  function closeOverlays(): void {
    const esc: KeyboardEventInit = { key: "Escape", code: "Escape", bubbles: true } as KeyboardEventInit;
    try { document.dispatchEvent(new KeyboardEvent("keydown", esc)); } catch { /* noop */ }
    try { document.dispatchEvent(new KeyboardEvent("keyup", esc)); } catch { /* noop */ }
    document.querySelectorAll<HTMLElement>(".cdk-overlay-backdrop").forEach((b) => { try { b.click(); } catch { /* noop */ } });
    try { (document.activeElement as HTMLElement)?.blur?.(); } catch { /* noop */ }
  }

  // ── Matn bo'yicha element topib bosish (menyu, tab, havola) ──
  // Eng qisqa (eng aniq) mos elementni topadi, so'ng eng yaqin bosiladigan
  // ajdodini (a/button/list-item) realClick bilan bosadi.
  function clickByText(selector: string, keywords: string[], maxLen = 45): boolean {
    const matches = Array.from(document.querySelectorAll<HTMLElement>(selector))
      .map((e) => ({ e, t: norm(e.textContent) }))
      .filter(({ e, t }) => t && t.length <= maxLen && !e.closest("#lex-court-panel") && keywords.some((k) => t.includes(k)))
      .sort((a, b) => a.t.length - b.t.length);
    if (!matches.length) return false;
    const el = matches[0].e;
    const target = (el.closest<HTMLElement>("a, button, [role='menuitem'], [role='tab'], .mat-list-item, .mat-mdc-list-item, .mat-nav-list a, li, .mat-tab-label, .mdc-tab") || el);
    realClick(target);
    return true;
  }

  // ── Autopilot: URL-ogoh, bosqichma-bosqich ──
  // URL naqshi: /cases/create → /cases/create/economic/suit/first → …
  async function autopilot(c: CourtClaim, note: HTMLElement): Promise<void> {
    // 0) Navigatsiya: Murojaatlar (ADOLAT) → Murojaat yaratish
    if (!location.href.includes("/cases/create")) {
      note.textContent = "Murojaatlar menyusi ochilmoqda…";
      clickByText("a, span, div, button, .mat-list-item, .mat-mdc-list-item, [role='menuitem']", ["murojaatlar"], 30);
      await sleep(1100);
      note.textContent = "«Murojaat yaratish» tanlanmoqda…";
      clickByText("a, span, div, button, .mat-list-item, .mat-mdc-list-item, [role='menuitem']", ["murojaat yaratish"], 30);
      await sleep(1400);
      // Menyu bosilmasa — to'g'ridan-to'g'ri URL bilan ochamiz (ishonchli zaxira)
      if (!location.href.includes("/cases/create")) {
        note.textContent = "To'g'ridan-to'g'ri ochilmoqda…";
        location.assign("https://cabinet.sud.uz/cases/create");
        return; // sahifa qayta yuklanadi — panel qayta chiqadi, «Avtomatik»ni yana bosing
      }
      await sleep(700);
    }

    // 1) Tur sahifasi (/cases/create): iqtisodiy + birinchi instansiya + da'vo tartibida
    if (/\/cases\/create\/?$/.test(location.pathname)) {
      note.textContent = "1-bosqich: sud turi, instansiya, murojaat turi…";
      selectRadio(["iqtisodiy"]);
      await sleep(450);
      clickByText("button, .mat-tab-label, .mdc-tab, div, a", ["birinchi instantsiya", "birinchi instansiya"], 30);
      await sleep(550);
      await selectDropdown(["da'vo tartibida", "da`vo tartibida", "arizasi", "da'vo", "da`vo"]);
      await sleep(450);
      const before = location.pathname;
      clickForward();
      // URL o'zgarishini kutamiz (5s gacha)
      for (let i = 0; i < 25 && location.pathname === before; i++) await sleep(200);
      await sleep(600);
    }

    // 2) Da'vo tafsilotlari (/economic/suit yoki /decree): ko'p ICHKI bo'lim,
    //    URL o'zgarmaydi. Har bo'limni to'ldirib «Keyingi» bosamiz; sahifa
    //    imzosi (signature) o'zgarmasa — to'xtaymiz (validatsiya yoki oxir).
    if (location.pathname.includes("/economic/")) {
      for (let sub = 1; sub <= 8; sub++) {
        note.textContent = "Da'vo — bo'lim " + sub + " to'ldirilmoqda…";
        await fillCurrentSuitSection(c);
        await sleep(500);
        closeOverlays(); // ochiq ochilmalar «Keyingi»ni to'smasin
        await sleep(400);
        const sig = pageSig();
        if (!clickForward()) { note.textContent = "Bo'lim " + sub + " to'ldirildi — «Keyingi» topilmadi. Tekshiring."; return; }
        // sahifa/bo'lim o'zgarishini kutamiz
        for (let i = 0; i < 12 && pageSig() === sig; i++) await sleep(200);
        await sleep(900);
        if (pageSig() === sig) {
          const pg = norm(document.body.textContent);
          if (pg.includes("robot emasman") || pg.includes("javobgar tomon")) {
            note.textContent = "Javobgar: STIR kiritildi. «Robot emasman»ni belgilang + «Qidirish» bosing (STIR to'g'ri bo'lsin), so'ng «🚀 Avtomatik»ni qayta bosing.";
          } else {
            note.textContent = "Bo'lim " + sub + "da to'xtadi (majburiy maydon?). Tekshiring / «🔍 Diagnostika».";
          }
          return;
        }
      }
      note.textContent = "Da'vo bo'limlari to'ldirildi: " + location.pathname + ". Tekshiring.";
      return;
    }

    // Boshqa sahifalar — tanigan matn maydonlarini to'ldiramiz, so'ng to'xtaymiz.
    if (location.pathname !== "/cases/create" && location.href.includes("/cases/create")) {
      const n = fillText(c);
      note.textContent = "Keyingi sahifa: " + location.pathname + " (" + n + " ta maydon). «🔍 Diagnostika» bosing.";
      return;
    }

    note.textContent = "To'xtadi: " + location.pathname + ". «🔍 Diagnostika» bosing.";
  }

  // ── Joylashuv (placeholder/yorliq) bo'yicha matn maydonini to'ldirish ──
  function setFieldByPlaceholder(keys: string[], value: string): boolean {
    if (!value) return false;
    const f = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea")).find((i) => {
      const type = ((i as HTMLInputElement).getAttribute("type") || "text").toLowerCase();
      if (["hidden", "checkbox", "radio", "date", "file", "submit", "button"].includes(type)) return false;
      if (i.value || (i as HTMLInputElement).disabled || (i as HTMLInputElement).readOnly) return false;
      const hay = norm((i as HTMLInputElement).placeholder) + " " + labelText(i);
      return keys.some((k) => hay.includes(k));
    });
    if (f) { setValue(f, value); return true; }
    return false;
  }

  // ── Maydon qiymatini o'qish (placeholder/yorliq bo'yicha) ──
  function getFieldValue(keys: string[]): string {
    const f = Array.from(document.querySelectorAll<HTMLInputElement>("input, textarea")).find((i) => {
      const hay = norm(i.placeholder) + " " + labelText(i);
      return keys.some((k) => hay.includes(k));
    });
    return f ? f.value : "";
  }

  // ── Sahifa/bo'lim imzosi — oldinga siljish bo'ldimi tekshirish uchun ──
  function pageSig(): string {
    const inps = Array.from(document.querySelectorAll<HTMLInputElement>("input, textarea")).slice(0, 12)
      .map((i) => i.placeholder + "=" + (i.value ? "1" : "0")).join("|");
    const sel = Array.from(document.querySelectorAll<HTMLElement>("mat-select")).map((s) => norm(s.textContent)).join("|");
    return location.pathname + "::" + inps + "::" + sel;
  }

  // ── Joriy ICHKI bo'limni to'ldirish (barcha ma'lum maydonlar; yo'q bo'lsa — no-op) ──
  async function fillCurrentSuitSection(c: CourtClaim): Promise<void> {
    // Sud bo'limi
    await selectDropdown(["тошкент шаҳар", "шаҳар", "toshkent shahar"]); // Viloyat
    await selectDropdown(["1001"]); // Sud nomi
    await selectDropdown(["mas'uliyati cheklangan jamiyat", "jamiyat", "mchj", "polyplast"]); // Da'vogar
    clickRadioExact(["ha"]); // Kichik biznes subyekti = Ha
    // Asosiy ma'lumotlar bo'limi (yorliq bo'yicha — aniq maydon)
    setFieldByPlaceholder(["raqam"], "1"); // Da'vo ariza raqami (raqamli maydon)
    await selectByLabel(["ariza turi"], ["умумий"], true); // Ariza turi = Умумий
    await selectByLabel(["asosiy ish turkumi"], ["1 - oldi-sotdi shartnomasi yuzasidan"], true); // Asosiy ish turkumi
    await sleep(400); // Asosiy tanlangach, Qo'shimcha variantlari (1.1–1.5) yuklanadi
    await selectByLabel(["shimcha ish turkumi"], ["1.5 - boshqalar"], true); // Qo'shimcha (majburiy!)

    // ── Javobgar tomon ma'lumotlari bo'limi ──
    const page = norm(document.body.textContent);
    if (page.includes("javobgar tomon") || page.includes("korxona nomi")) {
      selectRadio(["yuridik shaxs"]); // MCHJ — yuridik shaxs
      await sleep(200);
      // Korxona nomi hali bo'sh bo'lsa — STIR kiritib qidiramiz.
      // («Robot emasman» bot-himoyasini FOYDALANUVCHI belgilaydi; men bosmayman.)
      if (!getFieldValue(["korxona nomi"])) {
        setFieldByPlaceholder(["stir", "12345678910"], c.tin || "");
        await sleep(400);
        clickByText("button", ["qidirish"], 15); // robot belgilangan bo'lsa ishlaydi
        await sleep(1800);
      }
      // Korxona nomi to'lgan bo'lsa (qidiruvdan) — javobgarni qo'shamiz
      if (getFieldValue(["korxona nomi"])) {
        clickByText("button", ["qo'shish", "qo`shish", "qoʻshish", "qoshish"], 15);
        await sleep(700);
      }
    }

    // Valyuta + summalar / matn maydonlari
    await selectDropdown(["сўм", "so'm", "som"]); // Valyuta (summalar bo'limida bo'lsa)
    fillText(c); // Da'vo summasi, Asosiy qarz, Penya…
    await sleep(200);
  }

  function mount(): void {
    if (document.getElementById("lex-court-panel")) return;
    const p = document.createElement("div");
    p.id = "lex-court-panel";
    p.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;width:270px;font-family:system-ui,sans-serif;background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 10px 30px rgba(2,6,23,.18);overflow:hidden";
    p.innerHTML =
      '<div style="background:linear-gradient(135deg,#4f46e5,#6366f1);color:#fff;padding:10px 12px;font-weight:700;font-size:13px">◆ SmartLex — Autopilot</div>' +
      '<div style="padding:10px 12px;font-size:12.5px;line-height:1.5"><b>' + (claim.debtor || "—") + "</b><br>STIR: " + (claim.tin || "—") + "<br>Summa: " + (claim.amount || "—") + "</div>" +
      '<button id="lex-auto" style="width:calc(100% - 20px);margin:0 10px 6px;padding:9px;border:0;border-radius:10px;background:#4f46e5;color:#fff;font-weight:600;cursor:pointer">🚀 Avtomatik (autopilot)</button>' +
      '<button id="lex-step" style="width:calc(100% - 20px);margin:0 10px 6px;padding:8px;border:1px solid #c7d2fe;border-radius:10px;background:#eef2ff;color:#4338ca;font-weight:600;cursor:pointer">Shu bosqichni to\'ldirish</button>' +
      '<button id="lex-diag" style="width:calc(100% - 20px);margin:0 10px 8px;padding:7px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;color:#334155;font-size:11.5px;cursor:pointer">🔍 Diagnostika (tuzilishni ko\'rsatish)</button>' +
      '<div id="lex-note" style="padding:0 12px 10px;font-size:11.5px;color:#64748b"></div>';
    document.documentElement.appendChild(p);
    const note = p.querySelector<HTMLDivElement>("#lex-note")!;
    p.querySelector<HTMLButtonElement>("#lex-auto")!.onclick = () => { autopilot(claim, note); };
    p.querySelector<HTMLButtonElement>("#lex-diag")!.onclick = async () => {
      note.textContent = "Ochilmalar ochilib tekshirilmoqda…";
      const d = await deepDiagnose();
      let ta = document.getElementById("lex-diag-out") as HTMLTextAreaElement | null;
      if (!ta) {
        ta = document.createElement("textarea");
        ta.id = "lex-diag-out";
        ta.style.cssText = "width:calc(100% - 20px);margin:0 10px 10px;height:150px;font-size:9.5px;line-height:1.3;border:1px solid #cbd5e1;border-radius:8px;padding:6px;white-space:pre";
        p.appendChild(ta);
      }
      ta.value = d;
      ta.focus(); ta.select();
      let copied = false;
      try { copied = document.execCommand("copy"); } catch { copied = false; }
      note.textContent = copied ? "✓ Nusxalandi — chatga paste qiling (Cmd+V)" : "Katakdan nusxa oling (Cmd+A, Cmd+C).";
    };
    p.querySelector<HTMLButtonElement>("#lex-step")!.onclick = async () => {
      if (location.pathname.includes("/economic/")) {
        await fillCurrentSuitSection(claim);
        note.textContent = "Shu bo'lim to'ldirildi — tekshiring, so'ng «Keyingi».";
        return;
      }
      selectRadio(["iqtisodiy"]);
      clickByText("button, .mat-tab-label, .mdc-tab, div, a", ["birinchi instantsiya", "birinchi instansiya"], 30);
      await sleep(400);
      await selectDropdown(["da'vo tartibida", "da`vo tartibida", "arizasi", "da'vo", "da`vo"]);
      const n = fillText(claim);
      note.textContent = n > 0 ? n + " ta maydon + tanlovlar to'ldirildi." : "Tanlovlar bajarildi (matn maydoni yo'q).";
    };
  }

  const boot = () => { mount(); new MutationObserver(mount).observe(document.documentElement, { childList: true, subtree: true }); };
  if (document.body) boot(); else document.addEventListener("DOMContentLoaded", boot);
}
