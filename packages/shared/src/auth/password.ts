import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Parol hash'lash — node:crypto scrypt (tashqi bog'liqliksiz).
 * DIQQAT: faqat server tomonida ishlatiladi (`@lex/shared/auth` subpath orqali;
 * `@lex/shared` asosiy index'idan eksport qilinmaydi — frontend bundle'ga tushmasin).
 * Format: `scrypt$<saltHex>$<hashHex>`.
 */
const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1]!, "hex");
  const expected = Buffer.from(parts[2]!, "hex");
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
