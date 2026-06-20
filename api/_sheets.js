// Optional live backup: appends each submission to a Google Sheet as it comes in,
// so the facilitator always has an up-to-date Excel-compatible copy with no manual
// export step. Postgres (see _db.js) remains the source of truth for the dashboard;
// this is best-effort only and is skipped entirely if not configured.
import { JWT } from 'google-auth-library';

const SHEET_RANGE = process.env.GOOGLE_SHEET_RANGE || 'Sheet1!A1';

let client = null;
function getClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key) return null;
  if (!client) {
    client = new JWT({
      email,
      key: key.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
  }
  return client;
}

export function sheetsConfigured() {
  return Boolean(process.env.GOOGLE_SHEET_ID && getClient());
}

export async function appendToSheet(record) {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const auth = getClient();
  if (!sheetId || !auth) return; // not configured — skip silently

  const row = [
    new Date(record.takenAt || Date.now()).toISOString(),
    record.name || '',
    record.email || '',
    record.age ?? '',
    record.zip || '',
    record.phone || '',
    record.accessCode || '',
    record.dominant || '',
    record.pct?.goodness ?? '',
    record.pct?.passion ?? '',
    record.pct?.ignorance ?? '',
    record.raw?.goodness ?? '',
    record.raw?.passion ?? '',
    record.raw?.ignorance ?? '',
    record.durationMs ?? ''
  ];

  const { token } = await auth.getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(SHEET_RANGE)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values: [row] })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Sheets append failed: ${res.status} ${text}`);
  }
}
