const globalForPrisma = globalThis as unknown as {
  prisma?: unknown;
};

function createPrismaClient() {
  // Loaded lazily so the existing local SQLite build keeps working until
  // `npm install` generates `@prisma/client` for the Supabase deployment.
  const prismaPackage = eval("require")("@prisma/client") as {
    PrismaClient: new (options?: { log?: string[] }) => unknown;
  };

  return new prismaPackage.PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });
}

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
