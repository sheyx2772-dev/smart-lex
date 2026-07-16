import { CompaniesClient, type CompaniesData } from "@/components/companies/companies-client";
import { apiServer } from "@/lib/api";

export default async function CompaniesPage() {
  const res = await apiServer<CompaniesData>("/api/companies?page=1");
  return <CompaniesClient initial={res.data ?? { items: [], total: 0, page: 1, pageSize: 25, pageCount: 1 }} />;
}
