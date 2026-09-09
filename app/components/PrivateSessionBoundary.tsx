"use client";

import Link from "next/link";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

// This clears browser state; server routes remain responsible for authorization.
export default function PrivateSessionBoundary({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{ userId: string | null | undefined; revision: number }>({
    userId: undefined,
    revision: 0,
  });

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = createClient().auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      const userId = next?.user.id ?? null;
      setSession(previous => previous.userId === userId
        ? previous
        : { userId, revision: previous.revision + 1 });
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (session.userId === undefined) {
    return <main className="page"><p role="status">Checking session...</p></main>;
  }
  if (session.userId === null) {
    return <main className="page"><p>Sign in to access your workspace.</p><Link href="/sign-in">Sign in</Link></main>;
  }

  // Unmount private pages and their loaded state on identity changes.
  // A revision also handles sign-out and sign-in to the same account in one batch.
  return <Fragment key={session.revision}>{children}</Fragment>;
}
