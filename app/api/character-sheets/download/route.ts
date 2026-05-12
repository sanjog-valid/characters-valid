import { NextResponse } from "next/server";
import { getCharacterSheetDownload } from "@/lib/character-service";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const characterId = new URL(request.url).searchParams.get("characterId") || "";
    const download = await getCharacterSheetDownload(characterId);

    return new Response(download.buffer, {
      headers: {
        "Content-Type": download.mimeType,
        "Content-Disposition": `attachment; filename="${safeHeaderFileName(download.fileName)}"`,
        "Cache-Control": "private, max-age=0, no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Character sheet download failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function safeHeaderFileName(value: string) {
  return (value || "character-sheet.png").replace(/["\r\n\\]+/g, "-");
}
