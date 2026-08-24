import { Pool } from "pg";

// Reuse a single pool across hot reloads in dev, same idea as the usual Prisma-singleton pattern.
const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPg.pgPool = pool;
}
