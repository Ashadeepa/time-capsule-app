"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

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
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto px-6 py-12 text-sm text-ink/50">Loading…</div>}>
      <MyLettersContent />
    </Suspense>
  );
}

function MyLettersContent() {
  const searchParams = useSearchParams();

  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [requestingLink, setRequestingLink] = useState(false);

  const [capsules, setCapsules] = useState<CapsuleSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "invalid-link" ? "That sign-in link is invalid or has expired — request a new one." : null
  );
  const [deliveringId, setDeliveringId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((body) => setSessionEmail(body.email))
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (!sessionEmail) return;
    setLoading(true);
    fetch("/api/capsules")
      .then((res) => {
        if (!res.ok) throw new Error("Couldn't load your letters.");
        return res.json();
      })
      .then(setCapsules)
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
      .finally(() => setLoading(false));
  }, [sessionEmail]);

  async function handleRequestLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setRequestingLink(true);
    try {
      const res = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Couldn't send a sign-in link.");
      }
      setLinkSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setRequestingLink(false);
    }
  }

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setSessionEmail(null);
    setCapsules(null);
    setLinkSent(false);
    setEmail("");
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

  if (checkingSession) {
    return <div className="max-w-2xl mx-auto px-6 py-12 text-sm text-ink/50">Loading…</div>;
  }

  if (!sessionEmail) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold mb-2">My letters</h1>
        <p className="text-ink/70 mb-8">
          Sign in with your email to see what you&apos;ve sent or are waiting to receive — we&apos;ll
          send you a one-time link, no password needed.
        </p>

        {linkSent ? (
          <p className="text-sm bg-sage/10 border border-sage/20 rounded-md px-4 py-3 text-ink/80">
            Check <strong>{email}</strong> for a sign-in link. It works once and expires in 15 minutes.
          </p>
        ) : (
          <form onSubmit={handleRequestLink} className="flex gap-2">
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
              disabled={requestingLink}
              className="px-5 py-2 rounded-md bg-ink text-cream text-sm font-medium hover:bg-ink/90 disabled:opacity-60 transition-colors"
            >
              {requestingLink ? "Sending…" : "Send sign-in link"}
            </button>
          </form>
        )}

        {error && <p className="text-sm text-seal mt-4">{error}</p>}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-1">My letters</h1>
          <p className="text-sm text-ink/50">Signed in as {sessionEmail}</p>
        </div>
        <button onClick={handleSignOut} className="text-sm underline text-ink/60 hover:text-ink">
          Sign out
        </button>
      </div>

      {error && <p className="text-sm text-seal mb-6">{error}</p>}
      {loading && <p className="text-sm text-ink/50 mb-6">Loading…</p>}

      {capsules && capsules.length === 0 && (
        <p className="text-ink/60 text-sm">No letters found for that email yet.</p>
      )}

      <ul className="space-y-4">
        {capsules?.map((c) => {
          const formattedDate = new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(
            new Date(c.deliveryDate)
          );
          const isSender = c.senderEmail.toLowerCase() === sessionEmail.toLowerCase();
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
