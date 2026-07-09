import path from "node:path";
import { PrismaClient } from "@/generated/prisma/client";

// The Prisma CLI resolves a relative sqlite `file:` URL relative to
// prisma/schema.prisma (-> prisma/dev.db), but this generated client resolves
// it relative to its own output dir (src/generated/prisma) at runtime. Make
// it absolute here so the app opens the exact same file the CLI migrated.
function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (url.startsWith("file:") && !path.isAbsolute(url.slice("file:".length))) {
    const absolute = path.join(process.cwd(), "prisma", url.slice("file:".length));
    return `file:${absolute.split(path.sep).join("/")}`;
  }
  return url;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: resolveDatabaseUrl() });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
