import { NextResponse } from "next/server";
import { isGeminiConfigured, isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    supabaseConfigured: isSupabaseConfigured(),
    geminiConfigured: isGeminiConfigured()
  });
}
