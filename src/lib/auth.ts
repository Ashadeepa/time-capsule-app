import { randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { pool } from "@/lib/db";

const MAGIC_LINK_TTL_MINUTES = 15;
const SESSION_TTL_DAYS = 30;
export const SESSION_COOKIE = "session";

function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set — required for magic-link auth.");
  }
  return new TextEncoder().encode(secret);
}

/** Creates a single-use magic-link token for `email`, valid for 15 minutes. */
export async function createMagicLink(email: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60 * 1000);
  await pool.query(`INSERT INTO magic_links (token, email, expires_at) VALUES ($1, $2, $3)`, [
    token,
    email,
    expiresAt,
  ]);
  return token;
}

/** Consumes a magic-link token (single use). Returns the email it was issued for, or null if invalid/expired/used. */
export async function consumeMagicLink(token: string): Promise<string | null> {
  const { rows } = await pool.query(
    `UPDATE magic_links SET used_at = now()
     WHERE token = $1 AND used_at IS NULL AND expires_at > now()
     RETURNING email`,
    [token]
  );
  return rows[0]?.email ?? null;
}

/** Signs a session JWT for `email`, valid for 30 days. */
export async function createSessionToken(email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_DAYS}d`)
    .sign(getSessionSecret());
}

/** Verifies a session JWT and returns the email it was issued for, or null if invalid/expired. */
export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}
