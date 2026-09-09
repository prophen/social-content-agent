import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const migrationDir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(migrationDir).filter((file) => file.endsWith(".sql")).sort();
const repairFile = "20260909010000_complete_draft_timestamps.sql";
const repair = readFileSync(join(migrationDir, repairFile), "utf8");
const owner = "00000000-0000-4000-8000-000000000001";
const otherOwner = "00000000-0000-4000-8000-000000000002";
let db: PGlite;

async function createDatabase() {
  const database = new PGlite();
  // Minimal Supabase auth scaffolding only; the actual application SQL below
  // supplies the tables, constraints, triggers, and policies under test.
  await database.exec(`
    create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    insert into auth.users (id) values ('${owner}'), ('${otherOwner}');
  `);
  return database;
}

beforeAll(async () => {
  db = await createDatabase();
  for (const file of files) await db.exec(readFileSync(join(migrationDir, file), "utf8"));
}, 30000);
afterAll(async () => { await db?.close(); });

describe("fresh database migration chain", () => {
  it("provides every column referenced by the application", async () => {
    const { rows } = await db.query<{ table_name: string; column_name: string }>(`
      select table_name, column_name from information_schema.columns where table_schema = 'public'
    `);
    const expected: Record<string, string[]> = {
      drafts: ["id", "owner_id", "topic", "content", "status", "approved_at", "scheduled_for", "published_at", "created_at", "updated_at"],
      draft_events: ["id", "draft_id", "owner_id", "event_type", "metadata", "created_at"],
      generation_requests: ["id", "user_id", "created_at"],
      brand_voices: ["owner_id", "voice", "updated_at"],
    };
    for (const [table, columns] of Object.entries(expected)) {
      expect(rows.filter(row => row.table_name === table).map(row => row.column_name).sort()).toEqual(columns.sort());
    }
    const { rows: approval } = await db.query(`
      select data_type, is_nullable, column_default from information_schema.columns
      where table_schema = 'public' and table_name = 'drafts' and column_name = 'approved_at'
    `);
    expect(approval[0]).toMatchObject({ data_type: "timestamp with time zone", is_nullable: "YES", column_default: null });
  });

  it("supports the actual create, approve, schedule, edit, and publish column writes", async () => {
    const { rows: [draft] } = await db.query<{ id: string; approved_at: Date | null }>(`
      insert into public.drafts (owner_id, topic, content, status, approved_at)
      values ($1, 'A topic', 'Original text', 'draft', null) returning id, approved_at
    `, [owner]);
    expect(draft.approved_at).toBeNull();
    await db.query("update public.drafts set status = 'approved', approved_at = '2026-09-08T12:00:00Z' where id = $1", [draft.id]);
    await db.query("update public.drafts set status = 'scheduled', scheduled_for = '2026-09-09T12:00:00Z' where id = $1", [draft.id]);
    const { rows: [edited] } = await db.query(`
      update public.drafts set content = 'Changed text', status = 'draft', approved_at = null,
      scheduled_for = null, published_at = null where id = $1 returning *
    `, [draft.id]);
    expect(edited).toMatchObject({ content: "Changed text", status: "draft", approved_at: null, scheduled_for: null, published_at: null });
    await db.query("update public.drafts set status = 'approved', approved_at = now() where id = $1", [draft.id]);
    await db.query("update public.drafts set status = 'scheduled', scheduled_for = now() where id = $1", [draft.id]);
    await db.query("update public.drafts set status = 'published', published_at = now() where id = $1", [draft.id]);
    await db.query("insert into public.draft_events (draft_id, owner_id, event_type, metadata) values ($1, $2, 'draft_published', '{}')", [draft.id, owner]);
  });

  it("refreshes updated_at for content and status changes while preserving creation and approval times", async () => {
    const { rows: [draft] } = await db.query<{ id: string }>(`
      insert into public.drafts (owner_id, topic, content, status, created_at, updated_at, approved_at)
      values ($1, 'Timestamps', 'Original', 'approved', '2020-01-01Z', '2020-01-02Z', '2020-01-03Z') returning id
    `, [owner]);
    for (const update of ["content = 'Edited'", "status = 'scheduled', scheduled_for = now()", "status = 'published', published_at = now()"] ) {
      const { rows: [row] } = await db.query<{ updated_at: Date; created_at: Date; approved_at: Date; statement_time: Date }>(`
        update public.drafts set ${update} where id = $1
        returning updated_at, created_at, approved_at, statement_timestamp() as statement_time
      `, [draft.id]);
      expect(row.updated_at).toEqual(row.statement_time);
      expect(row.updated_at.getTime()).toBeGreaterThan(Date.parse("2020-01-02T00:00:00Z"));
      expect(row.created_at.toISOString()).toBe("2020-01-01T00:00:00.000Z");
      expect(row.approved_at.toISOString()).toBe("2020-01-03T00:00:00.000Z");
    }
  });

  it("retains existing constraints and supporting-table writes", async () => {
    await expect(db.query("insert into public.drafts (owner_id, topic, content, status) values ($1, 'Bad', 'Bad', 'scheduled')", [owner])).rejects.toThrow(/scheduled_draft_requires_scheduled_for/);
    await expect(db.query("insert into public.drafts (owner_id, topic, content, status) values ($1, 'Bad', 'Bad', 'unknown')", [owner])).rejects.toThrow(/check constraint/);
    await db.query("insert into public.generation_requests (user_id) values ($1)", [owner]);
    await db.query("insert into public.brand_voices (owner_id, voice) values ($1, '{\"name\":\"Test\"}')", [owner]);
    await db.query("insert into public.brand_voices (owner_id, voice) values ($1, '{\"name\":\"Updated\"}') on conflict (owner_id) do update set voice = excluded.voice, updated_at = now()", [owner]);
    await expect(db.query("update public.brand_voices set voice = '[]' where owner_id = $1", [owner])).rejects.toThrow(/check constraint/);
  });

  it("keeps draft ownership policies effective with the new trigger", async () => {
    await db.exec("grant usage on schema public, auth to authenticated; grant select, insert, update on public.drafts to authenticated;");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [otherOwner]);
    await db.exec("set role authenticated");
    try {
      const { rows } = await db.query("select * from public.drafts where owner_id = $1", [owner]);
      expect(rows).toHaveLength(0);
      const { rows: updated } = await db.query("update public.drafts set content = 'Not allowed' where owner_id = $1 returning id", [owner]);
      expect(updated).toHaveLength(0);
      const { rows: [own] } = await db.query<{ id: string }>("insert into public.drafts (owner_id, topic, content) values ($1, 'Own', 'Draft') returning id", [otherOwner]);
      const { rows: [approved] } = await db.query<{ status: string; approved_at: Date | null }>("update public.drafts set status = 'approved', approved_at = now() where id = $1 returning status, approved_at", [own.id]);
      expect(approved.status).toBe("approved");
      expect(approved.approved_at).not.toBeNull();
    } finally { await db.exec("reset role"); }
  });
});

describe("existing database upgrade", () => {
  it.each([false, true])("preserves existing records when approved_at already exists: %s", async (alreadyExists) => {
    const existing = await createDatabase();
    try {
      for (const file of files.filter(file => file < repairFile)) await existing.exec(readFileSync(join(migrationDir, file), "utf8"));
      if (alreadyExists) await existing.exec("alter table public.drafts add column approved_at timestamptz");
      const { rows: [before] } = await existing.query<{ id: string }>(`
        insert into public.drafts (owner_id, topic, content, status, scheduled_for, created_at, updated_at)
        values ($1, 'Existing', 'Keep this text', 'scheduled', '2026-10-01Z', '2020-01-01Z', '2020-01-02Z') returning id
      `, [owner]);
      if (alreadyExists) await existing.query("update public.drafts set approved_at = '2026-09-01Z' where id = $1", [before.id]);
      await existing.query("insert into public.draft_events (draft_id, owner_id, event_type) values ($1, $2, 'draft_scheduled')", [before.id, owner]);
      await existing.exec(repair);
      await existing.exec(repair); // Safe when already applied manually, too.
      const { rows: [after] } = await existing.query<{ content: string; status: string; approved_at: Date | null; updated_at: Date; scheduled_for: Date }>("select * from public.drafts where id = $1", [before.id]);
      expect(after.content).toBe("Keep this text");
      expect(after.status).toBe("scheduled");
      expect(after.updated_at.toISOString()).toBe("2020-01-02T00:00:00.000Z");
      expect(after.scheduled_for.toISOString()).toBe("2026-10-01T00:00:00.000Z");
      expect(after.approved_at?.toISOString() ?? null).toBe(alreadyExists ? "2026-09-01T00:00:00.000Z" : null);
      expect((await existing.query("select * from public.draft_events where draft_id = $1", [before.id])).rows).toHaveLength(1);
    } finally { await existing.close(); }
  }, 30000);
});
