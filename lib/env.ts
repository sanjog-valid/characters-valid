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
  geminiEmbeddingDimensions: Number(process.env.GEMINI_EMBEDDING_DIMENSIONS || 768),
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiVisionModel: process.env.OPENAI_VISION_MODEL || "gpt-5-mini",
  openaiEmbeddingModel: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
  openaiEmbeddingDimensions: Number(process.env.OPENAI_EMBEDDING_DIMENSIONS || 768),
  openaiImageModel: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
  openaiCharacterSheetSize: process.env.OPENAI_CHARACTER_SHEET_SIZE || "3840x2160",
  openaiCharacterSheetQuality: process.env.OPENAI_CHARACTER_SHEET_QUALITY || "high",
  processorSecret: process.env.PROCESSOR_SECRET || "",
  cronSecret: process.env.CRON_SECRET || ""
};

export function isSupabaseConfigured() {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}

export function isGeminiConfigured() {
  return Boolean(env.geminiApiKey);
}

export function isOpenAIConfigured() {
  return Boolean(env.openaiApiKey);
}

export function getRuntimeEnvStatus() {
  const missing: string[] = [];

  if (!env.supabaseUrl) {
    missing.push("SUPABASE_URL");
  }

  if (!env.supabaseServiceRoleKey) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (!env.openaiApiKey) {
    missing.push("OPENAI_API_KEY");
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
      geminiEmbeddingModel: Boolean(env.geminiEmbeddingModel),
      openaiApiKey: Boolean(env.openaiApiKey),
      openaiVisionModel: Boolean(env.openaiVisionModel),
      openaiEmbeddingModel: Boolean(env.openaiEmbeddingModel),
      openaiImageModel: Boolean(env.openaiImageModel),
      processorSecret: Boolean(env.processorSecret),
      cronSecret: Boolean(env.cronSecret)
    },
    supabaseConfigured: isSupabaseConfigured(),
    geminiConfigured: isGeminiConfigured(),
    openaiConfigured: isOpenAIConfigured()
  };
}

export function missingSupabaseEnv() {
  return getRuntimeEnvStatus().missing.filter((name) => name.startsWith("SUPABASE_"));
}

export function deploymentConfigError(missing: string[]) {
  return `Deployment is missing required environment variable${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}. Add the missing value${missing.length === 1 ? "" : "s"} in Vercel and redeploy.`;
}
