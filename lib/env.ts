export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || "Valid Character Library",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  storageBucket: process.env.SUPABASE_STORAGE_BUCKET || "characters",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiVisionModel: process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash",
  geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001",
  geminiEmbeddingDimensions: Number(process.env.GEMINI_EMBEDDING_DIMENSIONS || 768)
};

export function isSupabaseConfigured() {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}

export function isGeminiConfigured() {
  return Boolean(env.geminiApiKey);
}
