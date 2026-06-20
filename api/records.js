// GET /api/records — admin. Returns all results (optionally filtered by date range)
// as a normalized JSON array the dashboard can render and export.
import { sql, ensureSchema, isAuthed } from './_db.js';

export default async function handler(req, res) {
  if (!isAuthed(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    await ensureSchema();

    if (req.method === 'DELETE') {
      const id = (req.query && req.query.id) || (req.body && req.body.id);
      const all = (req.query && req.query.all) || (req.body && req.body.all);
      if (all) {
        await sql`DELETE FROM results;`;
      } else if (id) {
        await sql`DELETE FROM results WHERE id = ${String(id)};`;
      } else {
        res.status(400).json({ error: 'Provide id or all=1.' });
        return;
      }
      res.status(200).json({ ok: true });
      return;
    }
    const { rows } = await sql`
      SELECT id, name, email, age, zip, phone, access_code, answers,
             raw_goodness, raw_passion, raw_ignorance,
             pct_goodness, pct_passion, pct_ignorance,
             dominant, duration_ms, taken_at
      FROM results
      ORDER BY taken_at DESC;
    `;
    const records = rows.map(function (r) {
      return {
        id: r.id,
        name: r.name,
        email: r.email,
        age: r.age,
        zip: r.zip,
        phone: r.phone,
        accessCode: r.access_code,
        answers: r.answers || [],
        raw: { goodness: r.raw_goodness, passion: r.raw_passion, ignorance: r.raw_ignorance },
        pct: { goodness: r.pct_goodness, passion: r.pct_passion, ignorance: r.pct_ignorance },
        dominant: r.dominant,
        durationMs: r.duration_ms,
        takenAt: r.taken_at
      };
    });
    res.status(200).json({ records: records });
  } catch (err) {
    console.error('records error', err);
    res.status(500).json({ error: 'Could not load records.' });
  }
}
