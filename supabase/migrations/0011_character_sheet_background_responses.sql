alter table public.character_sheets
  add column if not exists openai_response_id text;

create index if not exists character_sheets_openai_response_id_idx
  on public.character_sheets (openai_response_id)
  where openai_response_id is not null;
