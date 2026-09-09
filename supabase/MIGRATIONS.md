# Applying and checking database migrations

## Fresh project

Run every SQL file in `supabase/migrations/` in filename order against a Supabase project. Supabase provides `auth.users`, `auth.uid()`, and the `authenticated` role used by these files.

The complete chain defines:

- `drafts`: id, owner_id, topic, content, status, approved_at, scheduled_for, published_at, created_at, updated_at.
- `draft_events`: id, draft_id, owner_id, event_type, metadata, created_at.
- `generation_requests`: id, user_id, created_at.
- `brand_voices`: owner_id, voice, updated_at.

## Existing project

After earlier migrations are present, apply only `migrations/20260909010000_complete_draft_timestamps.sql`. In the Supabase SQL Editor, select the Social Content Agent project, paste that file's complete contents, and run it. Do not rerun the historical CREATE TABLE files against existing tables. If using a migration runner, use its normal applied-migration tracking.

The repair adds nullable `drafts.approved_at` if absent, preserves pre-existing approval values, and installs `drafts_set_updated_at`. The trigger uses the current statement timestamp for future updates. It does not change other fields or fabricate historical approval dates. No blanket updates, record deletions, table recreation, or RLS changes are included.

If this hosted project already has custom timestamp triggers, inspect them before applying. Local tests cover the checked-in schema and a manually added approval column, not arbitrary hosted schema drift.

## Read-only verification after applying

Run these queries in the SQL Editor:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'drafts'
  and column_name in ('approved_at', 'created_at', 'updated_at', 'scheduled_for', 'published_at')
order by column_name;

select tgname, pg_get_triggerdef(oid) as definition
from pg_trigger
where tgrelid = 'public.drafts'::regclass
  and not tgisinternal;
```

Expect five timestamp-with-time-zone columns, with `approved_at` nullable, and a BEFORE UPDATE trigger named `drafts_set_updated_at` calling `public.set_drafts_updated_at()`.

## Local tests

`npm test -- tests/migrations.test.ts` runs the actual SQL in disposable in-memory PostgreSQL through PGlite. No live database credentials are read. The tests cover:

- All columns referenced by the current application.
- Create, approve, schedule, edit, and simulated-publish writes.
- Automatic `updated_at` changes while creation and approval timestamps are preserved.
- Scheduled-time and status constraints, brand-voice upserts, and usage/event inserts.
- Draft visibility and update isolation under two authenticated user identities.
- Upgrade from the original schema, upgrade with a manually added approval column, and repeat application without losing records or timestamps.

The auth schema/function/role is a small test substitute. These checks do not verify Supabase Auth, PostgREST, live RLS configuration, deployed cron jobs, or real publishing.

Implementation references: [PostgreSQL trigger behavior](https://www.postgresql.org/docs/16/trigger-definition.html) and [PGlite API](https://pglite.dev/docs/api).

Local verification for this repair: `npm test -- tests/migrations.test.ts` passed 7 tests; `npm test` passed all 91 tests across 9 files; `npm run lint` and `npm run typecheck` passed. No hosted migration was applied.
