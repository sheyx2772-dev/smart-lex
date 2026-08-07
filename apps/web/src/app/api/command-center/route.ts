import { NextResponse } from "next/server";
import { apiServer } from "@/lib/api";

export async function GET() {
  const res = await apiServer("/api/command-center");
  return NextResponse.json(res);
}
