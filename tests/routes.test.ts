import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), createDraft: vi.fn(), getDrafts: vi.fn(), getDraftById: vi.fn(), updateDraft: vi.fn(), publishDueDrafts: vi.fn(), createDraftEvent: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/drafts", () => mocks);
vi.mock("@/lib/draftEvents", () => ({ createDraftEvent: mocks.createDraftEvent }));
import { GET, POST } from "@/app/api/drafts/route";
import { GET as getOne, PATCH } from "@/app/api/drafts/[id]/route";
import { GET as cronGet, POST as cronPost } from "@/app/api/jobs/publish-due-drafts/route";

const context = () => ({ params: Promise.resolve({ id: "draft-1" }) });
const request = (body: unknown = {}) => new Request("http://localhost/api/drafts", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("draft API", () => {
  it("protects list, create, detail, and update from anonymous requests", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    for (const response of [await GET(), await POST(request()), await getOne(request(), context()), await PATCH(request(), context())]) {
      expect(response.status).toBe(401);
    }
    expect(mocks.createDraft).not.toHaveBeenCalled(); expect(mocks.getDrafts).not.toHaveBeenCalled();
    expect(mocks.getDraftById).not.toHaveBeenCalled(); expect(mocks.updateDraft).not.toHaveBeenCalled();
  });

  it.each([{ topic: " ", content: "post" }, { topic: "AI", content: 42 }, {}])("rejects missing or invalid creation fields: %j", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.createDraft).not.toHaveBeenCalled();
  });

  it("uses the authenticated owner and trims content on creation", async () => {
    mocks.createDraft.mockResolvedValue({ id: "draft-1" });
    const response = await POST(request({ topic: " AI ", content: " Post ", ownerId: "other-user" }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ draft: { id: "draft-1" } });
    expect(mocks.createDraft).toHaveBeenCalledWith("AI", "Post", "user-1");
    expect(mocks.createDraftEvent).toHaveBeenCalledWith("draft-1", "user-1", "draft_created", { source: "ai_generation" });
  });

  it("returns 404 for an inaccessible or missing draft", async () => {
    expect((await getOne(request(), context())).status).toBe(404);
    expect((await PATCH(request({ content: "Updated" }), context())).status).toBe(404);
    expect(mocks.createDraftEvent).not.toHaveBeenCalled();
  });

  it("rejects unknown status updates", async () => {
    expect((await PATCH(request({ status: "anything" }), context())).status).toBe(400);
    expect(mocks.updateDraft).not.toHaveBeenCalled();
  });

  it("records the normalized schedule in activity history", async () => {
    mocks.updateDraft.mockResolvedValue({ id: "draft-1", scheduledFor: "2026-09-07T16:00:00.000Z" });
    expect((await PATCH(request({ status: "scheduled", scheduledFor: "2026-09-07T09:00:00-07:00" }), context())).status).toBe(200);
    expect(mocks.createDraftEvent).toHaveBeenCalledWith("draft-1", "user-1", "draft_scheduled", { scheduledFor: "2026-09-07T16:00:00.000Z" });
  });
});

describe.each([cronGet, cronPost])("publisher authorization (%#)", (handler) => {
  it("fails closed with no configured secret", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await handler(new Request("http://localhost"))).status).toBe(500);
    expect(mocks.publishDueDrafts).not.toHaveBeenCalled();
  });
  it.each(["", "Bearer wrong", "test-secret"])("rejects invalid authorization %j", async (authorization) => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    expect((await handler(new Request("http://localhost", { headers: { authorization } }))).status).toBe(401);
    expect(mocks.publishDueDrafts).not.toHaveBeenCalled();
  });
  it("returns the published IDs with valid authorization", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret"); mocks.publishDueDrafts.mockResolvedValue([{ id: "draft-1" }]);
    const response = await handler(new Request("http://localhost", { headers: { authorization: "Bearer test-secret" } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ publishedCount: 1, publishedDraftIds: ["draft-1"] });
  });
});
