import { fetchLegalMatters } from "@/app/(app)/legal/matters/actions";
import { LegalMattersClient } from "@/components/legal/legal-matters-client";

export default async function LegalMattersPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const sp = await searchParams;
  const filter = sp.filter ?? "";
  const data = await fetchLegalMatters({ filter, page: 1 });
  return (
    <LegalMattersClient
      initial={data ?? { items: [], total: 0, page: 1, pageSize: 25, pageCount: 1 }}
      initialFilter={filter}
    />
  );
}
