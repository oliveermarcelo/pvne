import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Sem DATABASE_URL (ex.: build do Docker) o "prisma generate" funciona normalmente;
    // comandos de migração exigem a variável.
    url: process.env.DATABASE_URL ?? "",
  },
});
