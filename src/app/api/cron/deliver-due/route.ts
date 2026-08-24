import { NextRequest, NextResponse } from "next/server";
import { findDueCapsules, markDelivered, markFailed } from "@/lib/capsules";
import { sendCapsuleEmail } from "@/lib/mailer";

/**
 * This is the endpoint a real scheduler would hit once a day (Vercel Cron, a GitHub Action
 * on a schedule, a plain cron job hitting this URL with curl — any of them work).
 *
 * It finds every capsule whose deliveryDate has passed and is still "scheduled", and delivers
 * each one. Right now "deliver" just calls the mock mailer — see src/lib/mailer.ts for how to
 * swap in a real provider.
 *
 * Auth accepts three forms so this works whether it's Vercel Cron (which auto-sends
 * `Authorization: Bearer <CRON_SECRET>` once that env var is set on the project — no secret
 * needs to live in vercel.json), or a manual/GitHub Actions curl using ?secret= or a header.
 */
export async function GET(req: NextRequest) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const secret = bearer ?? req.nextUrl.searchParams.get("secret") ?? req.headers.get("x-cron-secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const due = await findDueCapsules();

  const results = [];
  for (const capsule of due) {
    try {
      await sendCapsuleEmail(capsule);
      await markDelivered(capsule.id);
      results.push({ id: capsule.id, status: "delivered" });
    } catch (err) {
      await markFailed(capsule.id);
      results.push({ id: capsule.id, status: "failed", error: String(err) });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
