require('dotenv').config();

const { neon } = require('@neondatabase/serverless');
const DATABASE_URL = process.env.DATABASE_URL;
const WEBHOOK_SECRET = process.env.snapserve_webhook_secret || '';

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
    console.error('Snapserve webhook secret mismatch', { expected: WEBHOOK_SECRET ? 'set' : 'unset', received: receivedSecret ? 'present' : 'missing' });
    return res.status(401).json({ error: 'Unauthorized webhook' });
  }

  if (!DATABASE_URL) {
    console.error('Snapserve webhook received but DATABASE_URL is not configured.');
    return res.status(500).json({ error: 'Database configuration missing' });
  }

  const webhookId = req.query?.webhookId || null;
  const eventType = req.body?.type || req.body?.event || req.body?.eventType || null;
  const phone = req.body?.phone || req.body?.payload?.phone || req.body?.call?.toNumber || req.body?.call?.fromNumber || null;
  const callId = req.body?.callId || req.body?.call?.id || req.body?.payload?.id || null;
  const payloadText = JSON.stringify(req.body || {});

  try {
    const sql = neon(DATABASE_URL);

    await sql`
      CREATE TABLE IF NOT EXISTS snapserve_webhooks (
        id SERIAL PRIMARY KEY,
        webhook_id TEXT,
        event_type TEXT,
        call_id TEXT,
        phone TEXT,
        payload TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      INSERT INTO snapserve_webhooks (webhook_id, event_type, call_id, phone, payload)
      VALUES (${webhookId}, ${eventType}, ${callId}, ${phone}, ${payloadText})
    `;

    console.log('Saved Snapserve webhook event', { webhookId, eventType, callId, phone });
    return res.status(200).json({ success: true, received: true });
  } catch (err) {
    console.error('Snapserve webhook processing failed:', err, { webhookId, eventType, callId, phone });
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
};
