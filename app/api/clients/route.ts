import { NextResponse } from "next/server";
import { listClients } from "@/lib/character-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ clients: await listClients() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await request.text();
    return NextResponse.json({ error: "Client management is maintained centrally." }, { status: 405 });
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return NextResponse.json({ error: message }, { status: 400 });
}
