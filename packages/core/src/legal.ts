/**
 * Sudgacha huquqiy deterministik hisob-kitoblar — davlat boji va sud aniqlash.
 *
 * MUHIM: bu yerdagi stavkalar TAXMINIY (iqtisodiy nizolar uchun umumiy amaliyot).
 * Ishga tushirishdan oldin JORIY Soliq kodeksi va BHM (bazaviy hisoblash miqdori)
 * bo'yicha yurist tomonidan tekshirilishi SHART. LLM bu raqamlarni hech qachon o'ylab topmaydi.
 */

export interface StateDutyResult {
  dutyMinor: bigint;
  rateBps: number;
  note: string;
}

/**
 * Davlat boji (iqtisodiy sud, mulkiy da'vo) — da'vo summasidan foiz.
 * Default 2% (200 bps) — taxminiy. `rateBps`/`minMinor` bilan sozlanadi.
 */
export function calcStateDuty(claimMinor: bigint, opts?: { rateBps?: number; minMinor?: bigint }): StateDutyResult {
  const rateBps = opts?.rateBps ?? 200;
  const min = opts?.minMinor ?? 0n;
  const raw = (claimMinor * BigInt(rateBps)) / 10000n;
  const dutyMinor = raw < min ? min : raw;
  return { dutyMinor, rateBps, note: "Taxminiy (2%). Joriy Soliq kodeksi bo'yicha tekshirilsin." };
}

export interface CourtDetermination {
  /** Sud turi: iqtisodiy (yuridik shaxslar o'rtasidagi nizolar) yoki fuqarolik. */
  type: "economic" | "civil";
  /** Javobgar joylashgan hudud (manzildan). */
  region: string;
  /** Ko'rsatiladigan nom. */
  name: string;
}

/** Manzildan hududni ajratadi (birinchi bo'lak — sh./viloyat). */
function extractRegion(address?: string | null): string {
  if (!address) return "—";
  const first = address.split(",")[0]?.trim();
  return first && first.length > 1 ? first : "—";
}

/**
 * Vakolatli sudni aniqlaydi. Yuridik shaxslar o'rtasidagi mulkiy nizolar → javobgar
 * joylashган iqtisodiy sud (IPK umumiy qoidasi). Shartnomada boshqacha yozilmagan bo'lsa.
 */
export function determineCourt(defendantAddress?: string | null): CourtDetermination {
  const region = extractRegion(defendantAddress);
  return { type: "economic", region, name: `${region} iqtisodiy sudi` };
}
