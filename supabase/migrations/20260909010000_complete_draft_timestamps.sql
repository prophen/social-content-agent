begin;

-- The application already reads and writes this column. Keep old approval
-- times unknown (NULL), rather than inventing a timestamp for existing rows.
-- IF NOT EXISTS also supports projects where the column was added manually.
alter table public.drafts
  add column if not exists approved_at timestamptz;

-- A DEFAULT only runs on INSERT. Refresh updated_at for every subsequent
-- draft update, including edits, approval, scheduling, and the publisher job.
create or replace function public.set_drafts_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create or replace trigger drafts_set_updated_at
before update on public.drafts
for each row
execute function public.set_drafts_updated_at();

-- Ask PostgREST to refresh its column metadata after the transaction commits.
notify pgrst, 'reload schema';

commit;
