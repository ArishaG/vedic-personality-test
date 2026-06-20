// GET  /api/access-codes — admin. Lists every code and whether it's been used.
// POST /api/access-codes — admin. Generates { count } new single-use codes.
import { ensureSchema, isAuthed, listAccessCodes, createAccessCodes } from './_db.js';

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
      const count = Math.trunc(+((req.body && req.body.count) || 0));
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
