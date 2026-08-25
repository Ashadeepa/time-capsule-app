# Time Capsule

The "Option A" flow from the product plan: write a letter, pick a delivery date, done — no account
needed to write one. Group recipients, photo/audio/video attachments, recurring letters, an
optional guided-writing helper, and a magic-link sign-in for viewing your own letters. The whole
flow (write → seal → schedule → deliver → view) works end to end with real email delivery.

## Stack

- **Next.js 14** (App Router, TypeScript) — frontend + API routes together
- **PostgreSQL**, accessed directly via [`pg`](https://node-postgres.com) (no ORM) — one
  `capsules` table (see `db/schema.sql`)
- **Resend** — email delivery
- **Vercel Blob** — photo/audio/video attachment storage
- **Gemini API** (optional) — drafts a letter from a few reflective prompts
- **Tailwind CSS** — styling

A note on the "no ORM" choice: Prisma was the original plan, but its engine binaries are fetched
from a CDN that isn't reachable from every environment (including the sandbox this was built in),
so this went with plain SQL via `pg` instead — zero native binaries, nothing to download at
install time, and the whole schema is one readable file (`db/schema.sql`). For a single-table MVP
this is genuinely simpler; if you outgrow it, swapping in Prisma or Drizzle later is a contained
change (everything funnels through `src/lib/capsules.ts`).

## Running it locally

1. **Start Postgres.** The included `docker-compose.yml` spins up a local Postgres that matches
   `.env.example` out of the box:

   ```bash
   docker compose up -d
   ```

   (No Docker? Any Postgres 13+ works — just point `DATABASE_URL` in `.env` at it. A free instance
   on [Neon](https://neon.tech) or [Supabase](https://supabase.com) takes about two minutes to set
   up if you'd rather not run Postgres locally. If you have Postgres installed natively, that's
   fine too — this was built and tested against a local `postgresql-16` install directly.)

2. **Install dependencies and set up the database:**

   ```bash
   cp .env.example .env
   npm install
   npm run db:migrate
   ```

3. **Run the app:**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000.

## How the demo flow works

1. Go to `/` and write a letter. Pick any future date.
2. You'll land on `/confirm/[id]` — the letter is now "sealed" (stored, status `scheduled`).
3. Go to `/my-letters`, look up the email you used, and click **"Deliver now (demo)"** on your
   letter. In a real deployment this would only happen automatically once the delivery date
   actually arrives (see below) — the manual button is here purely so you don't have to wait
   a year to see the rest of the product.
4. You'll see the letter rendered as an email at `/preview/[id]` — this is exactly the HTML that
   would be sent to the recipient's inbox once real delivery is wired up.

## How real delivery would work in production

`src/app/api/cron/deliver-due/route.ts` is the endpoint a scheduler hits once a day. It finds
every capsule whose `deliveryDate` has passed and is still `scheduled`, and delivers each one.
Point any of these at it on a daily schedule:

- **Vercel Cron** (if you deploy there) — add a `vercel.json` cron entry pointing at
  `/api/cron/deliver-due?secret=YOUR_CRON_SECRET`
- **A GitHub Action** on a `schedule` trigger that does `curl` against the deployed URL
- **A plain server cron job** if you're self-hosting

Protect it with the `CRON_SECRET` env var (see `.env.example`) so randoms on the internet can't
trigger deliveries.

## Email delivery (Resend)

`src/lib/mailer.ts` sends via [Resend](https://resend.com) when `RESEND_API_KEY` is set in `.env`,
and falls back to mock mode (console log only, no network call) when it's empty — so the app runs
end to end either way.

To send real email:

1. Sign up at [resend.com](https://resend.com) and create an API key at
   [resend.com/api-keys](https://resend.com/api-keys).
2. In `.env`, set:
   ```
   RESEND_API_KEY="re_your_key_here"
   EMAIL_FROM="Time Capsule <onboarding@resend.dev>"
   ```
3. Restart `npm run dev`. Sends now go out for real, both from the "Deliver now (demo)" button and
   the `/api/cron/deliver-due` job.

**Two `EMAIL_FROM` options, with a tradeoff:**

- **`onboarding@resend.dev`** (Resend's shared test sender) — works immediately, no domain setup.
  The catch: Resend only lets this address send **to the email you signed up to Resend with** —
  sends to any other recipient are rejected. Fine for developing/demoing solo, not for real users.
- **Your own verified domain** — verify a domain under
  [resend.com/domains](https://resend.com/domains) (adds a few DNS records), then set
  `EMAIL_FROM="Time Capsule <letters@yourdomain.com>"` using that domain. Once verified, you can
  send to any recipient — required before a real launch.

If a send fails, the error surfaces in the server logs (wherever `npm run dev` or your deployed
process is running), not in the UI — check there first if a letter doesn't show up.

No code changes needed for any of this — every route already calls `sendCapsuleEmail()` in
`mailer.ts`. Swapping providers later (SendGrid/Postmark/SES) means editing only that one file.

## Group capsules

A letter can have up to 10 recipients (`recipientEmails` on the write form). Everyone gets the
same email at the same moment — Resend's `to` field takes the whole list directly, so there's no
per-recipient scheduling. `recipient_emails TEXT[]` on `capsules` is the source of truth for
delivery and `/my-letters` lookups; the older `recipient_email` column stays populated (as
`recipientEmails[0]`) for cheap display, but nothing reads it as authoritative anymore.

## Media attachments (photo, audio, video)

The write form accepts one photo, audio, or video file (≤25MB), uploaded directly from the
browser to **Vercel Blob** via `upload()` in `src/app/page.tsx` — `src/app/api/upload/route.ts` is
just the token-issuing handshake (`handleUpload`), so large files never pass through a Next.js
function body. The resulting `media_url`/`media_type` render in the email as an `<img>` for
photos, or a plain link for audio/video (inline `<audio>`/`<video>` tags aren't reliably supported
across email clients).

Requires a Blob store linked to the project — `vercel blob create-store <name> --access public`,
then `vercel env pull` to get `BLOB_READ_WRITE_TOKEN` into `.env.local` for local dev (already
auto-linked if you ran that command in this repo). Photos from before this feature existed still
render via the legacy base64 `photo_data_url` column — no backfill was needed.

## Recurring capsules

Pick "Every year" or "Every month" on the write form and set a repeat-until date (capped at 20
years out). On delivery, `spawnNextOccurrence()` in `src/lib/capsules.ts` clones the capsule with
the next delivery date as a **new row** (linked back via `parent_capsule_id`) rather than mutating
the original — so delivery history is preserved per occurrence, and both the manual "Deliver now"
button and the daily cron job spawn the next one identically (they share `deliverCapsule()` in
`src/lib/delivery.ts`).

## Guided-writing agent

Blank-page paralysis is a real drop-off point for a "write a letter" product. If `GEMINI_API_KEY`
is set, a "Not sure what to write? Let us help" toggle appears on the write form — three reflective
prompts, answered, sent to `src/app/api/draft-letter/route.ts`, which asks Gemini
(`gemini-2.5-flash`, via `@google/genai`) to draft a letter from them. Get a key at
[aistudio.google.com/apikey](https://aistudio.google.com/apikey). The draft lands in the same
editable textarea; it's never submitted without the user reviewing and clicking "Seal & schedule"
themselves. Without the key, the toggle simply doesn't render — the rest of the app is unaffected.

## Guardrails

- **Rate limiting** — `src/lib/rateLimit.ts` is a fixed-window limiter backed by a `rate_limits`
  table in the same Postgres database (no Redis needed at this scale). Applied per-IP:
  sealing letters (`POST /api/capsules`, 10/hour), looking letters up (`GET /api/capsules`,
  30/hour), media uploads (`POST /api/upload`, 20/hour — only the browser-facing token request,
  never Vercel Blob's own upload-completed callback), and drafting letters
  (`POST /api/draft-letter`, 10/hour, since LLM calls cost money).
- **Guided-writing input guardrails** — each of the three reflective answers is capped at 1000
  characters, and the system prompt explicitly tells Gemini the answers are user-supplied content,
  not instructions, and to ignore anything inside them that tries to redirect its behavior or
  reveal the prompt (verified against a direct injection attempt during development). The route
  also checks `promptFeedback.blockReason` and `candidates[0].finishReason` and returns a friendly
  422 instead of a raw error if Gemini's own safety filtering blocks the input or output.
- **Letter length cap** — `message` is capped at 20,000 characters on `POST /api/capsules`,
  alongside the existing 120-character title cap and 25MB media cap.

## Authentication (magic link)

`/my-letters` requires signing in — no passwords, just a one-time link:

1. Enter your email → `POST /api/auth/request-link` creates a single-use token (`magic_links`
   table, 15-minute expiry) and emails a link via `sendMagicLinkEmail()` in `mailer.ts`.
2. Clicking the link hits `GET /api/auth/verify`, which consumes the token (one use only), signs a
   30-day session JWT with `jose` (`src/lib/auth.ts`), and sets it as an httpOnly cookie.
3. `GET /api/capsules` reads the email **from that cookie only** — it no longer accepts an
   `?email=` query param. This is the actual security fix: previously anyone could read anyone
   else's letters just by typing their email into the lookup form.

Requires `SESSION_SECRET` in `.env` (generate with `openssl rand -hex 32`) — changing it signs out
every session. Both the link-request and verify endpoints are rate-limited (`src/lib/rateLimit.ts`)
per-IP and per-email, so the flow can't be used to spam someone else's inbox with sign-in emails.

## Deploying

This is a standard Next.js app — [Vercel](https://vercel.com) is the path of least resistance
(connect the repo, set the `DATABASE_URL`/`CRON_SECRET` env vars, done). Any host that runs
Node + Postgres works too.
