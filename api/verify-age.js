// api/verify-age.js (Production: calls VerifyMyAge, optional Shopify tagging)
export default async function handler(req, res) {
  const ALLOWED_ORIGIN = process.env.VERIFY_ALLOWED_ORIGIN || '*';

  // CORS preflight handling
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    return res.status(405).json({ verified: false, reason: 'Method not allowed' });
  }

  try {
    const { email } = req.body || {};
    if (!email) {
      res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
      return res.status(400).json({ verified: false, reason: 'Email required' });
    }

    // VerifyMyAge call
    const VERIFY_URL = process.env.VERIFYMYAGE_API_URL;
    const VERIFY_KEY = process.env.VERIFYMYAGE_API_KEY;
    if (!VERIFY_URL || !VERIFY_KEY) {
      console.error('Missing VerifyMyAge env vars');
      res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
      return res.status(500).json({ verified: false, reason: 'Server configuration error' });
    }

    const vres = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VERIFY_KEY}`
      },
      body: JSON.stringify({ email })
    });

    const vjson = await vres.json().catch(() => null);
    console.log('VerifyMyAge response', vres.status, vjson);

    // Adjust this condition to match VerifyMyAge real response structure:
    const ageVerified = vjson && (vjson.verified === true || vjson.age_verified === true);

    // Always include CORS headers in response
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (!ageVerified) {
      return res.status(200).json({ verified: false, reason: vjson || 'not_verified' });
    }

    // Optional: tag Shopify customer so they don't reverify
    const SHOPIFY_STORE = process.env.SHOPIFY_STORE;           // e.g. yourstore.myshopify.com
    const SHOPIFY_ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN; // Admin API access token, needs customers:write
    if (SHOPIFY_STORE && SHOPIFY_ADMIN_TOKEN) {
      try {
        // 1) find customer by email
        const searchUrl = `https://${SHOPIFY_STORE}/admin/api/2024-01/customers/search.json?query=email:${encodeURIComponent(email)}`;
        const searchRes = await fetch(searchUrl, {
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': SHOPIFY_ADMIN_TOKEN
          }
        });
        const searchJson = await searchRes.json().catch(() => null);
        const customer = searchJson && searchJson.customers && searchJson.customers[0];

        if (customer && customer.id) {
          const currentTags = (customer.tags || '').split(',').map(t => t.trim()).filter(Boolean);
          if (!currentTags.includes('age_verified')) {
            const newTags = [...currentTags, 'age_verified'].join(', ');
            const updateUrl = `https://${SHOPIFY_STORE}/admin/api/2024-01/customers/${customer.id}.json`;
            await fetch(updateUrl, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': SHOPIFY_ADMIN_TOKEN
              },
              body: JSON.stringify({ customer: { id: customer.id, tags: newTags } })
            });
            console.log('Tagged customer', customer.id, 'with age_verified');
          } else {
            console.log('Customer already tagged', customer.id);
          }
        } else {
          console.log('Shopify customer not found for email', email);
        }
      } catch (err) {
        console.error('Shopify tagging error', err);
        // Do NOT fail the verification if tagging fails — verification already succeeded.
      }
    }

    return res.status(200).json({ verified: true });
  } catch (err) {
    console.error('verify-age handler error', err);
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    return res.status(500).json({ verified: false, reason: 'Server error' });
  }
}
