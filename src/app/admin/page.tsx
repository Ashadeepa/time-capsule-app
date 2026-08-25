"use client";

import { useEffect, useState } from "react";

type Block = { identifier: string; reason: string; blockedUntil: string; createdAt: string };
type Violation = { identifier: string; count: number };

export default function AdminAbusePage() {
  const [secret, setSecret] = useState("");
  const [authed, setAuthed] = useState(false);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [manualIdentifier, setManualIdentifier] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [manualHours, setManualHours] = useState("24");

  useEffect(() => {
    const stored = sessionStorage.getItem("admin-secret");
    if (stored) {
      setSecret(stored);
      void load(stored);
    }
  }, []);

  async function load(withSecret: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/abuse", { headers: { Authorization: `Bearer ${withSecret}` } });
      if (!res.ok) throw new Error(res.status === 401 ? "Wrong secret." : "Couldn't load abuse data.");
      const body = await res.json();
      setBlocks(body.blocks);
      setViolations(body.violations);
      setAuthed(true);
      sessionStorage.setItem("admin-secret", withSecret);
    } catch (err) {
      setAuthed(false);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUnblock(identifier: string) {
    await fetch("/api/admin/abuse", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ identifier, action: "unblock" }),
    });
    void load(secret);
  }

  async function handleManualBlock(e: React.FormEvent) {
    e.preventDefault();
    if (!manualIdentifier.trim()) return;
    await fetch("/api/admin/abuse", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({
        identifier: manualIdentifier.trim(),
        action: "block",
        reason: manualReason.trim() || undefined,
        hours: Number(manualHours) || 24,
      }),
    });
    setManualIdentifier("");
    setManualReason("");
    void load(secret);
  }

  if (!authed) {
    return (
      <div className="max-w-md mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold mb-4">Admin — Abuse review</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void load(secret);
          }}
          className="flex gap-2"
        >
          <input
            type="password"
            required
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Admin secret"
            className="flex-1 rounded-md border border-ink/20 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-terracotta/40"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 rounded-md bg-ink text-cream text-sm font-medium hover:bg-ink/90 disabled:opacity-60"
          >
            {loading ? "…" : "Enter"}
          </button>
        </form>
        {error && <p className="text-sm text-seal mt-3">{error}</p>}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold mb-8">Admin — Abuse review</h1>

      <section className="mb-10">
        <h2 className="text-lg font-medium mb-3">Currently blocked ({blocks.length})</h2>
        {blocks.length === 0 ? (
          <p className="text-sm text-ink/50">Nobody is currently blocked.</p>
        ) : (
          <ul className="space-y-2">
            {blocks.map((b) => (
              <li
                key={b.identifier}
                className="border border-ink/10 bg-white rounded-lg px-4 py-3 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="font-mono text-sm">{b.identifier}</p>
                  <p className="text-xs text-ink/50">
                    {b.reason} · until {new Date(b.blockedUntil).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => handleUnblock(b.identifier)}
                  className="text-xs underline text-ink/60 hover:text-ink shrink-0"
                >
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-medium mb-3">Recent violations (last 24h)</h2>
        {violations.length === 0 ? (
          <p className="text-sm text-ink/50">No rate-limit violations recorded.</p>
        ) : (
          <ul className="space-y-1">
            {violations.map((v) => (
              <li key={v.identifier} className="text-sm flex justify-between border-b border-ink/5 py-1.5">
                <span className="font-mono">{v.identifier}</span>
                <span className="text-ink/50">{v.count} hits</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Manually block</h2>
        <form onSubmit={handleManualBlock} className="flex flex-wrap gap-2">
          <input
            value={manualIdentifier}
            onChange={(e) => setManualIdentifier(e.target.value)}
            placeholder="IP or email"
            className="flex-1 min-w-[160px] rounded-md border border-ink/20 bg-white px-3 py-2 text-sm"
          />
          <input
            value={manualReason}
            onChange={(e) => setManualReason(e.target.value)}
            placeholder="Reason (optional)"
            className="flex-1 min-w-[160px] rounded-md border border-ink/20 bg-white px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={manualHours}
            onChange={(e) => setManualHours(e.target.value)}
            className="w-20 rounded-md border border-ink/20 bg-white px-3 py-2 text-sm"
          />
          <button type="submit" className="px-4 py-2 rounded-md bg-seal text-cream text-sm font-medium">
            Block
          </button>
        </form>
      </section>
    </div>
  );
}
