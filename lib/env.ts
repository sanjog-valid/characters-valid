const defaultSupabaseUrl = "https://itfhtxwhlnssqyfeoskw.supabase.co";
const defaultStorageBucket = "characters";

export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || "Valid Character Library",
  supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || defaultSupabaseUrl,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  storageBucket: process.env.SUPABASE_STORAGE_BUCKET || defaultStorageBucket,
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

export function getRuntimeEnvStatus() {
  const missing: string[] = [];

  if (!env.supabaseUrl) {
    missing.push("SUPABASE_URL");
  }

  if (!env.supabaseServiceRoleKey) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (!env.geminiApiKey) {
    missing.push("GEMINI_API_KEY");
  }

  return {
    ok: missing.length === 0,
    missing,
    configured: {
      supabaseUrl: Boolean(env.supabaseUrl),
      supabaseServiceRoleKey: Boolean(env.supabaseServiceRoleKey),
      storageBucket: Boolean(env.storageBucket),
      geminiApiKey: Boolean(env.geminiApiKey),
      geminiVisionModel: Boolean(env.geminiVisionModel),
      geminiEmbeddingModel: Boolean(env.geminiEmbeddingModel)
    },
    supabaseConfigured: isSupabaseConfigured(),
    geminiConfigured: isGeminiConfigured()
  };
}

export function missingSupabaseEnv() {
  return getRuntimeEnvStatus().missing.filter((name) => name.startsWith("SUPABASE_"));
}

export function deploymentConfigError(missing: string[]) {
  return `Deployment is missing required environment variable${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}. Add the missing value${missing.length === 1 ? "" : "s"} in Vercel and redeploy.`;
}
