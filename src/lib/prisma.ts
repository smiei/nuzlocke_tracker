import path from "node:path";
// The /web build talks to Turso over HTTP in plain JS. The default build loads
// libSQL's native binding at import time, and that binding does not load on
// the Docker image's Alpine at all - even though Docker never uses it.
import { PrismaLibSQL } from "@prisma/adapter-libsql/web";
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

// Two ways to reach the same SQLite schema. A self-hosted container opens its
// database file with Prisma's own engine, exactly as it always has. A hosted
// deployment (Vercel) has no file that survives a request and talks to Turso
// over the libSQL driver adapter instead - TURSO_DATABASE_URL is what the
// Vercel Marketplace integration sets. `unixepoch-ms` makes the adapter store
// DateTime as the same integer the engine writes, so both paths read and sort
// each other's rows identically.
function createClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  if (tursoUrl) {
    const adapter = new PrismaLibSQL(
      { url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN },
      { timestampFormat: "unixepoch-ms" },
    );
    return new PrismaClient({ adapter });
  }
  return new PrismaClient({ datasourceUrl: resolveDatabaseUrl() });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
