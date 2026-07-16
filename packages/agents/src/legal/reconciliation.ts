import { format, money } from "@lex/core";
import { type Locale, type Money } from "@lex/shared";

/**
 * Akt-sverka (solishtirma dalolatnoma) generatori.
 *
 * MUHIM: barcha summalar DETERMINISTIK — bu funksiya faqat MATN/JADVAL shakllantiradi,
 * hech qanday moliyaviy hisob-kitob qilmaydi (raqamlar chaqiruvchidan keladi).
 */

export interface ReconEntry {
  date: Date | null;
  docType: "invoice" | "payment";
  docNumber: string;
  debit?: Money; // kreditor foydasiga (invoice)
  credit?: Money; // qarzdor to'lovi (payment)
}

export interface ReconciliationInput {
  locale: Locale;
  creditor: { name: string; tin: string };
  debtor: { name: string; tin: string };
  actNumber: string;
  periodTo: Date;
  openingBalance: Money;
  entries: ReconEntry[];
  currency: string;
}

export interface ReconciliationAct {
  subject: string;
  body: string;
  closingBalanceMinor: string;
}

const L: Record<Locale, {
  subject: (n: string) => string;
  title: (n: string) => string;
  between: (a: string, b: string) => string;
  period: (d: string) => string;
  tinLine: (a: string, b: string) => string;
  header: string;
  opening: (v: string) => string;
  turnover: (d: string, c: string) => string;
  closing: (v: string) => string;
  invoice: string;
  payment: string;
  concl: (debtor: string, v: string) => string;
  signCreditor: string;
  signDebtor: string;
}> = {
  uz: {
    subject: (n) => `Solishtirma dalolatnoma № ${n}`,
    title: (n) => `SOLISHTIRMA DALOLATNOMA (AKT-SVERKA) № ${n}`,
    between: (a, b) => `"${a}" (kreditor) va "${b}" (qarzdor) o'rtasidagi o'zaro hisob-kitoblar bo'yicha`,
    period: (d) => `${d} holatiga`,
    tinLine: (a, b) => `Kreditor STIR: ${a}    Qarzdor STIR: ${b}`,
    header: "Sana        | Hujjat                | Debet            | Kredit",
    opening: (v) => `Boshlang'ich qoldiq (saldo): ${v}`,
    turnover: (d, c) => `Aylanma — Debet: ${d}    Kredit: ${c}`,
    closing: (v) => `Yakuniy qoldiq (saldo): ${v}`,
    invoice: "Hisob-faktura",
    payment: "To'lov",
    concl: (debtor, v) => `Yuqoridagi hisob-kitoblarga ko'ra, "${debtor}" ning qarzdorligi ${v} ni tashkil etadi.`,
    signCreditor: "Kreditor nomidan: _________________ (imzo, sana)",
    signDebtor: "Qarzdor nomidan: _________________ (imzo, sana)",
  },
  ru: {
    subject: (n) => `Акт сверки № ${n}`,
    title: (n) => `АКТ СВЕРКИ ВЗАИМНЫХ РАСЧЁТОВ № ${n}`,
    between: (a, b) => `между "${a}" (кредитор) и "${b}" (должник)`,
    period: (d) => `по состоянию на ${d}`,
    tinLine: (a, b) => `ИНН кредитора: ${a}    ИНН должника: ${b}`,
    header: "Дата        | Документ              | Дебет            | Кредит",
    opening: (v) => `Начальное сальдо: ${v}`,
    turnover: (d, c) => `Обороты — Дебет: ${d}    Кредит: ${c}`,
    closing: (v) => `Конечное сальдо: ${v}`,
    invoice: "Счёт-фактура",
    payment: "Платёж",
    concl: (debtor, v) => `По данным расчётов задолженность "${debtor}" составляет ${v}.`,
    signCreditor: "От кредитора: _________________ (подпись, дата)",
    signDebtor: "От должника: _________________ (подпись, дата)",
  },
  en: {
    subject: (n) => `Reconciliation act No. ${n}`,
    title: (n) => `RECONCILIATION ACT No. ${n}`,
    between: (a, b) => `between "${a}" (creditor) and "${b}" (debtor)`,
    period: (d) => `as of ${d}`,
    tinLine: (a, b) => `Creditor TIN: ${a}    Debtor TIN: ${b}`,
    header: "Date        | Document              | Debit            | Credit",
    opening: (v) => `Opening balance: ${v}`,
    turnover: (d, c) => `Turnover — Debit: ${d}    Credit: ${c}`,
    closing: (v) => `Closing balance: ${v}`,
    invoice: "Invoice",
    payment: "Payment",
    concl: (debtor, v) => `According to the reconciliation, the debt of "${debtor}" amounts to ${v}.`,
    signCreditor: "For the creditor: _________________ (signature, date)",
    signDebtor: "For the debtor: _________________ (signature, date)",
  },
};

const pad = (s: string, n: number) => (s.length >= n ? s : s + " ".repeat(n - s.length));

export function generateReconciliationAct(input: ReconciliationInput): ReconciliationAct {
  const m = L[input.locale];
  const cur = input.currency;
  const dstr = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "—");

  let debitSum = 0n;
  let creditSum = 0n;
  const rows = input.entries.map((e) => {
    const deb = e.debit?.minor ?? 0n;
    const cred = e.credit?.minor ?? 0n;
    debitSum += deb;
    creditSum += cred;
    const label = `${e.docType === "invoice" ? m.invoice : m.payment} ${e.docNumber}`;
    return `${pad(dstr(e.date), 11)} | ${pad(label, 21)} | ${pad(deb ? format(money(deb, cur)) : "", 16)} | ${cred ? format(money(cred, cur)) : ""}`;
  });

  const closing = input.openingBalance.minor + debitSum - creditSum;

  const lines = [
    m.title(input.actNumber),
    m.between(input.creditor.name, input.debtor.name),
    m.period(dstr(input.periodTo)),
    m.tinLine(input.creditor.tin, input.debtor.tin),
    "",
    m.opening(format(input.openingBalance)),
    "",
    m.header,
    "—".repeat(70),
    ...rows,
    "—".repeat(70),
    m.turnover(format(money(debitSum, cur)), format(money(creditSum, cur))),
    m.closing(format(money(closing, cur))),
    "",
    m.concl(input.debtor.name, format(money(closing < 0n ? 0n : closing, cur))),
    "",
    m.signCreditor,
    m.signDebtor,
  ];

  return {
    subject: m.subject(input.actNumber),
    body: lines.join("\n"),
    closingBalanceMinor: closing.toString(),
  };
}
