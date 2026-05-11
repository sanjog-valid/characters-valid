import { NextResponse } from "next/server";
import { searchCharacters } from "@/lib/character-service";
import type { SearchRequest } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SearchRequest;
    const characters = await searchCharacters(body);

    return NextResponse.json({ characters });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
