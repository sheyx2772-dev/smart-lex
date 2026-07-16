import { DocumentsClient, type DocumentsData } from "@/components/documents/documents-client";
import { apiServer } from "@/lib/api";

export default async function DocumentsPage() {
  const res = await apiServer<DocumentsData>("/api/documents?page=1");
  return (
    <DocumentsClient
      initial={res.data ?? { items: [], total: 0, page: 1, pageSize: 25, pageCount: 1, byType: {}, allTotal: 0 }}
    />
  );
}
