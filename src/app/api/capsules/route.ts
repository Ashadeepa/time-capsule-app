import { NextRequest, NextResponse } from "next/server";
import { createCapsule, listCapsulesByEmail } from "@/lib/capsules";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { senderEmail, recipientEmail, title, message, deliveryDate, photoDataUrl } = body;

  if (!senderEmail || !EMAIL_RE.test(senderEmail)) {
    return NextResponse.json({ error: "A valid sender email is required." }, { status: 400 });
  }
  if (!recipientEmail || !EMAIL_RE.test(recipientEmail)) {
    return NextResponse.json({ error: "A valid recipient email is required." }, { status: 400 });
  }
  if (!title || typeof title !== "string" || title.length > 120) {
    return NextResponse.json({ error: "Title is required (max 120 characters)." }, { status: 400 });
  }
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Letter message is required." }, { status: 400 });
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

  const capsule = await createCapsule({
    senderEmail,
    recipientEmail,
    title,
    message,
    deliveryDate: parsedDate,
    photoDataUrl: photoDataUrl ?? null,
  });

  return NextResponse.json(capsule, { status: 201 });
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid ?email= query param is required." }, { status: 400 });
  }

  const capsules = await listCapsulesByEmail(email);

  // Trim to just what the list view needs (leave message/photo out of the list response).
  const summaries = capsules.map(({ id, title, senderEmail, recipientEmail, deliveryDate, status, createdAt, deliveredAt }) => ({
    id,
    title,
    senderEmail,
    recipientEmail,
    deliveryDate,
    status,
    createdAt,
    deliveredAt,
  }));

  return NextResponse.json(summaries);
}
