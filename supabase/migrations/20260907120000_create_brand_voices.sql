create table public.brand_voices (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  voice jsonb not null check (jsonb_typeof(voice) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.brand_voices enable row level security;

create policy "Users can view their own brand voice"
on public.brand_voices for select to authenticated
using ((select auth.uid()) = owner_id);

create policy "Users can create their own brand voice"
on public.brand_voices for insert to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Users can update their own brand voice"
on public.brand_voices for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);
