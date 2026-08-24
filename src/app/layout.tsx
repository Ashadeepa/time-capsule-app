import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Time Capsule — a letter to your future self",
  description: "Write a letter now. We deliver it back to you whenever you choose.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col font-serif">
        <header className="border-b border-ink/10">
          <nav className="max-w-2xl mx-auto flex items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg tracking-tight">
              🕰️ <span className="font-semibold">Time Capsule</span>
            </Link>
            <Link
              href="/my-letters"
              className="text-sm text-ink/70 hover:text-terracotta transition-colors"
            >
              My letters
            </Link>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-ink/10 py-6">
          <p className="max-w-2xl mx-auto px-6 text-xs text-ink/50">
            Demo build — letters are simulated, not actually emailed. See the README to wire up real delivery.
          </p>
        </footer>
      </body>
    </html>
  );
}
