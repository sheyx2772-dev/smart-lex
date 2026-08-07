import { NextResponse } from "next/server";
import { apiServer } from "@/lib/api";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await _req.json();
  const res = await apiServer(`/api/command-center/overrides/${id}/decide`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return NextResponse.json(res);
}
