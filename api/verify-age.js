(No subject)
Sarah Walmsley
​You​
// api/verify-age.js (DEBUG / CORS-enabled)
export default async function handler(req, res) {
  // Allow a single origin set via ENV, or fallback to '*'
  const ALLOWED_ORIGIN = process.env.VERIFY_ALLOWED_ORIGIN || '*';

  // Always respond to OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  // Only accept POST for production usage
  if (req.method !== 'POST') {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    return res.status(405).json({ verified: false, reason: 'Method not allowed' });
  }

  try {
    const body = req.body || (await new Promise(r => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => r(data ? JSON.parse(data) : {}));
    })).catch(() => ({}));

    console.log('DEBUG verify-age invoked, body:', body);

    // Basic validation
    const email = body && body.email;
    if (!email) {
      res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
      return res.status(400).json({ verified: false, reason: 'Email required' });
    }

    // Respond with a mock result (for debugging the CORS & front-end)
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    return res.status(200).json({ verified: false, debug: 'mock-response', email });
  } catch (err) {
    console.error('DEBUG handler error', err);
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    return res.status(500).json({ verified: false, reason: 'Server error', error: String(err) });
  }
}
