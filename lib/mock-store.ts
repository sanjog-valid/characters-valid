import { buildSearchDocument, createFallbackProfile } from "@/lib/openai";
import { APPROVED_CLIENT_NAMES } from "@/lib/client-list";
import type { CharacterRecord, CharacterStatus, ClientRecord } from "@/lib/types";

type MockStore = {
  clients: ClientRecord[];
  characters: CharacterRecord[];
};

const now = new Date().toISOString();

const seedClients: ClientRecord[] = APPROVED_CLIENT_NAMES.map((name) => {
  const slug = slugify(name);

  return {
    id: `client-${slug}`,
    name,
    slug,
    created_at: now
  };
});

const seedImages = [
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=900&q=80"
];

const seedProfiles = [
  {
    summary: "Middle-aged man wearing a black shirt, direct-to-camera commercial reference.",
    apparent_age_range: "45-55",
    gender_presentation: "masculine",
    wardrobe: ["black shirt", "minimal styling"],
    dominant_colors: ["black", "neutral"],
    expression: "calm confident",
    pose: "front-facing head and shoulders",
    shot_type: "portrait",
    background: "neutral studio",
    style: "realistic AI ad character",
    quality_notes: "Clean reusable base image.",
    searchable_phrases: ["50 year old man", "black shirt", "middle aged male", "founder", "executive"]
  },
  {
    summary: "Professional woman in a blazer with polished commercial lighting.",
    apparent_age_range: "30-40",
    gender_presentation: "feminine",
    wardrobe: ["blazer", "business outfit"],
    dominant_colors: ["navy", "white"],
    expression: "approachable",
    pose: "three-quarter portrait",
    shot_type: "portrait",
    background: "office interior",
    style: "realistic AI ad character",
    quality_notes: "Strong business spokesperson reference.",
    searchable_phrases: ["businesswoman", "female founder", "corporate spokesperson", "blazer"]
  },
  {
    summary: "Older male doctor-style character in a light coat for healthcare ads.",
    apparent_age_range: "55-65",
    gender_presentation: "masculine",
    wardrobe: ["white coat", "blue shirt"],
    dominant_colors: ["white", "blue"],
    expression: "trustworthy",
    pose: "front-facing",
    shot_type: "medium portrait",
    background: "clinic-style interior",
    style: "realistic AI ad character",
    quality_notes: "Useful for medical explainer ads.",
    searchable_phrases: ["doctor", "older man", "healthcare", "white coat", "trustworthy"]
  },
  {
    summary: "Young startup operator in smart casual clothing.",
    apparent_age_range: "25-35",
    gender_presentation: "feminine",
    wardrobe: ["smart casual", "light blouse"],
    dominant_colors: ["cream", "charcoal"],
    expression: "focused",
    pose: "seated workspace portrait",
    shot_type: "portrait",
    background: "modern office",
    style: "realistic AI ad character",
    quality_notes: "Good for SaaS workflow demos.",
    searchable_phrases: ["startup employee", "operator", "young professional", "saas"]
  },
  {
    summary: "Athletic lifestyle character with casual training look.",
    apparent_age_range: "25-35",
    gender_presentation: "feminine",
    wardrobe: ["athletic top", "casual activewear"],
    dominant_colors: ["black", "gray"],
    expression: "energetic",
    pose: "upright portrait",
    shot_type: "portrait",
    background: "gym-adjacent neutral setting",
    style: "realistic AI ad character",
    quality_notes: "Reusable for fitness offers.",
    searchable_phrases: ["fitness woman", "athlete", "activewear", "gym", "wellness"]
  },
  {
    summary: "Casual male creator in a simple t-shirt for creator economy ads.",
    apparent_age_range: "30-40",
    gender_presentation: "masculine",
    wardrobe: ["plain t-shirt", "casual"],
    dominant_colors: ["white", "denim"],
    expression: "friendly",
    pose: "relaxed portrait",
    shot_type: "portrait",
    background: "neutral daylight interior",
    style: "realistic AI ad character",
    quality_notes: "General-purpose spokesperson base.",
    searchable_phrases: ["casual man", "creator", "plain t shirt", "friendly spokesman"]
  }
];

declare global {
  var __validCharacterLibraryMockStore: MockStore | undefined;
}

export function getMockStore() {
  if (!globalThis.__validCharacterLibraryMockStore) {
    globalThis.__validCharacterLibraryMockStore = {
      clients: seedClients,
      characters: seedProfiles.map((profile, index) => {
        const client = seedClients[index % seedClients.length];
        return {
          id: `mock-character-${index + 1}`,
          client_id: client.id,
          client_name: client.name,
          file_name: `demo-character-${index + 1}.jpg`,
          mime_type: "image/jpeg",
          image_url: seedImages[index],
          preview_url: seedImages[index],
          status: "ready",
          profile,
          search_document: buildSearchDocument(profile, client.name, `demo-character-${index + 1}.jpg`),
          created_at: new Date(Date.now() - index * 86400000).toISOString(),
          updated_at: now
        };
      })
    };
  }

  return globalThis.__validCharacterLibraryMockStore;
}

export function addMockClient(name: string) {
  const store = getMockStore();
  const slug = slugify(name);
  const existing = store.clients.find((client) => client.slug === slug);

  if (existing) {
    return existing;
  }

  const client: ClientRecord = {
    id: crypto.randomUUID(),
    name,
    slug,
    created_at: new Date().toISOString()
  };

  store.clients.push(client);
  return client;
}

export function addMockCharacter(input: {
  clientId?: string | null;
  fileName: string;
  mimeType: string;
  imageUrl: string;
  status?: CharacterStatus;
}) {
  const store = getMockStore();
  const client = input.clientId ? store.clients.find((item) => item.id === input.clientId) : null;
  const clientName = client?.name || "";
  const profile = createFallbackProfile(input.fileName);
  const record: CharacterRecord = {
    id: crypto.randomUUID(),
    client_id: client?.id || null,
    client_name: client?.name || "Unassigned",
    file_name: input.fileName,
    mime_type: input.mimeType,
    image_url: input.imageUrl,
    preview_url: input.imageUrl,
    status: input.status || "ready",
    profile,
    search_document: buildSearchDocument(profile, clientName, input.fileName),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  store.characters.unshift(record);
  return record;
}

export function deleteMockCharacter(id: string) {
  const store = getMockStore();
  const index = store.characters.findIndex((character) => character.id === id);

  if (index === -1) {
    throw new Error("Reference not found.");
  }

  store.characters.splice(index, 1);
}

export function searchMockCharacters(input: { query?: string; clientId?: string; status?: string }) {
  const store = getMockStore();
  const query = (input.query || "").toLowerCase().trim();
  const tokens = query.split(/\s+/).filter(Boolean);

  return store.characters
    .filter((character) => !input.clientId || character.client_id === input.clientId)
    .filter((character) => !input.status || input.status === "all" || character.status === input.status)
    .map((character) => {
      const haystack = character.search_document.toLowerCase();
      const matches = tokens.filter((token) => haystack.includes(token)).length;
      const similarity = tokens.length ? matches / tokens.length : undefined;
      return { ...character, similarity };
    })
    .filter((character) => !tokens.length || (character.similarity || 0) > 0)
    .sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
