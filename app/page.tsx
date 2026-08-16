"use client";

import { useState } from "react";
import Link from "next/link";

type PostStatus = "draft" | "approved" | "scheduled" | "published";

type BrandVoice = {
  name: string;
  audience: string;
  tone: readonly string[];
  avoid: readonly string[];
  formatRules: readonly string[];
};

export default function App() {
  const [topic, setTopic] = useState("");
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<PostStatus>("draft");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [brandVoiceName, setBrandVoiceName] = useState("");
  const [brandVoiceTone, setBrandVoiceTone] = useState<string[]>([]);
  const [saveMessage, setSaveMessage] = useState("");

  async function loadBrandVoice() {
    const response = await fetch("/api/brand-voice");
    const data: BrandVoice = await response.json();

    setBrandVoiceName(data.name);
    setBrandVoiceTone([...data.tone]);
  }

  async function generateDraft() {
    const cleanTopic = topic.trim();

    if (!cleanTopic) {
      setDraft("Please enter a topic first.");
      return;
    }

    setIsGenerating(true);
    setDraft("Generating your draft...");
    setStatus("draft");

    try {
      const response = await fetch("/api/generate-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: cleanTopic,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not generate a draft.");
      }

      const saveResponse = await fetch("/api/drafts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: cleanTopic,
          content: data.draft,
        }),
      });

      const savedData = await saveResponse.json();

      if (!saveResponse.ok) {
        throw new Error(savedData.error || "Could not save the draft.");
      }

      setDraft(savedData.draft.content);
      setDraftId(savedData.draft.id);
      setStatus(savedData.draft.status);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.";

      setDraft(`Error: ${message}`);
    } finally {
      setIsGenerating(false);
    }
  }

  async function approveDraft() {
    if (!draftId) {
      return;
    }

    try {
      const response = await fetch(`/api/drafts/${draftId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "approved",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not approve the draft.");
      }

      setStatus(data.draft.status);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not approve the draft.";

      setDraft(`Error: ${message}`);
    }
  }

  async function saveDraftChanges() {
    if (!draftId) {
      setSaveMessage(
        "This draft has not been saved yet. Generate a new draft first.",
      );
      return;
    }

    if (!draft.trim()) {
      setSaveMessage("The draft is empty, so there is nothing to save.");
      return;
    }

    setSaveMessage("Saving...");

    try {
      const response = await fetch(`/api/drafts/${draftId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: draft,
        }),
      });

      const responseText = await response.text();

      if (!responseText) {
        throw new Error(
          `The server returned an empty response (${response.status}).`,
        );
      }

      const data = JSON.parse(responseText);

      if (!response.ok || !data.draft?.content) {
        throw new Error(
          data.error ||
            "Save failed: the server did not return the updated draft content.",
        );
      }

      setDraft(data.draft.content);
      setStatus(data.draft.status);
      setSaveMessage("Changes saved.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save changes.";

      console.error("Could not save draft:", error);
      setSaveMessage(`Save failed: ${message}`);
    }
  }
  return (
    <main className="page">
      <section className="card">
        <nav className="top-nav" aria-label="Primary navigation">
          <Link href="/drafts">View saved drafts</Link>
        </nav>

        <p className="eyebrow">Social Content Agent</p>
        <h1>Create a LinkedIn draft</h1>
        <p className="intro">
          Enter a topic, generate a local practice draft, edit it, and approve
          it. Nothing is posted anywhere.
        </p>

        <button
          type="button"
          className="brand-voice-button"
          onClick={loadBrandVoice}
        >
          View active brand voice
        </button>
        {brandVoiceName && (
          <section className="brand-voice-preview">
            <h2>{brandVoiceName}</h2>
            <p>Current tone guidelines:</p>
            <ul>
              {brandVoiceTone.map((tone) => (
                <li key={tone}>{tone}</li>
              ))}
            </ul>
          </section>
        )}

        <label htmlFor="topic">What do you want to post about?</label>
        <textarea
          id="topic"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="Example: I learned how AI agents use tools."
          rows={4}
        />

        <button type="button" onClick={generateDraft} disabled={isGenerating}>
          {isGenerating ? "Generating..." : "Generate draft"}
        </button>

        {draft && (
          <section className="draft-section">
            <div className="draft-heading">
              <h2>Draft preview</h2>
              <span className={`status status-${status}`}>{status}</span>
            </div>

            <textarea
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setStatus("draft");
              }}
              rows={12}
            />
            <button
              type="button"
              className="secondary-button"
              onClick={saveDraftChanges}
              disabled={!draftId}
            >
              Save changes
            </button>

            {saveMessage && <p className="save-message">{saveMessage}</p>}

            <button
              type="button"
              className="approve-button"
              onClick={approveDraft}
              disabled={status === "approved"}
            >
              {status === "approved" ? "Approved" : "Approve draft"}
            </button>

            {status === "approved" && (
              <p className="success-message">
                Approved locally. A future version can send this approved draft
                to a scheduling or publishing backend.
              </p>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
