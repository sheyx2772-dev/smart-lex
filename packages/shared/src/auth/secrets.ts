import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Tenant sozlamalaridagi maxfiy kalitlar (Click/Payme merchant sirlari, Didox token,
 * Telegram bot token) `tenants.settings` JSONB ustunida saqlanadi — buni ochiq matnda
 * saqlash kiberxavfsizlik ekspertizasida rad etiladi. AES-256-GCM bilan shifrlanadi,
 * kalit SECRETS_ENCRYPTION_KEY env'dan olinadi. Ham API (yozish/o'qish), ham worker/
 * integrations paketi (Didox sinxronizatsiya uchun o'qish) shu bitta joydan foydalanadi.
 */
const ALGO = "aes-256-gcm";
const PREFIX = "enc:v1:";

let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const passphrase = process.env.SECRETS_ENCRYPTION_KEY;
  if (!passphrase) throw new Error("SECRETS_ENCRYPTION_KEY o'rnatilmagan — maxfiy kalitlarni shifrlab/ochib bo'lmaydi");
  cachedKey = scryptSync(passphrase, "lex-secrets-v1", 32);
  return cachedKey;
}

/** Sirni shifrlaydi. Bo'sh qiymat bo'sh qaytadi (majburiy bo'lmagan maydonlar uchun). */
export function encryptSecret(plain: string | undefined | null): string {
  if (!plain) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

/**
 * Shifrlangan qiymatni ochadi. ESKI (hali shifrlanmagan, migratsiyadan oldingi)
 * qiymatlarga ORQAGA MOS — prefiks bo'lmasa o'zgarishsiz qaytaradi, shu bilan
 * production'dagi mavjud sirlar keyingi yangilanishgacha ishlashda davom etadi.
 */
export function decryptSecret(value: string | undefined | null): string {
  if (!value) return "";
  if (!value.startsWith(PREFIX)) return value;
  try {
    const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(":");
    if (!ivB64 || !tagB64 || !dataB64) return "";
    const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return "";
  }
}

export function isEncrypted(value: string | undefined | null): boolean {
  return Boolean(value && value.startsWith(PREFIX));
}
