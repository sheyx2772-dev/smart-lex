import { NextResponse } from "next/server";
import { apiServer } from "@/lib/api";

/** Agentni ishga tushirish — barcha debitorliklarni qayta baholaydi. */
export async function POST() {
  const res = await apiServer<unknown>("/api/agent/run", { method: "POST" });
  return NextResponse.json(res.success ? { ok: true, ...(res.data as object) } : { ok: false });
}
