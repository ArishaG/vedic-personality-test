// POST /api/check-code — public. Lets the welcome screen verify an access code
// before starting the 36 questions. Does NOT consume the code — that happens
// atomically in /api/submit so an abandoned attempt doesn't waste it.
import { ensureSchema, accessCodeIsValid } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    await ensureSchema();
    const code = String((req.body && req.body.code) || '').trim().toUpperCase();
    if (!code) {
      res.status(400).json({ ok: false, error: 'Access code is required.' });
      return;
    }
    const ok = await accessCodeIsValid(code);
    res.status(200).json(ok ? { ok: true } : { ok: false, error: 'Invalid or already-used access code.' });
  } catch (err) {
    console.error('check-code error', err);
    res.status(500).json({ ok: false, error: 'Could not verify code.' });
  }
}
