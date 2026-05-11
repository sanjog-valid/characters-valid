import { NextResponse } from "next/server";
import { completeStoredUploads, uploadAndProcessCharacters } from "@/lib/character-service";
import type { StoredUpload, UploadAssignment } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { uploads?: StoredUpload[] };
      const uploads = Array.isArray(body.uploads) ? body.uploads : [];

      if (!uploads.length) {
        return NextResponse.json({ error: "No uploaded files received." }, { status: 400 });
      }

      const characters = await completeStoredUploads({
        uploads: uploads.map((upload) => ({
          clientUploadId: String(upload.clientUploadId || ""),
          id: String(upload.id || ""),
          storagePath: String(upload.storagePath || ""),
          fileName: String(upload.fileName || "upload"),
          mimeType: String(upload.mimeType || "application/octet-stream")
        }))
      });

      return NextResponse.json({ characters });
    }

    const formData = await request.formData();
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);
    const assignments = parseAssignments(formData.get("assignments"));

    if (!files.length) {
      return NextResponse.json({ error: "No image files received." }, { status: 400 });
    }

    const characters = await uploadAndProcessCharacters({ files, assignments });
    return NextResponse.json({ characters });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function parseAssignments(value: FormDataEntryValue | null): UploadAssignment[] {
  if (!value || typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
