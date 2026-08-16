import { CompaniesClient, type CompaniesData } from "@/components/companies/companies-client";
import { apiServer } from "@/lib/api";

export default async function CompaniesPage() {
  const [res, meRes] = await Promise.all([
    apiServer<CompaniesData>("/api/companies?page=1"),
    apiServer<{ workMode?: "debt" | "legal" }>("/api/me"),
  ]);
  return (
    <CompaniesClient
      initial={res.data ?? { items: [], total: 0, page: 1, pageSize: 25, pageCount: 1 }}
      workMode={meRes.data?.workMode ?? "debt"}
    />
  );
}
