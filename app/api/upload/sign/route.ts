import { NextResponse } from "next/server";
import { createSignedUploadIntents } from "@/lib/character-service";
import type { UploadIntentFile } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { files?: UploadIntentFile[] };
    const files = Array.isArray(body.files) ? body.files : [];

    if (!files.length) {
      return NextResponse.json({ error: "No image files received." }, { status: 400 });
    }

    const uploads = await createSignedUploadIntents(
      files.map((file) => ({
        clientUploadId: String(file.clientUploadId || ""),
        fileName: String(file.fileName || "upload"),
        mimeType: String(file.mimeType || "application/octet-stream"),
        size: Number(file.size || 0)
      }))
    );

    return NextResponse.json({ uploads });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
