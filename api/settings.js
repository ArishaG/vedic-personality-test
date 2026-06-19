// GET  /api/settings — admin. Returns current settings.
// POST /api/settings — admin. Updates the show-results-to-takers setting.
import { getSetting, setSetting, isAuthed } from './_db.js';

export default async function handler(req, res) {
  if (!isAuthed(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    if (req.method === 'GET') {
      const showResults = (await getSetting('showResultsToTakers', 'true')) === 'true';
      const balancedScoring = (await getSetting('balancedScoring', 'false')) === 'true';
      res.status(200).json({ showResultsToTakers: showResults, balancedScoring: balancedScoring });
      return;
    }
    if (req.method === 'POST') {
      const b = req.body || {};
      if (typeof b.showResultsToTakers === 'boolean') {
        await setSetting('showResultsToTakers', b.showResultsToTakers ? 'true' : 'false');
      }
      if (typeof b.balancedScoring === 'boolean') {
        await setSetting('balancedScoring', b.balancedScoring ? 'true' : 'false');
      }
      const showResults = (await getSetting('showResultsToTakers', 'true')) === 'true';
      const balancedScoring = (await getSetting('balancedScoring', 'false')) === 'true';
      res.status(200).json({ ok: true, showResultsToTakers: showResults, balancedScoring: balancedScoring });
      return;
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('settings error', err);
    res.status(500).json({ error: 'Settings error.' });
  }
}
