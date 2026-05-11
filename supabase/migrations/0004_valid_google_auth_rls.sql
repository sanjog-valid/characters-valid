create or replace function public.is_valid_app_user()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) like '%@valid.co';
$$;

grant execute on function public.is_valid_app_user() to authenticated;

alter table public.clients enable row level security;
alter table public.characters enable row level security;
alter table public.processing_events enable row level security;

drop policy if exists "Valid users can read clients" on public.clients;
create policy "Valid users can read clients"
on public.clients
for select
to authenticated
using (public.is_valid_app_user());

drop policy if exists "Valid users can read characters" on public.characters;
create policy "Valid users can read characters"
on public.characters
for select
to authenticated
using (public.is_valid_app_user());

drop policy if exists "Valid users can insert characters" on public.characters;
create policy "Valid users can insert characters"
on public.characters
for insert
to authenticated
with check (public.is_valid_app_user());

drop policy if exists "Valid users can update characters" on public.characters;
create policy "Valid users can update characters"
on public.characters
for update
to authenticated
using (public.is_valid_app_user())
with check (public.is_valid_app_user());

drop policy if exists "Valid users can read processing events" on public.processing_events;
create policy "Valid users can read processing events"
on public.processing_events
for select
to authenticated
using (public.is_valid_app_user());

drop policy if exists "Valid users can insert processing events" on public.processing_events;
create policy "Valid users can insert processing events"
on public.processing_events
for insert
to authenticated
with check (public.is_valid_app_user());
