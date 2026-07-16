/** Matn HTML'mi (teg bormi). */
export function isHtml(s: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(s);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Summani bold qiladi: "5 000 000,00 UZS" / "… so'm" / "… сум". */
function boldAmounts(line: string): string {
  return line.replace(/(\d[\d\s]*,\d{2}\s*(?:UZS|so'm|сум|сўм))/g, "<strong>$1</strong>");
}

const HEAD_RE = /^[A-ZА-ЯЎҚҒҲ0-9'"№.\-()\s]{5,}$/; // faqat bosh harflar/raqamlar => sarlavha
const KEY_RE = /^(SO'RAYMAN|ПРОШУ|I REQUEST|REQUEST)/i;

/**
 * Generator bergan oddiy matnni (\\n) tahrirlanadigan HTML'ga aylantiradi.
 * Sarlavhalar (BOSH HARFLI qatorlar) va summalar avtomatik BOLD bo'ladi.
 */
export function plainToHtml(plain: string): string {
  if (isHtml(plain)) return plain;
  const lines = plain.split("\n");
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      out.push("<p></p>");
      continue;
    }
    const esc = escapeHtml(line);
    if (HEAD_RE.test(line) && line.trim().length > 4) {
      out.push(`<p><strong>${esc}</strong></p>`);
    } else if (KEY_RE.test(line.trim())) {
      out.push(`<p><strong>${esc}</strong></p>`);
    } else {
      out.push(`<p>${boldAmounts(esc)}</p>`);
    }
  }
  return out.join("");
}

/** Ko'rsatish uchun HTML (agar oddiy matn bo'lsa — HTML'ga o'giradi). */
export function toDisplayHtml(body: string): string {
  return isHtml(body) ? body : plainToHtml(body);
}
