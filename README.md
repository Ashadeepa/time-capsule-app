# Time Capsule

Write a letter, pick a delivery date, seal it — delivered later by real email, to yourself or
others. No account needed to write; a magic-link sign-in protects viewing your own letters.

**Live app:** https://time-capsule-app-nine.vercel.app
**Proposal / roadmap:** https://claude.ai/code/artifact/cc91ae60-1018-4e05-a45a-db1e779ba815

## Stack

Next.js 14 (App Router) · PostgreSQL via `pg` (no ORM, one `capsules` table in `db/schema.sql`) ·
Resend (email) · Vercel Blob (media) · Gemini API (optional guided-writing) · Tailwind CSS

## Running it locally

```bash
docker compose up -d       # local Postgres matching .env.example
cp .env.example .env
npm install
npm run db:migrate
npm run dev                # open http://localhost:3000
```

## Features

- **Write → seal → deliver** — write a letter, pick a future date; `/api/cron/deliver-due` (a
  daily scheduled job) sends it once that date arrives. "Deliver now (demo)" on `/my-letters`
  skips ahead so you don't have to wait.
- **Group capsules** — up to 10 recipients per letter, delivered together.
- **Media attachments** — one photo/audio/video file (≤25MB) per letter, via Vercel Blob.
- **Recurring capsules** — yearly/monthly repeat, up to 20 years out; each delivery spawns the
  next occurrence (`spawnNextOccurrence()` in `src/lib/capsules.ts`).
- **Guided writing** — optional AI-drafted letter from 3 reflective prompts (Gemini), shown only
  when `GEMINI_API_KEY` is set. `npm run eval:draft-letter` regression-tests the prompt against
  injection attempts and quality checks.
- **Magic-link auth** — `/my-letters` requires a one-time emailed link (`src/lib/auth.ts`); the
  session cookie, not a query param, decides whose letters you see.
- **Abuse guardrails** — rate limiting per route (`src/lib/rateLimit.ts`), repeat offenders
  auto-blocked (`src/lib/abuseGuard.ts`), reviewable at `/admin` (needs `ADMIN_SECRET`).

## Email delivery

`src/lib/mailer.ts` sends via [Resend](https://resend.com) when `RESEND_API_KEY` is set, otherwise
mock mode (console log only). `EMAIL_FROM` can be Resend's shared `onboarding@resend.dev` (works
immediately, but only delivers to your own Resend signup email) or your own verified domain
(required before sending to real recipients).

## Deploying

Vercel is the path of least resistance — connect the repo, set the env vars from `.env.example`
(`DATABASE_URL`, `CRON_SECRET`, `SESSION_SECRET`, `ADMIN_SECRET`, plus `RESEND_API_KEY`/
`GEMINI_API_KEY`/`BLOB_READ_WRITE_TOKEN` for those features), done. Any host running Node +
Postgres works too.
