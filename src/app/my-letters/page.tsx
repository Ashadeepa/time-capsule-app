"use client";

import Link from "next/link";
import { useState } from "react";

type CapsuleSummary = {
  id: string;
  title: string;
  senderEmail: string;
  recipientEmails: string[];
  deliveryDate: string;
  status: "scheduled" | "delivered" | "failed";
  mediaType: "photo" | "audio" | "video" | null;
  recurrence: "none" | "yearly" | "monthly";
  recurrenceEndDate: string | null;
  createdAt: string;
  deliveredAt: string | null;
};

export default function MyLettersPage() {
  const [email, setEmail] = useState("");
  const [capsules, setCapsules] = useState<CapsuleSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deliveringId, setDeliveringId] = useState<string | null>(null);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/capsules?email=${encodeURIComponent(email)}`);
      if (!res.ok) throw new Error("Couldn't look up letters for that email.");
      setCapsules(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeliverNow(id: string) {
    setDeliveringId(id);
    try {
      const res = await fetch(`/api/capsules/${id}/deliver`, { method: "POST" });
      if (!res.ok) throw new Error("Couldn't deliver that letter.");
      setCapsules(
        (prev) =>
          prev?.map((c) =>
            c.id === id ? { ...c, status: "delivered", deliveredAt: new Date().toISOString() } : c
          ) ?? null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setDeliveringId(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold mb-2">My letters</h1>
      <p className="text-ink/70 mb-8">
        No account, no password — just look up what you&apos;ve sent or are waiting to receive by
        email.{" "}
        <span className="text-ink/40">
          (A real product would use a magic link here instead of a plain lookup — this is a demo.)
        </span>
      </p>

      <form onSubmit={handleLookup} className="flex gap-2 mb-10">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="flex-1 rounded-md border border-ink/20 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-terracotta/40"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 rounded-md bg-ink text-cream text-sm font-medium hover:bg-ink/90 disabled:opacity-60 transition-colors"
        >
          {loading ? "Looking…" : "Look up"}
        </button>
      </form>

      {error && <p className="text-sm text-seal mb-6">{error}</p>}

      {capsules && capsules.length === 0 && (
        <p className="text-ink/60 text-sm">No letters found for that email yet.</p>
      )}

      <ul className="space-y-4">
        {capsules?.map((c) => {
          const formattedDate = new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(
            new Date(c.deliveryDate)
          );
          const isSender = c.senderEmail.toLowerCase() === email.toLowerCase();
          const recurrenceBadge =
            c.recurrence === "yearly" ? "🔁 yearly" : c.recurrence === "monthly" ? "🔁 monthly" : null;

          return (
            <li
              key={c.id}
              className="border border-ink/10 bg-white rounded-lg px-4 py-3 flex items-center justify-between gap-4"
            >
              <div>
                <p className="font-medium">{c.title}</p>
                <p className="text-xs text-ink/50">
                  {isSender ? "To" : "From"} {isSender ? c.recipientEmails.join(", ") : c.senderEmail} ·{" "}
                  {c.status === "delivered" ? "Delivered" : "Arrives"} {formattedDate}
                  {recurrenceBadge && <> · {recurrenceBadge}</>}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    c.status === "delivered"
                      ? "bg-sage/20 text-sage"
                      : c.status === "failed"
                      ? "bg-seal/10 text-seal"
                      : "bg-terracotta/10 text-terracotta"
                  }`}
                >
                  {c.status}
                </span>
                {c.status === "delivered" ? (
                  <Link href={`/preview/${c.id}`} className="text-xs underline">
                    View
                  </Link>
                ) : (
                  <button
                    onClick={() => handleDeliverNow(c.id)}
                    disabled={deliveringId === c.id}
                    className="text-xs underline disabled:opacity-50"
                    title="Demo only — skips ahead to the delivery date"
                  >
                    {deliveringId === c.id ? "…" : "Deliver now (demo)"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
