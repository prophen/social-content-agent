"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SubmitEvent, useState } from "react";
import AuthControls from "@/app/components/AuthControls";

type CreateDraftResponse = {
  draft?: {
    id: string;
  };
  error?: string;
};

export default function NewDraftPage() {
  const router = useRouter();

  const [topic, setTopic] = useState("");
  const [content, setContent] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState("");

  async function handleGenerate() {
    setGenerationMessage("");
    const trimmedTopic = topic.trim();

    if (!trimmedTopic) {
      setInvalidFields(["topic"]);
      setErrorMessage("Enter a topic before generating a draft.");
      return;
    }

    setIsGenerating(true);
    setInvalidFields([]);
    setErrorMessage("");

    try {
      const response = await fetch("/api/generate-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: trimmedTopic,
        }),
      });

      const data = await response.json();

      if (!response.ok || typeof data.draft !== "string") {
        throw new Error(data.error || "Could not generate a draft.");
      }

      setContent(data.draft);
      setGenerationMessage("Draft generated. Review and edit the draft content before saving.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not generate a draft.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTopic = topic.trim();
    const trimmedContent = content.trim();

    if (!trimmedTopic || !trimmedContent) {
      setInvalidFields([
        ...(!trimmedTopic ? ["topic"] : []),
        ...(!trimmedContent ? ["content"] : []),
      ]);
      setErrorMessage("Enter both a topic and draft content.");
      return;
    }

    setIsCreating(true);
    setInvalidFields([]);
    setErrorMessage("");

    try {
      const response = await fetch("/api/drafts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: trimmedTopic,
          content: trimmedContent,
        }),
      });

      const data = (await response.json()) as CreateDraftResponse;

      if (!response.ok || !data.draft?.id) {
        throw new Error(data.error || "Could not create the draft.");
      }

      router.push(`/drafts/${data.draft.id}`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not create the draft.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="new-draft-page">
      <header className="new-draft-header">
        <Link className="back-to-drafts-link" href="/drafts">
          ← Back to drafts
        </Link>

        <AuthControls showDraftsLink={false} />
      </header>

      <section className="new-draft-card" aria-labelledby="new-draft-heading">
        <p className="eyebrow">New draft</p>
        <h1 id="new-draft-heading">Start a draft</h1>
        <p className="new-draft-description">
          Enter a topic, generate a first version with AI, then review and edit
          it before saving.
        </p>

        <form className="new-draft-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="topic">Topic</label>
            <input
              autoComplete="off"
              id="topic"
              name="topic"
              onChange={(event) => {
                setTopic(event.target.value);
                setInvalidFields([]);
                setErrorMessage("");
              }}
              aria-invalid={invalidFields.includes("topic")}
              aria-describedby={invalidFields.includes("topic") ? "new-draft-error" : undefined}
              placeholder="For example: Product launch announcement"
              required
              value={topic}
            />
          </div>
          <button
            className="generate-draft-button"
            disabled={isGenerating || isCreating}
            onClick={() => void handleGenerate()}
            type="button"
          >
            {isGenerating ? "Generating with AI..." : "Generate with AI"}
          </button>

          <p className="save-message live-message" role="status" aria-atomic="true">
            {isCreating ? "Creating draft..." : isGenerating ? "Generating draft..." : generationMessage}
          </p>

          <div className="form-field">
            <label htmlFor="content">Draft content</label>
            <textarea
              id="content"
              name="content"
              onChange={(event) => {
                setContent(event.target.value);
                setInvalidFields([]);
                setErrorMessage("");
              }}
              aria-invalid={invalidFields.includes("content")}
              aria-describedby={invalidFields.includes("content") ? "new-draft-error" : undefined}
              placeholder="Generate a draft with AI, or write your own content here..."
              required
              rows={12}
              value={content}
            />
          </div>

          <p id="new-draft-error" className={errorMessage ? "form-error" : "sr-only"} role="alert" aria-atomic="true">
            {errorMessage}
          </p>

          <div className="new-draft-form-actions">
            <Link className="secondary-link-button" href="/drafts">
              Cancel
            </Link>

            <button disabled={isCreating} type="submit">
              {isCreating ? "Creating..." : "Create draft"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
