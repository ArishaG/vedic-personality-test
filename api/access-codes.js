// GET  /api/access-codes — admin. Lists every code and whether it's been used.
// POST /api/access-codes — admin. Three actions, picked by which field is present:
//   { count }         generate N new single-use codes
//   { universalCode }  set/replace the one code that never expires
//   { action: 'reset' } mark every code unused again
import {
  ensureSchema, isAuthed, listAccessCodes, createAccessCodes,
  setUniversalCode, resetAllAccessCodes
} from './_db.js';

export default async function handler(req, res) {
  if (!isAuthed(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    await ensureSchema();
    if (req.method === 'GET') {
      const codes = await listAccessCodes();
      res.status(200).json({ codes: codes });
      return;
    }
    if (req.method === 'POST') {
      const b = req.body || {};
      if (b.action === 'reset') {
        await resetAllAccessCodes();
        res.status(200).json({ ok: true });
        return;
      }
      if (b.universalCode) {
        const code = String(b.universalCode).trim().toUpperCase().slice(0, 40);
        if (!code) {
          res.status(400).json({ error: 'Provide a code.' });
          return;
        }
        await setUniversalCode(code);
        res.status(200).json({ ok: true, universal: code });
        return;
      }
      const count = Math.trunc(+(b.count || 0));
      if (!Number.isFinite(count) || count < 1 || count > 500) {
        res.status(400).json({ error: 'Provide a count between 1 and 500.' });
        return;
      }
      const created = await createAccessCodes(count);
      res.status(200).json({ ok: true, created: created });
      return;
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('access-codes error', err);
    res.status(500).json({ error: 'Could not process access codes.' });
  }
}
