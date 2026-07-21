import { format } from "@lex/core";
import { type Locale, type Money } from "@lex/shared";
import { generateText } from "ai";
import { getModel } from "../llm";
import { fillDocTemplate } from "./doc-templates";

/**
 * Da'vo arizasi (iqtisodiy sud) generatori.
 *
 * MUHIM: barcha summalar (asosiy qarz, penya, davlat boji) DETERMINISTIK hisoblanadi
 * (core.calcPenalty / core.calcStateDuty). Bu funksiya faqat MATN shakllantiradi.
 * LLM (ixtiyoriy) faqat uslubni sayqallaydi — raqamlar/moddalarga TEGMAYDI.
 */

export interface LawsuitInput {
  locale: Locale;
  court: string;
  plaintiff: { name: string; tin: string; address?: string; bankAccount?: string; bankMfo?: string };
  defendant: { name: string; tin: string; address?: string };
  contractNumbers: string[];
  invoiceNumbers: string[];
  principal: Money;
  penalty: Money;
  total: Money;
  stateDuty: Money;
  overdueDays: number;
  signatory?: { name: string; position: string };
}

export interface Lawsuit {
  subject: string;
  body: string;
  generatedBy: "template" | "llm";
}

const L: Record<Locale, {
  subject: string;
  toCourt: (c: string) => string;
  plaintiff: (n: string, t: string, a?: string) => string;
  defendant: (n: string, t: string, a?: string) => string;
  claimPrice: (v: string) => string;
  duty: (v: string) => string;
  title: string;
  facts: (contracts: string, invoices: string, principal: string, days: number, penalty: string) => string;
  legal: string;
  petitionHead: string;
  pRecover: (total: string, principal: string, penalty: string) => string;
  pDuty: (v: string) => string;
  attachmentsHead: string;
  attachments: (contracts: string, invoices: string) => string[];
  sign: (n: string) => string;
}> = {
  uz: {
    subject: "Da'vo arizasi",
    toCourt: (c) => `${c}ga`,
    plaintiff: (n, t, a) => `Da'vogar: "${n}", STIR: ${t}${a ? `, manzil: ${a}` : ""}`,
    defendant: (n, t, a) => `Javobgar: "${n}", STIR: ${t}${a ? `, manzil: ${a}` : ""}`,
    claimPrice: (v) => `Da'vo narxi: ${v}`,
    duty: (v) => `To'langan davlat boji: ${v}`,
    title: "DA'VO ARIZASI\n(qarzdorlikni majburiy undirish to'g'risida)",
    facts: (contracts, invoices, principal, days, penalty) =>
      `Da'vogar va javobgar o'rtasida ${contracts} shartnoma(lar) tuzilgan. Ushbu shartnoma(lar) asosida ${invoices} hisob-faktura(lar) bo'yicha javobgar zimmasiga to'lov majburiyati yuklatilgan.\n\nJavobgar to'lov majburiyatini belgilangan muddatda bajarmagan. Asosiy qarz ${principal} ni tashkil etadi. To'lov muddati ${days} kun o'tgan bo'lib, shartnoma shartlariga muvofiq hisoblangan penya ${penalty} ni tashkil etadi.\n\nDa'vogar tomonidan sudgacha nizoni hal qilish tartibida talabnoma yuborilgan, biroq qarz to'lanmagan.`,
    legal:
      "Huquqiy asos: O'zbekiston Respublikasi Fuqarolik kodeksining majburiyatlarni lozim darajada bajarish, javobgarlik va penya to'g'risidagi normalari hamda Iqtisodiy protsessual kodeksi.",
    petitionHead: "Yuqoridagilarga asoslanib, SO'RAYMAN:",
    pRecover: (total, principal, penalty) =>
      `Javobgardan da'vogar foydasiga jami ${total} (shu jumladan asosiy qarz ${principal} va penya ${penalty}) undirilsin.`,
    pDuty: (v) => `To'langan davlat boji ${v} javobgar zimmasiga yuklatilsin.`,
    attachmentsHead: "Ilovalar:",
    attachments: (contracts, invoices) => [
      `1. Shartnoma(lar) nusxasi: ${contracts}`,
      `2. Hisob-faktura(lar): ${invoices}`,
      "3. Qarz hisob-kitobi",
      "4. Talabnoma va yuborilganlik dalili",
      "5. Davlat boji to'langanligi to'g'risidagi hujjat",
    ],
    sign: (n) => `Da'vogar nomidan: ${n}\n_________________ (imzo, sana)`,
  },
  ru: {
    subject: "Исковое заявление",
    toCourt: (c) => `В ${c}`,
    plaintiff: (n, t, a) => `Истец: "${n}", ИНН: ${t}${a ? `, адрес: ${a}` : ""}`,
    defendant: (n, t, a) => `Ответчик: "${n}", ИНН: ${t}${a ? `, адрес: ${a}` : ""}`,
    claimPrice: (v) => `Цена иска: ${v}`,
    duty: (v) => `Уплаченная госпошлина: ${v}`,
    title: "ИСКОВОЕ ЗАЯВЛЕНИЕ\n(о принудительном взыскании задолженности)",
    facts: (contracts, invoices, principal, days, penalty) =>
      `Между истцом и ответчиком заключён(ы) договор(ы) ${contracts}. На основании ${invoices} у ответчика возникло обязательство по оплате.\n\nОтветчик не исполнил обязательство в срок. Основной долг составляет ${principal}. Просрочка составляет ${days} дн., начисленная пеня — ${penalty}.\n\nИстцом направлена досудебная претензия, однако долг не погашен.`,
    legal:
      "Правовое основание: нормы Гражданского кодекса Республики Узбекистан о надлежащем исполнении обязательств, ответственности и пене, а также Экономический процессуальный кодекс.",
    petitionHead: "На основании изложенного, ПРОШУ:",
    pRecover: (total, principal, penalty) =>
      `Взыскать с ответчика в пользу истца всего ${total} (в т.ч. основной долг ${principal} и пеню ${penalty}).`,
    pDuty: (v) => `Отнести уплаченную госпошлину ${v} на ответчика.`,
    attachmentsHead: "Приложения:",
    attachments: (contracts, invoices) => [
      `1. Копия договора(ов): ${contracts}`,
      `2. Счета-фактуры: ${invoices}`,
      "3. Расчёт задолженности",
      "4. Претензия и доказательство отправки",
      "5. Документ об уплате госпошлины",
    ],
    sign: (n) => `От истца: ${n}\n_________________ (подпись, дата)`,
  },
  en: {
    subject: "Statement of claim",
    toCourt: (c) => `To the ${c}`,
    plaintiff: (n, t, a) => `Plaintiff: "${n}", TIN: ${t}${a ? `, address: ${a}` : ""}`,
    defendant: (n, t, a) => `Defendant: "${n}", TIN: ${t}${a ? `, address: ${a}` : ""}`,
    claimPrice: (v) => `Claim value: ${v}`,
    duty: (v) => `State duty paid: ${v}`,
    title: "STATEMENT OF CLAIM\n(for compulsory debt recovery)",
    facts: (contracts, invoices, principal, days, penalty) =>
      `The plaintiff and defendant concluded contract(s) ${contracts}. Under ${invoices} the defendant became obligated to pay.\n\nThe defendant failed to pay on time. The principal debt is ${principal}. The delay is ${days} days, and the accrued penalty is ${penalty}.\n\nThe plaintiff sent a pre-trial demand letter, but the debt remains unpaid.`,
    legal:
      "Legal basis: provisions of the Civil Code of the Republic of Uzbekistan on proper performance of obligations, liability and penalty, and the Economic Procedural Code.",
    petitionHead: "Based on the above, I REQUEST:",
    pRecover: (total, principal, penalty) =>
      `Recover from the defendant in favour of the plaintiff a total of ${total} (including principal ${principal} and penalty ${penalty}).`,
    pDuty: (v) => `Charge the paid state duty ${v} to the defendant.`,
    attachmentsHead: "Attachments:",
    attachments: (contracts, invoices) => [
      `1. Copy of contract(s): ${contracts}`,
      `2. Invoices: ${invoices}`,
      "3. Debt calculation",
      "4. Demand letter and proof of delivery",
      "5. Proof of state duty payment",
    ],
    sign: (n) => `For the plaintiff: ${n}\n_________________ (signature, date)`,
  },
};

export function generateLawsuit(input: LawsuitInput): Lawsuit {
  const m = L[input.locale];
  const contracts = input.contractNumbers.join(", ") || "—";
  const invoices = input.invoiceNumbers.join(", ") || "—";

  const lines = [
    m.toCourt(input.court),
    "",
    m.plaintiff(input.plaintiff.name, input.plaintiff.tin, input.plaintiff.address),
    m.defendant(input.defendant.name, input.defendant.tin, input.defendant.address),
    m.claimPrice(format(input.total)),
    m.duty(format(input.stateDuty)),
    "",
    m.title,
    "",
    m.facts(contracts, invoices, format(input.principal), input.overdueDays, format(input.penalty)),
    "",
    m.legal,
    "",
    m.petitionHead,
    m.pRecover(format(input.total), format(input.principal), format(input.penalty)),
    m.pDuty(format(input.stateDuty)),
    "",
    m.attachmentsHead,
    ...m.attachments(contracts, invoices),
    "",
    m.sign(input.signatory ? `${input.signatory.position} ${input.signatory.name}`.trim() : input.plaintiff.name),
  ];

  return { subject: m.subject, body: lines.join("\n"), generatedBy: "template" };
}

const STYLE_SYSTEM: Record<Locale, string> = {
  uz: "Sen O'zbekiston iqtisodiy sudlari bo'yicha tajribali yuristsan. Berilgan DA'VO ARIZASI qoralamasini yanada rasmiy, aniq va protsessual jihatdan to'g'ri o'zbek tilida qayta yoz. QAT'IY QOIDA: barcha raqamlar, summalar, sanalar, STIRlar, ismlar, shartnoma/faktura raqamlari va sud nomini AYNAN saqlab qol — o'zgartirma, yangi fakt yoki qonun moddasi qo'shma. Faqat matnni sayqalla. Faqat tayyor matnni qaytar.",
  ru: "Ты опытный юрист по экономическим судам Узбекистана. Перепиши черновик ИСКОВОГО ЗАЯВЛЕНИЯ более официально и процессуально корректно. СТРОГО: сохрани все числа, суммы, даты, ИНН, имена, номера договоров/счетов и название суда ТОЧНО. Только улучши стиль. Верни только текст.",
  en: "You are an experienced litigator for Uzbekistan's economic courts. Rewrite the STATEMENT OF CLAIM draft more formally and procedurally correctly. STRICT: keep all numbers, amounts, dates, TINs, names, contract/invoice numbers and the court name EXACTLY. Improve only the wording. Return only the text.",
};

function fromCustomLawsuit(input: LawsuitInput, template: string): Lawsuit {
  const base = generateLawsuit(input);
  const vars: Record<string, string> = {
    sud: input.court,
    davogar: input.plaintiff.name,
    davogar_stir: input.plaintiff.tin,
    javobgar: input.defendant.name,
    javobgar_stir: input.defendant.tin,
    javobgar_manzil: input.defendant.address ?? "—",
    shartnoma: input.contractNumbers.join(", ") || "—",
    fakturalar: input.invoiceNumbers.join(", ") || "—",
    asosiy_qarz: format(input.principal),
    penya: format(input.penalty),
    jami: format(input.total),
    davlat_boji: format(input.stateDuty),
    kun: String(input.overdueDays),
    imzolovchi: input.signatory ? `${input.signatory.position} ${input.signatory.name}`.trim() : input.plaintiff.name,
  };
  return { subject: base.subject, body: fillDocTemplate(template, vars), generatedBy: "template" };
}

/** LLM bilan sayqallangan da'vo. Tenant shabloni bo'lsa — o'sha. Aks holda default + LLM. */
export async function generateLawsuitSmart(input: LawsuitInput, customTemplate?: string): Promise<Lawsuit> {
  if (customTemplate && customTemplate.trim()) return fromCustomLawsuit(input, customTemplate);
  const base = generateLawsuit(input);
  const model = getModel();
  if (!model) return base;
  try {
    const { text } = await generateText({ model, system: STYLE_SYSTEM[input.locale], prompt: base.body });
    const polished = text.trim();
    if (polished.length < 80) return base;
    return { subject: base.subject, body: polished, generatedBy: "llm" };
  } catch {
    return base;
  }
}
