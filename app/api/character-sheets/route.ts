import { NextResponse } from "next/server";
import { getCharacterSheet, makeCharacterSheet } from "@/lib/character-service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const characterId = new URL(request.url).searchParams.get("characterId") || "";
    const sheet = await getCharacterSheet(characterId);

    return NextResponse.json({ sheet });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Character sheet lookup failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const characterId = typeof payload.characterId === "string" ? payload.characterId : "";
    const prompt = typeof payload.prompt === "string" && payload.prompt.trim() ? payload.prompt : undefined;
    const sheet = await makeCharacterSheet(characterId, prompt);

    return NextResponse.json({ sheet });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Character sheet generation failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
