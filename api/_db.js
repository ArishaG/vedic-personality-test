// Shared database helpers for the serverless API functions.
// Uses Vercel Postgres (the `@vercel/postgres` SDK reads POSTGRES_URL automatically
// once you connect a Postgres store to the project in the Vercel dashboard).
import { sql } from '@vercel/postgres';

let initialized = false;

// Create tables on first use so there is no separate migration step to run.
export async function ensureSchema() {
  if (initialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS results (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      email         TEXT,
      age           INTEGER,
      phone         TEXT,
      answers       JSONB,
      raw_goodness  INTEGER,
      raw_passion   INTEGER,
      raw_ignorance INTEGER,
      pct_goodness  REAL,
      pct_passion   REAL,
      pct_ignorance REAL,
      dominant      TEXT,
      duration_ms   INTEGER,
      taken_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `;
  // Seed default settings if missing.
  await sql`
    INSERT INTO app_settings (key, value)
    VALUES ('showResultsToTakers', 'true')
    ON CONFLICT (key) DO NOTHING;
  `;
  await sql`
    INSERT INTO app_settings (key, value)
    VALUES ('balancedScoring', 'false')
    ON CONFLICT (key) DO NOTHING;
  `;
  initialized = true;
}

export async function getSetting(key, fallback) {
  await ensureSchema();
  const { rows } = await sql`SELECT value FROM app_settings WHERE key = ${key};`;
  return rows.length ? rows[0].value : fallback;
}

export async function setSetting(key, value) {
  await ensureSchema();
  await sql`
    INSERT INTO app_settings (key, value)
    VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  `;
}

// Simple shared-password check for admin endpoints.
// Set ADMIN_PASSWORD in the Vercel project's Environment Variables.
export function adminPassword() {
  return process.env.ADMIN_PASSWORD || 'vedic';
}

export function isAuthed(req) {
  const provided =
    req.headers['x-admin-password'] ||
    (req.query && req.query.pw) ||
    '';
  return String(provided) === String(adminPassword());
}

export { sql };
