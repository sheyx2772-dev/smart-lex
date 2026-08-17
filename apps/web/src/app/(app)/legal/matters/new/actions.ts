"use server";

import { apiServer } from "@/lib/api";

export async function createMatterManual(input: { title: string; type: string; contractorName: string }): Promise<{ id: string } | null> {
  const res = await apiServer<{ id: string }>("/api/legal/matters", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data ?? null;
}
