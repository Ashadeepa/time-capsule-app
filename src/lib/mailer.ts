import { Resend } from "resend";
import type { Capsule } from "@/lib/capsules";

/**
 * Sends the capsule's email via Resend when RESEND_API_KEY + EMAIL_FROM are set in .env.
 * Falls back to mock mode (console log only, no network call) when they aren't, so the
 * app still runs end to end without a real provider configured — see README.md.
 */
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export function buildSubject(capsule: Pick<Capsule, "title">): string {
  return `A letter from your past self: "${capsule.title}"`;
}

function buildMediaHtml(capsule: Capsule): string {
  // New uploads use media_url/media_type (Vercel Blob); rows from before that migration
  // fall back to the legacy base64 photo_data_url.
  if (capsule.mediaUrl && capsule.mediaType === "photo") {
    return `<img src="${capsule.mediaUrl}" alt="attached photo" style="max-width: 100%; border-radius: 8px; margin-bottom: 20px;" />`;
  }
  if (capsule.mediaUrl && capsule.mediaType === "audio") {
    return `<p style="margin-bottom: 20px;"><a href="${capsule.mediaUrl}" style="color: #C1663B;">🎧 Listen to the voice message</a></p>`;
  }
  if (capsule.mediaUrl && capsule.mediaType === "video") {
    return `<p style="margin-bottom: 20px;"><a href="${capsule.mediaUrl}" style="color: #C1663B;">🎬 Watch the video</a></p>`;
  }
  if (capsule.photoDataUrl) {
    return `<img src="${capsule.photoDataUrl}" alt="attached photo" style="max-width: 100%; border-radius: 8px; margin-bottom: 20px;" />`;
  }
  return "";
}

export function buildEmailHtml(capsule: Capsule): string {
  const formattedDate = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "long",
  }).format(capsule.createdAt);

  return `
  <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 560px; margin: 0 auto; background: #FBF4E9; padding: 32px; border-radius: 12px; color: #2E2A26;">
    <p style="font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #C1663B; margin-bottom: 4px;">Time Capsule</p>
    <h1 style="font-size: 22px; margin: 0 0 4px;">${escapeHtml(capsule.title)}</h1>
    <p style="font-size: 13px; color: #6b6258; margin: 0 0 24px;">Written on ${formattedDate}</p>
    ${buildMediaHtml(capsule)}
    <p style="font-size: 16px; line-height: 1.7; white-space: pre-wrap;">${escapeHtml(capsule.message)}</p>
    <hr style="border: none; border-top: 1px solid #e6dcc9; margin: 28px 0;" />
    <p style="font-size: 12px; color: #8a8073;">This letter was sealed by ${escapeHtml(capsule.senderEmail)} and scheduled for delivery today. It can never be edited after sealing — only opened.</p>
  </div>`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendMagicLinkEmail(email: string, link: string): Promise<void> {
  const html = `
  <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 560px; margin: 0 auto; background: #FBF4E9; padding: 32px; border-radius: 12px; color: #2E2A26;">
    <p style="font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: #C1663B; margin-bottom: 4px;">Time Capsule</p>
    <h1 style="font-size: 22px; margin: 0 0 16px;">Sign in to your letters</h1>
    <p style="font-size: 16px; line-height: 1.7;">Click below to see the letters you've sent or are waiting to receive. This link works once and expires in 15 minutes.</p>
    <p style="margin: 28px 0;"><a href="${link}" style="display: inline-block; background: #8A2E2E; color: #FBF4E9; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 15px;">View my letters</a></p>
    <p style="font-size: 12px; color: #8a8073;">If you didn't request this, you can safely ignore this email.</p>
  </div>`;

  if (!resend) {
    console.log(`[mock mailer] Would send magic link to ${email}: ${link}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: email,
    subject: "Sign in to Time Capsule",
    html,
  });

  if (error) {
    throw new Error(`Resend failed to send magic link to ${email}: ${error.message}`);
  }
}

export async function sendCapsuleEmail(capsule: Capsule): Promise<{ html: string }> {
  const html = buildEmailHtml(capsule);
  const subject = buildSubject(capsule);

  if (!resend) {
    // Mock mode: no network call, just a server-side log so you can see it "sent" during development.
    console.log(
      `[mock mailer] Would deliver capsule ${capsule.id} to ${capsule.recipientEmails.join(", ")} — subject: "${subject}"`
    );
    return { html };
  }

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: capsule.recipientEmails,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend failed to deliver capsule ${capsule.id}: ${error.message}`);
  }

  return { html };
}
