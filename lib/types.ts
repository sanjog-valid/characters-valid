export type CharacterStatus = "queued" | "processing" | "ready" | "failed";

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
  created_at: string;
  updated_at?: string;
};

export type SearchRequest = {
  query?: string;
  clientId?: string;
  status?: CharacterStatus | "all";
};

export type UploadAssignment = {
  index: number;
  clientId?: string | null;
  originalName: string;
};
