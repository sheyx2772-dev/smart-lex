"use server";

import { revalidatePath } from "next/cache";
import { apiServer } from "@/lib/api";

export async function createTask(input: { action: string; title: string; receivableId?: string; deadline?: string }) {
  const res = await apiServer("/api/agent/tasks", { method: "POST", body: JSON.stringify(input) });
  if (res.success) revalidatePath("/agent/tasks");
  return res;
}

export async function runTask(id: string) {
  const res = await apiServer(`/api/agent/tasks/${id}/run`, { method: "POST" });
  if (res.success) revalidatePath("/agent/tasks");
  return res;
}
