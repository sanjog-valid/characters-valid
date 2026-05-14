import { deploymentConfigError, env, isOpenAIConfigured, missingSupabaseEnv } from "@/lib/env";
import {
  analyzeCharacterImage,
  buildSearchDocument,
  createFallbackProfile,
  embedSearchText,
  generateCharacterSheetImage,
  isRetryableAIError,
  normalizeProfile,
  toVectorLiteral
} from "@/lib/openai";
import { addMockCharacter, addMockClient, deleteMockCharacter, getMockStore, searchMockCharacters } from "@/lib/mock-store";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type {
  CharacterProfile,
  CharacterRecord,
  CharacterSheetRecord,
  CharacterSheetStatus,
  CharacterStatus,
  ClientRecord,
  FailedStoredUpload,
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
  processing_attempts?: number | null;
  processing_locked_at?: string | null;
  next_process_at?: string | null;
  analysis_provider?: string | null;
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

type CharacterSheetRow = {
  id: string;
  character_id: string;
  status: CharacterSheetStatus;
  prompt: string;
  storage_path?: string | null;
  file_name: string;
  mime_type: string;
  generation_model?: string | null;
  generation_size?: string | null;
  openai_response_id?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at?: string;
};

type CharacterSheetDownloadRow = {
  file_name: string;
  mime_type: string;
  storage_path: string;
};

type ProcessingClaimRow = {
  id: string;
  file_name: string;
  mime_type: string;
  storage_path: string;
  processing_attempts: number;
};

const characterSelect =
  "id,client_id,clients(name),file_name,mime_type,storage_path,status,profile,search_document,error_message,processing_attempts,processing_locked_at,next_process_at,analysis_provider,created_at,updated_at";
const characterSheetSelect =
  "id,character_id,status,prompt,storage_path,file_name,mime_type,generation_model,generation_size,openai_response_id,error_message,created_at,updated_at";
const maxProcessingAttempts = 5;
const staleCharacterSheetMs = 90_000;

const defaultCharacterSheetPrompt =
  "From the attached image-Generate a single horizontal image divided into three equal panels showing this exact character with no changes to their face, hair, outfit, skin tone, or physical features. " +
  "Panel 1 (left): full-body front-facing shot, neutral standing pose, feet visible, slight natural weight shift, looking straight ahead with a relaxed expression. " +
  "Panel 2 (center): full-body rear-facing shot, exact same outfit and posture, camera directly behind, feet visible. " +
  "Panel 3 (right): tight close-up of the face only from mid-chest up, slight 3/4 angle, natural expression, same lighting. " +
  "All three panels share identical background - clean, neutral, softly lit, out-of-focus environment consistent with the source image setting. " +
  "Consistent warm-neutral studio lighting across all three panels. No text, no labels, no captions, no annotations anywhere in the image. " +
  "Photorealistic, sharp detail, natural skin texture, same lens feel across all panels. Avoid any change in character identity between panels.";

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
  includeFailed?: boolean;
} = {}) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return searchMockCharacters({ clientId: input.clientId, status: input.status });
  }

  let query = supabase
    .from("characters")
    .select(characterSelect)
    .order("created_at", { ascending: false })
    .limit(input.limit || 120);

  if (input.clientId) {
    query = query.eq("client_id", input.clientId);
  }

  if (input.status && input.status !== "all") {
    query = query.eq("status", input.status);
  } else if (!input.includeFailed) {
    query = query.neq("status", "failed");
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
    return filterLibraryCharacters(searchMockCharacters({ ...input, status: cleanQuery ? "ready" : "all" }), input);
  }

  if (!cleanQuery) {
    const characters = await listCharacters({ clientId: input.clientId, status: "all" });
    return filterLibraryCharacters(characters, input);
  }

  if (isOpenAIConfigured()) {
    const embedding = await embedSearchText(cleanQuery);

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
    .select(characterSelect)
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
          imageUrl,
          status: "processing"
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
    const profile = createFallbackProfile(file.name);

    const upload = await supabase.storage.from(env.storageBucket).upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false
    });

    if (upload.error) {
      throw new Error(upload.error.message);
    }

    const { data, error } = await supabase
      .from("characters")
      .insert({
        id,
        client_id: null,
        file_name: file.name,
        mime_type: mimeType,
        storage_path: storagePath,
        status: "processing",
        profile,
        search_document: buildSearchDocument(profile, "", file.name),
        next_process_at: new Date().toISOString(),
        analysis_provider: "openai"
      })
      .select(characterSelect)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    await insertProcessingEvent(id, "upload_stored", "Image uploaded to private storage.");
    results.push(await mapCharacterRow(data as CharacterRow));
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
    const profile = createFallbackProfile(file.fileName);
    const { data, error } = await supabase.storage.from(env.storageBucket).createSignedUploadUrl(storagePath, {
      upsert: false
    });

    if (error) {
      throw new Error(error.message);
    }

    const insert = await supabase.from("characters").insert({
      id,
      client_id: null,
      file_name: file.fileName,
      mime_type: file.mimeType || "application/octet-stream",
      storage_path: storagePath,
      status: "queued",
      profile,
      search_document: buildSearchDocument(profile, "", file.fileName),
      error_message: null,
      processing_attempts: 0,
      processing_locked_at: null,
      processing_locked_by: null,
      next_process_at: new Date().toISOString(),
      analysis_provider: "openai"
    });

    if (insert.error) {
      throw new Error(insert.error.message);
    }

    await insertProcessingEvent(id, "upload_signed", "Upload row created and signed storage URL issued.");

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

export async function completeStoredUploads(input: {
  uploads: StoredUpload[];
  failed?: FailedStoredUpload[];
}) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error(deploymentConfigError(missingSupabaseEnv()));
  }

  const uploadIds = input.uploads.map((upload) => upload.id).filter(Boolean);
  const failedUploads = input.failed || [];

  if (uploadIds.length) {
    const { error } = await supabase
      .from("characters")
      .update({
        status: "processing",
        error_message: null,
        processing_locked_at: null,
        processing_locked_by: null,
        next_process_at: new Date().toISOString(),
        analysis_provider: "openai"
      })
      .in("id", uploadIds);

    if (error) {
      throw new Error(error.message);
    }

    await Promise.all(uploadIds.map((id) => insertProcessingEvent(id, "upload_stored", "Image uploaded directly to private storage.")));
  }

  for (const failed of failedUploads) {
    await supabase
      .from("characters")
      .update({
        status: "failed",
        error_message: failed.error || "Direct storage upload failed.",
        processing_locked_at: null,
        processing_locked_by: null
      })
      .eq("id", failed.id);
    await insertProcessingEvent(failed.id, "upload_failed", failed.error || "Direct storage upload failed.");
  }

  if (!uploadIds.length && !failedUploads.length) {
    throw new Error("No uploaded files received.");
  }

  const { data, error } = await supabase.from("characters").select(characterSelect).in("id", [...uploadIds, ...failedUploads.map((item) => item.id)]);

  if (error) {
    throw new Error(error.message);
  }

  return Promise.all((data || []).map((row) => mapCharacterRow(row as CharacterRow)));
}

export async function processStoredUploads(input: { uploads: StoredUpload[] }) {
  return completeStoredUploads({ uploads: input.uploads });
}

export async function processPendingCharacters(input: { limit?: number; workerId?: string } = {}) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error(deploymentConfigError(missingSupabaseEnv()));
  }

  const workerId = input.workerId || `vercel-${crypto.randomUUID()}`;
  const limit = Math.max(1, Math.min(input.limit || 2, 5));
  const claimed = await claimProcessingCharacters(workerId, limit);
  const results: Array<{ id: string; status: CharacterStatus; error?: string }> = [];

  for (const row of claimed) {
    await insertProcessingEvent(row.id, "analysis_started", `Processing attempt ${row.processing_attempts}.`);

    try {
      const download = await supabase.storage.from(env.storageBucket).download(row.storage_path);

      if (download.error) {
        throw new Error(download.error.message);
      }

      const buffer = Buffer.from(await download.data.arrayBuffer());
      const profile = await analyzeCharacterImage({
        buffer,
        mimeType: row.mime_type || "application/octet-stream",
        fileName: row.file_name
      });
      const searchDocument = buildSearchDocument(profile, "", row.file_name);
      const embedding = await embedSearchText(searchDocument);

      if (!embedding) {
        throw new Error(deploymentConfigError(["OPENAI_API_KEY"]));
      }

      const { error } = await supabase
        .from("characters")
        .update({
          status: "ready",
          profile,
          search_document: searchDocument,
          embedding: toVectorLiteral(embedding),
          error_message: null,
          processing_locked_at: null,
          processing_locked_by: null,
          next_process_at: null,
          analysis_provider: "openai"
        })
        .eq("id", row.id);

      if (error) {
        throw new Error(error.message);
      }

      await insertProcessingEvent(row.id, "analysis_ready", "OpenAI profile and embedding generated.");
      results.push({ id: row.id, status: "ready" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown processing error.";
      const shouldRetry = isRetryableAIError(error) && row.processing_attempts < maxProcessingAttempts;

      if (shouldRetry) {
        const nextProcessAt = new Date(Date.now() + retryDelayMs(row.processing_attempts)).toISOString();

        await supabase
          .from("characters")
          .update({
            status: "processing",
            error_message: message,
            processing_locked_at: null,
            processing_locked_by: null,
            next_process_at: nextProcessAt,
            analysis_provider: "openai"
          })
          .eq("id", row.id);
        await insertProcessingEvent(row.id, "analysis_retry", message);
        results.push({ id: row.id, status: "processing", error: message });
      } else {
        await supabase
          .from("characters")
          .update({
            status: "failed",
            error_message: message,
            processing_locked_at: null,
            processing_locked_by: null,
            next_process_at: null,
            analysis_provider: "openai"
          })
          .eq("id", row.id);
        await insertProcessingEvent(row.id, "analysis_failed", message);
        results.push({ id: row.id, status: "failed", error: message });
      }
    }
  }

  return {
    claimed: claimed.length,
    processed: results.filter((item) => item.status === "ready").length,
    retrying: results.filter((item) => item.status === "processing").length,
    failed: results.filter((item) => item.status === "failed").length,
    results
  };
}

export async function recoverStorageOnlyUploads(input: { limit?: number } = {}) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error(deploymentConfigError(missingSupabaseEnv()));
  }

  const limit = Math.max(1, Math.min(input.limit || 100, 500));
  const { data: objects, error } = await supabase.storage.from(env.storageBucket).list("unassigned", {
    limit,
    sortBy: { column: "created_at", order: "desc" }
  });

  if (error) {
    throw new Error(error.message);
  }

  const paths = (objects || []).filter((object) => object.name && object.name !== ".emptyFolderPlaceholder").map((object) => `unassigned/${object.name}`);

  if (!paths.length) {
    return { recovered: 0 };
  }

  const { data: existing, error: existingError } = await supabase.from("characters").select("storage_path").in("storage_path", paths);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingPaths = new Set((existing || []).map((row) => row.storage_path));
  const missingPaths = paths.filter((path) => !existingPaths.has(path));
  const rows = missingPaths.map((storagePath) => {
    const fileName = storagePath.split("/").pop() || "recovered-upload";
    const id = parseUuidFromStoredName(fileName) || crypto.randomUUID();
    const displayName = fileName.replace(/^[0-9a-f-]{36}-/i, "");
    const profile = createFallbackProfile(displayName);

    return {
      id,
      client_id: null,
      file_name: displayName,
      mime_type: mimeTypeFromFileName(displayName),
      storage_path: storagePath,
      status: "processing" as CharacterStatus,
      profile,
      search_document: buildSearchDocument(profile, "", displayName),
      error_message: null,
      processing_attempts: 0,
      processing_locked_at: null,
      processing_locked_by: null,
      next_process_at: new Date().toISOString(),
      analysis_provider: "openai"
    };
  });

  if (rows.length) {
    const { error: insertError } = await supabase.from("characters").insert(rows);

    if (insertError) {
      throw new Error(insertError.message);
    }

    await Promise.all(rows.map((row) => insertProcessingEvent(row.id, "recovered_from_storage", "Storage object recovered into processing queue.")));
  }

  return { recovered: rows.length };
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

export async function getCharacterSheet(characterId: string) {
  const cleanId = characterId.trim();

  if (!cleanId) {
    throw new Error("Character id is required.");
  }

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("character_sheets")
    .select(characterSheetSelect)
    .eq("character_id", cleanId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as CharacterSheetRow;

  if (isStaleLocalCharacterSheet(row)) {
    return markCharacterSheetFailed(
      row,
      "Character sheet generation timed out on Vercel before OpenAI returned. Retry after the latest deployment enables longer function duration."
    );
  }

  return mapCharacterSheetRow(row);
}

export async function makeCharacterSheet(characterId: string, prompt = defaultCharacterSheetPrompt) {
  const cleanId = characterId.trim();

  if (!cleanId) {
    throw new Error("Character id is required.");
  }

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error(deploymentConfigError(missingSupabaseEnv()));
  }

  const { data: character, error: characterError } = await supabase
    .from("characters")
    .select("id,file_name,mime_type,storage_path,status")
    .eq("id", cleanId)
    .single();

  if (characterError || !character) {
    throw new Error(characterError?.message || "Reference not found.");
  }

  if (character.status !== "ready") {
    throw new Error("Wait until this reference is ready before making a character sheet.");
  }

  const existing = await getCharacterSheet(cleanId);

  if (existing?.status === "ready") {
    return existing;
  }

  if (existing?.status === "generating" && !isStaleCharacterSheetRecord(existing)) {
    return existing;
  }

  const fileBase = safeFileName(character.file_name.replace(/\.[a-z0-9]+$/i, "")) || "character";
  const sheetFileName = `${fileBase}-character-sheet.png`;
  const sheetRow = await upsertGeneratingCharacterSheet({
    id: existing?.id,
    characterId: cleanId,
    prompt,
    fileName: sheetFileName
  });

  return generateCharacterSheetForRow(sheetRow);
}

export async function getCharacterSheetDownload(characterId: string) {
  const cleanId = characterId.trim();

  if (!cleanId) {
    throw new Error("Character id is required.");
  }

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error(deploymentConfigError(missingSupabaseEnv()));
  }

  const { data: sheet, error: sheetError } = await supabase
    .from("character_sheets")
    .select("file_name,mime_type,storage_path")
    .eq("character_id", cleanId)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (sheetError || !sheet) {
    throw new Error(sheetError?.message || "Character sheet not found.");
  }

  const row = sheet as CharacterSheetDownloadRow;
  const { data, error } = await supabase.storage.from(env.storageBucket).download(row.storage_path);

  if (error) {
    throw new Error(error.message);
  }

  return {
    buffer: Buffer.from(await data.arrayBuffer()),
    fileName: row.file_name,
    mimeType: row.mime_type || "image/png"
  };
}

async function generateCharacterSheetForRow(sheetRow: CharacterSheetRow) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error(deploymentConfigError(missingSupabaseEnv()));
  }

  try {
    const { data: character, error: characterError } = await supabase
      .from("characters")
      .select("id,file_name,mime_type,storage_path,status")
      .eq("id", sheetRow.character_id)
      .single();

    if (characterError || !character) {
      throw new Error(characterError?.message || "Reference not found.");
    }

    const source = await supabase.storage.from(env.storageBucket).download(character.storage_path);

    if (source.error) {
      throw new Error(source.error.message);
    }

    const sourceBuffer = Buffer.from(await source.data.arrayBuffer());
    const generated = await generateCharacterSheetImage({
      buffer: sourceBuffer,
      mimeType: character.mime_type || "image/png",
      fileName: character.file_name,
      prompt: sheetRow.prompt || defaultCharacterSheetPrompt
    });
    const storagePath = `character-sheets/${character.id}/${sheetRow.id}.png`;
    const upload = await supabase.storage.from(env.storageBucket).upload(storagePath, generated.buffer, {
      contentType: generated.mimeType,
      upsert: true
    });

    if (upload.error) {
      throw new Error(upload.error.message);
    }

    const { data: readySheet, error: readyError } = await supabase
      .from("character_sheets")
      .update({
        status: "ready",
        storage_path: storagePath,
        mime_type: generated.mimeType,
        generation_model: env.openaiImageModel,
        generation_size: env.openaiCharacterSheetSize,
        openai_response_id: null,
        error_message: null
      })
      .eq("id", sheetRow.id)
      .select(characterSheetSelect)
      .single();

    if (readyError || !readySheet) {
      throw new Error(readyError?.message || "Could not save character sheet.");
    }

    await insertProcessingEvent(sheetRow.character_id, "character_sheet_ready", "OpenAI 4K character sheet generated.");
    return mapCharacterSheetRow(readySheet as CharacterSheetRow);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Character sheet generation failed.";

    await supabase
      .from("character_sheets")
      .update({
        status: "failed",
        error_message: message
      })
      .eq("id", sheetRow.id);
    await insertProcessingEvent(sheetRow.character_id, "character_sheet_failed", message);

    throw new Error(message);
  }
}

export async function enqueueMissingCharacterSheets() {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error(deploymentConfigError(missingSupabaseEnv()));
  }

  const { data: characters, error: charactersError } = await supabase
    .from("characters")
    .select("id,file_name,status")
    .eq("status", "ready")
    .order("created_at", { ascending: true });

  if (charactersError) {
    throw new Error(charactersError.message);
  }

  const readyCharacters = (characters || []) as Array<{ id: string; file_name: string; status: CharacterStatus }>;
  const characterIds = readyCharacters.map((character) => character.id);

  if (!characterIds.length) {
    return { queued: 0, skipped: 0, totalReady: 0 };
  }

  const { data: sheets, error: sheetsError } = await supabase
    .from("character_sheets")
    .select(characterSheetSelect)
    .in("character_id", characterIds);

  if (sheetsError) {
    throw new Error(sheetsError.message);
  }

  const sheetsByCharacter = new Map((sheets || []).map((sheet) => [sheet.character_id as string, sheet as CharacterSheetRow]));
  let queued = 0;
  let skipped = 0;

  for (const character of readyCharacters) {
    const existing = sheetsByCharacter.get(character.id);

    if (existing?.status === "ready" || existing?.status === "generating") {
      skipped += 1;
      continue;
    }

    const fileBase = safeFileName(character.file_name.replace(/\.[a-z0-9]+$/i, "")) || "character";
    const payload = {
      character_id: character.id,
      status: "queued",
      prompt: defaultCharacterSheetPrompt,
      file_name: `${fileBase}-character-sheet.png`,
      mime_type: "image/png",
      generation_model: env.openaiImageModel,
      generation_size: env.openaiCharacterSheetSize,
      openai_response_id: null,
      error_message: null
    };

    const result = existing
      ? await supabase.from("character_sheets").update(payload).eq("id", existing.id)
      : await supabase.from("character_sheets").insert(payload);

    if (result.error) {
      throw new Error(result.error.message);
    }

    queued += 1;
  }

  return {
    queued,
    skipped,
    totalReady: readyCharacters.length
  };
}

export async function processQueuedCharacterSheets(input: { limit?: number } = {}) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error(deploymentConfigError(missingSupabaseEnv()));
  }

  const limit = Math.max(1, Math.min(Number(input.limit || 1), 2));
  const { data: queuedRows, error } = await supabase
    .from("character_sheets")
    .select(characterSheetSelect)
    .eq("status", "queued")
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (queuedRows || []) as CharacterSheetRow[];
  const results: CharacterSheetRecord[] = [];

  for (const row of rows) {
    results.push(await makeCharacterSheet(row.character_id, row.prompt || defaultCharacterSheetPrompt));
  }

  const { count: remaining, error: countError } = await supabase
    .from("character_sheets")
    .select("id", { count: "exact", head: true })
    .eq("status", "queued");

  if (countError) {
    throw new Error(countError.message);
  }

  return {
    processed: results.length,
    remaining: remaining || 0,
    results
  };
}

async function countQueuedCharacterSheets() {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return 0;
  }

  const { count, error } = await supabase.from("character_sheets").select("id", { count: "exact", head: true }).eq("status", "queued");

  if (error) {
    throw new Error(error.message);
  }

  return count || 0;
}

export async function claimQueuedCharacterSheet() {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error(deploymentConfigError(missingSupabaseEnv()));
  }

  const { data: rows, error } = await supabase
    .from("character_sheets")
    .select(characterSheetSelect)
    .eq("status", "queued")
    .order("updated_at", { ascending: true })
    .limit(5);

  if (error) {
    throw new Error(error.message);
  }

  for (const row of (rows || []) as CharacterSheetRow[]) {
    const { data: claimed, error: claimError } = await supabase
      .from("character_sheets")
      .update({
        status: "generating",
        error_message: null,
        generation_model: env.openaiImageModel,
        generation_size: env.openaiCharacterSheetSize
      })
      .eq("id", row.id)
      .eq("status", "queued")
      .select(characterSheetSelect)
      .maybeSingle();

    if (claimError) {
      throw new Error(claimError.message);
    }

    if (claimed) {
      const remaining = await countQueuedCharacterSheets();

      return {
        sheet: await mapCharacterSheetRow(claimed as CharacterSheetRow),
        remaining
      };
    }
  }

  return {
    sheet: null,
    remaining: 0
  };
}

export async function finishClaimedCharacterSheet(sheetId: string) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error(deploymentConfigError(missingSupabaseEnv()));
  }

  const { data, error } = await supabase
    .from("character_sheets")
    .select(characterSheetSelect)
    .eq("id", sheetId)
    .eq("status", "generating")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Claimed character sheet not found.");
  }

  return generateCharacterSheetForRow(data as CharacterSheetRow);
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

  const { data: character, error: characterError } = await supabase.from("characters").select("id,storage_path").eq("id", cleanId).single();

  if (characterError || !character) {
    throw new Error(characterError?.message || "Reference not found.");
  }

  const row = character as CharacterDeleteRow;
  const { data: sheets, error: sheetsError } = await supabase.from("character_sheets").select("storage_path").eq("character_id", cleanId);

  if (sheetsError) {
    throw new Error(sheetsError.message);
  }

  const { error: eventsDeleteError } = await supabase.from("processing_events").delete().eq("character_id", cleanId);

  if (eventsDeleteError) {
    throw new Error(eventsDeleteError.message);
  }

  const { error: deleteError } = await supabase.from("characters").delete().eq("id", cleanId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const storagePaths = [
    row.storage_path,
    ...((sheets || []) as Array<{ storage_path?: string | null }>).map((sheet) => sheet.storage_path).filter(Boolean)
  ] as string[];
  const storageDelete = storagePaths.length ? await supabase.storage.from(env.storageBucket).remove(storagePaths) : null;

  return {
    id: row.id,
    storageDeleted: !storageDelete?.error
  };
}

async function claimProcessingCharacters(workerId: string, limit: number): Promise<ProcessingClaimRow[]> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return [];
  }

  const rpc = await supabase.rpc("claim_processing_characters", {
    worker_id: workerId,
    batch_count: limit
  });

  if (!rpc.error && Array.isArray(rpc.data)) {
    return rpc.data as ProcessingClaimRow[];
  }

  const lockExpiredAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("characters")
    .select("id,file_name,mime_type,storage_path,processing_attempts")
    .eq("status", "processing")
    .lte("next_process_at", new Date().toISOString())
    .or(`processing_locked_at.is.null,processing_locked_at.lt.${lockExpiredAt}`)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(rpc.error?.message || error.message);
  }

  const rows = (data || []) as ProcessingClaimRow[];

  for (const row of rows) {
    await supabase
      .from("characters")
      .update({
        processing_locked_at: new Date().toISOString(),
        processing_locked_by: workerId,
        processing_attempts: (row.processing_attempts || 0) + 1
      })
      .eq("id", row.id);
    row.processing_attempts = (row.processing_attempts || 0) + 1;
  }

  return rows;
}

async function mapCharacterRow(row: CharacterRow): Promise<CharacterRecord> {
  const clientRelation = Array.isArray(row.clients) ? row.clients[0] : row.clients;
  const previewUrl = (await signedImageUrl(row.storage_path, { width: 520, height: 680, resize: "cover", quality: 72 })) || (await signedImageUrl(row.storage_path));

  return {
    id: row.id,
    client_id: row.client_id,
    client_name: row.client_name || clientRelation?.name || "Unassigned",
    file_name: row.file_name,
    mime_type: row.mime_type,
    storage_path: row.storage_path,
    image_url: previewUrl,
    preview_url: previewUrl,
    status: row.status,
    profile: normalizeProfile(row.profile),
    search_document: row.search_document,
    similarity: row.similarity,
    error_message: row.error_message,
    processing_attempts: row.processing_attempts || 0,
    processing_locked_at: row.processing_locked_at,
    next_process_at: row.next_process_at,
    analysis_provider: row.analysis_provider,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function mapCharacterSheetRow(row: CharacterSheetRow): Promise<CharacterSheetRecord> {
  const previewUrl = row.storage_path ? (await signedImageUrl(row.storage_path, { width: 1280, height: 720, resize: "contain", quality: 72 })) || (await signedImageUrl(row.storage_path)) : "";

  return {
    id: row.id,
    character_id: row.character_id,
    status: row.status,
    prompt: row.prompt,
    storage_path: row.storage_path,
    image_url: previewUrl,
    preview_url: previewUrl,
    file_name: row.file_name,
    mime_type: row.mime_type,
    generation_model: row.generation_model,
    generation_size: row.generation_size,
    openai_response_id: row.openai_response_id,
    error_message: row.error_message,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function markCharacterSheetFailed(row: CharacterSheetRow, message: string) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return mapCharacterSheetRow(row);
  }

  const { data, error } = await supabase
    .from("character_sheets")
    .update({
      status: "failed",
      error_message: message,
      openai_response_id: null
    })
    .eq("id", row.id)
    .select(characterSheetSelect)
    .single();

  if (error || !data) {
    throw new Error(error?.message || message);
  }

  await insertProcessingEvent(row.character_id, "character_sheet_failed", message);
  return mapCharacterSheetRow(data as CharacterSheetRow);
}

function isStaleLocalCharacterSheet(row: CharacterSheetRow) {
  return row.status === "generating" && !row.openai_response_id && isOlderThan(row.updated_at || row.created_at, staleCharacterSheetMs);
}

function isStaleCharacterSheetRecord(sheet: CharacterSheetRecord) {
  return sheet.status === "generating" && !sheet.openai_response_id && isOlderThan(sheet.updated_at || sheet.created_at, staleCharacterSheetMs);
}

function isOlderThan(value: string | undefined, ageMs: number) {
  const timestamp = value ? Date.parse(value) : NaN;

  return Number.isFinite(timestamp) && Date.now() - timestamp > ageMs;
}

async function upsertGeneratingCharacterSheet(input: {
  id?: string;
  characterId: string;
  prompt: string;
  fileName: string;
}) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    throw new Error(deploymentConfigError(missingSupabaseEnv()));
  }

  if (input.id) {
    const { data, error } = await supabase
      .from("character_sheets")
      .update({
        status: "generating",
        prompt: input.prompt,
        file_name: input.fileName,
        mime_type: "image/png",
        openai_response_id: null,
        error_message: null,
        generation_model: env.openaiImageModel,
        generation_size: env.openaiCharacterSheetSize
      })
      .eq("id", input.id)
      .select(characterSheetSelect)
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Could not start character sheet generation.");
    }

    return data as CharacterSheetRow;
  }

  const { data, error } = await supabase
    .from("character_sheets")
    .insert({
      character_id: input.characterId,
      status: "generating",
      prompt: input.prompt,
      file_name: input.fileName,
      mime_type: "image/png",
      generation_model: env.openaiImageModel,
      generation_size: env.openaiCharacterSheetSize
    })
    .select(characterSheetSelect)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Could not start character sheet generation.");
  }

  return data as CharacterSheetRow;
}

function filterLibraryCharacters(
  characters: CharacterRecord[],
  filters: {
    gender?: string;
    age?: string;
  }
) {
  return characters.filter((character) => {
    if (character.status !== "ready") {
      return (filters.gender || "all") === "all" && (filters.age || "all") === "all";
    }

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

type SignedImageTransform = {
  width?: number;
  height?: number;
  resize?: "cover" | "contain" | "fill";
  quality?: number;
  format?: "origin";
};

async function signedImageUrl(storagePath: string, transform?: SignedImageTransform) {
  const supabase = getSupabaseAdmin();

  if (!supabase || !storagePath) {
    return "";
  }

  const { data, error } = await supabase.storage.from(env.storageBucket).createSignedUrl(storagePath, 3600, transform ? { transform } : undefined);

  if (error) {
    if (transform) {
      return signedImageUrl(storagePath);
    }

    return "";
  }

  return data.signedUrl;
}

async function insertProcessingEvent(characterId: string, eventType: string, message: string) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return;
  }

  await supabase.from("processing_events").insert({
    character_id: characterId,
    event_type: eventType,
    message
  });
}

function retryDelayMs(attempt: number) {
  return Math.min(60_000 * 2 ** Math.max(0, attempt - 1), 30 * 60_000);
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

function parseUuidFromStoredName(value: string) {
  const match = value.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-/i);
  return match?.[1] || null;
}

function mimeTypeFromFileName(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "jpg" || extension === "jpeg") {
    return "image/jpeg";
  }

  if (extension === "png") {
    return "image/png";
  }

  if (extension === "webp") {
    return "image/webp";
  }

  if (extension === "gif") {
    return "image/gif";
  }

  return "application/octet-stream";
}
