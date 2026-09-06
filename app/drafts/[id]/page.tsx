"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AuthControls from "@/app/components/AuthControls";

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

type DraftEventType =
  | "draft_created"
  | "draft_updated"
  | "draft_approved"
  | "draft_scheduled"
  | "draft_published"
  | "draft_publish_failed";

type DraftEvent = {
  id: string;
  draftId: string;
  ownerId: string | null;
  eventType: DraftEventType;
  metadata: Record<string, unknown>;
  createdAt: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
function getEventLabel(event: DraftEvent) {
  switch (event.eventType) {
    case "draft_created":
      return "Draft created";
    case "draft_updated":
      return "Draft updated";
    case "draft_approved":
      return "Draft approved";
    case "draft_scheduled": {
      const scheduledFor = event.metadata.scheduledFor;

      if (typeof scheduledFor === "string") {
        return `Scheduled for ${formatDate(scheduledFor)}`;
      }

      return "Draft scheduled";
    }
    case "draft_published":
      return "Draft published";
    case "draft_publish_failed":
      return "Publication failed";
  }
}
export default function DraftEditorPage() {
  const params = useParams<{ id: string }>();
  const draftId = params.id;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [notice, setNotice] = useState({ text: "", type: "status" as "status" | "error" });
  const message = notice.text;
  const [scheduleError, setScheduleError] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);
  const [events, setEvents] = useState<DraftEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState("");

  function setMessage(text: string, type: "status" | "error" = "status") {
    setNotice({ text, type });
  }

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
  async function loadEvents() {
    setIsLoadingEvents(true);
    setEventsError("");

    try {
      const response = await fetch(`/api/drafts/${draftId}/events`);
      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "Could not load activity.");
      }

      setEvents(data.events);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Could not load activity.";

      setEventsError(errorMessage);
    } finally {
      setIsLoadingEvents(false);
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
          setMessage(`Error: ${errorMessage}`, "error");
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

  useEffect(() => {
    let ignore = false;

    async function fetchEvents() {
      try {
        const response = await fetch(`/api/drafts/${draftId}/events`);
        const data = await readResponse(response);

        if (!response.ok) {
          throw new Error(data.error || "Could not load activity.");
        }

        if (!ignore) {
          setEvents(data.events);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Could not load activity.";

        if (!ignore) {
          setEventsError(errorMessage);
        }
      } finally {
        if (!ignore) {
          setIsLoadingEvents(false);
        }
      }
    }

    void fetchEvents();

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
      setMessage("The draft is empty, so there is nothing to save.", "error");
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
      void loadEvents();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Could not save this draft.";

      setMessage(`Save failed: ${errorMessage}`, "error");
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

      setMessage(`Approval failed: ${errorMessage}`, "error");
    } finally {
      setIsApproving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="page">
        <section className="card">
          <p className="status-message" role="status">Loading draft...</p>
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
            <AuthControls showDraftsLink={false} />
          </nav>

          <p className="eyebrow">Draft Editor</p>
          <h1>Draft unavailable</h1>
          <p className="intro" role="alert">
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

    if (!scheduledFor || !Number.isFinite(new Date(scheduledFor).getTime()) || new Date(scheduledFor).getTime() <= Date.now()) {
      const error = "Choose a future date and time first.";
      setScheduleError(error);
      setMessage(error, "error");
      return;
    }

    setScheduleError("");
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
      void loadEvents();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Could not schedule this draft.";

      setMessage(`Scheduling failed: ${errorMessage}`, "error");
    } finally {
      setIsScheduling(false);
    }
  }
  return (
    <main className="page">
      <section className="card">
        <nav className="top-nav" aria-label="Primary navigation">
          <Link href="/drafts">Back to Draft Library</Link>
          <AuthControls showDraftsLink={false} />
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
                  aria-invalid={Boolean(scheduleError)}
                  aria-describedby={scheduleError ? "editor-error" : undefined}
                  onChange={(event) => {
                    setScheduledFor(event.target.value);
                    setScheduleError("");
                    setMessage("");
                  }}
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
        <p className="save-message live-message" role="status" aria-atomic="true">
          {notice.type === "status" ? message : ""}
        </p>
        <p id="editor-error" className="error-message-inline live-message" role="alert" aria-atomic="true">
          {notice.type === "error" ? message : ""}
        </p>

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
        <section
          className="activity-section"
          aria-labelledby="activity-heading"
        >
          <div className="activity-heading">
            <h2 id="activity-heading">Activity</h2>

            <button
              type="button"
              className="refresh-activity-button"
              onClick={() => void loadEvents()}
              disabled={isLoadingEvents}
            >
              {isLoadingEvents ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <p className="activity-message live-message" role="status" aria-atomic="true">
            {isLoadingEvents ? "Loading activity..." : !eventsError && events.length === 0
              ? "No activity has been recorded for this draft yet." : !eventsError
                ? `${events.length} activity events loaded.` : ""}
          </p>

          {!isLoadingEvents && eventsError && (
            <p className="activity-error" role="alert">
              Could not load activity: {eventsError}
            </p>
          )}


          {!isLoadingEvents && !eventsError && events.length > 0 && (
            <ol className="activity-list">
              {events.map((event) => (
                <li className="activity-item" key={event.id}>
                  <div>
                    <p className="activity-event">{getEventLabel(event)}</p>
                    <time className="activity-time" dateTime={event.createdAt}>
                      {formatDate(event.createdAt)}
                    </time>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </section>
    </main>
  );
}
