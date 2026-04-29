import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required. Copy .env.example to .env and fill in your PostgreSQL connection string.");
}

// Connection pool — sized for typical VPS deployment
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

pool.on("error", (err) => {
  console.error("[db] Unexpected pool error:", err);
});

export const db = drizzle(pool, { schema });

// Health-check helper used by the server on startup
export async function testConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    console.log("[db] PostgreSQL connection OK");
  } finally {
    client.release();
  }
}
