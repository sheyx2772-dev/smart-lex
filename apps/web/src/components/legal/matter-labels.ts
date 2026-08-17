import { type BadgeProps } from "@/components/ui/badge";

/** Ish holati/xavf darajasi uchun umumiy belgilar — /legal, /legal/matters va
 * /legal/matters/[id] barchasi shu bitta manbadan foydalanadi. */
export const MATTER_STATUS_LABEL: Record<string, string> = {
  new: "Yangi",
  in_review: "Ko'rib chiqilmoqda",
  in_progress: "Jarayonda",
  waiting_for_approval: "Tasdiq kutilmoqda",
  filed: "Topshirildi",
  in_court: "Sudda",
  decision: "Qaror",
  execution: "Ijroda",
  closed: "Yakunlangan",
};

export const MATTER_RISK_TONE: Record<string, BadgeProps["tone"]> = {
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "success",
};

export const MATTER_TYPE_LABEL: Record<string, string> = {
  contract_review: "Shartnoma tahlili",
  litigation: "Sud ishi",
  consultation: "Konsultatsiya",
  compliance: "Muvofiqlik",
  other: "Boshqa",
};

export const MATTER_PRIORITY_TONE: Record<string, BadgeProps["tone"]> = {
  urgent: "danger",
  high: "warning",
  normal: "neutral",
  low: "secondary",
};

export const MATTER_PRIORITY_LABEL: Record<string, string> = {
  urgent: "Shoshilinch",
  high: "Yuqori",
  normal: "Oddiy",
  low: "Past",
};
