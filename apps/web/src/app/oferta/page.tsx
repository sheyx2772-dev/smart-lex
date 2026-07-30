import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ommaviy oferta — LEX.AI",
  description: "LEX.AI platformasidan foydalanish bo'yicha xizmat ko'rsatish shartnomasi (ommaviy oferta).",
};

const PARAS: string[] = [
  "OMMAVIY OFERTA",
  "LEX.AI platformasidan foydalanish bo'yicha xizmat ko'rsatish shartnomasi",
  "Toshkent shahri     «____» __________ 2026-yil",
  "«MC LEGAL» yuridik firmasi (STIR 312559000), keyingi o‘rinlarda “Ijrochi” deb yuritiladi, direktor Aброров Жавохир Исматуллаевич shaxsida, ushbu Ommaviy ofertani (keyingi o‘rinlarda — “Oferta”) O‘zbekiston Respublikasi Fuqarolik kodeksining 367, 369 va 370-moddalariga muvofiq har qanday jismoniy yoki yuridik shaxsga (keyingi o‘rinlarda — “Foydalanuvchi”) quyidagi shartlarda taklif etadi.",
  "1. ATAMALAR VA TA’RIFLAR",
  "1.1. Platforma — lexai.com.uz manzilida joylashgan LEX.AI dasturiy-apparat majmuasi va u orqali taqdim etiladigan xizmatlar.",
  "1.2. Xizmat — Platforma orqali debitorlik qarzini nazorat qilish, hujjatlarni (talabnoma, da’vo arizasi, va h.k.) avtomatik tayyorlash, davlat va uchinchi tomon tizimlari (Didox, E-SUD, E-IMZO va boshqalar) bilan integratsiya qilish bo‘yicha ko‘rsatiladigan axborot-texnologik xizmatlar.",
  "1.3. Aksept — Foydalanuvchi tomonidan Oferta shartlarini to‘liq va so‘zsiz qabul qilinishi (FK 370-modda).",
  "1.4. Hisob (akkaunt) — Foydalanuvchiga Platformada ochilgan shaxsiy kabinet.",
  "2. OFERTA PREDMETI",
  "2.1. Ijrochi Foydalanuvchiga Platformadan foydalanish huquqini va Xizmatlarni tanlangan tarif rejasiga muvofiq taqdim etadi, Foydalanuvchi esa ularni qabul qiladi va haq to‘laydi.",
  "2.2. Xizmatlar ro‘yxati va imkoniyatlari Platformaning tegishli bo‘limlarida (jumladan “Imkoniyatlar” sahifasida) keltiriladi.",
  "2.3. Platforma “bor holicha” (as is) taqdim etiladi; Ijrochi Xizmatlarni doimiy takomillashtirib borish huquqini saqlab qoladi.",
  "3. OFERTANI AKSEPT QILISH",
  "3.1. Oferta quyidagi harakatlardan biri bilan aksept qilingan hisoblanadi: (a) ro‘yxatdan o‘tishda yoki tizimga kirishda “Shartnoma shartlariga roziman” belgisini qo‘yish; (b) Platformadan haqiqiy foydalanishni boshlash (konklyudent harakat); (c) tegishli hollarda — elektron raqamli imzo (E-IMZO) yordamida imzolash.",
  "3.2. Aksept qilingan paytdan boshlab Oferta tomonlar o‘rtasida yozma shaklda tuzilgan shartnomaga teng huquqiy kuchga ega bo‘ladi.",
  "3.3. Aksept qilish orqali Foydalanuvchi Oferta shartlari bilan to‘liq tanishganini va ularga rozi ekanini tasdiqlaydi.",
  "4. TOMONLARNING HUQUQ VA MAJBURIYATLARI",
  "4.1. Ijrochi majburdir:",
  "4.1.1. Xizmatlarni tanlangan tarifga muvofiq taqdim etish;",
  "4.1.2. Foydalanuvchi ma’lumotlari maxfiyligini ta’minlash;",
  "4.1.3. Texnik nosozliklarni imkon qadar tez bartaraf etish.",
  "4.2. Foydalanuvchi majburdir:",
  "4.2.1. Tanlangan tarif bo‘yicha haqni o‘z vaqtida to‘lash;",
  "4.2.2. Kirish ma’lumotlari (login/parol, E-IMZO kaliti) xavfsizligini saqlash;",
  "4.2.3. Platformadan qonun hujjatlariga zid maqsadlarda foydalanmaslik;",
  "4.2.4. Platformaga kiritilayotgan ma’lumotlarning to‘g‘riligi uchun javobgar bo‘lish.",
  "4.3. Foydalanuvchi haqli:",
  "4.3.1. Xizmatlardan tarif doirasida to‘liq foydalanish;",
  "4.3.2. Texnik qo‘llab-quvvatlashga murojaat qilish.",
  "5. XIZMAT NARXI VA TO‘LOV TARTIBI",
  "5.1. Xizmat narxi Platformaning “Narxlar” sahifasida joylashtirilgan tarif rejalari (Starter, Standard, Pro va boshqalar) bo‘yicha belgilanadi.",
  "5.2. To‘lov tanlangan tarifga muvofiq oldindan (obuna asosida) amalga oshiriladi. Narxlar Ijrochi tomonidan bir tomonlama o‘zgartirilishi mumkin; o‘zgartirishlar Platformada e’lon qilingandan so‘ng kuchga kiradi va joriy to‘langan davrga taalluqli emas.",
  "5.3. To‘lov o‘tkazilmagan taqdirda Ijrochi Xizmatni to‘xtatib turish huquqiga ega.",
  "[Aniq tarif narxlari va to‘lov usullari keyinchalik to‘ldiriladi / “Narxlar” sahifasiga havola qilinadi.]",
  "6. MAXFIYLIK VA SHAXSIY MA’LUMOTLAR",
  "6.1. Ijrochi Foydalanuvchi va uning kontragentlariga oid ma’lumotlarni “Shaxsga doir ma’lumotlar to‘g‘risida”gi O‘zbekiston Respublikasi Qonuniga muvofiq qayta ishlaydi va himoya qiladi.",
  "6.2. Oferta akseptlanishi Foydalanuvchi tomonidan shaxsiy ma’lumotlarni qayta ishlashga rozilik berilishini anglatadi (Xizmatni ko‘rsatish maqsadida).",
  "6.3. Ma’lumotlar uchinchi shaxslarga faqat qonunda nazarda tutilgan hollarda yoki Xizmatni ko‘rsatish uchun zarur bo‘lgan integratsiyalar (Didox, E-SUD va h.k.) doirasida uzatiladi.",
  "7. ELEKTRON HUJJATLAR VA E-IMZO",
  "7.1. Tomonlar Platforma orqali shakllantirilgan va elektron raqamli imzo (E-IMZO) bilan imzolangan hujjatlarni qo‘lda imzolangan hujjatlarga teng huquqiy kuchga ega deb tan oladilar (“Elektron raqamli imzo to‘g‘risida”gi Qonun).",
  "7.2. E-IMZO kaliti bilan imzolash Foydalanuvchining o‘zi tomonidan amalga oshiriladi; kalit xavfsizligi uchun Foydalanuvchi javobgar.",
  "8. TOMONLARNING JAVOBGARLIGI",
  "8.1. Tomonlar o‘z majburiyatlarini bajarmaganlik uchun O‘zbekiston Respublikasi qonun hujjatlariga muvofiq javobgar bo‘ladilar.",
  "8.2. Ijrochi Platforma orqali tayyorlangan hujjatlardan Foydalanuvchi tomonidan foydalanish natijalari, shuningdek Foydalanuvchi kiritgan noto‘g‘ri ma’lumotlar uchun javobgar emas.",
  "8.3. Ijrochining javobgarligi har qanday holatda Foydalanuvchi joriy hisob davrida to‘lagan summa bilan cheklanadi.",
  "9. FORS-MAJOR",
  "9.1. Tomonlar yengib bo‘lmaydigan kuch holatlari (fors-major) tufayli majburiyatlar bajarilmaganligi uchun javobgar bo‘lmaydilar.",
  "10. SHARTNOMA MUDDATI VA BEKOR QILISH",
  "10.1. Oferta aksept qilingan paytdan kuchga kiradi va Xizmatdan foydalanilayotgan davr mobaynida amal qiladi.",
  "10.2. Foydalanuvchi istalgan vaqtda Xizmatdan voz kechishi va akkauntni yopishi mumkin; to‘langan summa (agar boshqacha kelishilmagan bo‘lsa) qaytarilmaydi.",
  "10.3. Ijrochi Foydalanuvchi Oferta shartlarini buzgan taqdirda Xizmatni bir tomonlama to‘xtatish huquqiga ega.",
  "11. NIZOLARNI HAL QILISH",
  "11.1. Nizolar muzokaralar yo‘li bilan hal etiladi. Kelishuvga erishilmasa — O‘zbekiston Respublikasi qonunchiligiga muvofiq tegishli sudda ko‘rib chiqiladi.",
  "12. YAKUNIY QOIDALAR",
  "12.1. Ijrochi Oferta shartlarini bir tomonlama o‘zgartirish huquqiga ega; yangi tahrir Platformada e’lon qilingan paytdan kuchga kiradi.",
  "12.2. Oferta yangi tahriri e’lon qilingandan so‘ng Xizmatdan foydalanishni davom ettirish o‘zgartirishlarga rozilik hisoblanadi.",
  "13. IJROCHI REKVIZITLARI",
  "«MC LEGAL» yuridik firmasi · STIR: 312559000",
  "Manzil: Toshkent shahri, Mirobod tumani, 23-uy",
  "E-mail: smartlex.uzbekistan@gmail.com  ·  Tel: +998 97 724 79 99",
  "Direktor: Aброров Жавохир Исматуллаевич",
];

const isHeading = (s: string) => /^\d+\.\s+[A-ZА-Яʼʻ‘’'ЁO]/.test(s) && s === s.toUpperCase();
const isSub = (s: string) => /^\d+\.\d/.test(s);

export default function OfertaPage() {
  return (
    <div style={{ background: "#000", color: "#f4f3ef", minHeight: "100vh" }}>
      <header style={{ borderBottom: "1px solid rgba(255,255,255,.12)", position: "sticky", top: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(12px)", zIndex: 10 }}>
        <div style={{ width: "min(880px,92%)", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0" }}>
          <Link href="/login" style={{ fontFamily: "'Anton',var(--font-space-grotesk),sans-serif", fontSize: 22, textTransform: "uppercase", color: "#fff", textDecoration: "none", letterSpacing: ".02em" }}>
            LEX<span style={{ color: "#ff0000" }}>.AI</span>
          </Link>
          <Link href="/login" style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(244,243,239,.7)", textDecoration: "none" }}>← Bosh sahifa</Link>
        </div>
      </header>

      <main style={{ width: "min(880px,92%)", margin: "0 auto", padding: "48px 0 90px" }}>
        {PARAS.map((p, i) => {
          if (i === 0)
            return <h1 key={i} style={{ fontFamily: "'Anton',var(--font-space-grotesk),sans-serif", textTransform: "uppercase", fontSize: "clamp(2rem,6vw,3.4rem)", textAlign: "center", letterSpacing: ".02em", margin: "0 0 8px" }}>{p}</h1>;
          if (i === 1)
            return <p key={i} style={{ textAlign: "center", color: "rgba(244,243,239,.75)", fontSize: 17, margin: "0 0 6px" }}>{p}</p>;
          if (i === 2)
            return <p key={i} style={{ textAlign: "center", color: "rgba(244,243,239,.5)", fontSize: 14, margin: "0 0 34px", whiteSpace: "pre-wrap" }}>{p}</p>;
          if (isHeading(p))
            return <h2 key={i} style={{ fontFamily: "'Anton',var(--font-space-grotesk),sans-serif", textTransform: "uppercase", fontSize: 20, letterSpacing: ".01em", margin: "34px 0 12px", color: "#fff", borderLeft: "3px solid #ff0000", paddingLeft: 12 }}>{p}</h2>;
          return (
            <p key={i} style={{ margin: isSub(p) ? "0 0 10px" : "0 0 14px", paddingLeft: isSub(p) ? 14 : 0, color: "rgba(244,243,239,.82)", fontSize: 15.5, lineHeight: 1.7, textAlign: "justify" }}>{p}</p>
          );
        })}

        <div style={{ marginTop: 40, paddingTop: 22, borderTop: "1px solid rgba(255,255,255,.12)", color: "rgba(244,243,239,.45)", fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase" }}>
          © 2026 LEX.AI · MC LEGAL yuridik firmasi
        </div>
      </main>
    </div>
  );
}
