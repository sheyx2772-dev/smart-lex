import { NextResponse } from "next/server";
import { apiServer } from "@/lib/api";

export async function POST(req: Request) {
  const body = await req.text();
  const res = await apiServer("/api/v2/batches/analyze", {
    method: "POST",
    body: body || "{}",
  });
  return NextResponse.json(res);
}
