import { NextResponse } from "next/server";
import { recoverStorageOnlyUploads } from "@/lib/character-service";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const unauthorized = authorizeProcessor(request);

    if (unauthorized) {
      return unauthorized;
    }

    const body = await request.json().catch(() => ({}));
    const result = await recoverStorageOnlyUploads({ limit: Number(body?.limit || 100) });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function authorizeProcessor(request: Request) {
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

  return NextResponse.json({ error: "Unauthorized recovery request." }, { status: 401 });
}
