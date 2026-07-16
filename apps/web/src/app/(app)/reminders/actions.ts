"use server";

import type { RemindersData } from "@/components/reminders/reminders-client";
import { apiServer } from "@/lib/api";

export async function fetchReminders(params: {
  page: number;
  channel: string;
  status: string;
  q: string;
}): Promise<RemindersData | null> {
  const sp = new URLSearchParams({ page: String(params.page) });
  if (params.channel && params.channel !== "all") sp.set("channel", params.channel);
  if (params.status && params.status !== "all") sp.set("status", params.status);
  if (params.q.trim()) sp.set("q", params.q.trim());
  const res = await apiServer<RemindersData>(`/api/reminders?${sp.toString()}`);
  return res.data ?? null;
}
