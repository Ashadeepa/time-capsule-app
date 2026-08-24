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
