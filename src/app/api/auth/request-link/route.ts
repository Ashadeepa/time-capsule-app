import { NextRequest, NextResponse } from "next/server";
import { createMagicLink } from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/mailer";
import { getClientIp } from "@/lib/rateLimit";
import { guard, guardResponse } from "@/lib/abuseGuard";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IP_RATE_LIMIT = { max: 5, windowSeconds: 60 * 60 }; // 5 link requests/hour/IP.
const EMAIL_RATE_LIMIT = { max: 3, windowSeconds: 60 * 60 }; // 3 link requests/hour/email — stops spamming someone else's inbox.

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const [ipResult, emailResult] = await Promise.all([
    guard(getClientIp(req), "auth-link-ip", IP_RATE_LIMIT.max, IP_RATE_LIMIT.windowSeconds),
    guard(email, "auth-link-email", EMAIL_RATE_LIMIT.max, EMAIL_RATE_LIMIT.windowSeconds),
  ]);
  const blockedResponse = guardResponse(ipResult) ?? guardResponse(emailResult);
  if (blockedResponse) return blockedResponse;

  const token = await createMagicLink(email);
  const link = `${req.nextUrl.origin}/api/auth/verify?token=${token}`;
  await sendMagicLinkEmail(email, link);

  return NextResponse.json({ ok: true });
}
