import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env first.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(sql);
  console.log("✓ Database schema is up to date.");
} catch (err) {
  console.error("Migration failed:", err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
