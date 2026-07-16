import { AgentConsoleClient, type ConsoleData } from "@/components/agent/agent-console-client";
import { apiServer } from "@/lib/api";

export default async function AgentPage() {
  const res = await apiServer<ConsoleData>("/api/agent/console");
  return <AgentConsoleClient initial={res.data ?? { currency: "UZS", summary: null, items: [] }} />;
}
