import { AgentAutopilot, type AutopilotData } from "@/components/agent/agent-autopilot";
import { AgentChat } from "@/components/agent/agent-chat";
import { apiServer } from "@/lib/api";

// Lex AI Agent — avtonom undiruv (autopilot: qaror + jonli tasma) + suhbat (tool-calling).
export default async function AgentPage() {
  const res = await apiServer<AutopilotData>("/api/agent/autopilot");
  return (
    <div className="space-y-6">
      <AgentAutopilot initial={res.data ?? null} />
      <AgentChat />
    </div>
  );
}
