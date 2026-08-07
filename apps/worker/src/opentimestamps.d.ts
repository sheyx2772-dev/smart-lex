/**
 * `opentimestamps` (v0.4.9) hech qanday TypeScript turlarini o'zi bilan olib kelmaydi.
 * Bu yerda faqat BIZ ishlatadigan sirt (stamp/upgrade + DetachedTimestampFile) uchun
 * minimal, aniq tur e'lonlari — butun kutubxonani emas.
 */
declare module "opentimestamps" {
  class OpSHA256 {}

  interface TimeAttestation {
    height?: number;
  }

  interface Timestamp {
    isTimestampComplete(): boolean;
    allAttestations(): Map<unknown, TimeAttestation>;
  }

  class DetachedTimestampFile {
    timestamp: Timestamp;
    serializeToBytes(): number[];
    static fromHash(op: OpSHA256, hash: number[]): DetachedTimestampFile;
    static deserialize(ctx: StreamDeserializationContext): DetachedTimestampFile;
  }

  class StreamDeserializationContext {
    constructor(bytes: number[]);
  }

  interface StampOptions {
    calendars?: string[];
    m?: number;
  }

  interface OpenTimestampsModule {
    stamp(detaches: DetachedTimestampFile | DetachedTimestampFile[], options?: StampOptions): Promise<void>;
    upgrade(detached: DetachedTimestampFile, options?: { calendars?: string[] }): Promise<boolean>;
    DetachedTimestampFile: typeof DetachedTimestampFile;
    Ops: { OpSHA256: typeof OpSHA256 };
    Context: { StreamDeserialization: typeof StreamDeserializationContext };
  }

  const OpenTimestamps: OpenTimestampsModule;
  export default OpenTimestamps;
}
