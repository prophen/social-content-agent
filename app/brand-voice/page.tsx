"use client";

import Link from "next/link";
import { useEffect, useState, type SubmitEvent } from "react";
import AuthControls from "@/app/components/AuthControls";
import { parseBrandVoice, type BrandVoice } from "@/lib/brandVoice";

const fields = [
  { key: "name", label: "Voice name", hint: "A name to make this voice your own.", rows: 1 },
  { key: "audience", label: "Audience", hint: "Who are you writing for?", rows: 3 },
  { key: "tone", label: "Tone", hint: "How should your writing sound?", rows: 4, list: true },
  { key: "goals", label: "Goals", hint: "What should your content accomplish?", rows: 4, list: true },
  { key: "avoid", label: "Words and claims to avoid", hint: "Phrases you want to leave out.", rows: 4, list: true },
  { key: "formatRules", label: "Formatting rules", hint: "Guide structure, length, and hashtags.", rows: 5, list: true },
  { key: "accuracyRules", label: "Accuracy rules", hint: "Set expectations for evidence and factual claims.", rows: 5, list: true },
  { key: "callToActionStyle", label: "Call to action", hint: "How should posts invite a response?", rows: 3 },
] satisfies { key: keyof BrandVoice; label: string; hint: string; rows: number; list?: boolean }[];

type FormValues = Record<keyof BrandVoice, string>;
function toForm(voice: BrandVoice): FormValues {
  return Object.fromEntries(Object.entries(voice).map(([key, value]) => [key, Array.isArray(value) ? value.join("\n") : value])) as FormValues;
}

export default function BrandVoicePage() {
  const [values, setValues] = useState<FormValues | null>(null);
  const [saved, setSaved] = useState<FormValues | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/brand-voice", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load brand voice.");
        const form = toForm(parseBrandVoice(data));
        if (active) { setValues(form); setSaved(form); }
      } catch (error) {
        if (active) setError(error instanceof Error ? error.message : "Could not load brand voice.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values || saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const payload = parseBrandVoice(Object.fromEntries(fields.map((field) => [field.key,
        field.list ? values[field.key].split("\n").map((line) => line.trim()).filter(Boolean) : values[field.key],
      ])));
      const response = await fetch("/api/brand-voice", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save brand voice.");
      const form = toForm(parseBrandVoice(data));
      setValues(form); setSaved(form);
      setMessage("Brand voice saved. Your next generated draft will use these settings.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save brand voice.");
    } finally { setSaving(false); }
  }

  return (
    <main className="new-draft-page">
      <header className="new-draft-header">
        <Link className="back-to-drafts-link" href="/drafts" onNavigate={(event) => {
          if (dirty && !window.confirm("Leave without saving your brand voice changes?")) event.preventDefault();
        }}>← Back to drafts</Link>
        <AuthControls showDraftsLink={false} />
      </header>
      <section className="new-draft-card" aria-labelledby="brand-voice-heading">
        <p className="eyebrow">Writing settings</p>
        <h1 id="brand-voice-heading">Your brand voice</h1>
        <p className="new-draft-description">Shape how your posts sound. These settings apply to your next AI generation; existing drafts stay as they are.</p>
        {loading && <p role="status">Loading your brand voice…</p>}
        <p role="alert" className={error ? "form-error" : "sr-only"}>{error}</p>
        {!loading && !values && <button onClick={() => setAttempt((value) => value + 1)}>Try again</button>}
        {values && <form className="new-draft-form" onSubmit={save} aria-busy={saving}>
          {fields.map((field) => <div className="form-field" key={field.key}>
            <label htmlFor={field.key}>{field.label}</label>
            <p id={`${field.key}-hint`} className="brand-voice-hint">{field.hint}{field.list ? " Add one item per line (up to 30, 500 characters each)." : ""}</p>
            <textarea id={field.key} rows={field.rows} required={!field.list}
              maxLength={field.list ? 15029 : field.key === "name" ? 120 : 2000}
              aria-describedby={`${field.key}-hint`} value={values[field.key]} disabled={saving}
              onChange={(event) => { setValues({ ...values, [field.key]: event.target.value }); setMessage(""); }} />
          </div>)}
          <p role="status" aria-live="polite">{message || (dirty ? "You have unsaved changes." : "Your saved settings are up to date.")}</p>
          <div className="new-draft-form-actions">
            <button type="button" disabled={!dirty || saving} onClick={() => { setValues(saved); setError(""); setMessage(""); }}>Discard changes</button>
            <button type="submit" disabled={!dirty || saving}>{saving ? "Saving…" : "Save brand voice"}</button>
          </div>
        </form>}
      </section>
    </main>
  );
}
