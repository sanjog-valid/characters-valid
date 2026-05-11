import { deploymentConfigError, env, isGeminiConfigured, isSupabaseConfigured, missingSupabaseEnv } from "@/lib/env";
import { analyzeCharacterImage, buildSearchDocument, embedSearchText, normalizeProfile, toVectorLiteral } from "@/lib/gemini";
import { addMockCharacter, addMockClient, deleteMockCharacter, getMockStore, searchMockCharacters } from "@/lib/mock-store";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type {
  CharacterProfile,
  CharacterRecord,
  CharacterStatus,
  ClientRecord,
  SignedUploadIntent,
  StoredUpload,
  UploadAssignment,
  UploadIntentFile
} from "@/lib/types";

type CharacterRow = {
  id: string;
  client_id: string | null;
  clients?: { name?: string } | { name?: string }[];
  client_name?: string;
  file_name: string;
  mime_type: string;
  storage_path: string;
  status: CharacterStatus;
  profile: CharacterRecord["profile"];
  search_document: string;
  similarity?: number;
  error_message?: string | null;
  created_at: string;
  updated_at?: string;
};

type CharacterDownloadRow = {
  file_name: string;
  mime_type: string;
  storage_path: string;
};

type CharacterDeleteRow = {
  id: string;
  storage_path: string;
};

export async function listClients(): Promise<ClientRecord[]> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return getMockStore().clients;
  }

  const { data, error } = await supabase.from("clients").select("id,name,slug,created_at").order("name");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function createClient(name: string): Promise<ClientRecord> {
  const cleanName = name.trim();

  if (!cleanName) {
    throw new Error("Client name is required.");
  }

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return addMockClient(cleanName);
  }

  const slug = slugify(cleanName);
  const { data, error } = await supabase
    .from("clients")
    .upsert({ name: cleanName, slug }, { onConflict: "slug" })
    .select("id,name,slug,created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function listCharacters(input: {
  clientId?: string;
  status?: CharacterStatus | "all";
  limit?: number;
} = {}) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return searchMockCharacters({ clientId: input.clientId, status: input.status });
  }

  let query = supabase
    .from("characters")
    .select("id,client_id,clients(name),file_name,mime_type,storage_path,status,profile,search_document,error_message,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(input.limit || 80);

  if (input.clientId) {
    query = query.eq("client_id", input.clientId);
  }

  if (input.status && input.status !== "all") {
    query = query.eq("status", input.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return Promise.all((data || []).map((row) => mapCharacterRow(row as CharacterRow)));
}

export async function searchCharacters(input: {
  query?: string;
  clientId?: string;
  gender?: string;
  age?: string;
}) {
  const cleanQuery = (input.query || "").trim();
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return filterLibraryCharacters(searchMockCharacters({ ...input, status: "ready" }), input);
  }

  if (!cleanQuery) {
    const characters = await listCharacters({ clientId: input.clientId, status: "ready" });
    return filterLibraryCharacters(characters, input);
  }

  if (isGeminiConfigured()) {
    const embedding = await embedSearchText(cleanQuery, "RETRIEVAL_QUERY");

    if (embedding) {
      const { data, error } = await supabase.rpc("match_characters", {
        query_embedding: toVectorLiteral(embedding),
        match_count: 60,
        filter_client_id: input.clientId || null,
        filter_status: "ready"
      });

      if (error) {
        throw new Error(error.message);
      }

      const characters = await Promise.all(((data || []) as CharacterRow[]).map((row) => mapCharacterRow(row)));
      return filterLibraryCharacters(characters, input);
    }
  }

  let query = supabase
    .from("characters")
    .select("id,client_id,clients(name),file_name,mime_type,storage_path,status,profile,search_document,error_message,created_at,updated_at")
    .or(`search_document.ilike.%${cleanQuery}%,file_name.ilike.%${cleanQuery}%`)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(60);

  if (input.clientId) {
    query = query.eq("client_id", input.clientId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const characters = await Promise.all((data || []).map((row) => mapCharacterRow(row as CharacterRow)));
  return filterLibraryCharacters(characters, input);
}

export async function uploadAndProcessCharacters(input: {
  files: File[];
  assignments: UploadAssignment[];
}) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    const records = await Promise.all(
      input.files.map(async (file, index) => {
        const assignment = input.assignments.find((item) => item.index === index);
        const buffer = Buffer.from(await file.arrayBuffer());
        const imageUrl = `data:${file.type};base64,${buffer.toString("base64")}`;
        return addMockCharacter({
          clientId: assignment?.clientId || null,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          imageUrl
        });
      })
    );

    return records;
  }

  const results: CharacterRecord[] = [];

  for (const file of input.files) {
    const id = crypto.randomUUID();
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";
    const storagePath = `unassigned/${id}-${safeFileName(file.name)}`;

    const upload = await supabase.storage.from(env.storageBucket).upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false
    });

    if (upload.error) {
      throw new Error(upload.error.message);
    }

    await supabase.from("characters").insert({
      id,
      client_id: null,
      file_name: file.name,
      mime_type: mimeType,
      storage_path: storagePath,
      status: "processing"
    });

    await supabase.from("processing_events").insert({
      character_id: id,
      event_type: "upload_stored",
      message: "Image uploaded to private storage."
    });

    try {
      const profile = await analyzeCharacterImage({ buffer, mimeType, fileName: file.name });
      const searchDocument = buildSearchDocument(profile, "", file.name);
      const embedding = await embedSearchText(searchDocument, "RETRIEVAL_DOCUMENT");

      const { data, error } = await supabase
        .from("characters")
        .update({
          status: "ready",
          profile,
          search_document: searchDocument,
          embedding: toVectorLiteral(embedding),
          error_message: null
        })
        .eq("id", id)
        .select("id,client_id,clients(name),file_name,mime_type,storage_path,status,profile,search_document,error_message,created_at,updated_at")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      await supabase.from("processing_events").insert({
        character_id: id,
        event_type: "analysis_ready",
        message: "AI profile and embedding generated."
      });

      results.push(await mapCharacterRow(data as CharacterRow));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown processing error.";

      await supabase.from("characters").update({ status: "failed", error_message: message }).eq("id", id);
      await supabase.from("processing_events").insert({
        character_id: id,
        event_type: "analysis_failed",
        message
      });

      results.push({
        id,
        client_id: null,
        client_name: "Unassigned",
        file_name: file.name,
        mime_type: mimeType,
        storage_path: storagePath,
        image_url: await signedImageUrl(storagePath),
        status: "failed",
        profile: {
          summary: "Processing failed.",
          apparent_age_range: "unknown",
          gender_presentation: "unknown",
          wardrobe: [],
          dominant_colors: [],
          expression: "unknown",
          pose: "unknown",
          shot_type: "unknown",
          background: "unknown",
          style: "unknown",
          quality_notes: message,
          searchable_phrases: []
        },
        search_document: "",
        error_message: message,
        created_at: new Date().toISOString()
      });
    }
  }

  return results;
}

export async function createSignedUploadIntents(files: UploadIntentFile[]): Promise<SignedUploadIntent[]> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error(deploymentConfigError(missingSupabaseEnv()));
  }

  const validFiles = files.filter((file) => file.mimeType.startsWith("image/"));

  if (!validFiles.length) {
    throw new Error("No image files received.");
  }

  const intents: SignedUploadIntent[] = [];

  for (const file of validFiles) {
    const id = crypto.randomUUID();
    const storagePath = `unassigned/${id}-${safeFileName(file.fileName)}`;
    const { data, error } = await supabase.storage.from(env.storageBucket).createSignedUploadUrl(storagePath, {
      upsert: false
    });

    if (error) {
      throw new Error(error.message);
    }

    intents.push({
      ...file,
      id,
      storagePath,
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path
    });
  }

  return intents;
}

export async function processStoredUploads(input: { uploads: StoredUpload[] }) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error(deploymentConfigError(missingSupabaseEnv()));
  }

  if (!input.uploads.length) {
    throw new Error("No uploaded files received.");
  }

  const results: CharacterRecord[] = [];

  for (const upload of input.uploads) {
    const mimeType = upload.mimeType || "application/octet-stream";
    const download = await supabase.storage.from(env.storageBucket).download(upload.storagePath);

    if (download.error) {
      throw new Error(download.error.message);
    }

    const buffer = Buffer.from(await download.data.arrayBuffer());

    await supabase.from("characters").insert({
      id: upload.id,
      client_id: null,
      file_name: upload.fileName,
      mime_type: mimeType,
      storage_path: upload.storagePath,
      status: "processing"
    });

    await supabase.from("processing_events").insert({
      character_id: upload.id,
      event_type: "upload_stored",
      message: "Image uploaded directly to private storage."
    });

    try {
      const profile = await analyzeCharacterImage({ buffer, mimeType, fileName: upload.fileName });
      const searchDocument = buildSearchDocument(profile, "", upload.fileName);
      const embedding = await embedSearchText(searchDocument, "RETRIEVAL_DOCUMENT");

      const { data, error } = await supabase
        .from("characters")
        .update({
          status: "ready",
          profile,
          search_document: searchDocument,
          embedding: toVectorLiteral(embedding),
          error_message: null
        })
        .eq("id", upload.id)
        .select("id,client_id,clients(name),file_name,mime_type,storage_path,status,profile,search_document,error_message,created_at,updated_at")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      await supabase.from("processing_events").insert({
        character_id: upload.id,
        event_type: "analysis_ready",
        message: "AI profile and embedding generated."
      });

      results.push(await mapCharacterRow(data as CharacterRow));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown processing error.";

      await supabase.from("characters").update({ status: "failed", error_message: message }).eq("id", upload.id);
      await supabase.from("processing_events").insert({
        character_id: upload.id,
        event_type: "analysis_failed",
        message
      });

      results.push({
        id: upload.id,
        client_id: null,
        client_name: "Unassigned",
        file_name: upload.fileName,
        mime_type: mimeType,
        storage_path: upload.storagePath,
        image_url: await signedImageUrl(upload.storagePath),
        status: "failed",
        profile: {
          summary: "Processing failed.",
          apparent_age_range: "unknown",
          gender_presentation: "unknown",
          wardrobe: [],
          dominant_colors: [],
          expression: "unknown",
          pose: "unknown",
          shot_type: "unknown",
          background: "unknown",
          style: "unknown",
          quality_notes: message,
          searchable_phrases: []
        },
        search_document: "",
        error_message: message,
        created_at: new Date().toISOString()
      });
    }
  }

  return results;
}

export async function getCharacterDownload(id: string) {
  const cleanId = id.trim();

  if (!cleanId) {
    throw new Error("Character id is required.");
  }

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error(deploymentConfigError(missingSupabaseEnv()));
  }

  const { data: character, error: characterError } = await supabase
    .from("characters")
    .select("file_name,mime_type,storage_path")
    .eq("id", cleanId)
    .eq("status", "ready")
    .single();

  if (characterError || !character) {
    throw new Error(characterError?.message || "Reference not found.");
  }

  const row = character as CharacterDownloadRow;
  const { data, error } = await supabase.storage.from(env.storageBucket).download(row.storage_path);

  if (error) {
    throw new Error(error.message);
  }

  return {
    buffer: Buffer.from(await data.arrayBuffer()),
    fileName: row.file_name,
    mimeType: row.mime_type || "application/octet-stream"
  };
}

export async function deleteCharacter(id: string) {
  const cleanId = id.trim();

  if (!cleanId) {
    throw new Error("Character id is required.");
  }

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    deleteMockCharacter(cleanId);
    return { id: cleanId, storageDeleted: false };
  }

  const { data: character, error: characterError } = await supabase
    .from("characters")
    .select("id,storage_path")
    .eq("id", cleanId)
    .single();

  if (characterError || !character) {
    throw new Error(characterError?.message || "Reference not found.");
  }

  const row = character as CharacterDeleteRow;

  const { error: eventsDeleteError } = await supabase.from("processing_events").delete().eq("character_id", cleanId);

  if (eventsDeleteError) {
    throw new Error(eventsDeleteError.message);
  }

  const { error: deleteError } = await supabase.from("characters").delete().eq("id", cleanId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const storageDelete = row.storage_path ? await supabase.storage.from(env.storageBucket).remove([row.storage_path]) : null;

  return {
    id: row.id,
    storageDeleted: !storageDelete?.error
  };
}

async function mapCharacterRow(row: CharacterRow): Promise<CharacterRecord> {
  const clientRelation = Array.isArray(row.clients) ? row.clients[0] : row.clients;

  return {
    id: row.id,
    client_id: row.client_id,
    client_name: row.client_name || clientRelation?.name || "Unassigned",
    file_name: row.file_name,
    mime_type: row.mime_type,
    storage_path: row.storage_path,
    image_url: await signedImageUrl(row.storage_path),
    status: row.status,
    profile: normalizeProfile(row.profile),
    search_document: row.search_document,
    similarity: row.similarity,
    error_message: row.error_message,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function filterLibraryCharacters(
  characters: CharacterRecord[],
  filters: {
    gender?: string;
    age?: string;
  }
) {
  return characters.filter((character) => {
    const profile = normalizeProfile(character.profile);

    return genderMatches(profile, filters.gender) && ageMatches(profile, filters.age);
  });
}

function genderMatches(profile: CharacterProfile, gender?: string) {
  const filter = (gender || "all").toLowerCase();

  if (filter === "all") {
    return true;
  }

  const value = profile.gender_presentation.toLowerCase();

  if (filter === "feminine") {
    return value.includes("feminine") || /\bfemale\b/.test(value) || /\bwoman\b/.test(value);
  }

  if (filter === "masculine") {
    return value.includes("masculine") || /\bmale\b/.test(value) || /\bman\b/.test(value);
  }

  if (filter === "androgynous") {
    return value.includes("androgynous") || value.includes("nonbinary") || value.includes("non-binary");
  }

  return true;
}

function ageMatches(profile: CharacterProfile, age?: string) {
  const filter = (age || "all").toLowerCase();

  if (filter === "all") {
    return true;
  }

  const [minimum, maximum] = ageRangeBounds(filter);
  const profileRange = parseAgeRange(profile.apparent_age_range);

  if (!profileRange) {
    return false;
  }

  return profileRange.maximum >= minimum && profileRange.minimum <= maximum;
}

function ageRangeBounds(value: string): [number, number] {
  if (value === "18-29") {
    return [18, 29];
  }

  if (value === "30-39") {
    return [30, 39];
  }

  if (value === "40-49") {
    return [40, 49];
  }

  if (value === "50-59") {
    return [50, 59];
  }

  if (value === "60-plus") {
    return [60, 120];
  }

  return [0, 120];
}

function parseAgeRange(value: string) {
  const numbers = value.match(/\d+/g)?.map((item) => Number(item)).filter((item) => Number.isFinite(item));

  if (!numbers?.length) {
    return null;
  }

  if (numbers.length === 1) {
    const age = numbers[0];
    return { minimum: age, maximum: age };
  }

  return {
    minimum: Math.min(numbers[0], numbers[1]),
    maximum: Math.max(numbers[0], numbers[1])
  };
}

async function signedImageUrl(storagePath: string) {
  const supabase = getSupabaseAdmin();

  if (!supabase || !storagePath) {
    return "";
  }

  const { data, error } = await supabase.storage.from(env.storageBucket).createSignedUrl(storagePath, 3600);

  if (error) {
    return "";
  }

  return data.signedUrl;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
}
