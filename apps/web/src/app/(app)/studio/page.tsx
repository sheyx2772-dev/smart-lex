import { Suspense } from "react";
import { DocumentStudio } from "@/components/studio/document-studio";

/**
 * Hujjat tayyorlash studiyasi — Tuzuk.ai uslubidagi ikki panelli ish maydoni:
 * chapda hujjat muharriri, o'ngda AI yordamchi (tahlil, risk, savol-javob).
 * ?template=<key> — boshqa bo'limlardan kerakli shablonni ochish uchun.
 */
export default function StudioPage() {
  return (
    <Suspense fallback={null}>
      <DocumentStudio />
    </Suspense>
  );
}
