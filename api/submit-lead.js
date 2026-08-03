// Vercel serverless proxy — forwards form submissions to the Render backend.
// Setup:
// 1. In Vercel project settings → Environment Variables, add:
//      RENDER_API_URL = https://<your-render-service>.onrender.com
// 2. Deploy. This file is auto-detected as /api/submit-lead.

require('dotenv').config();

const RENDER_API_URL = process.env.RENDER_API_URL;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!RENDER_API_URL) {
    return res.status(500).json({ error: 'Render backend URL is not configured.' });
  }

  try {
    const backendUrl = `${RENDER_API_URL.replace(/\/$/, '')}/submit-lead`;
    const backendRes = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {})
    });

    const contentType = backendRes.headers.get('content-type') || '';
    const bodyText = await backendRes.text();

    res.status(backendRes.status);
    if (contentType.includes('application/json')) {
      return res.json(JSON.parse(bodyText || '{}'));
    }
    return res.send(bodyText);
  } catch (err) {
    console.error('submit-lead proxy error:', err);
    return res.status(500).json({ error: 'Could not forward request to backend.' });
  }
};
