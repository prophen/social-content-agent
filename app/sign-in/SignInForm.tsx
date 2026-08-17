"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "sign-in" | "sign-up";

export default function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = searchParams.get("next");
  const destination =
    nextPath?.startsWith("/") && !nextPath.startsWith("//")
      ? nextPath
      : "/drafts";

  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      setMessage("Enter both your email address and password.");
      return;
    }

    if (password.length < 8) {
      setMessage("Use a password with at least 8 characters.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    const supabase = createClient();

    try {
      if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          throw error;
        }

        setMessage("Signed in. Redirecting...");
        router.replace(destination);
        router.refresh();
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        setMessage("Account created. Redirecting...");
        router.replace(destination);
        router.refresh();
        return;
      }

      setMessage(
        "Account created. Check your email to confirm your address, then sign in.",
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.";

      setMessage(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
    setPassword("");
  }

  const isSuccess =
    message.startsWith("Signed in") || message.startsWith("Account created");

  return (
    <main className="page">
      <section className="card auth-card">
        <nav className="top-nav" aria-label="Primary navigation">
          <Link href="/">Back to editor</Link>
        </nav>

        <p className="eyebrow">Social Content Agent</p>

        <h1>{mode === "sign-in" ? "Welcome back" : "Create your account"}</h1>

        <p className="intro">
          {mode === "sign-in"
            ? "Sign in to access drafts associated with your account."
            : "Create an account to keep your drafts private and available across devices."}
        </p>

        <div className="auth-tabs" role="tablist" aria-label="Account action">
          <button
            type="button"
            className={mode === "sign-in" ? "auth-tab active" : "auth-tab"}
            onClick={() => switchMode("sign-in")}
            role="tab"
            aria-selected={mode === "sign-in"}
          >
            Sign in
          </button>

          <button
            type="button"
            className={mode === "sign-up" ? "auth-tab active" : "auth-tab"}
            onClick={() => switchMode("sign-up")}
            role="tab"
            aria-selected={mode === "sign-up"}
          >
            Create account
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="email">Email address</label>

          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            required
          />

          <label htmlFor="password">Password</label>

          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={
              mode === "sign-in" ? "current-password" : "new-password"
            }
            minLength={8}
            required
          />

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? mode === "sign-in"
                ? "Signing in..."
                : "Creating account..."
              : mode === "sign-in"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        {message && (
          <p
            className={
              isSuccess ? "auth-message success" : "auth-message error"
            }
            role="status"
          >
            {message}
          </p>
        )}
      </section>
    </main>
  );
}
