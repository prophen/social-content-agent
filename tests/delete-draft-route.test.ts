import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), deleteDraft: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/drafts", () => ({ deleteDraft: mocks.deleteDraft }));
vi.mock("@/lib/draftEvents", () => ({ createDraftEvent: vi.fn() }));
import { DELETE } from "@/app/api/drafts/[id]/route";

function remove() {
  return DELETE(new Request("http://localhost/api/drafts/draft-1", { method: "DELETE" }), {
    params: Promise.resolve({ id: "draft-1" }),
  });
}

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  mocks.deleteDraft.mockReset();
});

it("rejects anonymous deletion without accessing drafts", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await remove()).status).toBe(401);
  expect(mocks.deleteDraft).not.toHaveBeenCalled();
});

it("deletes with the authenticated owner's ID and returns an empty success", async () => {
  mocks.deleteDraft.mockResolvedValue(true);
  const response = await remove();
  expect(response.status).toBe(204);
  expect(await response.text()).toBe("");
  expect(mocks.deleteDraft).toHaveBeenCalledWith("draft-1", "user-1");
});

it("returns 404 for missing or other users' drafts", async () => {
  mocks.deleteDraft.mockResolvedValue(false);
  expect((await remove()).status).toBe(404);
});

it("returns a safe error when the database fails", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.deleteDraft.mockRejectedValue(new Error("private database details"));
  const response = await remove();
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "Could not delete the draft. Please try again." });
});
