import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { query, draftRow } from "./helpers/supabase";

const { from, adminFrom } = vi.hoisted(() => ({ from: vi.fn(), adminFrom: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from }) }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: { from: adminFrom } }));
import { createDraft, deleteDraft, updateDraft, publishDueDrafts } from "@/lib/drafts";

beforeEach(() => {
  from.mockReset(); adminFrom.mockReset();
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-06T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

function existing(overrides: Record<string, unknown> = {}) {
  const row = { ...draftRow, ...overrides };
  const read = query({ data: row });
  const write = query({ data: row });
  from.mockReturnValueOnce(read).mockReturnValueOnce(write);
  return { read, write };
}

describe("draft workflow", () => {
  it("deletes only the requested owner's draft using the session client", async () => {
    const write = query({ data: { id: "draft-1" } });
    from.mockReturnValue(write);
    expect(await deleteDraft("draft-1", "user-1")).toBe(true);
    expect(write.delete).toHaveBeenCalledOnce();
    expect(write.eq).toHaveBeenCalledWith("id", "draft-1");
    expect(write.eq).toHaveBeenCalledWith("owner_id", "user-1");
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it("does not report deletion when no accessible draft was removed", async () => {
    from.mockReturnValue(query());
    expect(await deleteDraft("missing", "user-1")).toBe(false);
  });

  it("surfaces deletion failures", async () => {
    from.mockReturnValue(query({ error: { message: "database unavailable" } }));
    await expect(deleteDraft("draft-1", "user-1")).rejects.toThrow("database unavailable");
  });

  it("creates a user-owned draft and maps database fields", async () => {
    const insert = query({ data: draftRow }); from.mockReturnValue(insert);
    const draft = await createDraft(draftRow.topic, draftRow.content, "user-1");
    expect(insert.insert).toHaveBeenCalledWith({ topic: draftRow.topic, content: draftRow.content, status: "draft", approved_at: null, owner_id: "user-1" });
    expect(draft).toMatchObject({ id: "draft-1", ownerId: "user-1", createdAt: draftRow.created_at, scheduledFor: null });
  });

  it("returns undefined without writing when the draft is missing", async () => {
    from.mockReturnValue(query());
    expect(await updateDraft("missing", { status: "approved" })).toBeUndefined();
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("records approval time", async () => {
    const { write } = existing();
    await updateDraft("draft-1", { status: "approved" });
    expect(write.update).toHaveBeenCalledWith({ status: "approved", approved_at: "2026-09-06T12:00:00.000Z" });
    expect(write.eq).toHaveBeenCalledWith("id", "draft-1");
  });

  it.each(["approved", "scheduled"])("editing %s content revokes approval and scheduling", async (status) => {
    const { write } = existing({ status });
    await updateDraft("draft-1", { content: "Revised content" });
    expect(write.update).toHaveBeenCalledWith({ content: "Revised content", status: "draft", approved_at: null, scheduled_for: null, published_at: null });
  });

  it("saving unchanged content preserves approval", async () => {
    const { write } = existing({ status: "approved" });
    await updateDraft("draft-1", { content: draftRow.content });
    expect(write.update).toHaveBeenCalledWith({ content: draftRow.content });
  });

  it.each([
    ["published", { content: "Edited" }, "Published drafts cannot be edited."],
    ["approved", { status: "approved" as const }, "Only a draft can be approved."],
    ["draft", { status: "scheduled" as const }, "Only an approved draft can be scheduled."],
    ["approved", { status: "scheduled" as const }, "A scheduled publishing time is required."],
    ["approved", { status: "scheduled" as const, scheduledFor: "invalid" }, "The scheduled publishing time is invalid."],
    ["approved", { status: "scheduled" as const, scheduledFor: "2026-09-06T12:00:00Z" }, "The scheduled publishing time must be in the future."],
    ["draft", { status: "published" as const }, "Only a scheduled draft can be published."],
    ["scheduled", { status: "published" as const }, "This draft is not ready to publish yet."],
  ])("rejects invalid transition from %s: %j", async (status, updates, message) => {
    const { write } = existing({ status });
    await expect(updateDraft("draft-1", updates)).rejects.toThrow(message);
    expect(write.update).not.toHaveBeenCalled();
  });

  it("normalizes a future schedule to UTC", async () => {
    const { write } = existing({ status: "approved" });
    await updateDraft("draft-1", { status: "scheduled", scheduledFor: "2026-09-07T09:00:00-07:00" });
    expect(write.update).toHaveBeenCalledWith({ status: "scheduled", scheduled_for: "2026-09-07T16:00:00.000Z" });
  });

  it("publishes a scheduled draft exactly when due", async () => {
    const { write } = existing({ status: "scheduled", scheduled_for: "2026-09-06T12:00:00Z" });
    await updateDraft("draft-1", { status: "published" });
    expect(write.update).toHaveBeenCalledWith({ status: "published", published_at: "2026-09-06T12:00:00.000Z" });
  });
});

describe("scheduled publisher", () => {
  it("does nothing when there are no due drafts", async () => {
    const read = query({ data: [] }); adminFrom.mockReturnValue(read);
    expect(await publishDueDrafts()).toEqual([]);
    expect(read.eq).toHaveBeenCalledWith("status", "scheduled");
    expect(read.lte).toHaveBeenCalledWith("scheduled_for", "2026-09-06T12:00:00.000Z");
    expect(adminFrom).toHaveBeenCalledTimes(1);
  });

  it("guards the write against concurrent publication and records only changed rows", async () => {
    const write = query({ data: [{ ...draftRow, status: "published" }] });
    const events = query();
    adminFrom.mockReturnValueOnce(query({ data: [draftRow, { ...draftRow, id: "already-published" }] })).mockReturnValueOnce(write).mockReturnValueOnce(events);
    expect(await publishDueDrafts()).toHaveLength(1);
    expect(write.in).toHaveBeenCalledWith("id", ["draft-1", "already-published"]);
    expect(write.eq).toHaveBeenCalledWith("status", "scheduled");
    expect(events.insert).toHaveBeenCalledWith([{ draft_id: "draft-1", owner_id: "user-1", event_type: "draft_published", metadata: { publishedAt: "2026-09-06T12:00:00.000Z" } }]);
  });

  it("does not record events if another job already published every row", async () => {
    adminFrom.mockReturnValueOnce(query({ data: [draftRow] })).mockReturnValueOnce(query({ data: [] }));
    expect(await publishDueDrafts()).toEqual([]);
    expect(adminFrom).toHaveBeenCalledTimes(2);
  });

  it.each(["read", "write", "event"])("surfaces a %s failure", async (stage) => {
    const error = { message: "database unavailable" };
    adminFrom.mockReturnValueOnce(query(stage === "read" ? { error } : { data: [draftRow] }))
      .mockReturnValueOnce(query(stage === "write" ? { error } : { data: [draftRow] }))
      .mockReturnValueOnce(query({ error }));
    await expect(publishDueDrafts()).rejects.toThrow("database unavailable");
    expect(adminFrom).toHaveBeenCalledTimes(stage === "read" ? 1 : stage === "write" ? 2 : 3);
  });
});
