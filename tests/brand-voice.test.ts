import { beforeEach, expect, it, vi } from "vitest";
import { brandVoice } from "@/lib/brandVoice";
import { query } from "./helpers/supabase";

const { getUser, from } = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser }, from }) }));
import { GET, PUT } from "@/app/api/brand-voice/route";

const request = (body: unknown) => new Request("http://localhost/api/brand-voice", { method: "PUT", body: JSON.stringify(body) });
beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  from.mockReset();
});

it("requires authentication for reads and writes", async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await GET()).status).toBe(401);
  expect((await PUT(request(brandVoice))).status).toBe(401);
  expect(from).not.toHaveBeenCalled();
});

it("loads defaults for a new account and scopes the lookup to its owner", async () => {
  const read = query(); from.mockReturnValue(read);
  expect(await (await GET()).json()).toEqual(brandVoice);
  expect(read.eq).toHaveBeenCalledWith("owner_id", "user-1");
});

it("returns saved settings", async () => {
  const voice = { ...brandVoice, name: "Saved voice" };
  from.mockReturnValue(query({ data: { voice } }));
  expect(await (await GET()).json()).toEqual(voice);
});

it("normalizes settings and ignores a forged owner", async () => {
  const write = { upsert: vi.fn().mockResolvedValue({ error: null }) }; from.mockReturnValue(write);
  const response = await PUT(request({ ...brandVoice, name: " New voice ", owner_id: "other-user" }));
  expect(response.status).toBe(200);
  expect(write.upsert).toHaveBeenCalledWith(expect.objectContaining({ owner_id: "user-1", voice: { ...brandVoice, name: "New voice" } }), { onConflict: "owner_id" });
});

it.each([null, {}, { ...brandVoice, name: " " }, { ...brandVoice, tone: "wrong" }, { ...brandVoice, goals: [42] }, { ...brandVoice, avoid: ["x".repeat(501)] }, { ...brandVoice, tone: Array(31).fill("a") }])("rejects invalid settings", async (body) => {
  expect((await PUT(request(body))).status).toBe(400);
  expect(from).not.toHaveBeenCalled();
});

it("reports database failure without claiming a successful save", async () => {
  from.mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: { message: "unavailable" } }) });
  expect((await PUT(request(brandVoice))).status).toBe(500);
});
