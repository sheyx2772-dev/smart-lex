export interface Amount {
  minor: string;
  formatted: string;
}

export interface ReceivableRow {
  id: string;
  status: string;
  outstanding: Amount;
  penalty: Amount;
  invoiceAmount: Amount;
  currency: string;
  overdueDays: number;
  agingBucket: string;
  riskScore: number;
  invoiceNumber: string;
  issuedAt: string;
  dueDate: string;
  contractorId: string;
  contractorName: string;
  contractorTin: string;
  contractorPhone: string | null;
  contractorEmail: string | null;
  contractNumber: string | null;
  penaltyDailyBps: number;
  reminderCount: number;
}

export interface ReceivableDetail {
  id: string;
  status: string;
  overdueDays: number;
  agingBucket: string;
  riskScore: number;
  currency: string;
  executedStages: string[];
  lastEvaluatedAt: string | null;
  amounts: {
    invoice: Amount;
    paid: Amount;
    outstanding: Amount;
    penalty: Amount;
    total: Amount;
  };
  invoice: { number: string; issuedAt: string; dueDate: string };
  contract: {
    number: string | null;
    signedAt: string | null;
    penaltyDailyBps: number;
    penaltyCapBps: number | null;
    jurisdictionNote: string | null;
  } | null;
  contractor: {
    id: string;
    name: string;
    tin: string;
    legalAddress: string | null;
    bankAccount: string | null;
    bankMfo: string | null;
    phone: string | null;
    email: string | null;
    telegramId: string | null;
  };
  payments: { id: string; amount: Amount; status: string; paidAt: string | null }[];
  reminders: {
    id: string;
    stage: string;
    channel: string;
    status: string;
    address: string;
    body: string;
    paymentLink: string | null;
    sentAt: string | null;
    createdAt: string;
  }[];
  latestDecision: {
    reason: string;
    factors: { label: string; impact: number }[];
    action: string;
    recoveryScore: number;
    createdAt: string;
  } | null;
  promise: {
    type: string;
    amount: Amount;
    dueDate: string;
    status: string;
    offerText: string;
  } | null;
  financing: {
    eligible: boolean;
    band: "low" | "medium" | "not_eligible";
    suggestedDiscountBps: number;
    activeListingId: string | null;
  };
}
