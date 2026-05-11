import { NextResponse } from "next/server";
import { getCharacterDownload } from "@/lib/character-service";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id") || "";
    const download = await getCharacterDownload(id);

    return new Response(download.buffer, {
      headers: {
        "Content-Type": download.mimeType,
        "Content-Disposition": `attachment; filename="${safeHeaderFileName(download.fileName)}"`,
        "Cache-Control": "private, max-age=0, no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Download failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function safeHeaderFileName(value: string) {
  return (value || "character-reference").replace(/["\r\n\\]+/g, "-");
}
