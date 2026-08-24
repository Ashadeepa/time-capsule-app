"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { upload } from "@vercel/blob/client";

const MAX_MEDIA_BYTES = 25 * 1024 * 1024; // 25MB demo limit — see README.
const MAX_RECIPIENTS = 10;

type MediaType = "photo" | "audio" | "video";
type Recurrence = "none" | "yearly" | "monthly";

const GUIDED_PROMPTS = [
  "What's happening in your life right now that you want to remember?",
  "What are you hoping is different by the time this arrives?",
  "What's one thing you don't want to forget — or want to tell them?",
];

function todayPlusOneYear(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function mediaTypeFromFile(file: File): MediaType | null {
  if (file.type.startsWith("image/")) return "photo";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

export default function WritePage() {
  const router = useRouter();

  const [senderEmail, setSenderEmail] = useState("");
  const [recipientSameAsSender, setRecipientSameAsSender] = useState(true);
  const [recipients, setRecipients] = useState<string[]>([""]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(todayPlusOneYear());
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");

  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [guidedAvailable, setGuidedAvailable] = useState(false);
  const [guidedOpen, setGuidedOpen] = useState(false);
  const [guidedAnswers, setGuidedAnswers] = useState(["", "", ""]);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/draft-letter")
      .then((res) => res.json())
      .then((body) => setGuidedAvailable(Boolean(body.available)))
      .catch(() => setGuidedAvailable(false));
  }, []);

  function updateRecipient(index: number, value: string) {
    setRecipients((prev) => prev.map((r, i) => (i === index ? value : r)));
  }

  function addRecipient() {
    setRecipients((prev) => (prev.length < MAX_RECIPIENTS ? [...prev, ""] : prev));
  }

  function removeRecipient(index: number) {
    setRecipients((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleMediaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setMediaError(null);
    if (!file) return;

    const inferredType = mediaTypeFromFile(file);
    if (!inferredType) {
      setMediaError("Attach a photo, audio, or video file.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_MEDIA_BYTES) {
      setMediaError("File is too large for the demo (max 25MB). Try a smaller one.");
      e.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const result = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      setMediaUrl(result.url);
      setMediaType(inferredType);
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDraftLetter() {
    setDraftError(null);
    if (guidedAnswers.some((a) => !a.trim())) {
      setDraftError("Answer all three prompts to draft a letter.");
      return;
    }
    setDrafting(true);
    try {
      const res = await fetch("/api/draft-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: guidedAnswers, title, deliveryDate }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Couldn't draft a letter.");
      }
      const { draft } = await res.json();
      setMessage(draft);
      setGuidedOpen(false);
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setDrafting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const finalRecipients = recipientSameAsSender
      ? [senderEmail]
      : recipients.map((r) => r.trim()).filter(Boolean);

    if (!senderEmail || finalRecipients.length === 0 || !title || !message || !deliveryDate) {
      setError("Please fill in every field before sealing your letter.");
      return;
    }

    const chosenDate = new Date(deliveryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (chosenDate <= today) {
      setError("Pick a delivery date in the future — that's the whole point!");
      return;
    }

    if (recurrence !== "none" && !recurrenceEndDate) {
      setError("Pick a repeat-until date for a recurring letter.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/capsules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderEmail,
          recipientEmails: finalRecipients,
          title,
          message,
          deliveryDate,
          mediaUrl,
          mediaType,
          recurrence,
          recurrenceEndDate: recurrence !== "none" ? recurrenceEndDate : undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Something went wrong sealing your letter.");
      }

      const capsule = await res.json();
      router.push(`/confirm/${capsule.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <p className="text-xs tracking-[0.15em] uppercase text-terracotta mb-2">
        Write once. Arrive later.
      </p>
      <h1 className="text-3xl font-semibold mb-3">A letter to your future self</h1>
      <p className="text-ink/70 mb-10 leading-relaxed">
        Write it now, seal it, and pick the day it should land back in an inbox — yours, or someone
        else&apos;s. No account needed.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="senderEmail">
              Your email
            </label>
            <input
              id="senderEmail"
              type="email"
              required
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md border border-ink/20 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-terracotta/40"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="deliveryDate">
              Deliver on
            </label>
            <input
              id="deliveryDate"
              type="date"
              required
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="w-full rounded-md border border-ink/20 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-terracotta/40"
            />
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm mb-2">
            <input
              type="checkbox"
              checked={recipientSameAsSender}
              onChange={(e) => setRecipientSameAsSender(e.target.checked)}
              className="rounded border-ink/30"
            />
            Send it to myself
          </label>
          {!recipientSameAsSender && (
            <div className="space-y-2">
              {recipients.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="email"
                    required
                    value={r}
                    onChange={(e) => updateRecipient(i, e.target.value)}
                    placeholder="recipient@example.com"
                    className="flex-1 rounded-md border border-ink/20 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-terracotta/40"
                  />
                  {recipients.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRecipient(i)}
                      className="px-3 text-sm text-ink/50 hover:text-seal"
                      aria-label="Remove recipient"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {recipients.length < MAX_RECIPIENTS && (
                <button
                  type="button"
                  onClick={addRecipient}
                  className="text-xs underline text-ink/60"
                >
                  + Add another recipient
                </button>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            type="text"
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. To me, one year from now"
            className="w-full rounded-md border border-ink/20 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-terracotta/40"
          />
        </div>

        {guidedAvailable && (
          <div className="rounded-md border border-sage/30 bg-sage/5 p-4">
            <button
              type="button"
              onClick={() => setGuidedOpen((v) => !v)}
              className="text-sm font-medium text-sage"
            >
              {guidedOpen ? "Hide guided writing" : "Not sure what to write? Let us help"}
            </button>
            {guidedOpen && (
              <div className="mt-4 space-y-4">
                {GUIDED_PROMPTS.map((prompt, i) => (
                  <div key={i}>
                    <label className="block text-sm mb-1">{prompt}</label>
                    <textarea
                      rows={2}
                      value={guidedAnswers[i]}
                      onChange={(e) =>
                        setGuidedAnswers((prev) => prev.map((a, j) => (j === i ? e.target.value : a)))
                      }
                      className="w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/40"
                    />
                  </div>
                ))}
                {draftError && <p className="text-sm text-seal">{draftError}</p>}
                <button
                  type="button"
                  onClick={handleDraftLetter}
                  disabled={drafting}
                  className="px-4 py-2 rounded-md bg-sage text-cream text-sm font-medium hover:bg-sage/90 disabled:opacity-60 transition-colors"
                >
                  {drafting ? "Drafting…" : "Draft my letter"}
                </button>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="message">
            Your letter
          </label>
          <textarea
            id="message"
            required
            rows={10}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Dear future me…"
            className="w-full rounded-md border border-ink/20 bg-white px-3 py-2 leading-relaxed focus:outline-none focus:ring-2 focus:ring-terracotta/40"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="media">
            Attach a photo, audio, or video{" "}
            <span className="text-ink/40 font-normal">(optional, max 25MB)</span>
          </label>
          <input
            id="media"
            type="file"
            accept="image/*,audio/*,video/*"
            onChange={handleMediaChange}
            disabled={uploading}
            className="block w-full text-sm text-ink/70 file:mr-4 file:rounded-md file:border-0 file:bg-sage/20 file:px-4 file:py-2 file:text-sage file:font-medium"
          />
          {uploading && <p className="text-sm text-ink/50 mt-1">Uploading…</p>}
          {mediaError && <p className="text-sm text-seal mt-1">{mediaError}</p>}
          {mediaUrl && mediaType === "photo" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl}
              alt="attached preview"
              className="mt-3 max-h-48 rounded-md border border-ink/10"
            />
          )}
          {mediaUrl && mediaType === "audio" && (
            <audio controls src={mediaUrl} className="mt-3 w-full" />
          )}
          {mediaUrl && mediaType === "video" && (
            <video controls src={mediaUrl} className="mt-3 max-h-48 rounded-md border border-ink/10" />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="recurrence">
            Repeat
          </label>
          <select
            id="recurrence"
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as Recurrence)}
            className="w-full sm:w-auto rounded-md border border-ink/20 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-terracotta/40"
          >
            <option value="none">One-time</option>
            <option value="yearly">Every year</option>
            <option value="monthly">Every month</option>
          </select>
          {recurrence !== "none" && (
            <div className="mt-2">
              <label className="block text-sm font-medium mb-1" htmlFor="recurrenceEndDate">
                Repeat until
              </label>
              <input
                id="recurrenceEndDate"
                type="date"
                required
                value={recurrenceEndDate}
                onChange={(e) => setRecurrenceEndDate(e.target.value)}
                className="w-full sm:w-auto rounded-md border border-ink/20 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-terracotta/40"
              />
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-seal bg-seal/5 border border-seal/20 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || uploading}
          className="w-full sm:w-auto px-6 py-3 rounded-md bg-seal text-cream font-medium hover:bg-seal/90 disabled:opacity-60 transition-colors"
        >
          {submitting ? "Sealing…" : "Seal & schedule this letter"}
        </button>
      </form>
    </div>
  );
}
