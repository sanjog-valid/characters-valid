import { deploymentConfigError, env, isGeminiConfigured } from "@/lib/env";
import type { CharacterProfile } from "@/lib/types";

type GeminiPart = {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
};

type GeminiFetchOptions = {
  label: string;
  url: string;
  body: unknown;
};

const retryableStatuses = new Set([429, 500, 502, 503, 504]);

const profileSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    apparent_age_range: { type: "string" },
    gender_presentation: { type: "string" },
    wardrobe: { type: "array", items: { type: "string" } },
    dominant_colors: { type: "array", items: { type: "string" } },
    expression: { type: "string" },
    pose: { type: "string" },
    shot_type: { type: "string" },
    background: { type: "string" },
    style: { type: "string" },
    quality_notes: { type: "string" },
    searchable_phrases: { type: "array", items: { type: "string" } }
  },
  required: [
    "summary",
    "apparent_age_range",
    "gender_presentation",
    "wardrobe",
    "dominant_colors",
    "expression",
    "pose",
    "shot_type",
    "background",
    "style",
    "quality_notes",
    "searchable_phrases"
  ]
};

export function createFallbackProfile(fileName: string): CharacterProfile {
  const normalized = fileName.replace(/[-_]/g, " ").replace(/\.[a-z0-9]+$/i, "").trim();

  return {
    summary: normalized
      ? `Character reference image from ${normalized}. Add Gemini to generate precise visual analysis.`
      : "Character reference image awaiting Gemini visual analysis.",
    apparent_age_range: "unknown",
    gender_presentation: "unknown",
    wardrobe: ["unprocessed"],
    dominant_colors: ["unknown"],
    expression: "unknown",
    pose: "unknown",
    shot_type: "unknown",
    background: "unknown",
    style: "realistic AI character reference",
    quality_notes: "Gemini API key is not configured, so this record is using fallback metadata.",
    searchable_phrases: [normalized, "character reference", "ai video ad character"].filter(Boolean)
  };
}

export function buildSearchDocument(profile: CharacterProfile, clientName: string, fileName: string) {
  return [
    clientName,
    fileName,
    profile.summary,
    profile.apparent_age_range,
    profile.gender_presentation,
    profile.wardrobe.join(" "),
    profile.dominant_colors.join(" "),
    profile.expression,
    profile.pose,
    profile.shot_type,
    profile.background,
    profile.style,
    profile.quality_notes,
    profile.searchable_phrases.join(" ")
  ]
    .filter(Boolean)
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}

export async function analyzeCharacterImage(input: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}) {
  if (!isGeminiConfigured()) {
    throw new Error(deploymentConfigError(["GEMINI_API_KEY"]));
  }

  const parts: GeminiPart[] = [
    {
      text:
        "Analyze this AI video ad character base image for an internal reusable character library. " +
        "Do not identify the person. Do not infer a real identity. Describe only visible production-relevant traits. " +
        "Return concise JSON for semantic search. Avoid manual tagging language. " +
        "Use 'unknown' when a trait is not visible. Describe cultural clothing only when visible; do not guess ethnicity."
    },
    {
      inlineData: {
        mimeType: input.mimeType,
        data: input.buffer.toString("base64")
      }
    }
  ];

  const payload = await fetchGeminiJson({
    label: "Gemini image analysis",
    url: `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiVisionModel}:generateContent?key=${env.geminiApiKey}`,
    body: {
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: profileSchema
      }
    }
  });
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini image analysis returned no text response.");
  }

  return normalizeProfile(JSON.parse(text));
}

export async function embedSearchText(text: string, taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY") {
  if (!isGeminiConfigured()) {
    return null;
  }

  const payload = await fetchGeminiJson({
    label: "Gemini embedding",
    url: `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiEmbeddingModel}:embedContent?key=${env.geminiApiKey}`,
    body: {
      model: `models/${env.geminiEmbeddingModel}`,
      content: {
        parts: [{ text }]
      },
      taskType,
      outputDimensionality: env.geminiEmbeddingDimensions
    }
  });
  const values = payload?.embedding?.values;

  if (!Array.isArray(values)) {
    throw new Error("Gemini embedding response did not include embedding values.");
  }

  return values as number[];
}

export function toVectorLiteral(values: number[] | null) {
  if (!values) {
    return null;
  }

  return `[${values.map((value) => Number(value).toFixed(8)).join(",")}]`;
}

function normalizeProfile(value: Partial<CharacterProfile>): CharacterProfile {
  return {
    summary: value.summary || "AI character reference image.",
    apparent_age_range: value.apparent_age_range || "unknown",
    gender_presentation: value.gender_presentation || "unknown",
    wardrobe: normalizeList(value.wardrobe),
    dominant_colors: normalizeList(value.dominant_colors),
    expression: value.expression || "unknown",
    pose: value.pose || "unknown",
    shot_type: value.shot_type || "unknown",
    background: value.background || "unknown",
    style: value.style || "realistic AI character reference",
    quality_notes: value.quality_notes || "No quality notes generated.",
    searchable_phrases: normalizeList(value.searchable_phrases)
  };
}

function normalizeList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 12);
}

async function fetchGeminiJson(options: GeminiFetchOptions) {
  const maxAttempts = 4;
  let lastMessage = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(options.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(options.body)
      });

      if (response.ok) {
        return response.json();
      }

      const message = await response.text();
      lastMessage = `${response.status} ${message}`;

      if (!retryableStatuses.has(response.status) || attempt === maxAttempts) {
        throw new Error(`${options.label} failed: ${lastMessage}`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith(`${options.label} failed:`)) {
        throw error;
      }

      lastMessage = error instanceof Error ? error.message : "fetch failed";

      if (attempt === maxAttempts || !isRetryableGeminiError(lastMessage)) {
        throw new Error(`${options.label} failed: ${lastMessage}`);
      }
    }

    await sleep(900 * attempt * attempt);
  }

  throw new Error(`${options.label} failed: ${lastMessage || "unknown error"}`);
}

function isRetryableGeminiError(message: string) {
  return /fetch failed|429|500|502|503|504|UNAVAILABLE|RESOURCE_EXHAUSTED/i.test(message);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
