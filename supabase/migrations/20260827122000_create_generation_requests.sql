create table public.generation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index generation_requests_user_id_created_at_idx
on public.generation_requests (user_id, created_at desc);

alter table public.generation_requests enable row level security;

create policy "Users can read their own generation requests"
on public.generation_requests
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own generation requests"
on public.generation_requests
for insert
to authenticated
with check ((select auth.uid()) = user_id);