import { NextRequest, NextResponse } from "next/server";
import { createCapsule, listCapsulesByEmail, MediaType, Recurrence } from "@/lib/capsules";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 10;
const MAX_MESSAGE_LENGTH = 20_000;
const MEDIA_TYPES: MediaType[] = ["photo", "audio", "video"];
const RECURRENCES: Recurrence[] = ["none", "yearly", "monthly"];
const MAX_RECURRENCE_YEARS = 20;
const WRITE_RATE_LIMIT = { max: 10, windowSeconds: 60 * 60 }; // 10 letters/hour/IP.
const LOOKUP_RATE_LIMIT = { max: 30, windowSeconds: 60 * 60 }; // 30 lookups/hour/IP.

export async function POST(req: NextRequest) {
  const { allowed } = await checkRateLimit(`capsules-write:${getClientIp(req)}`, WRITE_RATE_LIMIT.max, WRITE_RATE_LIMIT.windowSeconds);
  if (!allowed) {
    return NextResponse.json(
      { error: "You've sealed a lot of letters recently — try again later." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const {
    senderEmail,
    recipientEmails,
    title,
    message,
    deliveryDate,
    photoDataUrl,
    mediaUrl,
    mediaType,
    recurrence,
    recurrenceEndDate,
  } = body;

  if (!senderEmail || !EMAIL_RE.test(senderEmail)) {
    return NextResponse.json({ error: "A valid sender email is required." }, { status: 400 });
  }

  if (!Array.isArray(recipientEmails) || recipientEmails.length === 0) {
    return NextResponse.json({ error: "At least one recipient email is required." }, { status: 400 });
  }
  if (recipientEmails.length > MAX_RECIPIENTS) {
    return NextResponse.json({ error: `You can add at most ${MAX_RECIPIENTS} recipients.` }, { status: 400 });
  }
  const dedupedRecipients = [...new Set(recipientEmails.map((e) => String(e).trim().toLowerCase()))];
  if (dedupedRecipients.some((e) => !EMAIL_RE.test(e))) {
    return NextResponse.json({ error: "All recipient emails must be valid." }, { status: 400 });
  }

  if (!title || typeof title !== "string" || title.length > 120) {
    return NextResponse.json({ error: "Title is required (max 120 characters)." }, { status: 400 });
  }
  if (!message || typeof message !== "string" || message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Letter message is required (max ${MAX_MESSAGE_LENGTH} characters).` },
      { status: 400 }
    );
  }

  const parsedDate = new Date(deliveryDate);
  if (isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: "A valid delivery date is required." }, { status: 400 });
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (parsedDate <= today) {
    return NextResponse.json({ error: "Delivery date must be in the future." }, { status: 400 });
  }

  if (photoDataUrl && typeof photoDataUrl === "string" && photoDataUrl.length > 3_000_000) {
    return NextResponse.json({ error: "Photo is too large." }, { status: 400 });
  }

  if (mediaUrl && (typeof mediaUrl !== "string" || !MEDIA_TYPES.includes(mediaType))) {
    return NextResponse.json({ error: "A valid mediaType is required alongside mediaUrl." }, { status: 400 });
  }

  const resolvedRecurrence: Recurrence = recurrence ?? "none";
  if (!RECURRENCES.includes(resolvedRecurrence)) {
    return NextResponse.json({ error: "Invalid recurrence." }, { status: 400 });
  }

  let parsedRecurrenceEndDate: Date | null = null;
  if (resolvedRecurrence !== "none") {
    parsedRecurrenceEndDate = new Date(recurrenceEndDate);
    if (isNaN(parsedRecurrenceEndDate.getTime()) || parsedRecurrenceEndDate <= parsedDate) {
      return NextResponse.json(
        { error: "A repeat-until date after the delivery date is required for recurring letters." },
        { status: 400 }
      );
    }
    const maxEndDate = new Date(parsedDate);
    maxEndDate.setFullYear(maxEndDate.getFullYear() + MAX_RECURRENCE_YEARS);
    if (parsedRecurrenceEndDate > maxEndDate) {
      return NextResponse.json(
        { error: `Recurring letters can repeat for at most ${MAX_RECURRENCE_YEARS} years.` },
        { status: 400 }
      );
    }
  }

  const capsule = await createCapsule({
    senderEmail,
    recipientEmails: dedupedRecipients,
    title,
    message,
    deliveryDate: parsedDate,
    photoDataUrl: photoDataUrl ?? null,
    mediaUrl: mediaUrl ?? null,
    mediaType: mediaUrl ? mediaType : null,
    recurrence: resolvedRecurrence,
    recurrenceEndDate: parsedRecurrenceEndDate,
  });

  return NextResponse.json(capsule, { status: 201 });
}

export async function GET(req: NextRequest) {
  const { allowed } = await checkRateLimit(`capsules-lookup:${getClientIp(req)}`, LOOKUP_RATE_LIMIT.max, LOOKUP_RATE_LIMIT.windowSeconds);
  if (!allowed) {
    return NextResponse.json({ error: "Too many lookups — try again later." }, { status: 429 });
  }

  // The session's own email is the only email this endpoint will ever query for — a
  // ?email= query param is not honored, so signing in as X can never list Y's letters.
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
  const email = sessionToken ? await verifySessionToken(sessionToken) : null;
  if (!email) {
    return NextResponse.json({ error: "Sign in to view your letters." }, { status: 401 });
  }

  const capsules = await listCapsulesByEmail(email);

  // Trim to just what the list view needs (leave message/photo out of the list response).
  const summaries = capsules.map(
    ({
      id,
      title,
      senderEmail,
      recipientEmails,
      deliveryDate,
      status,
      mediaType,
      recurrence,
      recurrenceEndDate,
      createdAt,
      deliveredAt,
    }) => ({
      id,
      title,
      senderEmail,
      recipientEmails,
      deliveryDate,
      status,
      mediaType,
      recurrence,
      recurrenceEndDate,
      createdAt,
      deliveredAt,
    })
  );

  return NextResponse.json(summaries);
}
