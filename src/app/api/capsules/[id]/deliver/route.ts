import { NextRequest, NextResponse } from "next/server";
import { getCapsuleById } from "@/lib/capsules";
import { deliverCapsule } from "@/lib/delivery";

/**
 * Manually trigger delivery of one capsule, regardless of its scheduled date.
 *
 * This exists so you can demo the full loop without waiting for the real date to arrive —
 * in production this wouldn't be exposed like this; delivery would only ever happen via
 * the scheduled job at /api/cron/deliver-due once a capsule's date has actually passed.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const capsule = await getCapsuleById(params.id);

  if (!capsule) {
    return NextResponse.json({ error: "Letter not found." }, { status: 404 });
  }

  if (capsule.status === "delivered") {
    return NextResponse.json({ error: "This letter has already been delivered." }, { status: 409 });
  }

  const { updated, html, spawned } = await deliverCapsule(capsule);

  return NextResponse.json({ capsule: updated, previewHtml: html, spawnedId: spawned?.id ?? null });
}
