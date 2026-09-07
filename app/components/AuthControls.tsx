"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AuthControlsProps = {
  showDraftsLink?: boolean;
};

export default function AuthControls({
  showDraftsLink = true,
}: AuthControlsProps) {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const supabase = createClient();
    let isActive = true;

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (isActive) {
        setUser(user);
        setIsLoading(false);
      }
    }

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isActive) {
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    setIsSigningOut(true);
    setErrorMessage("");

    const supabase = createClient();

    const { error } = await supabase.auth.signOut({
      scope: "local",
    });

    if (error) {
      console.error("Could not sign out:", error);
      setErrorMessage("Could not sign out. Please try again.");
      setIsSigningOut(false);
      return;
    }

    router.replace("/sign-in");
    router.refresh();
  }

  if (isLoading) {
    return <span className="auth-status">Checking session...</span>;
  }

  if (!user) {
    return (
      <div className="auth-controls">
        <Link href="/sign-in">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="auth-controls">
      {showDraftsLink && <Link href="/drafts">My drafts</Link>}
      <Link href="/brand-voice">Brand voice</Link>

      <button
        type="button"
        className="sign-out-button"
        onClick={handleSignOut}
        disabled={isSigningOut}
      >
        {isSigningOut ? "Signing out..." : "Sign out"}
      </button>

      {errorMessage && (
        <span className="auth-controls-error" role="alert">
          {errorMessage}
        </span>
      )}
    </div>
  );
}
