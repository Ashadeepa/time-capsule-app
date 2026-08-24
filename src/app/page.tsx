"use client";

import { useRouter } from "next/navigation";
import { useState, useRef } from "react";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2MB — demo-mode limit, see README.

function todayPlusOneYear(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export default function WritePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [senderEmail, setSenderEmail] = useState("");
  const [recipientSameAsSender, setRecipientSameAsSender] = useState(true);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(todayPlusOneYear());
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setPhotoError(null);
    if (!file) {
      setPhotoDataUrl(null);
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("Photo is too large for the demo (max 2MB). Try a smaller image.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const finalRecipient = recipientSameAsSender ? senderEmail : recipientEmail;

    if (!senderEmail || !finalRecipient || !title || !message || !deliveryDate) {
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

    setSubmitting(true);
    try {
      const res = await fetch("/api/capsules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderEmail,
          recipientEmail: finalRecipient,
          title,
          message,
          deliveryDate,
          photoDataUrl,
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
            <input
              type="email"
              required={!recipientSameAsSender}
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="recipient@example.com"
              className="w-full rounded-md border border-ink/20 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-terracotta/40"
            />
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
          <label className="block text-sm font-medium mb-1" htmlFor="photo">
            Attach a photo <span className="text-ink/40 font-normal">(optional, max 2MB)</span>
          </label>
          <input
            id="photo"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="block w-full text-sm text-ink/70 file:mr-4 file:rounded-md file:border-0 file:bg-sage/20 file:px-4 file:py-2 file:text-sage file:font-medium"
          />
          {photoError && <p className="text-sm text-seal mt-1">{photoError}</p>}
          {photoDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoDataUrl}
              alt="attached preview"
              className="mt-3 max-h-48 rounded-md border border-ink/10"
            />
          )}
        </div>

        {error && (
          <p className="text-sm text-seal bg-seal/5 border border-seal/20 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto px-6 py-3 rounded-md bg-seal text-cream font-medium hover:bg-seal/90 disabled:opacity-60 transition-colors"
        >
          {submitting ? "Sealing…" : "Seal & schedule this letter"}
        </button>
      </form>
    </div>
  );
}
