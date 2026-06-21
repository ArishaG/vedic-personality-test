// POST /api/insight — get-or-generate a personalized AI reading for one record.
// Authorized by EITHER the facilitator admin password OR that record's own
// access code (so a taker can fetch their own, just-used code's insight).
// Generated once per record and cached in the database — re-requests are free.
import { isAuthed, getResultById, saveAiInsight } from './_db.js';
import { generateInsight, aiConfigured } from './_ai.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const b = req.body || {};
    const id = String(b.id || '');
    if (!id) {
      res.status(400).json({ error: 'Record id is required.' });
      return;
    }

    const record = await getResultById(id);
    if (!record) {
      res.status(404).json({ error: 'Record not found.' });
      return;
    }

    const codeMatches = b.accessCode && record.accessCode &&
      String(b.accessCode).trim().toUpperCase() === String(record.accessCode).toUpperCase();
    if (!isAuthed(req) && !codeMatches) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (record.aiInsight) {
      res.status(200).json({ ok: true, insight: record.aiInsight, cached: true });
      return;
    }
    if (!aiConfigured()) {
      res.status(503).json({ error: 'AI insights are not set up yet (ANTHROPIC_API_KEY is missing).' });
      return;
    }

    const insight = await generateInsight(record);
    await saveAiInsight(id, insight);
    res.status(200).json({ ok: true, insight, cached: false });
  } catch (err) {
    console.error('insight error', err);
    res.status(500).json({ error: 'Could not generate insight.' });
  }
}
