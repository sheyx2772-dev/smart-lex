import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// E-IMZO Client mahalliy WebSocket'i (127.0.0.1:64443) va rasmiy e-imzo.js/e-imzo-client.js
// (/public/eimzo/ dan, 'self' bilan qamrab olinadi) — imzolash oqimi buzilmasin deb
// connect-src'ga aniq qo'shilgan. Next.js hydration/inline skriptlari uchun 'unsafe-inline'
// hozircha kerak (to'liq nonce-asoslangan CSP — alohida, ehtiyotkorlik bilan qilinadigan qadam).
// `next dev`ning HMR/refresh runtime'i eval() ishlatadi — shuning uchun faqat devda
// 'unsafe-eval' qo'shiladi; production build'da eval umuman kerak emas, CSP qat'iy qoladi.
const isDev = process.env.NODE_ENV !== "production";
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' ws://127.0.0.1:* wss://127.0.0.1:* https://127.0.0.1:*",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@lex/shared"],
  // Tunnel (serveo/localhost.run) orqali kirishda dev-origin va Server Action so'rovlariga ruxsat.
  allowedDevOrigins: ["*.serveousercontent.com", "*.lhr.life", "*.trycloudflare.com"],
  experimental: {
    // Monorepo workspace paketlarini tashqi qilib qo'yish.
    externalDir: true,
    serverActions: {
      allowedOrigins: ["*.serveousercontent.com", "*.lhr.life", "*.trycloudflare.com"],
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
