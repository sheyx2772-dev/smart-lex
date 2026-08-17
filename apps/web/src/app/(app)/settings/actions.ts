"use server";

import { revalidatePath } from "next/cache";
import { apiServer } from "@/lib/api";

/** Xavfsizlik: token httpOnly cookie'da, server action ichida qoladi. */

export async function saveProfile(input: { fullName: string; locale: string }) {
  const res = await apiServer("/api/settings/profile", { method: "PUT", body: JSON.stringify(input) });
  revalidatePath("/settings");
  return res;
}

export async function savePassword(input: { currentPassword: string; newPassword: string }) {
  return apiServer("/api/settings/password", { method: "PUT", body: JSON.stringify(input) });
}

export async function setWorkMode(mode: "debt" | "legal") {
  const res = await apiServer("/api/settings/work-mode", { method: "PUT", body: JSON.stringify({ mode }) });
  revalidatePath("/", "layout");
  return res;
}

export async function saveCompany(input: Record<string, unknown>) {
  const res = await apiServer("/api/settings/company", { method: "PUT", body: JSON.stringify(input) });
  revalidatePath("/settings");
  return res;
}

export async function saveCollection(input: { steps: unknown[] }) {
  const res = await apiServer("/api/settings/collection", { method: "PUT", body: JSON.stringify(input) });
  revalidatePath("/settings");
  return res;
}

export async function saveIntegrations(input: Record<string, string>) {
  const res = await apiServer("/api/settings/integrations", { method: "PUT", body: JSON.stringify(input) });
  revalidatePath("/settings");
  return res;
}

export async function connectDidox(input: { pkcs7: string; signatureHex: string }) {
  const res = await apiServer("/api/settings/didox/connect", { method: "POST", body: JSON.stringify(input) });
  revalidatePath("/settings");
  return res;
}

export async function connectDidoxPassword(input: { password: string }) {
  const res = await apiServer("/api/settings/didox/connect-password", { method: "POST", body: JSON.stringify(input) });
  revalidatePath("/settings");
  return res;
}

export async function saveDocTemplates(input: Record<string, string>) {
  const res = await apiServer("/api/settings/doc-templates", { method: "PUT", body: JSON.stringify(input) });
  revalidatePath("/settings");
  return res;
}

export async function createUser(input: { fullName: string; email: string; role: string; password: string }) {
  const res = await apiServer("/api/settings/users", { method: "POST", body: JSON.stringify(input) });
  revalidatePath("/settings");
  return res;
}

export async function updateUser(id: string, input: { role?: string; isActive?: boolean }) {
  const res = await apiServer(`/api/settings/users/${id}`, { method: "PUT", body: JSON.stringify(input) });
  revalidatePath("/settings");
  return res;
}
