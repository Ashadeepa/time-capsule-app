import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";

const VIOLATION_WINDOW_HOURS = 24;
const VIOLATION_THRESHOLD = 3; // 3 rate-limit hits in 24h from the same identifier -> auto-block.
const AUTO_BLOCK_HOURS = 24;

export type Block = { identifier: string; reason: string; blockedUntil: Date; createdAt: Date };
export type ViolationCount = { identifier: string; count: number };

export async function isBlocked(identifier: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM blocked_identifiers WHERE identifier = $1 AND blocked_until > now()`,
    [identifier]
  );
  return rows.length > 0;
}

export async function blockIdentifier(identifier: string, reason: string, hours: number): Promise<void> {
  const blockedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO blocked_identifiers (identifier, reason, blocked_until) VALUES ($1, $2, $3)
     ON CONFLICT (identifier) DO UPDATE SET reason = $2, blocked_until = $3`,
    [identifier, reason, blockedUntil]
  );
}

export async function unblockIdentifier(identifier: string): Promise<void> {
  await pool.query(`DELETE FROM blocked_identifiers WHERE identifier = $1`, [identifier]);
}

export async function listBlocks(): Promise<Block[]> {
  const { rows } = await pool.query(
    `SELECT identifier, reason, blocked_until, created_at FROM blocked_identifiers
     WHERE blocked_until > now() ORDER BY created_at DESC`
  );
  return rows.map((r) => ({
    identifier: r.identifier,
    reason: r.reason,
    blockedUntil: r.blocked_until,
    createdAt: r.created_at,
  }));
}

export async function listRecentViolations(hours = VIOLATION_WINDOW_HOURS): Promise<ViolationCount[]> {
  const { rows } = await pool.query(
    `SELECT identifier, count(*)::int AS count FROM abuse_violations
     WHERE occurred_at > now() - ($1 || ' hours')::interval
     GROUP BY identifier ORDER BY count DESC LIMIT 50`,
    [hours]
  );
  return rows.map((r) => ({ identifier: r.identifier, count: r.count }));
}

async function recordViolationAndMaybeAutoBlock(identifier: string): Promise<void> {
  await pool.query(`INSERT INTO abuse_violations (identifier) VALUES ($1)`, [identifier]);
  const { rows } = await pool.query(
    `SELECT count(*)::int AS count FROM abuse_violations
     WHERE identifier = $1 AND occurred_at > now() - ($2 || ' hours')::interval`,
    [identifier, VIOLATION_WINDOW_HOURS]
  );
  const count = rows[0].count as number;
  if (count >= VIOLATION_THRESHOLD) {
    await blockIdentifier(
      identifier,
      `Auto-blocked: ${count} rate-limit violations in ${VIOLATION_WINDOW_HOURS}h`,
      AUTO_BLOCK_HOURS
    );
  }
}

/**
 * Combined guard for a route: checks whether `identifier` (an IP or email) is currently
 * blocked, then applies the existing fixed-window rate limit. Repeated rate-limit hits from
 * the same identifier — across any route, since `identifier` alone is the block key —
 * escalate to an actual temporary block, not just a reset-every-window slowdown.
 */
export async function guard(
  identifier: string,
  routeKey: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; blocked: boolean }> {
  if (await isBlocked(identifier)) {
    return { allowed: false, blocked: true };
  }
  const { allowed } = await checkRateLimit(`${routeKey}:${identifier}`, limit, windowSeconds);
  if (!allowed) {
    await recordViolationAndMaybeAutoBlock(identifier);
  }
  return { allowed, blocked: false };
}

/** Turns a guard() result into the response a route should return, or null if the request may proceed. */
export function guardResponse(result: { allowed: boolean; blocked: boolean }): NextResponse | null {
  if (result.blocked) {
    return NextResponse.json(
      { error: "You've been temporarily blocked due to repeated abuse. Try again later." },
      { status: 403 }
    );
  }
  if (!result.allowed) {
    return NextResponse.json({ error: "Too many requests — try again later." }, { status: 429 });
  }
  return null;
}
