"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AuthControls from "@/app/components/AuthControls";

type DraftStatus =
  | "draft"
  | "approved"
  | "scheduled"
  | "published"
  | "publish_failed";

type Draft = {
  id: string;
  topic: string;
  content: string;
  status: DraftStatus;
  scheduledFor: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type StatusFilter = "all" | DraftStatus;

const filters: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Drafts", value: "draft" },
  { label: "Approved", value: "approved" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Published", value: "published" },
  { label: "Failed", value: "publish_failed" },
];

function formatDate(value: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStatusLabel(status: DraftStatus) {
  switch (status) {
    case "draft":
      return "Draft";
    case "approved":
      return "Approved";
    case "scheduled":
      return "Scheduled";
    case "published":
      return "Published";
    case "publish_failed":
      return "Publish failed";
  }
}

function getPreview(content: string) {
  const preview = content.replace(/\s+/g, " ").trim();

  if (!preview) {
    return "No content yet.";
  }

  return preview.length > 160 ? `${preview.slice(0, 160)}…` : preview;
}

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("all");
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
      setError(
        error instanceof Error ? error.message : "Could not load drafts.",
      );
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

  const filteredDrafts = useMemo(() => {
    if (filter === "all") {
      return drafts;
    }

    return drafts.filter((draft) => draft.status === filter);
  }, [drafts, filter]);

  return (
    <main className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">Publishing workspace</p>
          <h1>Your drafts</h1>
          <p className="dashboard-description">
            Create, review, schedule, and track your publishing work.
          </p>
        </div>

        <div className="dashboard-actions">
          <Link className="new-draft-button" href="/drafts/new">
            New draft
          </Link>

          <AuthControls showDraftsLink={false} />
        </div>
      </div>

      <section aria-label="Draft filters">
        <div className="draft-filter-list">
          {filters.map((item) => (
            <button
              aria-pressed={filter === item.value}
              className={`draft-filter-button ${
                filter === item.value ? "is-active" : ""
              }`}
              key={item.value}
              onClick={() => setFilter(item.value)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {isLoading && <p className="dashboard-message">Loading drafts...</p>}

      {!isLoading && error && (
        <div className="dashboard-error" role="alert">
          <p>Could not load drafts: {error}</p>
          <button onClick={() => void loadDrafts()} type="button">
            Try again
          </button>
        </div>
      )}

      {!isLoading && !error && filteredDrafts.length === 0 && (
        <section className="empty-drafts">
          <h2>
            No {filter === "all" ? "" : getStatusLabel(filter).toLowerCase()}{" "}
            drafts yet
          </h2>
          <p>
            {filter === "all"
              ? "Create your first draft to start your publishing workflow."
              : "Try another filter or create a new draft."}
          </p>
          {filter === "all" && (
            <Link className="new-draft-button" href="/drafts/new">
              Create a draft
            </Link>
          )}
        </section>
      )}

      {!isLoading && !error && filteredDrafts.length > 0 && (
        <section className="draft-grid" aria-label="Drafts">
          {filteredDrafts.map((draft) => (
            <article className="draft-card" key={draft.id}>
              <div className="draft-card-topline">
                <span className={`status-badge status-${draft.status}`}>
                  {getStatusLabel(draft.status)}
                </span>

                <time dateTime={draft.updatedAt}>
                  Updated {formatDate(draft.updatedAt)}
                </time>
              </div>

              <h2>{draft.topic || "Untitled draft"}</h2>

              <p className="draft-preview">{getPreview(draft.content)}</p>

              {draft.status === "scheduled" && draft.scheduledFor && (
                <p className="draft-timing">
                  Scheduled for {formatDate(draft.scheduledFor)}
                </p>
              )}

              {draft.status === "published" && draft.publishedAt && (
                <p className="draft-timing">
                  Published {formatDate(draft.publishedAt)}
                </p>
              )}

              <Link className="open-draft-link" href={`/drafts/${draft.id}`}>
                Open draft <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
