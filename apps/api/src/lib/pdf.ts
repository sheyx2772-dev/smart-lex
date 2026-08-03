import { createRequire } from "node:module";
import PDFDocument from "pdfkit";

const require = createRequire(import.meta.url);

/**
 * DejaVu Sans — kirill (o'zbek/rus) va lotin harflarini to'liq qamrab oladigan,
 * bepul/ochiq TTF. PDFKit'ning standart shriftlari (Helvetica va h.k.) kirillni
 * chizolmaydi — shuning uchun bu shrift har doim embed qilinadi.
 */
const REGULAR_FONT = require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans.ttf");
const BOLD_FONT = require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf");

/**
 * Oddiy ko'p-paragrafli matnni (masalan generateLawsuit() natijasi) A4 PDF
 * buferga aylantiradi — cabinet.sud.uz'ga case_documents sifatida yuklash uchun.
 * Bo'sh qatorlar orasidagi paragraflar ajratiladi; sarlavha (birinchi ALL-CAPS
 * qator bo'lsa) qalin qilib chiqariladi — aks holda hammasi oddiy shrift bilan.
 */
export function renderTextPdf(text: string, opts?: { title?: string }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font(REGULAR_FONT).fontSize(11);

    if (opts?.title) {
      doc.font(BOLD_FONT).fontSize(13).text(opts.title, { align: "center" });
      doc.moveDown(1);
      doc.font(REGULAR_FONT).fontSize(11);
    }

    const paragraphs = text.split(/\n{2,}/);
    for (const p of paragraphs) {
      const isHeading = /^[A-ZА-ЯЁЎҚҒҲ0-9 .,'()\-]+$/.test(p.trim()) && p.trim().length > 3 && p.trim().length < 120;
      doc.font(isHeading ? BOLD_FONT : REGULAR_FONT).text(p.trim(), { align: "left", lineGap: 3 });
      doc.moveDown(0.8);
    }

    doc.end();
  });
}
