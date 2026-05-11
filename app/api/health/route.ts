import { NextResponse } from "next/server";
import { getRuntimeEnvStatus } from "@/lib/env";

export const runtime = "nodejs";

export async function GET() {
  const status = getRuntimeEnvStatus();

  return NextResponse.json(status, { status: status.ok ? 200 : 503 });
}
