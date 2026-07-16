import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

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
};

export default withNextIntl(nextConfig);
