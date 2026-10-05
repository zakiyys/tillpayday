import { defineConfig } from "prisma/config";

// DATABASE_URL is read lazily so `prisma generate` works without a database.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "postgresql://invalid:invalid@127.0.0.1:1/invalid" },
});
