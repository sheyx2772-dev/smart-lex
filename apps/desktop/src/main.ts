import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "node:path";
import { fillCourtForm } from "./automation/court";

/** SmartLex API — o'zgartirish uchun env: SMARTLEX_API */
const API = process.env.SMARTLEX_API || "https://api.lexai.com.uz";

let win: BrowserWindow | null = null;

/** fetch — timeout + qayta urinish (transient tarmoq uzilishlariga chidamli). */
async function fetchRetry(url: string, init: RequestInit = {}, tries = 3, timeoutMs = 12000): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: ctrl.signal });
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 700 * (i + 1))); // qisqa kutish, so'ng qayta
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1120,
    height: 780,
    title: "SmartLex Desktop",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, "..", "src", "renderer", "index.html"));
}

app.whenReady().then(createWindow);
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ─── IPC: SmartLex bilan aloqa ──────────────────────────────────────────────
ipcMain.handle("api:login", async (_e, { email, password }: { email: string; password: string }) => {
  try {
    const res = await fetchRetry(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Lang": "uz" },
      body: JSON.stringify({ email, password }),
    });
    return await res.json();
  } catch {
    return { success: false, message: "Serverga ulanib bo'lmadi. Internetni tekshiring va qayta urinib ko'ring." };
  }
});

/** Sudga tayyor da'volar (submitted/queue). Backend'da /api/court mavjud. */
ipcMain.handle("api:claims", async (_e, token: string) => {
  try {
    const res = await fetchRetry(`${API}/api/court`, {
      headers: { Authorization: `Bearer ${token}`, "X-Lang": "uz" },
    });
    return await res.json();
  } catch {
    return { success: false, message: "Serverga ulanib bo'lmadi.", data: { items: [] } };
  }
});

// ─── IPC: Brauzer avtomatlashtirish ────────────────────────────────────────
ipcMain.handle("court:fill", async (_e, claim: Record<string, unknown>) => {
  try {
    const result = await fillCourtForm(claim);
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
});
