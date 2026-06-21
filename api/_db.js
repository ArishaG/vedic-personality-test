// Shared database helpers for the serverless API functions.
// Uses Vercel Postgres (the `@vercel/postgres` SDK reads POSTGRES_URL automatically
// once you connect a Postgres store to the project in the Vercel dashboard).
import { sql } from '@vercel/postgres';
import crypto from 'node:crypto';

let initialized = false;

// Create tables on first use so there is no separate migration step to run.
export async function ensureSchema() {
  if (initialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS results (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      email         TEXT,
      age           TEXT,
      zip           TEXT,
      phone         TEXT,
      access_code   TEXT,
      answers       JSONB,
      raw_goodness  INTEGER,
      raw_passion   INTEGER,
      raw_ignorance INTEGER,
      pct_goodness  REAL,
      pct_passion   REAL,
      pct_ignorance REAL,
      dominant      TEXT,
      duration_ms   INTEGER,
      taken_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      ai_insight    JSONB
    );
  `;
  // Migration for tables created before these columns existed.
  await sql`ALTER TABLE results ADD COLUMN IF NOT EXISTS access_code TEXT;`;
  await sql`ALTER TABLE results ADD COLUMN IF NOT EXISTS zip TEXT;`;
  await sql`ALTER TABLE results ADD COLUMN IF NOT EXISTS ai_insight JSONB;`;
  // Age moved from a single integer to a range (e.g. "25-34"); widen the column if needed.
  await sql`ALTER TABLE results ALTER COLUMN age TYPE TEXT;`;
  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS access_codes (
      code       TEXT PRIMARY KEY,
      used_at    TIMESTAMPTZ,
      unlimited  BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`ALTER TABLE access_codes ADD COLUMN IF NOT EXISTS unlimited BOOLEAN NOT NULL DEFAULT false;`;
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

// Access codes — each one lets exactly one person take the test. Codes are only
// claimed (marked used) at final submission, so an abandoned attempt doesn't
// waste a code; /api/check-code does an early, non-consuming check.
const CODE_CHARS = '0123456789'; // numeric only — fast to type on a phone keypad

function randomCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
  return s;
}

export async function createAccessCodes(count) {
  await ensureSchema();
  const codes = [];
  for (let i = 0; i < count; i++) {
    for (;;) {
      const code = randomCode();
      try {
        await sql`INSERT INTO access_codes (code) VALUES (${code});`;
        codes.push(code);
        break;
      } catch (err) {
        if (!/duplicate key/i.test(String(err.message))) throw err;
        // Collision on the tiny chance of a repeat — try another code.
      }
    }
  }
  return codes;
}

export async function listAccessCodes() {
  await ensureSchema();
  const { rows } = await sql`SELECT code, used_at, unlimited FROM access_codes ORDER BY created_at DESC;`;
  return rows.map(function (r) { return { code: r.code, usedAt: r.used_at, unlimited: r.unlimited }; });
}

// Creates (or converts an existing single-use code into) one code that never
// expires and can be used by any number of people — for a walk-up/kiosk display.
export async function setUniversalCode(code) {
  await ensureSchema();
  await sql`
    INSERT INTO access_codes (code, unlimited, used_at)
    VALUES (${code}, true, NULL)
    ON CONFLICT (code) DO UPDATE SET unlimited = true, used_at = NULL;
  `;
  return code;
}

// Marks every code unused again (e.g. resetting before a new event).
export async function resetAllAccessCodes() {
  await ensureSchema();
  await sql`UPDATE access_codes SET used_at = NULL;`;
}

export async function accessCodeIsValid(code) {
  await ensureSchema();
  const { rows } = await sql`SELECT 1 FROM access_codes WHERE code = ${code} AND (unlimited OR used_at IS NULL);`;
  return rows.length > 0;
}

// Atomically marks a code used; returns false if it was invalid or already used.
// Unlimited codes are validated but never consumed.
export async function claimAccessCode(code) {
  await ensureSchema();
  const { rows } = await sql`
    UPDATE access_codes SET used_at = CASE WHEN unlimited THEN used_at ELSE now() END
    WHERE code = ${code} AND (unlimited OR used_at IS NULL)
    RETURNING code;
  `;
  return rows.length > 0;
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

// Fetch one full result row (for generating/serving its AI insight).
export async function getResultById(id) {
  await ensureSchema();
  const { rows } = await sql`
    SELECT id, name, email, age, zip, phone, access_code, answers,
           raw_goodness, raw_passion, raw_ignorance,
           pct_goodness, pct_passion, pct_ignorance,
           dominant, duration_ms, taken_at, ai_insight
    FROM results WHERE id = ${id};
  `;
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: r.id, name: r.name, email: r.email, age: r.age, zip: r.zip, phone: r.phone,
    accessCode: r.access_code,
    answers: r.answers || [],
    raw: { goodness: r.raw_goodness, passion: r.raw_passion, ignorance: r.raw_ignorance },
    pct: { goodness: r.pct_goodness, passion: r.pct_passion, ignorance: r.pct_ignorance },
    dominant: r.dominant,
    durationMs: r.duration_ms,
    takenAt: r.taken_at,
    aiInsight: r.ai_insight
  };
}

export async function saveAiInsight(id, insight) {
  await ensureSchema();
  await sql`UPDATE results SET ai_insight = ${JSON.stringify(insight)} WHERE id = ${id};`;
}

export { sql };
