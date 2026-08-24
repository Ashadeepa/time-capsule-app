import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

const MAX_MEDIA_BYTES = 25 * 1024 * 1024; // 25MB — demo limit, same spirit as the old 2MB photo cap.

/**
 * Server half of a direct browser-to-Vercel-Blob upload: authorizes the client's upload
 * request (so large audio/video never has to pass through this Next.js function body).
 * See src/app/page.tsx for the client-side upload() call.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as HandleUploadBody;

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
