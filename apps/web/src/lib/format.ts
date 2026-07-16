/** Kiritish payti pul summasini ming ajratgichlar bilan formatlaydi: "5000000" → "5 000 000". */
export function formatMoneyInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Formatlangan pulni raqamli stringga qaytaradi: "5 000 000" → "5000000". */
export function unformatMoney(value: string): string {
  return value.replace(/\D/g, "");
}

/** O'zbekiston telefon raqamini formatlaydi: → "+998 90 123 45 67". */
export function formatPhoneInput(value: string): string {
  let d = value.replace(/\D/g, "");
  if (d.startsWith("998")) d = d.slice(3);
  d = d.slice(0, 9);
  if (!d) return "";
  let out = "+998";
  if (d.length > 0) out += " " + d.slice(0, 2);
  if (d.length > 2) out += " " + d.slice(2, 5);
  if (d.length > 5) out += " " + d.slice(5, 7);
  if (d.length > 7) out += " " + d.slice(7, 9);
  return out;
}
