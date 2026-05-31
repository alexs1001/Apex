// api/sync.js
// Receives a full app_state payload from the frontend and upserts it into Supabase.
// Also handles GET to pull the latest state down.
// Uses the service-role key (server-side only) so RLS doesn't block the write.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // service role — never exposed to browser
  if (!supabaseUrl || !supabaseKey)
    return res.status(500).json({ error: 'Supabase env vars not configured' });

  const apiBase = supabaseUrl.replace(/\/$/, '') + '/rest/v1';
  const headers = {
    'Content-Type':  'application/json',
    'apikey':         supabaseKey,
    'Authorization': 'Bearer ' + supabaseKey,
    'Prefer':        'return=representation',
  };

  if (req.method === 'GET') {
    // Pull all rows for this user's app state
    const r = await fetch(apiBase + '/app_state?select=key,data,updated_at&order=key', { headers });
    const text = await r.text();
    res.status(r.status).setHeader('Content-Type', 'application/json').send(text);
    return;
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const { key, data } = body || {};
    if (!key || data === undefined)
      return res.status(400).json({ error: 'key and data are required' });

    const payload = [{ key, data, updated_at: new Date().toISOString() }];
    const r = await fetch(apiBase + '/app_state?on_conflict=key', {
      method:  'POST',
      headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body:    JSON.stringify(payload),
    });
    const text = await r.text();
    res.status(r.status).setHeader('Content-Type', 'application/json').send(text);
    return;
  }

  res.status(405).json({ error: 'method not allowed' });
}
