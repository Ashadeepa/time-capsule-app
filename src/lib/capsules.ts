import { pool } from "@/lib/db";

export type CapsuleStatus = "scheduled" | "delivered" | "failed";
export type MediaType = "photo" | "audio" | "video";
export type Recurrence = "none" | "yearly" | "monthly";

export type Capsule = {
  id: string;
  senderEmail: string;
  recipientEmail: string;
  recipientEmails: string[];
  title: string;
  message: string;
  photoDataUrl: string | null;
  mediaUrl: string | null;
  mediaType: MediaType | null;
  deliveryDate: Date;
  status: CapsuleStatus;
  recurrence: Recurrence;
  recurrenceEndDate: Date | null;
  parentCapsuleId: string | null;
  createdAt: Date;
  deliveredAt: Date | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidId(id: string): boolean {
  return UUID_RE.test(id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToCapsule(row: any): Capsule {
  return {
    id: row.id,
    senderEmail: row.sender_email,
    recipientEmail: row.recipient_email,
    recipientEmails: row.recipient_emails,
    title: row.title,
    message: row.message,
    photoDataUrl: row.photo_data_url,
    mediaUrl: row.media_url,
    mediaType: row.media_type,
    deliveryDate: row.delivery_date,
    status: row.status,
    recurrence: row.recurrence,
    recurrenceEndDate: row.recurrence_end_date,
    parentCapsuleId: row.parent_capsule_id,
    createdAt: row.created_at,
    deliveredAt: row.delivered_at,
  };
}

export async function createCapsule(input: {
  senderEmail: string;
  recipientEmails: string[];
  title: string;
  message: string;
  deliveryDate: Date;
  photoDataUrl?: string | null;
  mediaUrl?: string | null;
  mediaType?: MediaType | null;
  recurrence?: Recurrence;
  recurrenceEndDate?: Date | null;
  parentCapsuleId?: string | null;
}): Promise<Capsule> {
  const { rows } = await pool.query(
    `INSERT INTO capsules
       (sender_email, recipient_email, recipient_emails, title, message, delivery_date,
        photo_data_url, media_url, media_type, recurrence, recurrence_end_date, parent_capsule_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      input.senderEmail,
      input.recipientEmails[0],
      input.recipientEmails,
      input.title,
      input.message,
      input.deliveryDate,
      input.photoDataUrl ?? null,
      input.mediaUrl ?? null,
      input.mediaType ?? null,
      input.recurrence ?? "none",
      input.recurrenceEndDate ?? null,
      input.parentCapsuleId ?? null,
    ]
  );
  return rowToCapsule(rows[0]);
}

export async function getCapsuleById(id: string): Promise<Capsule | null> {
  if (!isValidId(id)) return null;
  const { rows } = await pool.query(`SELECT * FROM capsules WHERE id = $1`, [id]);
  return rows[0] ? rowToCapsule(rows[0]) : null;
}

export async function listCapsulesByEmail(email: string): Promise<Capsule[]> {
  const { rows } = await pool.query(
    `SELECT * FROM capsules WHERE sender_email = $1 OR $1 = ANY(recipient_emails) ORDER BY delivery_date ASC`,
    [email]
  );
  return rows.map(rowToCapsule);
}

export async function findDueCapsules(): Promise<Capsule[]> {
  const { rows } = await pool.query(
    `SELECT * FROM capsules WHERE status = 'scheduled' AND delivery_date <= now()`
  );
  return rows.map(rowToCapsule);
}

export async function markDelivered(id: string): Promise<Capsule> {
  const { rows } = await pool.query(
    `UPDATE capsules SET status = 'delivered', delivered_at = now() WHERE id = $1 RETURNING *`,
    [id]
  );
  return rowToCapsule(rows[0]);
}

export async function markFailed(id: string): Promise<void> {
  await pool.query(`UPDATE capsules SET status = 'failed' WHERE id = $1`, [id]);
}

function nextDeliveryDate(from: Date, recurrence: Recurrence): Date {
  const next = new Date(from);
  if (recurrence === "yearly") next.setFullYear(next.getFullYear() + 1);
  else if (recurrence === "monthly") next.setMonth(next.getMonth() + 1);
  return next;
}

/**
 * Clones a recurring capsule as its next occurrence. Returns null if the next
 * date would fall after recurrence_end_date (series is over) or if the capsule
 * isn't recurring — callers should treat null as "nothing to do".
 */
export async function spawnNextOccurrence(capsule: Capsule): Promise<Capsule | null> {
  if (capsule.recurrence === "none") return null;

  const next = nextDeliveryDate(capsule.deliveryDate, capsule.recurrence);
  if (capsule.recurrenceEndDate && next > capsule.recurrenceEndDate) return null;

  return createCapsule({
    senderEmail: capsule.senderEmail,
    recipientEmails: capsule.recipientEmails,
    title: capsule.title,
    message: capsule.message,
    deliveryDate: next,
    mediaUrl: capsule.mediaUrl,
    mediaType: capsule.mediaType,
    recurrence: capsule.recurrence,
    recurrenceEndDate: capsule.recurrenceEndDate,
    parentCapsuleId: capsule.id,
  });
}
