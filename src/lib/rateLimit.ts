import { NextRequest } from "next/server";
import { pool } from "@/lib/db";

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Fixed-window rate limiter backed by the `rate_limits` table (see db/schema.sql) — no
 * Redis needed at this scale. `key` should already include the route (e.g. "capsules:1.2.3.4").
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

  const { rows } = await pool.query(
    `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, $2, 1)
     ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
     RETURNING count`,
    [key, windowStart]
  );
  const count = rows[0].count as number;

  // Opportunistic cleanup so the table doesn't grow unbounded — no cron needed for this scale.
  if (Math.random() < 0.01) {
    pool.query(`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`).catch(() => {});
  }

  return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
}
