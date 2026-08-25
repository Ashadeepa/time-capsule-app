import { NextRequest, NextResponse } from "next/server";
import { blockIdentifier, listBlocks, listRecentViolations, unblockIdentifier } from "@/lib/abuseGuard";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

// Deliberately NOT using the abuseGuard escalation here — a mistyped secret shouldn't be
// able to auto-block the admin's own IP from every guarded route in the app.
const AUTH_ATTEMPT_LIMIT = { max: 20, windowSeconds: 60 * 60 };

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization");
  return header === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  const { allowed } = await checkRateLimit(`admin-auth:${getClientIp(req)}`, AUTH_ATTEMPT_LIMIT.max, AUTH_ATTEMPT_LIMIT.windowSeconds);
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  }
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [blocks, violations] = await Promise.all([listBlocks(), listRecentViolations()]);
  return NextResponse.json({ blocks, violations });
}

export async function POST(req: NextRequest) {
  const { allowed } = await checkRateLimit(`admin-auth:${getClientIp(req)}`, AUTH_ATTEMPT_LIMIT.max, AUTH_ATTEMPT_LIMIT.windowSeconds);
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  }
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
  if (!identifier) {
    return NextResponse.json({ error: "identifier is required." }, { status: 400 });
  }

  if (body.action === "unblock") {
    await unblockIdentifier(identifier);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "block") {
    const hours = Number(body.hours) > 0 ? Number(body.hours) : 24;
    const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "Manually blocked";
    await blockIdentifier(identifier, reason, hours);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "action must be 'block' or 'unblock'." }, { status: 400 });
}
