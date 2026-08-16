"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type DraftStatus = "draft" | "approved" | "scheduled" | "published";

type Draft = {
  id: string;
  topic: string;
  content: string;
  status: DraftStatus;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getPreview(content: string) {
  const trimmed = content.replace(/\s+/g, " ").trim();

  if (trimmed.length <= 180) {
    return trimmed;
  }

  return `${trimmed.slice(0, 180)}…`;
}

export default function DraftLibraryPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDrafts() {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/drafts");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load drafts.");
      }

      setDrafts(data.drafts);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not load drafts.";

      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;

    async function fetchDrafts() {
      try {
        const response = await fetch("/api/drafts");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not load drafts.");
        }

        if (!ignore) {
          setDrafts(data.drafts);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not load drafts.";

        if (!ignore) {
          setError(message);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void fetchDrafts();

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <main className="page">
      <section className="card">
        <nav className="top-nav" aria-label="Primary navigation">
          <Link href="/">Create a new draft</Link>
        </nav>

        <p className="eyebrow">Draft Library</p>
        <h1>Saved drafts</h1>

        <p className="intro">
          Your generated content is stored in Supabase and remains available
          after you refresh or return later.
        </p>

        {isLoading && <p className="status-message">Loading drafts...</p>}

        {error && (
          <section className="error-message" role="alert">
            <p>Could not load drafts: {error}</p>
            <button type="button" onClick={loadDrafts}>
              Try again
            </button>
          </section>
        )}

        {!isLoading && !error && drafts.length === 0 && (
          <section className="empty-state">
            <h2>No saved drafts yet</h2>
            <p>Create your first AI-generated post draft from the home page.</p>
            <Link className="primary-link" href="/">
              Create a draft
            </Link>
          </section>
        )}

        {!isLoading && !error && drafts.length > 0 && (
          <div className="draft-list">
            {drafts.map((draft) => (
              <article className="draft-list-item" key={draft.id}>
                <div className="draft-list-heading">
                  <p className="draft-topic">{draft.topic}</p>
                  <span className={`status status-${draft.status}`}>
                    {draft.status}
                  </span>
                </div>

                <p className="draft-preview">{getPreview(draft.content)}</p>

                <div className="draft-list-footer">
                  <span>Last updated {formatDate(draft.updatedAt)}</span>

                  <Link className="text-link" href={`/drafts/${draft.id}`}>
                    Open draft
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
