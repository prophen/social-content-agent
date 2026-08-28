create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  content text not null,
  status text not null default 'draft'
    check (
      status in (
        'draft',
        'approved',
        'scheduled',
        'published',
        'publish_failed'
      )
    ),
  scheduled_for timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint scheduled_draft_requires_scheduled_for check (
    status <> 'scheduled' or scheduled_for is not null
  )
);

create index drafts_owner_id_updated_at_idx
on public.drafts (owner_id, updated_at desc);

create index drafts_due_scheduled_for_idx
on public.drafts (scheduled_for)
where status = 'scheduled';

alter table public.drafts enable row level security;

create policy "Users can view their own drafts"
on public.drafts
for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Users can create their own drafts"
on public.drafts
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Users can update their own drafts"
on public.drafts
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Users can delete their own drafts"
on public.drafts
for delete
to authenticated
using ((select auth.uid()) = owner_id);