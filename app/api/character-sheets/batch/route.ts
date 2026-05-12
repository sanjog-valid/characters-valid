import { NextResponse } from "next/server";
import { enqueueMissingCharacterSheets } from "@/lib/character-service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  try {
    const result = await enqueueMissingCharacterSheets();

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Character sheet batch enqueue failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
