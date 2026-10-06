import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

export type { Prisma } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL não configurada");
  const adapter = new PrismaPg({ connectionString, max: Number(process.env.DB_POOL_SIZE ?? 10) });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/** Cliente dentro de uma transação interativa */
export type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
/** Aceita tanto o cliente global quanto uma transação */
export type DbOrTx = typeof db | Tx;
