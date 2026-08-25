-- Time Capsule schema. Run via `npm run db:migrate` (see scripts/migrate.mjs),
-- or just `psql "$DATABASE_URL" -f db/schema.sql` directly.

CREATE TABLE IF NOT EXISTS capsules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_email     TEXT NOT NULL,
  recipient_email  TEXT NOT NULL,
  title            TEXT NOT NULL,
  message          TEXT NOT NULL,
  -- Small demo photos are stored as data URLs for simplicity (MVP only).
  -- In production, swap this for an object-storage URL (S3 / Cloudflare R2) instead.
  photo_data_url   TEXT,
  delivery_date    TIMESTAMPTZ NOT NULL,
  status           TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'delivered', 'failed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_capsules_sender_email ON capsules (sender_email);
CREATE INDEX IF NOT EXISTS idx_capsules_recipient_email ON capsules (recipient_email);
CREATE INDEX IF NOT EXISTS idx_capsules_status_delivery_date ON capsules (status, delivery_date);

-- Group capsules: recipient_emails is the source of truth going forward (recipient_email
-- above stays populated as recipientEmails[0] for cheap/simple display, but is no longer
-- authoritative for delivery or "my letters" lookups).
ALTER TABLE capsules ADD COLUMN IF NOT EXISTS recipient_emails TEXT[] NOT NULL DEFAULT '{}';
UPDATE capsules SET recipient_emails = ARRAY[recipient_email]
  WHERE array_length(recipient_emails, 1) IS NULL AND recipient_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_capsules_recipient_emails ON capsules USING GIN (recipient_emails);

-- Media attachments: generalizes photo_data_url into any attachment type, stored in Vercel
-- Blob for new uploads. Rows created before this migration keep rendering via photo_data_url.
ALTER TABLE capsules ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE capsules ADD COLUMN IF NOT EXISTS media_type TEXT CHECK (media_type IN ('photo', 'audio', 'video'));

-- Recurring capsules: on delivery, a recurring capsule spawns its next occurrence as a new
-- row (parent_capsule_id links it back) instead of mutating itself, preserving history.
ALTER TABLE capsules ADD COLUMN IF NOT EXISTS recurrence TEXT NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none', 'yearly', 'monthly'));
ALTER TABLE capsules ADD COLUMN IF NOT EXISTS recurrence_end_date TIMESTAMPTZ;
ALTER TABLE capsules ADD COLUMN IF NOT EXISTS parent_capsule_id UUID REFERENCES capsules(id);
CREATE INDEX IF NOT EXISTS idx_capsules_parent_capsule_id ON capsules (parent_capsule_id);

-- Rate limiting: fixed-window counters keyed by "<route>:<ip>". Kept in Postgres rather than
-- adding Redis, since request volume here doesn't warrant a separate service. See src/lib/rateLimit.ts.
CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count        INT NOT NULL DEFAULT 1,
  PRIMARY KEY (key, window_start)
);

-- Magic-link auth: single-use, short-lived tokens for signing into /my-letters. See
-- src/lib/auth.ts. The session itself is a signed cookie (no server-side session table needed).
CREATE TABLE IF NOT EXISTS magic_links (
  token      TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_magic_links_email ON magic_links (email);

-- Abuse response beyond plain rate limits: repeat rate-limit violations by the same
-- identifier (IP or email) escalate to an actual block, and blocks/violations are visible
-- for manual review at /admin. See src/lib/abuseGuard.ts.
CREATE TABLE IF NOT EXISTS abuse_violations (
  identifier  TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_abuse_violations_identifier ON abuse_violations (identifier, occurred_at);

CREATE TABLE IF NOT EXISTS blocked_identifiers (
  identifier    TEXT PRIMARY KEY,
  reason        TEXT NOT NULL,
  blocked_until TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
