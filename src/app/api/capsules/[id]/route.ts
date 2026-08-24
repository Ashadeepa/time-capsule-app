import { NextRequest, NextResponse } from "next/server";
import { getCapsuleById } from "@/lib/capsules";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const capsule = await getCapsuleById(params.id);

  if (!capsule) {
    return NextResponse.json({ error: "Letter not found." }, { status: 404 });
  }

  return NextResponse.json(capsule);
}
