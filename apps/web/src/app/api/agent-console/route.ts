import { NextResponse } from "next/server";
import { apiServer } from "@/lib/api";

/** AI Agent Konsoli — token server tomonda qoladi. */
export async function GET() {
  const res = await apiServer<unknown>("/api/agent/console");
  return NextResponse.json(res.success ? res.data : { summary: null, items: [] });
}
