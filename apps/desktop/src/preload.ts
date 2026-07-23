import { contextBridge, ipcRenderer } from "electron";

/**
 * Xavfsiz ko'prik — renderer (UI) faqat shu funksiyalarni ko'radi
 * (contextIsolation yoqilgan, Node to'g'ridan-to'g'ri ochilmaydi).
 */
contextBridge.exposeInMainWorld("smartlex", {
  login: (email: string, password: string) => ipcRenderer.invoke("api:login", { email, password }),
  claims: (token: string) => ipcRenderer.invoke("api:claims", token),
  fillCourt: (claim: unknown) => ipcRenderer.invoke("court:fill", claim),
});
