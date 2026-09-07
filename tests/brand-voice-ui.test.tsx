// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { brandVoice } from "@/lib/brandVoice";
vi.mock("@/app/components/AuthControls", () => ({ default: () => null }));
import BrandVoicePage from "@/app/brand-voice/page";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("loads, edits, saves normalized lists, and restores saved values on discard", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(brandVoice))
    .mockImplementation(async (_url, options) => Response.json(JSON.parse(options.body)));
  vi.stubGlobal("fetch", fetchMock);
  render(<BrandVoicePage />);
  const name = await screen.findByLabelText("Voice name");
  expect(name).toHaveValue(brandVoice.name);
  const tone = screen.getByLabelText("Tone");
  await userEvent.clear(tone); await userEvent.type(tone, " Warm \n\n Direct ");
  await userEvent.click(screen.getByRole("button", { name: "Save brand voice" }));
  await screen.findByText(/Brand voice saved\./);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).tone).toEqual(["Warm", "Direct"]);
  await userEvent.clear(name); await userEvent.type(name, "Unsaved");
  await userEvent.click(screen.getByRole("button", { name: "Discard changes" }));
  expect(name).toHaveValue(brandVoice.name);
});

it("retains edits after a failed save and allows retry", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json(brandVoice))
    .mockResolvedValue(Response.json({ error: "Save failed" }, { status: 500 })));
  render(<BrandVoicePage />);
  const name = await screen.findByLabelText("Voice name");
  await userEvent.clear(name); await userEvent.type(name, "Keep my changes");
  await userEvent.click(screen.getByRole("button", { name: "Save brand voice" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Save failed"));
  expect(name).toHaveValue("Keep my changes");
  expect(screen.getByRole("button", { name: "Save brand voice" })).toBeEnabled();
});
