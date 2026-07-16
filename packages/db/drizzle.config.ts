import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://lex:lex@localhost:5433/lex",
  },
  casing: "snake_case",
  verbose: true,
  strict: true,
});
