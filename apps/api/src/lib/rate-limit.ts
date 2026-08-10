/**
 * Login urinishlarini IP+email bo'yicha cheklaydi — parolni "kaba-forta" (brute-force)
 * bilan topishga urinishning oldini oladi. Xotirada (bitta pm2 fork jarayoni — Redis
 * shart emas). Muvaffaqiyatli kirishda hisoblagich tozalanadi.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 15 * 60 * 1000; // 15 daqiqa
const MAX_ATTEMPTS = 5;

const buckets = new Map<string, Bucket>();

export function checkLoginRateLimit(key: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }
  if (b.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count++;
  return { allowed: true };
}

export function resetLoginRateLimit(key: string): void {
  buckets.delete(key);
}

// Eskirgan yozuvlarni vaqti-vaqti bilan tozalash — xotira sizib chiqmasin.
setInterval(
  () => {
    const now = Date.now();
    for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
  },
  5 * 60 * 1000,
).unref();
