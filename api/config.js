// GET /api/config — public. Returns settings a taker's device is allowed to know.
import { getSetting } from './_db.js';

export default async function handler(req, res) {
  try {
    const showResults = (await getSetting('showResultsToTakers', 'true')) === 'true';
    const balancedScoring = (await getSetting('balancedScoring', 'false')) === 'true';
    res.status(200).json({ showResultsToTakers: showResults, balancedScoring: balancedScoring });
  } catch (err) {
    console.error('config error', err);
    // Fail open so the test still works even if the DB hiccups.
    res.status(200).json({ showResultsToTakers: true, balancedScoring: false });
  }
}
