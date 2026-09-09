// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

const auth = vi.hoisted(() => ({
  callback: undefined as undefined | ((event: AuthChangeEvent, session: Session | null) => void),
  unsubscribe: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: {
  onAuthStateChange: (callback: typeof auth.callback) => {
    auth.callback = callback;
    return { data: { subscription: { unsubscribe: auth.unsubscribe } } };
  },
} }) }));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "draft-1" }), useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/components/AuthControls", () => ({ default: () => null }));
import PrivateSessionBoundary from "@/app/components/PrivateSessionBoundary";
import DraftEditorPage from "@/app/drafts/[id]/page";

const draft = { id: "draft-1", topic: "Private topic A", content: "Private content A", status: "draft",
  createdAt: "2026-09-09T12:00:00Z", updatedAt: "2026-09-09T12:00:00Z",
  approvedAt: null, scheduledFor: null, publishedAt: null };

function emit(userId: string | null, event: AuthChangeEvent = "SIGNED_IN") {
  act(() => auth.callback?.(event, userId ? { user: { id: userId } } as Session : null));
}
function mount() { return render(<PrivateSessionBoundary><DraftEditorPage /></PrivateSessionBoundary>); }
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(Response.json(
    url.endsWith("/events") ? { events: [] } : { draft },
  ))));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("does not load private content before the initial session and clears it on sign-out", async () => {
  mount();
  expect(fetch).not.toHaveBeenCalled();
  emit("A", "INITIAL_SESSION");
  expect(await screen.findByLabelText("Post draft")).toHaveValue("Private content A");
  emit(null, "SIGNED_OUT");
  expect(screen.queryByLabelText("Post draft")).not.toBeInTheDocument();
  expect(screen.queryByText("Private topic A")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
});

it("discards an open editor when a different account signs in and reloads authorization", async () => {
  mount(); emit("A", "INITIAL_SESSION");
  await screen.findByLabelText("Post draft");
  vi.mocked(fetch).mockResolvedValue(Response.json({ error: "Draft not found." }, { status: 404 }));
  emit("B");
  expect(screen.queryByLabelText("Post draft")).not.toBeInTheDocument();
  expect(await screen.findByRole("heading", { name: "Draft unavailable" })).toBeInTheDocument();
  expect(screen.queryByText("Private topic A")).not.toBeInTheDocument();
});

it("keeps unsaved edits on same-user session refresh", async () => {
  mount(); emit("A", "INITIAL_SESSION");
  const editor = await screen.findByLabelText("Post draft");
  await userEvent.clear(editor); await userEvent.type(editor, "Unsaved work");
  const requestCount = vi.mocked(fetch).mock.calls.length;
  emit("A", "TOKEN_REFRESHED"); emit("A", "SIGNED_IN");
  expect(editor).toHaveValue("Unsaved work");
  expect(vi.mocked(fetch).mock.calls).toHaveLength(requestCount);
});

it("does not restore a late response from the previous account", async () => {
  let resolveOld!: (response: Response) => void;
  vi.mocked(fetch).mockImplementation((url) => String(url).endsWith("/events")
    ? Promise.resolve(Response.json({ events: [] }))
    : new Promise(resolve => { resolveOld = resolve; }));
  mount(); emit("A", "INITIAL_SESSION");
  vi.mocked(fetch).mockResolvedValue(Response.json({ error: "Draft not found." }, { status: 404 }));
  emit("B");
  await screen.findByRole("heading", { name: "Draft unavailable" });
  await act(async () => { resolveOld(Response.json({ draft })); });
  expect(screen.queryByLabelText("Post draft")).not.toBeInTheDocument();
  expect(screen.queryByText("Private topic A")).not.toBeInTheDocument();
});

it("resets even when sign-out and same-account sign-in are batched", async () => {
  mount(); emit("A", "INITIAL_SESSION");
  const editor = await screen.findByLabelText("Post draft");
  await userEvent.type(editor, " unsaved");
  act(() => {
    auth.callback?.("SIGNED_OUT", null);
    auth.callback?.("SIGNED_IN", { user: { id: "A" } } as Session);
  });
  expect(await screen.findByLabelText("Post draft")).toHaveValue("Private content A");
});
