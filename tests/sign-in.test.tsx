// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({ signInWithPassword: vi.fn(), signUp: vi.fn(), replace: vi.fn(), refresh: vi.fn(), next: "/drafts/new" }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks, useSearchParams: () => new URLSearchParams({ next: mocks.next }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: mocks }) }));
import SignInForm from "@/app/sign-in/SignInForm";

beforeEach(() => {
  mocks.next = "/drafts/new";
  mocks.signInWithPassword.mockReset().mockResolvedValue({ error: null });
  mocks.signUp.mockReset().mockResolvedValue({ data: { session: null }, error: null });
});
afterEach(cleanup);

async function fillAndSubmit(name = "Sign in") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email address"), "tester@example.com");
  await user.type(screen.getByLabelText("Password"), "test-password");
  await user.click(screen.getByRole("button", { name }));
}

it.each([["/drafts/new", "/drafts/new"], ["https://example.com", "/drafts"], ["//example.com", "/drafts"]])("signs in and safely redirects from %s", async (next, destination) => {
  mocks.next = next; render(<SignInForm />);
  await fillAndSubmit();
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(destination));
  expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: "tester@example.com", password: "test-password" });
  expect(mocks.refresh).toHaveBeenCalled();
});

it("announces authentication errors and allows retrying", async () => {
  mocks.signInWithPassword.mockResolvedValue({ error: new Error("Invalid credentials") });
  render(<SignInForm />); await fillAndSubmit();
  expect(screen.getByRole("alert")).toHaveTextContent("Invalid credentials");
  expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  expect(mocks.replace).not.toHaveBeenCalled();
});

it("supports keyboard mode switching and clears the old password", async () => {
  const user = userEvent.setup(); render(<SignInForm />);
  await user.type(screen.getByLabelText("Password"), "old-password");
  screen.getByRole("tab", { name: "Sign in" }).focus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: "Create account" })).toHaveFocus();
  expect(screen.getByRole("tab", { name: "Create account" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByLabelText("Password")).toHaveValue("");
  await fillAndSubmit("Create account");
  expect(screen.getByRole("status")).toHaveTextContent("Check your email");
  expect(mocks.signUp).toHaveBeenCalledOnce();
  expect(mocks.replace).not.toHaveBeenCalled();
});
