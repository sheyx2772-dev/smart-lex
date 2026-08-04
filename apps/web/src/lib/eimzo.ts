/**
 * E-IMZO client-side imzolash.
 *
 * Rasmiy E-IMZO.js (public/eimzo/e-imzo.js + e-imzo-client.js) dinamik yuklanadi va
 * foydalanuvchi kompyuteridagi E-IMZO Client (localhost:64443) bilan ishlaydi.
 * Imzo HAR DOIM foydalanuvchi mashinasida (kalit + PIN) — server hech qachon imzolamaydi.
 *
 * E-IMZO Client o'rnatilmagan/ishlamayotgan bo'lsa — DEMO (mock) imzoga tushadi,
 * shunda oqim brauzerda ko'rsatiladi.
 */

export interface EimzoSignature {
  pkcs7: string;
  signerName: string;
  certSerial: string;
  signedAt: string;
  provider: "eimzo" | "mock";
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyWin = typeof window & { EIMZOClient?: any; CAPIWS?: any };

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = false;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`load failed: ${src}`));
    document.head.appendChild(s);
  });
}

let scriptsPromise: Promise<boolean> | null = null;
/** Rasmiy E-IMZO.js fayllarini yuklaydi (bir marta). */
function loadEimzoScripts(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (!scriptsPromise) {
    scriptsPromise = (async () => {
      try {
        await injectScript("/eimzo/e-imzo.js"); // CAPIWS + Base64
        await injectScript("/eimzo/e-imzo-client.js"); // EIMZOClient
        return Boolean((window as AnyWin).EIMZOClient);
      } catch {
        return false;
      }
    })();
  }
  return scriptsPromise;
}

const p =
  <T,>(fn: (ok: (v: T) => void, fail: (e: unknown, r?: string) => void) => void): Promise<T> =>
    new Promise<T>((resolve, reject) => fn(resolve, (e, r) => reject(new Error(r || (e ? String(e) : "E-IMZO error")))));

/** E-IMZO Client haqiqatan ishlab turibdimi (localhost'da). */
export async function isEimzoAvailable(): Promise<boolean> {
  const loaded = await loadEimzoScripts();
  if (!loaded) return false;
  const C = (window as AnyWin).EIMZOClient;
  try {
    await p<{ major: string; minor: string }>((ok, fail) => C.checkVersion((major: string, minor: string) => ok({ major, minor }), fail));
    return true;
  } catch {
    return false;
  }
}

/**
 * Hujjat matnini imzolaydi. Real E-IMZO Client bor bo'lsa — real PKCS#7, aks holda DEMO.
 * Real Client bor-u imzo bekor qilinsa/xato bo'lsa — xato tashlaydi (UI ko'rsatadi).
 */
export async function signWithEimzo(content: string, signerHint?: string): Promise<EimzoSignature> {
  const loaded = await loadEimzoScripts();
  const C = loaded ? (window as AnyWin).EIMZOClient : null;

  // Client ishlaydimi?
  let clientLive = false;
  if (C) {
    try {
      await p((ok, fail) => C.checkVersion(() => ok(true), fail));
      clientLive = true;
    } catch {
      clientLive = false;
    }
  }

  if (clientLive && C) {
    // ── REAL E-IMZO oqimi ──
    await p((ok, fail) => C.installApiKeys(() => ok(true), fail));
    const items = await p<any[]>((ok, fail) =>
      C.listAllUserKeys(
        (_vo: any, rec: number) => "k" + rec,
        (id: string, vo: any) => ({ id, ...vo }),
        (arr: any[]) => ok(arr),
        fail,
      ),
    );
    if (!items || items.length === 0) throw new Error("E-IMZO: kalit topilmadi");
    const item = items[0]; // prototip: birinchi kalit (real appda tanlov oynasi)
    // EIMZOClient.loadKey vo maydonlarini (type/disk/path/name/alias) TO'G'RIDAN item'dan
    // o'qiydi — {id, vo} qilib o'rab yuborilsa, item.type aniqlanmay, funksiya HECH NARSA
    // qilmay (dialog ochilmay, xato ham bermay) jim qoladi. Shu sabab vo maydonlari item
    // ustiga yoyiladi (spread).
    const keyId = await p<string>((ok, fail) => C.loadKey(item, (id: string) => ok(id), fail));
    const pkcs7 = await p<string>((ok, fail) => C.createPkcs7(keyId, content, null, (s: string) => ok(s), fail));
    return {
      pkcs7,
      signerName: item.CN || item.O || "E-IMZO",
      certSerial: item.serialNumber || item.TIN || "—",
      signedAt: new Date().toISOString(),
      provider: "eimzo",
    };
  }

  // ── DEMO (mock) — E-IMZO Client yo'q ──
  await new Promise((r) => setTimeout(r, 900));
  const enc = typeof btoa === "function" ? btoa(unescape(encodeURIComponent(content.slice(0, 24)))) : content.slice(0, 24);
  return {
    pkcs7: `MOCK.PKCS7.${enc}`,
    signerName: signerHint ? `${signerHint} (DEMO)` : "DEMO imzo",
    certSerial: "6F2A9C4E-DEMO-0001",
    signedAt: new Date().toISOString(),
    provider: "mock",
  };
}

export interface DidoxEimzoSignature {
  pkcs7: string;
  signatureHex: string;
  signerName: string;
  certSerial: string;
  provider: "eimzo" | "mock";
}

export interface EimzoKeyOption {
  /** loadKey/createPkcs7'ga to'g'ridan yuborsa bo'ladigan xom vo obyekti (yoki mock uchun null). */
  raw: any;
  CN: string;
  O: string;
  TIN: string;
  PINFL: string;
  validTo: string;
}

const MOCK_KEY: EimzoKeyOption = { raw: null, CN: "DEMO imzo", O: "", TIN: "", PINFL: "", validTo: "" };

/**
 * Foydalanuvchining barcha E-IMZO kalitlarini (bir nechta bo'lishi mumkin — turli
 * tashkilot/shaxs sertifikatlari) ro'yxat qiladi. Chaqiruvchi (UI) shu ro'yxatdan
 * TANLOV taklif qilishi kerak — birinchisini avtomatik olish noto'g'ri kalit bilan
 * imzolanishiga olib kelishi mumkin.
 */
export async function listEimzoKeys(): Promise<{ keys: EimzoKeyOption[]; provider: "eimzo" | "mock" }> {
  const loaded = await loadEimzoScripts();
  const C = loaded ? (window as AnyWin).EIMZOClient : null;

  let clientLive = false;
  if (C) {
    try {
      await p((ok, fail) => C.checkVersion(() => ok(true), fail));
      clientLive = true;
    } catch {
      clientLive = false;
    }
  }

  if (!clientLive || !C) return { keys: [MOCK_KEY], provider: "mock" };

  await p((ok, fail) => C.installApiKeys(() => ok(true), fail));
  const items = await p<any[]>((ok, fail) =>
    C.listAllUserKeys(
      (_vo: any, rec: number) => "k" + rec,
      (id: string, vo: any) => ({ id, ...vo }),
      (arr: any[]) => ok(arr),
      fail,
    ),
  );
  if (!items || items.length === 0) throw new Error("E-IMZO: kalit topilmadi");
  return {
    provider: "eimzo",
    keys: items.map((it) => ({
      raw: it,
      CN: it.CN || it.O || "Noma'lum",
      O: it.O || "",
      TIN: it.TIN || "",
      PINFL: it.PINFL || "",
      validTo: it.validTo instanceof Date && !isNaN(it.validTo.getTime()) ? it.validTo.toISOString().slice(0, 10) : "",
    })),
  };
}

/**
 * Didox self-service ulanish uchun maxsus imzo — pkcs7_64 BILAN BIRGA signature_hex
 * ham kerak (Didox /v1/dsvs/timestamp shuni talab qiladi). EIMZOClient.createPkcs7
 * faqat pkcs7_64'ni tashqariga beradi, shuning uchun bu yerda pastki darajadagi
 * CAPIWS.callFunction to'g'ridan chaqiriladi (xuddi shu WebSocket protokoli,
 * lekin xom javob — signature_hex ham qaytadi).
 *
 * `key` — listEimzoKeys() natijasidan foydalanuvchi TANLAGAN element (bir nechta
 * kalit bo'lsa, avtomatik birinchisini olish noto'g'ri profil bilan ulanishga
 * olib kelishi mumkin edi).
 */
export async function signTinForDidox(tin: string, key: EimzoKeyOption): Promise<DidoxEimzoSignature> {
  if (key.raw === null) {
    // ── DEMO (mock) — E-IMZO Client yo'q bo'lsa ham oqim strukturasini sinash mumkin ──
    await new Promise((r) => setTimeout(r, 900));
    return {
      pkcs7: "MOCK.PKCS7.DIDOX_DEMO",
      signatureHex: "6d6f636b2d7369676e61747572652d6865782d64656d6f",
      signerName: "DEMO imzo",
      certSerial: "6F2A9C4E-DEMO-0001",
      provider: "mock",
    };
  }

  const loaded = await loadEimzoScripts();
  const C = loaded ? (window as AnyWin).EIMZOClient : null;
  const CW = loaded ? (window as AnyWin & { CAPIWS?: any }).CAPIWS : null;
  if (!C || !CW) throw new Error("E-IMZO Client ishlamayapti");

  // EIMZOClient.loadKey vo maydonlarini (type/disk/path/name/alias) TO'G'RIDAN item'dan
  // o'qiydi — {id, vo} qilib o'rab yuborilsa, item.type aniqlanmay, funksiya HECH NARSA
  // qilmay (dialog ochilmay, xato ham bermay) jim qoladi. Shu sabab listEimzoKeys() vo
  // maydonlarini item ustiga yoygan (spread) holda saqlaydi.
  const keyId = await p<string>((ok, fail) => C.loadKey(key.raw, (id: string) => ok(id), fail));
  const tinB64 = typeof btoa === "function" ? btoa(tin) : Buffer.from(tin).toString("base64");
  const raw = await p<{ pkcs7_64: string; signature_hex: string }>((ok, fail) =>
    CW.callFunction(
      { plugin: "pkcs7", name: "create_pkcs7", arguments: [tinB64, keyId, "no"] },
      (_event: unknown, data: any) => (data?.success ? ok(data) : fail(null, data?.reason)),
      (e: unknown) => fail(e, undefined),
    ),
  );
  return {
    pkcs7: raw.pkcs7_64,
    signatureHex: raw.signature_hex,
    signerName: key.CN || key.O || "E-IMZO",
    certSerial: key.TIN || key.PINFL || "—",
    provider: "eimzo",
  };
}
