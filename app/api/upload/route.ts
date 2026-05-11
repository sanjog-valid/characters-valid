import { NextResponse } from "next/server";
import { uploadAndProcessCharacters } from "@/lib/character-service";
import type { UploadAssignment } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
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
