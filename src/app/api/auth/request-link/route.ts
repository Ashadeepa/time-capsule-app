import { NextRequest, NextResponse } from "next/server";
import { createMagicLink } from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/mailer";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IP_RATE_LIMIT = { max: 5, windowSeconds: 60 * 60 }; // 5 link requests/hour/IP.
const EMAIL_RATE_LIMIT = { max: 3, windowSeconds: 60 * 60 }; // 3 link requests/hour/email — stops spamming someone else's inbox.

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const [ipLimit, emailLimit] = await Promise.all([
    checkRateLimit(`auth-link-ip:${getClientIp(req)}`, IP_RATE_LIMIT.max, IP_RATE_LIMIT.windowSeconds),
    checkRateLimit(`auth-link-email:${email}`, EMAIL_RATE_LIMIT.max, EMAIL_RATE_LIMIT.windowSeconds),
  ]);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    return NextResponse.json({ error: "Too many sign-in requests — try again later." }, { status: 429 });
  }

  const token = await createMagicLink(email);
  const link = `${req.nextUrl.origin}/api/auth/verify?token=${token}`;
  await sendMagicLinkEmail(email, link);

  return NextResponse.json({ ok: true });
}
