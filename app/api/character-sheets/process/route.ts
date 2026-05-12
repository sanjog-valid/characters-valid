import { NextResponse } from "next/server";
import { processQueuedCharacterSheets } from "@/lib/character-service";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = Number.isFinite(Number(body?.limit)) ? Number(body.limit) : 1;
    const result = await processQueuedCharacterSheets({ limit });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Character sheet processing failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
