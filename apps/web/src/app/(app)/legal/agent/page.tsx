import { redirect } from "next/navigation";

/** AI agent /legal sahifasiga ko'chirildi (KPI + agent bitta sahifada) — eski havolalar
 * uchun 404 o'rniga qayta yo'naltirish. */
export default function LegalAgentRedirect() {
  redirect("/legal");
}
