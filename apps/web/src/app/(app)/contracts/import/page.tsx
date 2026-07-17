import { BulkImportForm } from "@/components/contracts/bulk-import-form";

/**
 * Ko'plab qarzdorlik ishlarini bir vaqtda yuklash (CSV/Excel) — firma qarzdorlar
 * ro'yxatini bittalab emas, bir marta yuklaydi. Har qator POST /contracts orqali
 * to'liq ish (qarzdor + shartnoma + invoice + receivable) yaratadi.
 */
export default function BulkImportPage() {
  return <BulkImportForm />;
}
