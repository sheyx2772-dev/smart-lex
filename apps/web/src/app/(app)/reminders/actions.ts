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

export interface SendReminderResult {
  status: "sent" | "failed";
  channel?: string;
  address?: string;
  simulated?: boolean;
  preview?: string;
  error?: string | null;
}

/** Qo'lda eslatma (SMS) yuborish — tanlangan qarzdorga. */
export async function sendReminder(receivableId: string, stage: "soft_reminder" | "firm_reminder"): Promise<SendReminderResult> {
  const res = await apiServer<SendReminderResult>("/api/reminders/send", {
    method: "POST",
    body: JSON.stringify({ receivableId, stage }),
  });
  return res.data ?? { status: "failed", error: "network" };
}

export interface ChannelStatus {
  sms: boolean;
  email: boolean;
  telegram: boolean;
  hybrid_post: boolean;
}

/** Har bir kanal HAQIQATAN ulanganmi (real) yoki simulyatsiya rejimida. */
export async function fetchChannelStatus(): Promise<ChannelStatus> {
  const res = await apiServer<ChannelStatus>("/api/reminders/channel-status");
  return res.data ?? { sms: false, email: false, telegram: false, hybrid_post: false };
}
