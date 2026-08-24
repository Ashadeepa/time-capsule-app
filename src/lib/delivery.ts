import { Capsule, markDelivered, spawnNextOccurrence } from "@/lib/capsules";
import { sendCapsuleEmail } from "@/lib/mailer";

/**
 * Shared by the manual "Deliver now (demo)" route and the daily cron route, so both
 * behave identically — including spawning the next occurrence for recurring capsules.
 */
export async function deliverCapsule(
  capsule: Capsule
): Promise<{ updated: Capsule; html: string; spawned: Capsule | null }> {
  const { html } = await sendCapsuleEmail(capsule);
  const updated = await markDelivered(capsule.id);
  const spawned = await spawnNextOccurrence(capsule);
  return { updated, html, spawned };
}
