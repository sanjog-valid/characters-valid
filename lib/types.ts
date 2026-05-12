export type CharacterStatus = "queued" | "processing" | "ready" | "failed";
export type CharacterSheetStatus = "queued" | "generating" | "ready" | "failed";

export type ClientRecord = {
  id: string;
  name: string;
  slug: string;
  created_at?: string;
};

export type CharacterProfile = {
  summary: string;
  apparent_age_range: string;
  gender_presentation: string;
  wardrobe: string[];
  dominant_colors: string[];
  expression: string;
  pose: string;
  shot_type: string;
  background: string;
  style: string;
  quality_notes: string;
  searchable_phrases: string[];
};

export type CharacterRecord = {
  id: string;
  client_id: string | null;
  client_name: string;
  file_name: string;
  mime_type: string;
  storage_path?: string;
  image_url: string;
  status: CharacterStatus;
  profile: CharacterProfile;
  search_document: string;
  similarity?: number;
  error_message?: string | null;
  processing_attempts?: number;
  processing_locked_at?: string | null;
  next_process_at?: string | null;
  analysis_provider?: string | null;
  created_at: string;
  updated_at?: string;
};

export type CharacterSheetRecord = {
  id: string;
  character_id: string;
  status: CharacterSheetStatus;
  prompt: string;
  storage_path?: string | null;
  image_url?: string;
  file_name: string;
  mime_type: string;
  generation_model?: string | null;
  generation_size?: string | null;
  openai_response_id?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at?: string;
};

export type SearchRequest = {
  query?: string;
  clientId?: string;
  gender?: string;
  age?: string;
};

export type UploadAssignment = {
  index: number;
  clientId?: string | null;
  originalName: string;
};

export type UploadIntentFile = {
  clientUploadId: string;
  fileName: string;
  mimeType: string;
  size: number;
};

export type SignedUploadIntent = UploadIntentFile & {
  id: string;
  storagePath: string;
  signedUrl: string;
  token: string;
  path: string;
};

export type StoredUpload = {
  clientUploadId: string;
  id: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
};

export type FailedStoredUpload = {
  id: string;
  error: string;
};
