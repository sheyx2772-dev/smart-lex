import { notFound } from "next/navigation";
import { fetchMatterDetail } from "@/app/(app)/legal/matters/[id]/actions";
import { MatterWorkspaceClient } from "@/components/legal/matter-workspace-client";

export default async function MatterWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await fetchMatterDetail(id);
  if (!data) notFound();
  return <MatterWorkspaceClient data={data} />;
}
