import { beforeEach, expect, it, vi } from "vitest";
import { query } from "./helpers/supabase";

const { getUser, from, generate } = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), generate: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser } }) }));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: { from } }));
vi.mock("openai", () => ({ default: class { responses = { create: generate }; } }));
import { POST } from "@/app/api/generate-draft/route";

function request(topic: unknown) {
  return new Request("http://localhost/api/generate-draft", { method: "POST", body: JSON.stringify({ topic }) });
}

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  from.mockReset(); generate.mockReset().mockResolvedValue({ output_text: "Generated post" });
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

it("requires authentication before spending tokens or checking quota", async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await POST(request("AI"))).status).toBe(401);
  expect(from).not.toHaveBeenCalled(); expect(generate).not.toHaveBeenCalled();
});

it.each(["", "   ", "x".repeat(301), undefined, 42, {}, []])("rejects invalid topic %j before calling services", async (topic) => {
  expect((await POST(request(topic))).status).toBe(400);
  expect(from).not.toHaveBeenCalled(); expect(generate).not.toHaveBeenCalled();
});

it("blocks generation at the hourly limit", async () => {
  const count = query({ count: 10 }); from.mockReturnValue(count);
  expect((await POST(request("AI"))).status).toBe(429);
  expect(count.eq).toHaveBeenCalledWith("user_id", "user-1");
  expect(generate).not.toHaveBeenCalled();
});

it("accepts the maximum topic length below the limit and records usage", async () => {
  const count = query({ count: 9 }); const insert = query();
  from.mockReturnValueOnce(count).mockReturnValueOnce(insert);
  const response = await POST(request(`  ${"x".repeat(300)}  `));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ draft: "Generated post" });
  expect(generate).toHaveBeenCalledWith(expect.objectContaining({ input: `Write one LinkedIn post about this topic: "${"x".repeat(300)}"`, instructions: expect.stringContaining("Never invent accomplishments") }));
  expect(insert.insert).toHaveBeenCalledWith({ user_id: "user-1" });
});

it("fails closed if the quota lookup fails", async () => {
  from.mockReturnValue(query({ error: { message: "unavailable" } }));
  expect((await POST(request("AI"))).status).toBe(500);
  expect(generate).not.toHaveBeenCalled();
});

it("does not record usage when OpenAI fails", async () => {
  from.mockReturnValue(query({ count: 0 })); generate.mockRejectedValue(new Error("Provider failure"));
  const response = await POST(request("AI"));
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "Something went wrong while generating the draft." });
  expect(from).toHaveBeenCalledTimes(1);
});

it("still returns generated content if usage recording fails", async () => {
  from.mockReturnValueOnce(query({ count: 0 })).mockReturnValueOnce(query({ error: { message: "write failed" } }));
  expect((await POST(request("AI"))).status).toBe(200);
  expect(console.error).toHaveBeenCalled();
});
