create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  file_name text not null,
  mime_type text not null,
  storage_path text not null unique,
  status text not null default 'queued' check (status in ('queued', 'processing', 'ready', 'failed')),
  profile jsonb not null default '{}'::jsonb,
  search_document text not null default '',
  embedding vector(768),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.processing_events (
  id uuid primary key default gen_random_uuid(),
  character_id uuid references public.characters(id) on delete cascade,
  event_type text not null,
  message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists clients_name_idx on public.clients using gin (to_tsvector('simple', name));
create index if not exists characters_client_id_idx on public.characters(client_id);
create index if not exists characters_status_idx on public.characters(status);
create index if not exists characters_search_document_idx on public.characters using gin (to_tsvector('simple', search_document));
create index if not exists characters_embedding_idx on public.characters using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clients_touch_updated_at on public.clients;
create trigger clients_touch_updated_at
before update on public.clients
for each row execute function public.touch_updated_at();

drop trigger if exists characters_touch_updated_at on public.characters;
create trigger characters_touch_updated_at
before update on public.characters
for each row execute function public.touch_updated_at();

create or replace function public.match_characters(
  query_embedding vector(768),
  match_count int default 48,
  filter_client_id uuid default null,
  filter_status text default 'ready'
)
returns table (
  id uuid,
  client_id uuid,
  client_name text,
  file_name text,
  mime_type text,
  storage_path text,
  status text,
  profile jsonb,
  search_document text,
  similarity float,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
as $$
  select
    characters.id,
    characters.client_id,
    coalesce(clients.name, 'Unassigned') as client_name,
    characters.file_name,
    characters.mime_type,
    characters.storage_path,
    characters.status,
    characters.profile,
    characters.search_document,
    1 - (characters.embedding <=> query_embedding) as similarity,
    characters.created_at,
    characters.updated_at
  from public.characters
  left join public.clients on clients.id = characters.client_id
  where characters.embedding is not null
    and (filter_client_id is null or characters.client_id = filter_client_id)
    and (filter_status is null or characters.status = filter_status)
  order by characters.embedding <=> query_embedding
  limit match_count;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'characters',
  'characters',
  false,
  26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Client rows are intentionally not seeded here. Valid.co will maintain the client list centrally.
