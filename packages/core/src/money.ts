import { type Currency, DEFAULT_CURRENCY, type Money } from "@lex/shared";

/**
 * Pul matematikasi — HAR DOIM `bigint` (eng kichik birlik: tiyin/sent) bilan.
 * Suzuvchi nuqta ISHLATILMAYDI — moliyaviy aniqlik uchun.
 */

// Currency'ni Currency yoki ixtiyoriy string sifatida qabul qilamiz (DB'dan
// kelgan enum ustunlar `string` deb tiplashi mumkin) — avtomatik tugallash saqlanadi.
type CurrencyInput = Currency | (string & {});

export function money(minor: bigint | number, currency: CurrencyInput = DEFAULT_CURRENCY): Money {
  return { minor: typeof minor === "bigint" ? minor : BigInt(Math.trunc(minor)), currency: currency as Currency };
}

export const zero = (currency: CurrencyInput = DEFAULT_CURRENCY): Money => money(0n, currency);

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { minor: a.minor + b.minor, currency: a.currency };
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { minor: a.minor - b.minor, currency: a.currency };
}

export function isNegative(a: Money): boolean {
  return a.minor < 0n;
}

export function isZero(a: Money): boolean {
  return a.minor === 0n;
}

export function isPositive(a: Money): boolean {
  return a.minor > 0n;
}

/** a > b (bir xil valyuta). */
export function greaterThan(a: Money, b: Money): boolean {
  assertSameCurrency(a, b);
  return a.minor > b.minor;
}

/**
 * Miqdorni basis point (1 bps = 0.01%) bo'yicha ko'paytiradi. Floor yaxlitlash.
 * @example percentBps(money(100_00n), 5) -> 0.05% dan 5 tiyin
 */
export function percentBps(a: Money, bps: number): Money {
  if (!Number.isInteger(bps) || bps < 0) {
    throw new Error(`bps butun va manfiy bo'lmagan bo'lishi kerak: ${bps}`);
  }
  return { minor: (a.minor * BigInt(bps)) / 10_000n, currency: a.currency };
}

/** Ikki miqdordan kichigini qaytaradi (cap uchun). */
export function min(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return a.minor <= b.minor ? a : b;
}

/** Serializatsiya uchun string (JSON bigint'ni qo'llamaydi). */
export function toMinorString(a: Money): string {
  return a.minor.toString();
}

/** Butun so'm/dollar (major) → Money. */
export function fromMajor(major: number, currency: Currency = DEFAULT_CURRENCY, minorUnitScale = 100): Money {
  return { minor: BigInt(Math.round(major * minorUnitScale)), currency };
}

/** Ko'rsatish uchun formatlash: "1 234 567,89 UZS". */
export function format(a: Money, minorUnitScale = 100): string {
  const negative = a.minor < 0n;
  const abs = negative ? -a.minor : a.minor;
  const scale = BigInt(minorUnitScale);
  const majorPart = abs / scale;
  const minorPart = abs % scale;

  const grouped = majorPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const fraction = minorUnitScale > 1 ? "," + minorPart.toString().padStart(2, "0") : "";
  return `${negative ? "-" : ""}${grouped}${fraction} ${a.currency}`;
}
