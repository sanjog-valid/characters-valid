import { NextResponse } from "next/server";
import { processPendingCharacters } from "@/lib/character-service";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  return handleProcessPending(request);
}

export async function POST(request: Request) {
  return handleProcessPending(request);
}

async function handleProcessPending(request: Request) {
  try {
    const unauthorized = authorizeProcessor(request);

    if (unauthorized) {
      return unauthorized;
    }

    const url = new URL(request.url);
    let limit = request.method === "POST" ? 1 : Number(url.searchParams.get("limit") || 2);

    if (request.method === "POST") {
      const body = await request.json().catch(() => ({}));

      if (Number.isFinite(Number(body?.limit))) {
        limit = Number(body.limit);
      }
    }

    const result = await processPendingCharacters({ limit });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function authorizeProcessor(request: Request) {
  if (request.method === "POST") {
    return null;
  }

  const allowedSecrets = [env.processorSecret, env.cronSecret].filter(Boolean);

  if (!allowedSecrets.length) {
    return null;
  }

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  const headerSecret = request.headers.get("x-processor-secret") || "";

  if (allowedSecrets.includes(token) || allowedSecrets.includes(headerSecret)) {
    return null;
  }

  return NextResponse.json({ error: "Unauthorized processor request." }, { status: 401 });
}
