import { NextResponse } from "next/server";
import { apiServer } from "@/lib/api";

interface AuditItem {
  id: string;
  actorType: "user" | "ai_agent" | "system";
  actorName: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
}
interface AuditResponse {
  items: AuditItem[];
}

/**
 * AI Agent paneli uchun jonli oqim. Klient buni davriy so'raydi (polling) va
 * yangi yozuvlarni notification qilib chiqaradi. Backend token server tomonda
 * qoladi — brauzer to'g'ridan-to'g'ri API'ga chiqmaydi.
 */
export async function GET() {
  const [feedRes, approvalsRes] = await Promise.all([
    apiServer<AuditResponse>("/api/audit?pageSize=40"),
    apiServer<unknown[]>("/api/approvals?status=pending"),
  ]);

  return NextResponse.json({
    items: feedRes.success ? (feedRes.data?.items ?? []) : [],
    approvals: approvalsRes.success ? (approvalsRes.data ?? []) : [],
  });
}
