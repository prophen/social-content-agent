create table public.draft_events (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.drafts(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null
    check (
      event_type in (
        'draft_created',
        'draft_updated',
        'draft_approved',
        'draft_scheduled',
        'draft_published',
        'draft_publish_failed'
      )
    ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index draft_events_draft_id_created_at_idx
on public.draft_events (draft_id, created_at desc);

create index draft_events_owner_id_created_at_idx
on public.draft_events (owner_id, created_at desc);

alter table public.draft_events enable row level security;

create policy "Users can view their own draft events"
on public.draft_events
for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Users can create events for their own drafts"
on public.draft_events
for insert
to authenticated
with check ((select auth.uid()) = owner_id);