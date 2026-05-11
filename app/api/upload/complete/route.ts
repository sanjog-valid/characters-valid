import { NextResponse } from "next/server";
import { completeStoredUploads } from "@/lib/character-service";
import type { FailedStoredUpload, StoredUpload } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { uploads?: StoredUpload[]; failed?: FailedStoredUpload[] };
    const uploads = Array.isArray(body.uploads) ? body.uploads : [];
    const failed = Array.isArray(body.failed) ? body.failed : [];

    if (!uploads.length && !failed.length) {
      return NextResponse.json({ error: "No uploaded files received." }, { status: 400 });
    }

    const characters = await completeStoredUploads({
      uploads: uploads.map((upload) => ({
        clientUploadId: String(upload.clientUploadId || ""),
        id: String(upload.id || ""),
        storagePath: String(upload.storagePath || ""),
        fileName: String(upload.fileName || "upload"),
        mimeType: String(upload.mimeType || "application/octet-stream")
      })),
      failed: failed.map((upload) => ({
        id: String(upload.id || ""),
        error: String(upload.error || "Direct storage upload failed.")
      }))
    });

    return NextResponse.json({ characters });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
