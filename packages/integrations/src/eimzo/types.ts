/**
 * E-IMZO interfeysi — FAZA 2 uchun tayyorgarlik (hozir faqat shakl).
 * Imzolash kaliti + PIN HAR DOIM foydalanuvchi tomonida kiritiladi (server hech qachon
 * kalitni ko'rmaydi). Server faqat imzolanadigan hujjatni tayyorlaydi va imzoni tekshiradi.
 */
export interface SignRequest {
  documentId: string;
  /** Imzolanadigan tarkib (PDF/hujjat) base64. */
  contentBase64: string;
}

export interface SignatureResult {
  /** PKCS#7 imzo (frontend E-IMZO orqali qaytaradi). */
  pkcs7: string;
  signedAt: string;
  signerTin?: string;
}

export interface EImzoService {
  /** Imzolash uchun challenge/hujjat tayyorlaydi. */
  prepare(request: SignRequest): Promise<{ challengeId: string }>;
  /** Frontenddan kelgan PKCS#7 imzoni tekshiradi. */
  verify(pkcs7: string): Promise<{ valid: boolean; signerTin?: string }>;
}
