# Time Capsule — MVP

The "Option A" flow from the product plan: no login, write a letter, pick a delivery date, done.
Email delivery is **mocked** — nothing is actually sent yet, but the whole flow (write → seal →
schedule → deliver → view) works end to end, so you can see and demo the real product before
wiring up a live email provider.

## Stack

- **Next.js 14** (App Router, TypeScript) — frontend + API routes together
- **PostgreSQL**, accessed directly via [`pg`](https://node-postgres.com) (no ORM) — one
  `capsules` table (see `db/schema.sql`)
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

## What's intentionally left out of this MVP

Per the product plan, these are deliberately deferred rather than missing by accident:

- **Real authentication** — `/my-letters` is a plain email lookup, not a secure login. Fine for a
  demo; before a real launch this should be a magic-link email instead (no passwords), so someone
  can't read another person's letters by guessing their email.
- **Object storage for photos** — photos are stored as base64 in Postgres, capped at 2MB, for
  simplicity. Swap `photo_data_url` for an S3/Cloudflare R2 URL before this needs to scale —
  storing images in the database doesn't hold up past a small number of users.
- **Group/shared capsules, audio/video, recurring capsules** — these are the premium-tier features
  from the plan (Section 4) and the "Option B" account-based app — deliberately out of scope for
  this first build.
- **Rate limiting / spam prevention** on the public write form — needed before a real public launch.

## Deploying

This is a standard Next.js app — [Vercel](https://vercel.com) is the path of least resistance
(connect the repo, set the `DATABASE_URL`/`CRON_SECRET` env vars, done). Any host that runs
Node + Postgres works too.
