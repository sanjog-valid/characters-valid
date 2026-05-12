import { deploymentConfigError, env, isOpenAIConfigured } from "@/lib/env";
import type { CharacterProfile } from "@/lib/types";

type OpenAIFetchOptions = {
  label: string;
  url: string;
  body: unknown | null;
};

export class RetryableAIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryableAIError";
  }
}

const retryableStatuses = new Set([429, 500, 502, 503, 504]);

const profileSchema = {
  type: "object",
  additionalProperties: false,
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
      ? `Character reference image from ${normalized}. Awaiting OpenAI visual analysis.`
      : "Character reference image awaiting OpenAI visual analysis.",
    apparent_age_range: "unknown",
    gender_presentation: "unknown",
    wardrobe: ["unprocessed"],
    dominant_colors: ["unknown"],
    expression: "unknown",
    pose: "unknown",
    shot_type: "unknown",
    background: "unknown",
    style: "realistic AI character reference",
    quality_notes: "OpenAI analysis has not completed yet.",
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
  if (!isOpenAIConfigured()) {
    throw new Error(deploymentConfigError(["OPENAI_API_KEY"]));
  }

  const payload = await fetchOpenAIJson({
    label: "OpenAI image analysis",
    url: "https://api.openai.com/v1/responses",
    body: {
      model: env.openaiVisionModel,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Analyze this AI video ad character base image for an internal reusable character library. " +
                "Do not identify the person. Do not infer a real identity. Describe only visible production-relevant traits. " +
                "Return concise JSON for semantic search. Use 'unknown' when a trait is not visible. " +
                "Describe cultural clothing only when visible; do not guess ethnicity."
            },
            {
              type: "input_image",
              image_url: `data:${input.mimeType};base64,${input.buffer.toString("base64")}`,
              detail: "low"
            }
          ]
        }
      ],
      max_output_tokens: 1200,
      text: {
        format: {
          type: "json_schema",
          name: "character_profile",
          strict: true,
          schema: profileSchema
        }
      }
    }
  });
  const text = extractResponseText(payload);

  if (!text) {
    throw new Error("OpenAI image analysis returned no text response.");
  }

  return normalizeProfile(JSON.parse(text));
}

export async function embedSearchText(text: string) {
  if (!isOpenAIConfigured()) {
    return null;
  }

  const payload = await fetchOpenAIJson({
    label: "OpenAI embedding",
    url: "https://api.openai.com/v1/embeddings",
    body: {
      model: env.openaiEmbeddingModel,
      input: text,
      dimensions: env.openaiEmbeddingDimensions
    }
  });
  const values = payload?.data?.[0]?.embedding;

  if (!Array.isArray(values)) {
    throw new Error("OpenAI embedding response did not include embedding values.");
  }

  return values as number[];
}

export async function startCharacterSheetGeneration(input: {
  buffer: Buffer;
  mimeType: string;
  prompt: string;
}) {
  if (!isOpenAIConfigured()) {
    throw new Error(deploymentConfigError(["OPENAI_API_KEY"]));
  }

  const payload = await fetchOpenAIJson({
    label: "OpenAI character sheet generation",
    url: "https://api.openai.com/v1/responses",
    body: {
      model: env.openaiImageResponseModel,
      background: true,
      store: true,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: input.prompt
            },
            {
              type: "input_image",
              image_url: `data:${input.mimeType || "image/png"};base64,${input.buffer.toString("base64")}`
            }
          ]
        }
      ],
      tools: [
        {
          type: "image_generation",
          size: env.openaiCharacterSheetSize,
          quality: env.openaiCharacterSheetQuality
        }
      ]
    }
  });

  if (typeof payload?.id !== "string") {
    throw new Error("OpenAI did not return a background response id.");
  }

  return {
    responseId: payload.id,
    status: typeof payload.status === "string" ? payload.status : "queued"
  };
}

export async function retrieveCharacterSheetGeneration(responseId: string) {
  if (!isOpenAIConfigured()) {
    throw new Error(deploymentConfigError(["OPENAI_API_KEY"]));
  }

  const payload = await fetchOpenAIJson({
    label: "OpenAI character sheet polling",
    url: `https://api.openai.com/v1/responses/${encodeURIComponent(responseId)}`,
    body: null
  });

  return {
    responseId,
    status: typeof payload?.status === "string" ? payload.status : "unknown",
    image: extractResponseImage(payload),
    error: typeof payload?.error?.message === "string" ? payload.error.message : null
  };
}

export function toVectorLiteral(values: number[] | null) {
  if (!values) {
    return null;
  }

  return `[${values.map((value) => Number(value).toFixed(8)).join(",")}]`;
}

export function normalizeProfile(value: Partial<CharacterProfile> | null | undefined): CharacterProfile {
  const profile = value || {};

  return {
    summary: profile.summary || "AI character reference image.",
    apparent_age_range: profile.apparent_age_range || "unknown",
    gender_presentation: profile.gender_presentation || "unknown",
    wardrobe: normalizeList(profile.wardrobe),
    dominant_colors: normalizeList(profile.dominant_colors),
    expression: profile.expression || "unknown",
    pose: profile.pose || "unknown",
    shot_type: profile.shot_type || "unknown",
    background: profile.background || "unknown",
    style: profile.style || "realistic AI character reference",
    quality_notes: profile.quality_notes || "No quality notes generated.",
    searchable_phrases: normalizeList(profile.searchable_phrases)
  };
}

export function isRetryableAIError(error: unknown) {
  if (error instanceof RetryableAIError) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return /fetch failed|429|500|502|503|504|rate limit|temporarily unavailable|timeout/i.test(message);
}

function normalizeList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 12);
}

async function fetchOpenAIJson(options: OpenAIFetchOptions) {
  const maxAttempts = 4;
  let lastMessage = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(options.url, {
        method: options.body === null ? "GET" : "POST",
        headers: {
          Authorization: `Bearer ${env.openaiApiKey}`,
          ...(options.body === null ? {} : { "Content-Type": "application/json" })
        },
        body: options.body === null ? undefined : JSON.stringify(options.body)
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
        if (isRetryableAIError(error)) {
          throw new RetryableAIError(error.message);
        }

        throw error;
      }

      lastMessage = error instanceof Error ? error.message : "fetch failed";

      if (attempt === maxAttempts || !isRetryableAIError(lastMessage)) {
        throw new Error(`${options.label} failed: ${lastMessage}`);
      }
    }

    await sleep(900 * attempt * attempt);
  }

  throw new RetryableAIError(`${options.label} failed: ${lastMessage || "unknown error"}`);
}

function extractResponseText(payload: any) {
  if (typeof payload?.output_text === "string") {
    return payload.output_text;
  }

  const chunks: string[] = [];
  const output = Array.isArray(payload?.output) ? payload.output : [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];

    for (const part of content) {
      if (typeof part?.text === "string") {
        chunks.push(part.text);
      }
    }
  }

  return chunks.join("").trim();
}

function extractResponseImage(payload: any) {
  const output = Array.isArray(payload?.output) ? payload.output : [];

  for (const item of output) {
    if (item?.type === "image_generation_call" && typeof item?.result === "string") {
      return {
        buffer: Buffer.from(item.result, "base64"),
        mimeType: "image/png"
      };
    }
  }

  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
