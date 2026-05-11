alter table public.characters
  alter column client_id drop not null;

alter table public.characters
  drop constraint if exists characters_client_id_fkey;

alter table public.characters
  add constraint characters_client_id_fkey
  foreign key (client_id)
  references public.clients(id)
  on delete set null;

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
