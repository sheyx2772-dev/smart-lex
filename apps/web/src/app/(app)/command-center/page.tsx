import { CommandCenter, type CommandCenterData } from "@/components/command-center/command-center";
import { apiServer } from "@/lib/api";

export default async function CommandCenterPage() {
  const res = await apiServer<CommandCenterData>("/api/command-center");
  return <CommandCenter initial={res.data ?? null} />;
}
