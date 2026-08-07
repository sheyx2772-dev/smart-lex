import { CommandCenterCaseDetail } from "@/components/command-center/case-detail";
import { apiServer } from "@/lib/api";

interface CaseDetail {
  case: {
    id: string;
    number: string;
    state: string;
    dsScore: number;
    recoveryProbability: number;
    optimalSettlementPct: number;
    estimatedRecoveryDays: number;
    scoreFactors: { label: string; impact: number }[];
    receivableId: string;
  };
  debtor: { name: string; tin: string } | null;
  debt: { outstandingMinor: string; formatted: string; overdueDays: number; invoiceNumber?: string } | null;
  playbook: {
    strategyType: string;
    currentPhase: number;
    progress: number;
    phases: { phase: number; name: string; durationDays: number; actions: unknown[] }[];
    exitConditions: unknown[];
  } | null;
  events: { eventType: string; detail: Record<string, unknown> | null; createdAt: string | null }[];
  pendingOverrides: unknown[];
}

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await apiServer<CaseDetail>(`/api/command-center/cases/${id}`);
  return <CommandCenterCaseDetail data={res.data ?? null} />;
}
