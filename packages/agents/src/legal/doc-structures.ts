import { type Locale } from "@lex/shared";

/**
 * HAQIQIY SUD HUJJATLARI TUZILMASI — O'zbekiston yuridik firmalarining amalda
 * sudga topshirgan hujjatlaridan (da'vo ariza, talabnoma, shikoyat, murojaat)
 * o'rganilgan aniq skelet. Generatsiya shu tuzilmaga solинади — natija "sudga
 * yuborsa bo'ladigan" darajada bo'lsin (skelet/andoza emas).
 *
 * Har tur uchun: aniq bo'lim ketma-ketligi + rekvizit bloklari + iqtibos joylari.
 * Modda RAQAMLARI bu yerda YOZILMAYDI — ular RAG (law-base) orqali keladi.
 */

type DocType = "davo" | "talabnoma" | "pretenziya" | "shikoyat" | "murojaat" | "shartnoma" | "akt";

/** Instruksiyadan hujjat turini aniqlaydi (uz/ru/lat/kirill). */
function detectType(instruction: string): DocType | null {
  const s = instruction
    .toLowerCase()
    .replace(/[ʻʼ'`']/g, "");
  // Kirill + lotin variantlarini birga tekshiramiz.
  if (/da.?vo|даъво|исковое|иск\b|судга ариза|sudga ariza/.test(s)) return "davo";
  if (/talabnoma|талабнома/.test(s)) return "talabnoma";
  if (/pretenz|претенз/.test(s)) return "pretenziya";
  if (/shikoyat|жалоба|шикоят|жалоб/.test(s)) return "shikoyat";
  if (/murojaat|мурожаат|обращени|xat\b|хат\b|javob xati|жавоб хат/.test(s)) return "murojaat";
  if (/shartnoma|шартнома|договор|kelishuv|келишув|контракт|kontrakt/.test(s)) return "shartnoma";
  if (/\bakt\b|акт|dalolatnoma|далолатнома/.test(s)) return "akt";
  return null;
}

/**
 * DA'VO ARIZA — iqtisodiy sudga (haqiqiy "JAHON INVEST PLAST" namunasidan).
 * Reja: sana → sud → Da'vogar/Javobgar to'liq rekvizit → Da'vo bahosi (ajratib)
 * → sarlavha → Ishning holati → Nizoning kelib chiqishi → Qonuniy asoslar
 * → Penya hisob-kitobi → Sudgacha harakatlar → Da'voni ta'minlash → SO'RAYMAN
 * → Ilovalar ro'yxati → direktor imzosi.
 */
const DAVO_UZ = `DA'VO ARIZA — iqtisodiy sud uchun QAT'IY tuzilma (har bo'lim majburiy, real sud amaliyoti):
1) Yuqori o'ng burchakda sana ("[kun] [oy] [yil] yil").
2) Markazda, JIRALI: sud nomi — "[TUMAN] TUMANLARARO IQTISODIY SUDIGA" (yoki viloyat iqtisodiy sudi).
3) **Da'vogar:** yangi qatordan to'liq rekvizit bloki:
   - «Nomi» MChJ/YaTT (jirali)
   - Manzili: [to'liq pochta manzili]
   - STIR: [9 raqam]
   - Bank rekvizitlari: Bank nomi va filiali; H/R: [20 xonali]; MFO: [5 raqam]
   - Telefon: [raqam]
4) **Javobgar:** aynan shunday to'liq rekvizit bloki (nomi, manzil, STIR, bank H/R+MFO, tel).
5) **Da'vo bahosi:** "Jami: [summa] so'm" va qavs ichida AJRATIB: [asosiy qarz] so'm asosiy qarz, [penya] so'm penya, [davlat boji] so'm davlat boji, [pochta] so'm pochta xarajatlari.
6) Markazda JIRALI sarlavha: "DA'VO ARIZA" va ostida qavsда predmet: "(Qarzdorlikni va penyani undirish to'g'risida)".
7) **Ishning holati:** tomonlar o'rtasidagi shartnoma № va sanasi, predmeti; hisob-faktura/nakladnoy № va sanasi bilan tovar/xizmat topshirilgani. Shartnomaning tegishli bandlarini (masalan to'lov muddati bandi) TIRNOQ ichida AYNAN iqtibos qil.
8) **Nizoning kelib chiqishi:** javobgar to'lov majburiyatini bajarmagani; o'zaro hisob-kitob akti (akt-sverka) № va sanasi bilan qarz miqdori; akt ikki tomon imzolagani va javobgar qarzni tan olgani.
9) **Da'voning qonuniy asoslari:** Fuqarolik kodeksi va tegishli qonun moddalarini ANIQ RAQAM va MATNI bilan keltir (RAG'dagi topilgan moddalardan; o'ylab topma). Har modda javobgar majburiyatiga qanday bog'liqligini yoz.
10) **Penya (neustoyka) hisob-kitobi:** shartnomaning penya bandini TIRNOQ ичida iqtibos; hisoblash davri ([boshlanish sana]–[tugash sana]) va yakuniy penya summasi.
11) **Nizoni sudgacha hal qilish uchun ko'rilgan sa'y-harakatlar:** javobgarga yuborilган talabnoma № va sanasi; javob bo'lmagani.
12) **Da'voni ta'minlash choralari:** Iqtisodiy protsessual kodeksning tegishli moddalarига asosan javobgar hisob raqamlaridagi mablag'ni xatlab qo'yishni asosla.
13) Yakuniy asos qatori: "...Iqtisodiy protsessual kodeksining [tegishli moddalar]ga asoslanib," (RAG'dan).
14) Markazда JIRALI: "SO'RAYMAN:" va ostida raqamli talablar:
   - Javobgardan da'vogar foydasiga [asosiy qarz] (so'z bilan) so'm asosiy qarzni, [penya] (so'z bilan) so'm penyani, [davlat boji] (so'z bilan) so'm davlat bojini, [pochta] so'm pochta xarajatlarini, jami [summa] (so'z bilan) so'mni undirib berishни;
   - (kerak bo'lsa) javobgar hisob raqamидagi [summa] so'mни hal qiluv qarori kuchга kirgunга qadar xatlab qo'yishni.
15) **Ilova qilinayotgan hujjatlar ro'yxati:** raqamli ro'yxat (davlat boji va pochta to'lovi hujjati; shartnoma nusxasi; hisob-faktura; akt-sverka; talabnoma nusxasi va yuborilgani tasdig'i; guvohnoma nusxasi; kichik tadbirkorlik subyekti hujjati).
16) Imzo: "«Nomi» MChJ Direktori [F.I.Sh] _______________ / M.O'."
MUHIM: har summa RAQAM va qavsда SO'Z bilan yozilsin. Ma'lumot yo'q joyni [____] qoldir — HECH QACHON o'ylab topma.`;

/** TALABNOMA — sudga chiqishdan oldingi rasmiy talab (real namunadan). */
const TALABNOMA_UZ = `TALABNOMA — rasmiy sudgacha talab, QAT'IY tuzilma:
1) Yuqorida: "Reg. №[__]" va sana ("«[kun]» [oy] [yil] y.").
2) **Kimga:** «Javobgar nomi» MChJ rahbariga; ostida "Manzil: [__]".
3) **Kimdan:** «Da'vogar nomi» MChJ; "Manzil: [__]"; "STIR: [__]".
4) Markazda JIRALI: "TALABNOMA".
5) Kirish: ushbu talabnoma [da'vogar] va [javobgar] o'rtasида [sana]да tuzilган №[__] shartnoma bo'yicha majburiyatni bajarmaslik yuzasidan taqdim etilishi.
6) Holat: shartnoma predmeti va summasi; yetkazilган tovar/xizmat (kerak bo'lsa JADVAL bilan: nomi, soni, narxi, summasi); hisob-faktura № va sanasi. Shartnomaning narx/to'lov bandlarини (2.1, 2.2) iqtibos qil.
7) **Talablar:** Fuqarolik kodeksi va "Xo'jalik yurituvchi subyektlar faoliyatining shartnomaviy-huquqiy bazasi to'g'risida"gi Qonun moddalarига (RAG'dagi aniq raqam bilan) asoslanib, asosiy qarz + penya (kun uchun foiz) talab qilinishi.
8) To'lov rekvizitlari: "Oluvchi: «[nom]» MChJ; H/R: [__]; Bank MFO: [__]; STIR: [__]".
9) **OGOHLANTIRISH:** belgilangan muddat ([__] bank kuni) ichида to'lanmasa — iqtisodiy sudga da'vo arizasi kiritilishi; javobgar asosiy qarzdan tashqari davlat boji va barcha sud xarajatlarini ham to'lashi.
10) **Ilovalar:** shartnoma nusxasi, hisob-faktura nusxasi (raqamli ro'yxat).
11) Imzo: "Direktor «[nom]» MChJ ______________ [F.I.Sh]".`;

/** SHIKOYAT/JALOBA — davlat organiga (MIB, prokuratura va h.k.) — real namunadan. */
const SHIKOYAT_UZ = `SHIKOYAT ARIZASI — davlat organi harakatsizligi/qarori ustidan, tuzilma:
1) Yuqorida: "Reg. №[__]" va sana.
2) **Kimdan:** «Nomi» MChJ; "Manzil: [__]"; "STIR: [__]".
3) **Kimga:** organ va mansabdor shaxs to'liq nomi (masalan "Majburiy Ijro Byurosining [tuman] tuman bo'limi boshlig'iga").
4) Markazда JIRALI: "SHIKOYAT ARIZASI".
5) Holat: qaysi hujjat/ajrim/qaror (sud nomi, sana, ish №) ijroга topshirilgani va sana; organ qanday harakat/harakatsizlik qilgani; huquq buzilgani.
6) Huquqiy asos: Iqtisodiy protsessual kodeks va "Sud hujjatlari va boshqa organlar hujjatlarini ijro etish to'g'risida"gi Qonun moddalarини (RAG'dan aniq raqam+matn) keltir; mansabdor shaxs majburiyati nimadan iboratligini ko'rsat.
7) Markazда JIRALI: "SIZDAN QUYIDAGILARNI SO'RAYMIZ:" — raqamli talablar (intizomiy chora; ajrim/qarorni darhol va to'liq ijro etish).
8) **Ilova:** tegishli ajrim/qaror nusxasi (raqamli).
9) Imzo: "«[nom]» MChJ direktori ______________ [F.I.Sh]".`;

/** MUROJAAT / JAVOB XATI — davlat portali/organ murojaatiga javob. */
const MUROJAAT_UZ = `MUROJAAT / JAVOB XATI — rasmiy ish yuritish uslubида:
1) Yuqorida: "Reg. №[__]" va sana; kerak bo'lsa kiruvchi murojaat №/sanaga havola ("Sizning [sana]dagi №[__] murojaatingizga javoban").
2) **Kimga:** organ/shaxs to'liq nomi va lavozimi.
3) **Kimdan:** «Nomi» MChJ; manzil; STIR.
4) Markazда JIRALI: "MUROJAAT" yoki "JAVOB XATI".
5) Mohiyat: murojaat qilinayotган masala aniq bayoni; faktlar sana/hujjat/summa bilan; huquqiy asos (RAG moddalari).
6) So'rov/xulosa: aniq talab yoki javob (raqamli bo'lishi mumkin).
7) **Ilovalar** (bo'lsa).
8) Imzo: rahbar F.I.Sh + M.O'.`;

const STRUCTS_UZ: Partial<Record<DocType, string>> = {
  davo: DAVO_UZ,
  talabnoma: TALABNOMA_UZ,
  pretenziya: TALABNOMA_UZ, // pretenziya ~ talabnoma tuzilmasi
  shikoyat: SHIKOYAT_UZ,
  murojaat: MUROJAAT_UZ,
};

/**
 * Instruksiyaga mos hujjat-tur skeletini qaytaradi (topilса). Generatsiya
 * promptiga qo'shiladi — model shu aniq tuzilmaga amal qiladi.
 * Firma blankasi (letterhead) va kirill/lotin eslatmasi ham qo'shiladi.
 */
export function docStructureHint(instruction: string, locale: Locale): string {
  const type = detectType(instruction);
  if (!type) return "";
  const struct = STRUCTS_UZ[type];
  if (!struct) return "";

  // Firma blankasi (letterhead) — chiquvchi xatlar uchun.
  const letterhead =
    type === "davo" || type === "shikoyat"
      ? ""
      : `\n\nFIRMA BLANKASI: agar so'rovda firma nomi/rekvizitlari berilган bo'lsa, hujjat boshida qisqa blanka (firma nomi, STIR, manzil, tel) va "Reg. №" qatorini qo'y.`;

  // Kirill eslatmasi — O'zbekiston sud amaliyotida ko'p hujjat kirillда.
  const script = `\n\nALIFBO: agar foydalanuvchi kirill (ўзбекча кирилл) so'rasa yoki firma hujjatlari kirillда bo'lsa — hujjatni KIRILL alifbosida yoz; aks holda lotinда. Rasmiy ish uslubi, quruq va aniq til.`;

  const header =
    locale === "ru"
      ? "\n\nСТРУКТУРА ДОКУМЕНТА (следуй строго, реальная судебная практика РУз):\n"
      : locale === "en"
        ? "\n\nDOCUMENT STRUCTURE (follow strictly, real Uzbek court practice):\n"
        : "\n\nHUJJAT TUZILMASI (real sud amaliyoti — QAT'IY amal qil):\n";

  return `${header}${struct}${letterhead}${script}`;
}
