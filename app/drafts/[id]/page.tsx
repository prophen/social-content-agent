"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type DraftStatus = "draft" | "approved" | "scheduled" | "published";

type Draft = {
  id: string;
  topic: string;
  content: string;
  status: DraftStatus;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  scheduledFor: string | null;
  publishedAt: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function DraftEditorPage() {
  const params = useParams<{ id: string }>();
  const draftId = params.id;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [message, setMessage] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);

  async function readResponse(response: Response) {
    const text = await response.text();

    if (!text) {
      throw new Error(
        `The server returned an empty response (${response.status}).`,
      );
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        `The server returned non-JSON (${response.status}): ${text.slice(0, 200)}`,
      );
    }
  }

  useEffect(() => {
    let ignore = false;

    async function fetchDraft() {
      try {
        const response = await fetch(`/api/drafts/${draftId}`);
        const data = await readResponse(response);

        if (!response.ok || !data.draft) {
          throw new Error(data.error || "Could not load this draft.");
        }

        if (!ignore) {
          setDraft(data.draft);
          setContent(data.draft.content);

          setScheduledFor(
            data.draft.scheduledFor
              ? new Date(data.draft.scheduledFor).toISOString().slice(0, 16)
              : "",
          );
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Could not load this draft.";

        if (!ignore) {
          setMessage(`Error: ${errorMessage}`);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void fetchDraft();

    return () => {
      ignore = true;
    };
  }, [draftId]);

  function handleContentChange(nextContent: string) {
    setContent(nextContent);

    /*
      The visual status changes immediately when text is edited.
      The server enforces the same rule when the user saves.
    */
    if (draft?.status === "approved") {
      setDraft({
        ...draft,
        status: "draft",
        approvedAt: null,
      });
    }

    setMessage("");
  }

  async function saveChanges() {
    if (!draft || !content.trim()) {
      setMessage("The draft is empty, so there is nothing to save.");
      return;
    }

    setIsSaving(true);
    setMessage("Saving changes...");

    try {
      const response = await fetch(`/api/drafts/${draft.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content,
        }),
      });

      const data = await readResponse(response);

      if (!response.ok || !data.draft?.content) {
        throw new Error(data.error || "Could not save this draft.");
      }

      setDraft(data.draft);
      setContent(data.draft.content);
      setMessage("Changes saved.");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Could not save this draft.";

      setMessage(`Save failed: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function approveDraft() {
    if (!draft) {
      return;
    }

    setIsApproving(true);
    setMessage("Approving draft...");

    try {
      const response = await fetch(`/api/drafts/${draft.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "approved",
        }),
      });

      const data = await readResponse(response);

      if (!response.ok || !data.draft) {
        throw new Error(data.error || "Could not approve this draft.");
      }

      setDraft(data.draft);
      setContent(data.draft.content);
      setMessage("Draft approved.");
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Could not approve this draft.";

      setMessage(`Approval failed: ${errorMessage}`);
    } finally {
      setIsApproving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="page">
        <section className="card">
          <p className="status-message">Loading draft...</p>
        </section>
      </main>
    );
  }

  if (!draft) {
    return (
      <main className="page">
        <section className="card">
          <nav className="top-nav" aria-label="Primary navigation">
            <Link href="/drafts">Back to Draft Library</Link>
          </nav>

          <p className="eyebrow">Draft Editor</p>
          <h1>Draft unavailable</h1>
          <p className="intro">
            {message || "This draft may have been deleted or does not exist."}
          </p>
        </section>
      </main>
    );
  }
  async function scheduleDraft() {
    if (!draft) {
      return;
    }

    if (!scheduledFor) {
      setMessage("Choose a future date and time first.");
      return;
    }

    setIsScheduling(true);
    setMessage("Scheduling draft...");

    try {
      const response = await fetch(`/api/drafts/${draft.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "scheduled",
          scheduledFor: new Date(scheduledFor).toISOString(),
        }),
      });

      const data = await readResponse(response);

      if (!response.ok || !data.draft) {
        throw new Error(data.error || "Could not schedule this draft.");
      }

      setDraft(data.draft);
      setContent(data.draft.content);
      setScheduledFor(
        new Date(data.draft.scheduledFor).toISOString().slice(0, 16),
      );
      setMessage("Draft scheduled.");
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Could not schedule this draft.";

      setMessage(`Scheduling failed: ${errorMessage}`);
    } finally {
      setIsScheduling(false);
    }
  }
  return (
    <main className="page">
      <section className="card">
        <nav className="top-nav" aria-label="Primary navigation">
          <Link href="/drafts">Back to Draft Library</Link>
        </nav>

        <p className="eyebrow">Draft Editor</p>

        <div className="draft-heading">
          <h1>Continue editing</h1>
          <span className={`status status-${draft.status}`}>
            {draft.status}
          </span>
        </div>

        <p className="intro">
          Created {formatDate(draft.createdAt)}. Last updated{" "}
          {formatDate(draft.updatedAt)}.
        </p>

        <section className="draft-topic-panel">
          <h2>Original topic</h2>
          <p>{draft.topic}</p>
        </section>

        <label htmlFor="draft-content">Post draft</label>
        <textarea
          id="draft-content"
          value={content}
          onChange={(event) => handleContentChange(event.target.value)}
          rows={16}
          readOnly={draft.status === "published"}
        />
        {draft.status === "published" && (
          <section className="approval-note">
            <h2>Published record</h2>
            <p>
              This is a simulated publication record. Published drafts are
              read-only in this version of the app.
            </p>
          </section>
        )}
        {draft.status !== "published" && (
          <div className="editor-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={saveChanges}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save changes"}
            </button>

            <button
              type="button"
              className="approve-button"
              onClick={approveDraft}
              disabled={isApproving || draft.status === "approved"}
            >
              {draft.status === "approved"
                ? "Approved"
                : isApproving
                  ? "Approving..."
                  : "Approve draft"}
            </button>

            {draft.status === "approved" && (
              <section className="schedule-panel">
                <h2>Schedule simulated publication</h2>

                <label htmlFor="scheduled-for">Publish date and time</label>

                <input
                  id="scheduled-for"
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(event) => setScheduledFor(event.target.value)}
                />

                <button
                  type="button"
                  className="schedule-button"
                  onClick={scheduleDraft}
                  disabled={isScheduling}
                >
                  {isScheduling ? "Scheduling..." : "Schedule post"}
                </button>
              </section>
            )}
            {draft.status === "scheduled" && draft.scheduledFor && (
              <section className="schedule-panel">
                <h2>Scheduled</h2>
                <p>
                  Simulated publication is scheduled for{" "}
                  {formatDate(draft.scheduledFor)}.
                </p>
              </section>
            )}
          </div>
        )}
        {message && (
          <p
            className={
              message.startsWith("Error") ||
              message.startsWith("Save failed") ||
              message.startsWith("Approval failed")
                ? "error-message-inline"
                : "save-message"
            }
            role={message.startsWith("Error") ? "alert" : undefined}
          >
            {message}
          </p>
        )}

        {draft.status === "approved" && (
          <section className="approval-note">
            <h2>Ready for a future publishing step</h2>
            <p>
              This exact saved text has been approved. If you change it and
              save, approval will be removed and you will need to approve the
              new version again.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}
