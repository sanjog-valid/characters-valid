import { NextResponse } from "next/server";
import { deleteCharacter, listCharacters } from "@/lib/character-service";
import type { CharacterStatus } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const clientId = url.searchParams.get("clientId") || undefined;
    const status = (url.searchParams.get("status") || "all") as CharacterStatus | "all";
    const characters = await listCharacters({ clientId, status });

    return NextResponse.json({ characters });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const id = typeof payload.id === "string" ? payload.id : "";
    const result = await deleteCharacter(id);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
