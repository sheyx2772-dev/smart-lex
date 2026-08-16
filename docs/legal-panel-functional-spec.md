# SmartLex — Yuridik Panel: To'liq Funksional Spetsifikatsiya

**Maqsad:** Hozirgi UI/workflow skeletonini "haqiqiy AI Legal Agent"ga aylantirish. Dizayn saqlanadi — orqasiga real avtomatlashtirish, proaktiv aniqlash va human-in-the-loop tasdiq qatlamlari quriladi.

**Asosiy tsikl** (har bir modulda takrorlanadi):
`ko'radi → tushunadi → tekshiradi → qaror taklif qiladi → hujjat tayyorlaydi → approval oladi → yuboradi → kuzatadi → natijani qayta ishlaydi`

**Muhim tamoyil:** AI hech qachon tashqi/qaytmas amalni (yuborish, sudga topshirish, hisobdan chiqarish) o'zi bajarmaydi — faqat tayyorlaydi va Tasdiqlar bo'limiga qo'yadi. Bu tamoyil kodda allaqachon bor (`queueApproval` asbobi) — kengaytiriladi, o'zgartirilmaydi.

---

## 0. Kesib o'tuvchi tushuncha: "AI Vazifalari" navbati

Bu — eng muhim yangi qatlam. Dashboarddagi "AI VAZIFALARI" hozir shunchaki hisoblagich (0); u **real, harakat qilinadigan navbat**ga aylanishi kerak.

**Ma'lumot manbai:** mavjud `agent_tasks` jadvali (schema'da bor, hozir bo'sh — `action, title, receivableId, deadline, status, result` maydonlari bilan; `legalMatters`/`documents`/`contracts`ga bog'lanadigan variantda kengaytiriladi).

**Vazifa turlari** (har biri alohida "generator" — fon jarayoni yoki hujjat/muddat o'zgarganda triggerlanadi):

| Turkum | Trigger | Misol sarlavha |
|---|---|---|
| 🔴 Shoshilinch | Muddat 3 kun ichida yoki o'tgan | "GLOBAL SNAB MCHJ bo'yicha da'vo muddatini tekshirish — 2 kun qoldi" |
| 🟠 Tavsiya | AI tahlil natijasi diqqat talab qiladi | "3 ta shartnomada penya bandi aniqlanmadi" |
| 🔵 Avtomatik tekshiruv | Yangi hujjat/shartnoma yuklandi | "Yangi yuklangan 7 ta hujjat tahlil qilindi" |

**Har bir vazifa kartasi:** sarlavha, qisqa asos (1 gap), bog'langan ob'ekt (kontragent/ish/hujjat havolasi), va 3 tugma: **[Ko'rish]** (batafsil ochadi) → **[Agent ishlasin]** (AI darhol tahlil/hujjat tayyorlaydi, natijani shu kartada ko'rsatadi) → **[Tasdiqlash]** (agar AI allaqachon hujjat tayyorlagan bo'lsa, to'g'ridan-to'g'ri Tasdiqlar navbatiga yuboradi).

**Generatorlar (fon jarayoni sifatida amalga oshiriladi, worker/cron orqali):**
- `deadline-scanner`: har kuni `legal_matters.dueDate` va sud ishlarining `courtStatus`ini skanerlaydi, 3/1/0 kun qolganda vazifa yaratadi.
- `document-ingest-analyzer`: yangi hujjat yuklanganda (`documents` INSERT) avtomatik `analyzeContractRisk`ni chaqiradi (agar `type=contract`) va natijani vazifa sifatida qo'yadi.
- `contract-clause-auditor`: shartnoma tahlili natijasida `missingClauses`/`unusualClauses` topilsa — alohida "tavsiya" vazifasi yaratadi.

---

## 1. Yuridik AI Agent (`/legal`)

**Ochiladi:** Bosh sahifa — hero + real KPI qatori + **AI Vazifalari navbati** (yuqoridagi §0, hozirgi bo'sh joy o'rniga) + chat.

| Bosqich | Tavsif |
|---|---|
| Foydalanuvchi | Sahifani ochadi; yuqorida real vazifalar ro'yxatini ko'radi (agar bo'lsa — bo'sh holatda "hammasi nazoratda" xabari); chatga yozadi yoki vazifa kartasidagi tugmani bosadi |
| AI | Chatda: `findMatter`/`findContract` bilan real ma'lumotni o'qiydi → `analyzeContractRisk`/`draftCourtFiling` bilan ishlaydi → natijani tushuntiradi. Fonda: yuqoridagi generatorlar orqali navbatni to'ldirib boradi |
| Tizim | Har bir AI harakatini `audit_logs`ga yozadi (`actorType: ai_agent`); vazifa bajarilganda `agent_tasks.status = done` |
| Natija | Foydalanuvchi "kirib — kutib — chiqib ketish" o'rniga "kirib — bugun nima e'tibor talab qilishini ko'rib — bir necha bosishda hal qilish" tajribasini oladi |

**Misol ssenariy (foydalanuvchi so'ragan aniq misol):**
> Yurist: "GLOBAL SNAB bo'yicha sudga da'vo tayyorla."
> Agent zanjiri: kontragentni topadi → shartnomani topadi → hisob-fakturalarni topadi → qarzdorlikni hisoblaydi (`outstandingMinor`) → oldingi yozishmalarni (`caseEvents`/`auditLogs`) tekshiradi → talabnoma yuborilganmi tekshiradi (`documents type=demand_letter` mavjudligi) → da'vo muddatini (3 yillik iskovaya davnost) tekshiradi → `draftCourtFiling` bilan matn tuzadi → davlat bojini hisoblaydi (mavjud `court.ts` state-duty formulasi) → **`queueApproval`** bilan Tasdiqlar navbatiga qo'yadi.
> Bu zanjir — asboblar (`findContract`, `analyzeContractRisk` va h.k.) allaqachon bor; yetishmayotgani — ularni BITTA so'rovda ketma-ket ZANJIRLAYDIGAN ko'proq qadamli tool-calling (hozir `maxSteps: 6`, oshirish va yangi asboblar: `checkDemandSent`, `checkLimitationPeriod`, `calculateStateDuty` qo'shish kerak).

---

## 2. Hujjat tayyorlash (`/studio`)

Hozirgi holat asosan yaxshi (AI orqali hujjat yaratish/tahlil). Qo'shiladigani:

| Bosqich | Tavsif |
|---|---|
| Foydalanuvchi | Hujjat yuklaydi yoki shablondan boshlaydi |
| AI | Matnni o'qiydi (`extractDocumentText` — mavjud) → **avtomatik** turini aniqlaydi, asosiy maydonlarni chiqaradi (`extractContractFields` — mavjud, lekin hozir faqat "Yangi shartnoma" oqimida ishlatiladi, Studio yuklashda emas) |
| Tizim | Natijani chapda "AI aniqladi" panelida ko'rsatadi (hujjat turi, kontragent, summa, muddat) — tahrirlash mumkin |
| Natija | Foydalanuvchi bo'sh joydan boshlamaydi — AI birinchi qoralamani allaqachon tayyorlab qo'ygan bo'ladi |

---

## 3. Hujjatlar (`/documents`)

**Hozir bor:** ro'yxat, filtr, qidiruv, imzolash, (bugun qo'shilgan) "Tahlil qil" tugmasi.

**Yetishmayotgan — foydalanuvchi misolidagi aniq oqim:**

| Bosqich | Tavsif |
|---|---|
| Trigger | Yangi hujjat kelib tushdi (Didox sinxronizatsiya YOKI qo'lda yuklash) |
| AI (avtomatik, foydalanuvchi so'ramasdan) | Hujjat turini, kontragentni, summani, shartnoma raqamini, to'lov muddatini chiqaradi (`extractContractFields` avtomatik chaqiriladi INSERT paytida — worker/trigger orqali) |
| Tizim | Ro'yxatda yangi qator "🆕 AI tahlil qildi" belgisi bilan chiqadi; ochilganda AI xulosasi banner ko'rinadi: "Hujjat turi: Hisob-faktura · Kontragent: MEGA BUILD MCHJ · Summa: 8 340 000 UZS · Muddat: 15.08.2026 · Xavf: O'RTA" |
| Foydalanuvchi | 3 tugma: **[Tasdiqlash]** (ma'lumotlar to'g'ri, tizimga kiritiladi) · **[Tahrirlash]** (qo'lda tuzatish) · **[Agentga topshirish]** (masalan — "kechikkan to'lov bo'yicha talabnoma tayyorla" kabi keyingi qadamni AI'ga buyuradi) |

---

## 4. Tasdiqlar (`/approvals`)

**Hozir bor:** ro'yxat, tasdiqlash/rad etish (`approvalRequests`, `matter_action` turi bugun qo'shildi).

**Kengaytirish — kontekst boyligi:**

| Bosqich | Tavsif |
|---|---|
| Ochiladi | Har bir kartada: **kim** (AI yoki qaysi xodim so'ragan), **nima** (hujjat turi + qisqa mazmun), **qancha** (summa, agar bo'lsa), **nega** (AI'ning bir gaplik asosi — masalan "2 kunlik kechikish, oldin eslatma yuborilmagan") |
| Foydalanuvchi | **[Ko'rish]** (to'liq hujjat matni) → **[Tasdiqlash]** / **[Rad etish]** / **[Tahrirlash]** |
| Tizim | Tasdiqlangach — bog'liq turga qarab keyingi qadamni avtomatik bajaradi (`demand_letter` uchun allaqachon bor; `matter_action`/`court_claim` uchun ham xuddi shunday zanjir) |
| Natija | Rahbar/yurist "nima uchun tasdiqlayapman"ni bir qarashda tushunadi — ko'r-ko'rona bosish yo'q |

---

## 5. Shartnomalar (`/contracts`)

**Eng katta imkoniyat — "Contract AI Review".**

| Bosqich | Tavsif |
|---|---|
| Trigger | Yangi shartnoma yuklandi yoki "Tahlil qil" bosildi (mexanizm bugun qurildi — `analyzeContractRisk`) |
| AI | Matnni bandlarga ajratib tahlil qiladi: xavf darajasi + har bir band bo'yicha alohida topilma + **yetishmayotgan bandlar** + **g'ayrioddiy/bir tomonlama noqulay bandlar** (natija formati allaqachon shu tuzilishda: `findings[]`, `missingClauses[]`, `unusualClauses[]`) |
| Tizim | Natijani "CONTRACT AI REVIEW" kartasi sifatida ko'rsatadi — har bir topilma shartnoma matni ICHIDA tegishli joyga bog'langan holda (hozir — ro'yxat sifatida; keyingi qadam — matn ichida highlight/anchor) |
| Foydalanuvchi | **[Risklarni ko'rish]** → har bir bandni alohida ko'radi → **[Agentdan qayta ishlab chiqishni so'rash]** (masalan "penya bandini tuzat" — AI muqobil band taklif qiladi) |
| Natija | Bank/yirik kompaniya yuristi shartnomani QO'LDA o'qib chiqmasdan, AI xulosasidan boshlaydi |

---

## 6. Kontragentlar (`/companies`) — "Yagona yuridik profil"

Hozirgi ro'yxat saqlanadi, lekin detail sahifa (`/companies/[id]`) tubdan boyitiladi:

| Bo'lim | Manba (mavjud) |
|---|---|
| Asosiy ma'lumotlar | `contractors` (STIR, manzil, telefon, email) — bor |
| Shartnomalar soni | `contracts` — bor |
| Hujjatlar soni | `documents` — bor |
| **Sud ishlari soni** | **YANGI** — `legal_matters WHERE status='in_court' AND contractorId=X` |
| **Qarzdorlik/kreditorlik** | Yuridik rejimda ko'rsatilmaydi (ataylab yashirilgan — debitorlik-specific), lekin **agar kerak bo'lsa** neytral "moliyaviy holat" ko'rinishida qo'shilishi mumkin |
| **Risk darajasi** | **YANGI** — shartnomalar risk tahlili + sud ishlari statusi asosida hisoblanadigan yig'ma ko'rsatkich |
| **AI xulosasi** | **YANGI** — bitta paragraf: "Ushbu kontragent bilan N ta shartnoma, shundan M tasi yuqori xavfli. K ta sud ishi mavjud. Yangi shartnoma tuzishdan oldin tekshiruv tavsiya etiladi." (LLM chaqiruvi — mavjud kontragent ma'lumotlarini jamlab, 2-3 gaplik xulosa yozadi) |

**Natija:** Kontragentlar — statik ro'yxat emas, balki "bu kompaniya bilan ishlash xavfsizmi?" degan savolga darhol javob beruvchi profil bo'ladi.

---

## 7. Sud (`/court`) — eng kuchli modul bo'lish salohiyati

**Hozir bor (haqiqiy, mock emas):** ikki bosqichli topshirish (`prepare`→`submit`), sud.uz bilan REAL API integratsiyasi, davlat boji hisob-kitobi, Soliq orqali javobgar ma'lumotlarini tekshirish, 5 bosqichli vizual holat (Tayyorlandi→Topshirishga tayyor→Topshirildi→Qabul qilindi→Qaror).

**Kengaytirish:**

| Bosqich | Hozir | Qo'shiladi |
|---|---|---|
| Ish yaratish | Qo'lda (Kontragentlar sahifasidan "Da'vo tayyorlash") | AI Vazifalar navbatidan avtomatik taklif ("Bu kontragentga qarshi da'vo tayyorlashni tavsiya qilaman") |
| Hujjat yig'ish | Qo'lda biriktiriladi | AI kontragentning barcha tegishli hujjatlarini (shartnoma, hisob-faktura, eslatma) avtomatik to'playdi va ro'yxat qiladi — yetishmayotganini belgilaydi |
| Muddat monitoring | Yo'q | AI Vazifalar navbatida — sud sanasi/javob muddati yaqinlashganda avtomatik eslatma |
| Qaror keyingi qadami | Qo'lda | Qaror yuklanganda AI uni o'qib, "ijro varaqasi olish" yoki "apellyatsiya" kabi keyingi qadamni tavsiya qiladi |

**Natija:** Sud bo'limi CRM (statik ro'yxat) emas, balki ishning butun hayotiy sikli davomida hamrohlik qiluvchi modul bo'ladi.

---

## 8. Hisobotlar (`/reports`) — bugun asos qurildi, boyitiladi

**Bugun qo'shilgan:** ishlar bosqichlar/xavf/ustuvorlik bo'yicha taqsimoti, shartnoma xavf xulosasi, o'rtacha yechish muddati.

**Keyingi qadam — "Yuridik bo'lim samaradorligi" ko'rinishi:**

| Ko'rsatkich | Manba |
|---|---|
| Bu oy qayta ishlangan hujjatlar | `documents WHERE createdAt >= oy_boshi` |
| Tekshirilgan shartnomalar | `documents WHERE type='contract' AND extracted.riskAnalysis IS NOT NULL` |
| Aniqlangan risklar | `SUM(riskAnalysis.findings.length)` |
| Yuborilgan talabnomalar | `approvalRequests WHERE type='demand_letter' AND status='approved'` |
| Sudga topshirilgan ishlar | `legal_matters WHERE status IN ('filed','in_court')` |
| **AI avtomatlashtirish darajasi** | `(AI tomonidan boshlangan vazifalar) / (jami vazifalar) × 100%` — `audit_logs WHERE actorType='ai_agent'` ulushi |
| **Tejalgan vaqt (taxminiy)** | Har bir AI-tayyorlagan hujjat uchun o'rtacha qo'lda tayyorlash vaqti (masalan 45 daq) × hujjatlar soni |

**Natija:** Rahbariyat uchun "SmartLex bizga necha soat tejadi" degan raqam — investitsiya/sotib olish qarorini oqlaydigan asosiy KPI.

---

## 9. Sozlamalar (`/settings`)

O'zgarishsiz qoladi — umumiy administrativ modul (profil, jamoa, integratsiyalar). Yuridik rejimga xos qo'shimcha: AI agentning **avtonomiya darajasi** sozlamasi (Debitorlik tarafidagi mavjud off/suggest/auto naqshiga o'xshab) — masalan "AI hujjatlarni avtomatik tahlil qilsinmi (ha/yo'q)", "AI qanday hollarda vazifa yaratsin" kabi ostki sozlamalar.

---

## Amalga oshirish tartibi (modulma-modul, Cursor promptlari uchun asos)

1. **AI Vazifalari navbati** (§0) — infratuzilma: `agent_tasks` jadvalini kengaytirish + 3 ta generator (deadline-scanner, document-ingest-analyzer, contract-clause-auditor) + dashboard UI
2. **Hujjatlar — avtomatik AI tahlil** (§3) — yuklash paytida trigger, AI xulosa banneri, 3 tugmali oqim
3. **Kontragentlar — yagona yuridik profil** (§6) — risk yig'ma ko'rsatkichi + AI xulosa paragrafi
4. **Sud — muddat monitoring + hujjat auto-yig'ish** (§7)
5. **AI Legal Agent — ko'p qadamli zanjirlash** (§1) — asboblar sonini oshirish, `maxSteps` oshirish
6. **Hisobotlar — samaradorlik KPI** (§8)

Har bir band alohida, mustaqil implementatsiya promptiga aylantirilishi mumkin — birortasi boshqasini buzmaydi (barchasi additive, mavjud Debitorlik infratuzilmasiga tegmaydi).
