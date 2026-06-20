// GET /api/stats — public. Aggregate, anonymized numbers only (counts and averages)
// for the public landing page. Never exposes individual names, emails, or answers.
import { sql, ensureSchema } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    await ensureSchema();
    const { rows } = await sql`
      SELECT
        COUNT(*)::int AS total,
        AVG(pct_goodness) AS avg_goodness,
        AVG(pct_passion) AS avg_passion,
        AVG(pct_ignorance) AS avg_ignorance,
        AVG(duration_ms) AS avg_duration_ms
      FROM results;
    `;
    const { rows: domRows } = await sql`
      SELECT dominant, COUNT(*)::int AS n FROM results WHERE dominant IS NOT NULL GROUP BY dominant;
    `;
    const r = rows[0] || {};
    const dominantCounts = { goodness: 0, passion: 0, ignorance: 0 };
    domRows.forEach(function (d) { if (dominantCounts[d.dominant] != null) dominantCounts[d.dominant] = d.n; });
    res.status(200).json({
      total: r.total || 0,
      avgPct: {
        goodness: r.avg_goodness != null ? Math.round(r.avg_goodness * 10) / 10 : null,
        passion: r.avg_passion != null ? Math.round(r.avg_passion * 10) / 10 : null,
        ignorance: r.avg_ignorance != null ? Math.round(r.avg_ignorance * 10) / 10 : null
      },
      avgDurationMs: r.avg_duration_ms != null ? Math.round(r.avg_duration_ms) : null,
      dominantCounts: dominantCounts
    });
  } catch (err) {
    console.error('stats error', err);
    // Fail open with an empty/zero state so the landing page never breaks.
    res.status(200).json({ total: 0, avgPct: {}, avgDurationMs: null, dominantCounts: {} });
  }
}
