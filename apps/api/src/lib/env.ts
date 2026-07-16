export const env = {
  port: Number(process.env.API_PORT ?? 3001),
  jwtSecret: process.env.JWT_SECRET ?? "change-me-in-production",
  webUrl: process.env.WEB_URL ?? "http://localhost:3000",
};
