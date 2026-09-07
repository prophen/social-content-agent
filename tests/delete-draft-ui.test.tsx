// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "draft-1" }), useRouter: () => mocks }));
vi.mock("@/app/components/AuthControls", () => ({ default: () => null }));
import DraftEditorPage from "@/app/drafts/[id]/page";

const draft = {
  id: "draft-1", topic: "My test draft", content: "Keep this content", status: "draft",
  createdAt: "2026-09-01T12:00:00Z", updatedAt: "2026-09-01T12:00:00Z",
  approvedAt: null, scheduledFor: null, publishedAt: null,
};
const deleteRequest = vi.fn();

beforeEach(() => {
  deleteRequest.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", vi.fn((url: string, options?: RequestInit) => {
    if (options?.method === "DELETE") return deleteRequest(url);
    return Promise.resolve(Response.json(url.endsWith("/events") ? { events: [] } : { draft }));
  }));
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(cleanup);

it("does not delete when confirmation is cancelled", async () => {
  vi.mocked(window.confirm).mockReturnValue(false);
  render(<DraftEditorPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Delete draft" }));
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("My test draft"));
  expect(deleteRequest).not.toHaveBeenCalled();
  expect(mocks.replace).not.toHaveBeenCalled();
});

it("returns to the library after confirmed deletion", async () => {
  render(<DraftEditorPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Delete draft" }));
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/drafts"));
  expect(deleteRequest).toHaveBeenCalledOnce();
  expect(deleteRequest).toHaveBeenCalledWith("/api/drafts/draft-1");
  expect(mocks.refresh).toHaveBeenCalled();
});

it("keeps content and allows retry when deletion fails", async () => {
  deleteRequest.mockResolvedValue(Response.json({ error: "Could not delete the draft. Please try again." }, { status: 500 }));
  render(<DraftEditorPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Delete draft" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not delete the draft");
  expect(screen.getByLabelText("Post draft")).toHaveValue("Keep this content");
  expect(screen.getByRole("button", { name: "Delete draft" })).toBeEnabled();
  expect(mocks.replace).not.toHaveBeenCalled();
});

it("disables editing actions while deletion is pending", async () => {
  deleteRequest.mockReturnValue(new Promise(() => {}));
  render(<DraftEditorPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Delete draft" }));
  expect(screen.getByRole("button", { name: "Deleting..." })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Approve draft" })).toBeDisabled();
});
