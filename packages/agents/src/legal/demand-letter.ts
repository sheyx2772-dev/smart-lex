import { format } from "@lex/core";
import { type Locale, type Money } from "@lex/shared";
import { generateText } from "ai";
import { getModel } from "../llm";
import { fillTemplate } from "./doc-templates";

/**
 * Talabnoma (sudgacha da'vo/pretenziya) generatori.
 *
 * MUHIM: barcha summalar chaqiruvchi tomonidan DETERMINISTIK hisoblab uzatiladi
 * (core.calcPenalty / core.totalDebt). Bu funksiya faqat MATN shakllantiradi —
 * hech qanday moliyaviy hisob-kitob qilmaydi. LLM (ixtiyoriy) faqat uslubni sayqallaydi,
 * raqamlarga TEGMAYDI.
 */
export interface Party {
  name: string;
  tin: string;
  legalAddress?: string;
  bankAccount?: string;
  bankMfo?: string;
}

export interface DemandLetterInput {
  locale: Locale;
  creditor: Party;
  debtor: Party;
  contractNumber: string;
  contractSignedAt?: Date;
  invoiceNumbers: string[];
  principal: Money;
  penalty: Money;
  total: Money;
  overdueDays: number;
  /** Javob berish/to'lash muddati (kun). */
  responseDeadlineDays: number;
  /** Imzolovchi rahbar (hujjat oxirida ko'rsatiladi). */
  signatory?: { name: string; position: string };
}

export interface DemandLetter {
  subject: string;
  body: string;
  generatedBy: "template" | "llm";
}

const L = {
  uz: {
    subject: (n: string) => `${n}-shartnoma bo'yicha qarzni to'lash to'g'risida TALABNOMA`,
    intro: (c: string, d: string) =>
      `Hurmatli ${d}!\n\n"${c}" (kreditor) Siz bilan tuzilgan shartnoma bo'yicha zimmangizda muddati o'tgan qarzdorlik yuzaga kelganini ma'lum qiladi.`,
    contract: (n: string, date: string) => `Shartnoma: № ${n}${date ? `, ${date} sanadagi` : ""}.`,
    invoices: (list: string) => `Hisob-fakturalar: ${list}.`,
    principal: (v: string) => `Asosiy qarz: ${v}.`,
    penalty: (v: string, days: number) => `Penya (${days} kun uchun): ${v}.`,
    total: (v: string) => `Jami to'lanishi lozim: ${v}.`,
    demand: (days: number) =>
      `Yuqoridagi qarzni ushbu talabnoma olingan kundan boshlab ${days} (kalendar) kun ichida to'liq to'lashingizni talab qilamiz.`,
    warning:
      "Belgilangan muddatda to'lov amalga oshirilmagan taqdirda, kreditor O'zbekiston Respublikasi qonunchiligiga muvofiq qarzni majburiy undirish yuzasidan iqtisodiy sudga da'vo arizasi bilan murojaat qilish huquqini o'zida saqlab qoladi. Bunda davlat boji va sud xarajatlari ham javobgar zimmasiga yuklatiladi.",
    legal:
      "Asos: O'zbekiston Respublikasi Fuqarolik kodeksining majburiyatlarni lozim darajada bajarish to'g'risidagi normalari hamda tomonlar o'rtasidagi shartnoma shartlari.",
    footer: (c: string) => `Hurmat bilan,\n${c}`,
    requisites: (acc?: string, mfo?: string) =>
      acc ? `To'lov rekvizitlari: h/r ${acc}${mfo ? `, MFO ${mfo}` : ""}.` : "",
  },
  ru: {
    subject: (n: string) => `ПРЕТЕНЗИЯ об оплате задолженности по договору № ${n}`,
    intro: (c: string, d: string) =>
      `Уважаемый(ая) ${d}!\n\n"${c}" (кредитор) уведомляет о наличии просроченной задолженности по заключённому с Вами договору.`,
    contract: (n: string, date: string) => `Договор: № ${n}${date ? ` от ${date}` : ""}.`,
    invoices: (list: string) => `Счета-фактуры: ${list}.`,
    principal: (v: string) => `Основной долг: ${v}.`,
    penalty: (v: string, days: number) => `Пеня (за ${days} дн.): ${v}.`,
    total: (v: string) => `Итого к оплате: ${v}.`,
    demand: (days: number) =>
      `Требуем полностью погасить указанную задолженность в течение ${days} (календарных) дней с даты получения настоящей претензии.`,
    warning:
      "В случае неоплаты в установленный срок кредитор оставляет за собой право обратиться в экономический суд с исковым заявлением о принудительном взыскании задолженности в соответствии с законодательством Республики Узбекистан. Государственная пошлина и судебные расходы будут возложены на ответчика.",
    legal:
      "Основание: нормы Гражданского кодекса Республики Узбекистан о надлежащем исполнении обязательств, а также условия договора между сторонами.",
    footer: (c: string) => `С уважением,\n${c}`,
    requisites: (acc?: string, mfo?: string) =>
      acc ? `Платёжные реквизиты: р/с ${acc}${mfo ? `, МФО ${mfo}` : ""}.` : "",
  },
  en: {
    subject: (n: string) => `DEMAND LETTER for payment of debt under contract No. ${n}`,
    intro: (c: string, d: string) =>
      `Dear ${d},\n\n"${c}" (the creditor) hereby notifies you of an overdue debt arising under the contract concluded with you.`,
    contract: (n: string, date: string) => `Contract: No. ${n}${date ? ` dated ${date}` : ""}.`,
    invoices: (list: string) => `Invoices: ${list}.`,
    principal: (v: string) => `Principal debt: ${v}.`,
    penalty: (v: string, days: number) => `Penalty (for ${days} days): ${v}.`,
    total: (v: string) => `Total payable: ${v}.`,
    demand: (days: number) =>
      `We demand full repayment of the above debt within ${days} calendar days from receipt of this letter.`,
    warning:
      "If payment is not made within the stated period, the creditor reserves the right to file a claim with the economic court for compulsory recovery of the debt under the legislation of the Republic of Uzbekistan. State duty and court costs will be charged to the defendant.",
    legal:
      "Basis: the provisions of the Civil Code of the Republic of Uzbekistan on proper performance of obligations, and the terms of the contract between the parties.",
    footer: (c: string) => `Respectfully,\n${c}`,
    requisites: (acc?: string, mfo?: string) =>
      acc ? `Payment details: acc. ${acc}${mfo ? `, MFO ${mfo}` : ""}.` : "",
  },
};

/** Deterministik talabnoma matni (raqamlar allaqachon hisoblangan). */
export function generateDemandLetter(input: DemandLetterInput): DemandLetter {
  const m = L[input.locale];
  const dateStr = input.contractSignedAt
    ? input.contractSignedAt.toISOString().slice(0, 10)
    : "";

  const lines = [
    m.intro(input.creditor.name, input.debtor.name),
    "",
    m.contract(input.contractNumber, dateStr),
    m.invoices(input.invoiceNumbers.join(", ")),
    "",
    m.principal(format(input.principal)),
    m.penalty(format(input.penalty), input.overdueDays),
    m.total(format(input.total)),
    "",
    m.demand(input.responseDeadlineDays),
    m.requisites(input.creditor.bankAccount, input.creditor.bankMfo),
    "",
    m.warning,
    m.legal,
    "",
    m.footer(input.creditor.name),
    ...(input.signatory ? [`${input.signatory.position} ${input.signatory.name}`.trim(), "_______________ (imzo)"] : []),
  ].filter((line) => line !== undefined);

  return {
    subject: m.subject(input.contractNumber),
    body: lines.join("\n"),
    generatedBy: "template",
  };
}

const STYLE_SYSTEM: Record<Locale, string> = {
  uz: "Sen O'zbekiston yuridik hujjatlari bo'yicha tajribali yuristsan. Berilgan TALABNOMA qoralamasini yanada rasmiy, ishonarli va professional o'zbek tilida qayta yoz. QAT'IY QOIDA: barcha raqamlar, summalar, sanalar, ismlar, shartnoma va hisob-faktura raqamlarini AYNAN saqlab qol — bittasini ham o'zgartirma, yangi fakt yoki qonun moddasi qo'shma. Faqat uslub va so'z tuzilishini yaxshila. Faqat tayyor matnni qaytar, izoh yozma.",
  ru: "Ты опытный юрист по документам Узбекистана. Перепиши черновик ПРЕТЕНЗИИ более официальным и профессиональным языком. СТРОГО: сохрани все числа, суммы, даты, имена, номера договоров и счетов ТОЧНО — ничего не меняй и не добавляй новых фактов. Только улучши стиль. Верни только текст.",
  en: "You are an experienced legal specialist for Uzbekistan. Rewrite the DEMAND LETTER draft in more formal, professional language. STRICT: keep every number, amount, date, name, contract and invoice number EXACTLY — change nothing, invent no facts. Improve only the wording. Return only the text.",
};

/**
 * LLM bilan sayqallangan talabnoma. Raqamlar template'dan (DETERMINISTIK) keladi,
 * LLM faqat uslubni yaxshilaydi. Kalit yo'q/xato bo'lsa template'ga qaytadi.
 */
function fromCustom(input: DemandLetterInput, template: string): DemandLetter {
  const base = generateDemandLetter(input);
  const vars: Record<string, string> = {
    kreditor: input.creditor.name,
    qarzdor: input.debtor.name,
    shartnoma: input.contractNumber,
    fakturalar: input.invoiceNumbers.join(", "),
    asosiy_qarz: format(input.principal),
    penya: format(input.penalty),
    jami: format(input.total),
    kun: String(input.overdueDays),
    muddat: String(input.responseDeadlineDays),
    imzolovchi: input.signatory ? `${input.signatory.position} ${input.signatory.name}`.trim() : "",
  };
  return { subject: base.subject, body: fillTemplate(template, vars), generatedBy: "template" };
}

export async function generateDemandLetterSmart(input: DemandLetterInput, customTemplate?: string): Promise<DemandLetter> {
  if (customTemplate && customTemplate.trim()) return fromCustom(input, customTemplate);
  const base = generateDemandLetter(input);
  const model = getModel();
  if (!model) return base;
  try {
    const { text } = await generateText({ model, system: STYLE_SYSTEM[input.locale], prompt: base.body });
    const polished = text.trim();
    if (polished.length < 50) return base; // shubhali natija — template
    return { subject: base.subject, body: polished, generatedBy: "llm" };
  } catch {
    return base;
  }
}
