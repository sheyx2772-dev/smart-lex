"use server";

import { apiServer } from "@/lib/api";

export interface PayableRow {
  id: string;
  number: string;
  amount: string;
  issuedAt: string;
  dueDate: string;
  contractorName: string;
  contractorTin: string;
}
export interface PayablesData {
  items: PayableRow[];
  total: number;
  totalAmount: string;
}

/** Kreditorlik ro'yxati — tenantning boshqaga qarzdorligi (undiruvga kirmaydi). */
export async function fetchPayables(): Promise<PayablesData> {
  const res = await apiServer<PayablesData>("/api/payables");
  return res.data ?? { items: [], total: 0, totalAmount: "" };
}
