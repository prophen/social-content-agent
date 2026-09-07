import { vi } from "vitest";

// Each query gets its own builder so read/write filters can be asserted separately.
// Awaiting a builder matches Supabase's PromiseLike query API.
export function query(result: { data?: unknown; error?: { message: string } | null; count?: number | null } = {}) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    then: <T, U>(resolve: (value: typeof result) => T, reject?: (reason: unknown) => U) =>
      Promise.resolve({ data: null, error: null, ...result }).then(resolve, reject),
  };
  return builder;
}

export const draftRow = {
  id: "draft-1", topic: "Testing AI workflows", content: "Original content",
  status: "draft", owner_id: "user-1", created_at: "2026-09-01T12:00:00.000Z",
  updated_at: "2026-09-01T12:00:00.000Z", approved_at: null,
  scheduled_for: null, published_at: null,
};
