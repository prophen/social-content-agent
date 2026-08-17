"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthControls() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Could not sign out:", error);
      setIsSigningOut(false);
      return;
    }

    router.push("/sign-in");
    router.refresh();
  }

  return (
    <div className="auth-controls">
      <Link href="/drafts">My drafts</Link>

      <button
        type="button"
        className="sign-out-button"
        onClick={handleSignOut}
        disabled={isSigningOut}
      >
        {isSigningOut ? "Signing out..." : "Sign out"}
      </button>
    </div>
  );
}
