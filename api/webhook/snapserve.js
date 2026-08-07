require('dotenv').config();

const path = require('path');
const { neon } = require('@neondatabase/serverless');
const { upsertCall } = require('../../call-storage');
const { callFromPayload } = require('../../call-normalization');
const { databaseUrl } = require('../../database-config');

const RENDER_API_URL = process.env.RENDER_API_URL;
const CALLS_PATH = process.env.CALLS_CSV_PATH || path.join(__dirname, '..', '..', 'data', 'calls.csv');
const WEBHOOK_SECRET = process.env.SNAPSERVE_WEBHOOK_SECRET || process.env.snapserve_webhook_secret || '';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Snapserve-Signature, X-Snapserve-Webhook-Secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const receivedSecret =
    req.headers['x-snapserve-webhook-secret'] ||
    req.headers['x-snapserve-signature'] ||
    req.body?.secret ||
    '';

  if (WEBHOOK_SECRET && receivedSecret !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized webhook' });
  }

  const body = req.body || {};
  const callData = callFromPayload(body);
  let persisted = false;
  let forwarded = false;

  // Serverless files disappear after a restart, so only write locally when Neon is configured.
  if (databaseUrl()) {
    try {
      await upsertCall(CALLS_PATH, callData);
      persisted = true;
    } catch (storageErr) {
      console.error('Persistent call storage failed:', storageErr);
    }
  }

  // 2. Forward to Render API if configured
  if (RENDER_API_URL) {
    try {
      const renderWebhookUrl = `${RENDER_API_URL.replace(/\/$/, '')}/webhook/snapserve`;
      const response = await fetch(renderWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-snapserve-webhook-secret': receivedSecret || WEBHOOK_SECRET
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(`Render webhook returned ${response.status}`);
      forwarded = true;
    } catch (renderErr) {
      console.error('Render forwarding failed:', renderErr);
    }
  }

  // 3. Store in Neon DB if configured
  const neonUrl = databaseUrl();
  if (neonUrl) {
    try {
      const sql = neon(neonUrl);
      await sql`
        CREATE TABLE IF NOT EXISTS snapserve_webhooks (
          id SERIAL PRIMARY KEY,
          event_type TEXT,
          call_id TEXT,
          phone TEXT,
          payload TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await sql`
        INSERT INTO snapserve_webhooks (event_type, call_id, phone, payload)
        VALUES (${callData.status}, ${callData.snapserve_call_id || null}, ${callData.phone}, ${JSON.stringify(body)})
      `;
    } catch (dbErr) {
      console.error('Neon DB webhook insert failed:', dbErr);
    }
  }

  if (!persisted && !forwarded) {
    return res.status(503).json({ error: 'Persistent call storage is not configured or unavailable.' });
  }

  return res.status(200).json({ success: true, received: true });
};
