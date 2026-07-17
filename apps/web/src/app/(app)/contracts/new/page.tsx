import { NewContractForm } from "@/components/contracts/new-contract-form";

/**
 * Yangi qarzdorlik ishini qo'lda kiritish nuqtasi — firma bir martalik ish
 * olganda shu yerdan qarzdor + shartnoma + qarzni bazaga yuklaydi. Yaratilgach
 * ish avtomatik kuzatuvga (Debitorlik/Muddati o'tgan) tushadi.
 */
export default function NewContractPage() {
  return <NewContractForm />;
}
