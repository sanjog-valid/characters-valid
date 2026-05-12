create table if not exists public.character_sheets (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'generating', 'ready', 'failed')),
  prompt text not null,
  storage_path text unique,
  file_name text not null default 'character-sheet.png',
  mime_type text not null default 'image/png',
  generation_model text,
  generation_size text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists character_sheets_character_id_idx
  on public.character_sheets (character_id);

create index if not exists character_sheets_status_idx
  on public.character_sheets (status);

alter table public.character_sheets enable row level security;

drop trigger if exists character_sheets_touch_updated_at on public.character_sheets;
create trigger character_sheets_touch_updated_at
before update on public.character_sheets
for each row execute function public.touch_updated_at();
