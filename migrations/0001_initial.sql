-- ============================================================
-- Kindred — Initial Database Schema
-- Run once against a fresh PostgreSQL database
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  email            TEXT NOT NULL UNIQUE,
  age              INTEGER,
  location         TEXT,
  bio              TEXT,
  avatar_initials  TEXT,
  avatar_color     TEXT,
  tribe_id         INTEGER,
  quiz_completed   BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  interests        JSONB NOT NULL DEFAULT '[]',
  personality_scores JSONB NOT NULL DEFAULT '{}',
  answers          JSONB NOT NULL DEFAULT '{}',
  lifestyle        JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tribe_id ON users(tribe_id);

-- ─── Tribes ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tribes (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL UNIQUE,
  description      TEXT,
  member_count     INTEGER NOT NULL DEFAULT 0,
  max_members      INTEGER NOT NULL DEFAULT 30,
  centroid         JSONB NOT NULL DEFAULT '{}',
  primary_interests JSONB NOT NULL DEFAULT '[]',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_tribes_is_active ON tribes(is_active);

-- ─── Messages ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id              SERIAL PRIMARY KEY,
  tribe_id        INTEGER NOT NULL REFERENCES tribes(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  user_name       TEXT NOT NULL,
  user_initials   TEXT NOT NULL,
  user_color      TEXT NOT NULL,
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_tribe_id    ON messages(tribe_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at  ON messages(created_at DESC);

-- ─── Foreign key constraint (deferred to avoid circular dep) ──────────────────
ALTER TABLE users ADD CONSTRAINT fk_users_tribe
  FOREIGN KEY (tribe_id) REFERENCES tribes(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;
