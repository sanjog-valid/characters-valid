alter table public.characters
  add column if not exists processing_attempts integer not null default 0,
  add column if not exists processing_locked_at timestamptz,
  add column if not exists processing_locked_by text,
  add column if not exists next_process_at timestamptz not null default now(),
  add column if not exists analysis_provider text not null default 'openai';

create index if not exists characters_processing_queue_idx
  on public.characters (status, next_process_at, created_at)
  where status = 'processing';

create index if not exists characters_processing_lock_idx
  on public.characters (processing_locked_at)
  where status = 'processing';

create or replace function public.claim_processing_characters(
  worker_id text,
  batch_count int default 2
)
returns table (
  id uuid,
  file_name text,
  mime_type text,
  storage_path text,
  processing_attempts int
)
language sql
security definer
set search_path = public, extensions
as $$
  update public.characters as character
  set
    processing_locked_at = now(),
    processing_locked_by = worker_id,
    processing_attempts = character.processing_attempts + 1
  where character.id in (
    select queued.id
    from public.characters as queued
    where queued.status = 'processing'
      and queued.next_process_at <= now()
      and (
        queued.processing_locked_at is null
        or queued.processing_locked_at < now() - interval '5 minutes'
      )
    order by queued.created_at
    limit greatest(1, least(batch_count, 5))
    for update skip locked
  )
  returning
    character.id,
    character.file_name,
    character.mime_type,
    character.storage_path,
    character.processing_attempts;
$$;
