/**
 * Database migration runner
 * Usage: npx tsx scripts/migrate.ts
 *
 * Reads all .sql files from /migrations in numeric order and runs them
 * inside a transaction. Skips files already tracked in `schema_migrations`.
 */

import "dotenv/config";
import { readdir, readFile } from "fs/promises";
import { join, resolve } from "path";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set. Copy .env.example → .env and fill it in.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    // Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Read migration files
    const migrationsDir = resolve(__dirname, "../migrations");
    const files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("No migration files found.");
      return;
    }

    for (const file of files) {
      // Check if already applied
      const { rows } = await client.query(
        "SELECT filename FROM schema_migrations WHERE filename = $1",
        [file]
      );
      if (rows.length > 0) {
        console.log(`  [skip]  ${file} — already applied`);
        continue;
      }

      // Run inside a transaction
      const sql = await readFile(join(migrationsDir, file), "utf-8");
      console.log(`  [run]   ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [file]
        );
        await client.query("COMMIT");
        console.log(`  [done]  ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`  [fail]  ${file}:`, err);
        process.exit(1);
      }
    }

    console.log("\nAll migrations applied successfully.");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Migration runner error:", err);
  process.exit(1);
});
