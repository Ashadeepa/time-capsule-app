import { pool } from "@/lib/db";

export type CapsuleStatus = "scheduled" | "delivered" | "failed";

export type Capsule = {
  id: string;
  senderEmail: string;
  recipientEmail: string;
  title: string;
  message: string;
  photoDataUrl: string | null;
  deliveryDate: Date;
  status: CapsuleStatus;
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
    title: row.title,
    message: row.message,
    photoDataUrl: row.photo_data_url,
    deliveryDate: row.delivery_date,
    status: row.status,
    createdAt: row.created_at,
    deliveredAt: row.delivered_at,
  };
}

export async function createCapsule(input: {
  senderEmail: string;
  recipientEmail: string;
  title: string;
  message: string;
  deliveryDate: Date;
  photoDataUrl: string | null;
}): Promise<Capsule> {
  const { rows } = await pool.query(
    `INSERT INTO capsules (sender_email, recipient_email, title, message, delivery_date, photo_data_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.senderEmail,
      input.recipientEmail,
      input.title,
      input.message,
      input.deliveryDate,
      input.photoDataUrl,
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
    `SELECT * FROM capsules WHERE sender_email = $1 OR recipient_email = $1 ORDER BY delivery_date ASC`,
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
