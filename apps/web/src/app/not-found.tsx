import Link from "next/link";

/** App Router uchun 404 sahifasi. Bu fayl yo'q edi — Next.js build paytida statik
 * 404/500 eksport qilishda o'zining ichki pages-router-uslubidagi zaxira sahifasiga
 * qaytib, "<Html> should not be imported outside of pages/_document" xatosini berardi
 * (localhost:3000 dev-serverda ko'rinmaydi, faqat `next build`da chiqadi). */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-black text-center text-white">
      <p className="text-sm uppercase tracking-[0.3em] text-white/40">404</p>
      <h1 className="font-display text-3xl font-bold">Sahifa topilmadi</h1>
      <Link href="/" className="mt-2 rounded-full border border-white/25 px-5 py-2 text-sm font-semibold hover:bg-white hover:text-black">
        Bosh sahifaga qaytish
      </Link>
    </div>
  );
}
