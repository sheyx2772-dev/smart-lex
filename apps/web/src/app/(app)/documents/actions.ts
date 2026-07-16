"use server";

import { revalidatePath } from "next/cache";
import type { DocDetail, DocumentsData } from "@/components/documents/documents-client";
import { apiServer } from "@/lib/api";

export async function getDocumentDetail(id: string): Promise<DocDetail | null> {
  const res = await apiServer<DocDetail>(`/api/documents/${id}`);
  return res.data ?? null;
}

interface Sig {
  pkcs7: string;
  signerName: string;
  certSerial: string;
  signedAt: string;
  provider: "eimzo" | "mock";
}

export async function signDocument(id: string, signature: Sig) {
  return apiServer(`/api/documents/${id}/sign`, { method: "POST", body: JSON.stringify({ signature }) });
}

export async function syncDidox() {
  const res = await apiServer("/api/integrations/sync", { method: "POST", body: "{}" });
  if (res.success) {
    revalidatePath("/documents");
    revalidatePath("/companies");
    revalidatePath("/");
  }
  return res;
}

export async function fetchDocuments(params: { page: number; type: string; q: string }): Promise<DocumentsData | null> {
  const sp = new URLSearchParams({ page: String(params.page) });
  if (params.type && params.type !== "all") sp.set("type", params.type);
  if (params.q.trim()) sp.set("q", params.q.trim());
  const res = await apiServer<DocumentsData>(`/api/documents?${sp.toString()}`);
  return res.data ?? null;
}
