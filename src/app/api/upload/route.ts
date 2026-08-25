import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const MAX_MEDIA_BYTES = 25 * 1024 * 1024; // 25MB — demo limit, same spirit as the old 2MB photo cap.
const RATE_LIMIT = { max: 20, windowSeconds: 60 * 60 }; // 20 uploads/hour/IP.

/**
 * Server half of a direct browser-to-Vercel-Blob upload: authorizes the client's upload
 * request (so large audio/video never has to pass through this Next.js function body).
 * See src/app/page.tsx for the client-side upload() call.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as HandleUploadBody;

  // Only rate-limit the token request (from the browser) — "blob.upload-completed" is a
  // callback from Vercel's own infrastructure, not the user, so it must never be throttled.
  if (body.type === "blob.generate-client-token") {
    const { allowed } = await checkRateLimit(`upload:${getClientIp(req)}`, RATE_LIMIT.max, RATE_LIMIT.windowSeconds);
    if (!allowed) {
      return NextResponse.json({ error: "Too many uploads — try again later." }, { status: 429 });
    }
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["image/*", "audio/*", "video/*"],
        maximumSizeInBytes: MAX_MEDIA_BYTES,
        addRandomSuffix: true,
      }),
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed." },
      { status: 400 }
    );
  }
}
