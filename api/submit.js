// POST /api/submit  — public. Saves one completed test and returns whether
// the taker should be shown their result (live facilitator setting).
import { sql, ensureSchema, getSetting, claimAccessCode } from './_db.js';
import { appendToSheet } from './_sheets.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    await ensureSchema();
    const b = req.body || {};
    // Basic validation / sanitation.
    const id = 'r_' + Date.now() + '_' + Math.floor(Math.random() * 1e9);
    const name = String(b.name || '').slice(0, 200);
    const email = String(b.email || '').slice(0, 200);
    const age = String(b.age || '').slice(0, 20);
    const zip = String(b.zip || '').slice(0, 10);
    const phone = String(b.phone || '').slice(0, 60);
    const accessCode = String(b.accessCode || '').trim().toUpperCase().slice(0, 40);
    const answers = Array.isArray(b.answers) ? b.answers : [];
    const raw = b.raw || {};
    const pct = b.pct || {};
    const dominant = String(b.dominant || '').slice(0, 20);
    const durationMs = Number.isFinite(+b.durationMs) ? Math.trunc(+b.durationMs) : null;

    if (!name) {
      res.status(400).json({ error: 'Name is required.' });
      return;
    }
    if (!age) {
      res.status(400).json({ error: 'Age is required.' });
      return;
    }
    if (!zip) {
      res.status(400).json({ error: 'Zip code is required.' });
      return;
    }
    if (!accessCode) {
      res.status(400).json({ error: 'Access code is required.' });
      return;
    }
    if (!(await claimAccessCode(accessCode))) {
      res.status(400).json({ error: 'Invalid or already-used access code.' });
      return;
    }

    await sql`
      INSERT INTO results
        (id, name, email, age, zip, phone, access_code, answers,
         raw_goodness, raw_passion, raw_ignorance,
         pct_goodness, pct_passion, pct_ignorance,
         dominant, duration_ms)
      VALUES
        (${id}, ${name}, ${email}, ${age}, ${zip}, ${phone}, ${accessCode}, ${JSON.stringify(answers)},
         ${raw.goodness ?? null}, ${raw.passion ?? null}, ${raw.ignorance ?? null},
         ${pct.goodness ?? null}, ${pct.passion ?? null}, ${pct.ignorance ?? null},
         ${dominant}, ${durationMs});
    `;

    try {
      await appendToSheet({ name, email, age, zip, phone, accessCode, dominant, raw, pct, durationMs, takenAt: new Date() });
    } catch (err) {
      console.error('sheets append failed', err);
    }

    const showResults = (await getSetting('showResultsToTakers', 'true')) === 'true';
    const balancedScoring = (await getSetting('balancedScoring', 'false')) === 'true';
    res.status(200).json({ ok: true, id, showResults, balancedScoring });
  } catch (err) {
    console.error('submit error', err);
    res.status(500).json({ error: 'Could not save result.' });
  }
}
