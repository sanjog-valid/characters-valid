import { NextResponse } from "next/server";
import { after } from "next/server";
import { claimQueuedCharacterSheet, finishClaimedCharacterSheet } from "@/lib/character-service";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  try {
    const result = await claimQueuedCharacterSheet();

    if (result.sheet) {
      after(async () => {
        await finishClaimedCharacterSheet(result.sheet!.id);
      });
    }

    return NextResponse.json({
      started: result.sheet ? 1 : 0,
      remaining: result.remaining,
      sheet: result.sheet
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Character sheet processing failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
