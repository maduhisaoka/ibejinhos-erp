import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);

  return new PrismaClient({
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });
}

function normalizeDatabaseUrl(value: string | undefined) {
  if (!value) return value;
  if (!value.includes("pooler.supabase.com")) return value;

  const url = new URL(value);
  if (!url.searchParams.has("pgbouncer")) {
    url.searchParams.set("pgbouncer", "true");
  }
  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", "1");
  }
  return url.toString();
}

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
