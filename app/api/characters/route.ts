import { NextResponse } from "next/server";
import { listCharacters } from "@/lib/character-service";
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
