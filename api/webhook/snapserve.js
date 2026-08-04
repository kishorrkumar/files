require('dotenv').config();

const path = require('path');
const { neon } = require('@neondatabase/serverless');
const { appendCall } = require('../../call-storage');

const DATABASE_URL = process.env.DATABASE_URL;
const RENDER_API_URL = process.env.RENDER_API_URL;
const CALLS_PATH = process.env.CALLS_CSV_PATH || path.join(__dirname, '..', '..', 'data', 'calls.csv');
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
    return res.status(401).json({ error: 'Unauthorized webhook' });
  }

  const body = req.body || {};
  const agent_id = body.agent_id || body.agentId || body.agent?.id || body.call?.agentId || '';
  const agent_name = body.agent_name || body.agentName || body.agent?.name || body.call?.agentName || '';
  const phone = body.phone || body.toNumber || body.fromNumber || body.call?.toNumber || body.call?.phone || body.payload?.phone || '';
  const duration = Number(body.duration || body.callDuration || body.call?.duration || 0);
  const summary = body.summary || body.call_summary || body.callSummary || body.call?.summary || body.analysis?.summary || '';
  const transcript = body.transcript || body.call_transcript || body.callTranscript || body.call?.transcript || body.analysis?.transcript || (Array.isArray(body.messages) ? body.messages.map(m => `${m.role || m.speaker}: ${m.text || m.content}`).join('\n') : '');
  const status = body.status || body.call_status || body.callStatus || body.event || body.type || 'completed';

  // 1. Store locally in CSV
  try {
    await appendCall(CALLS_PATH, {
      agent_id,
      agent_name,
      phone,
      duration,
      summary,
      transcript,
      status
    });
  } catch (csvErr) {
    console.error('CSV call append error:', csvErr);
  }

  // 2. Forward to Render API if configured
  if (RENDER_API_URL) {
    try {
      const renderWebhookUrl = `${RENDER_API_URL.replace(/\/$/, '')}/webhook/snapserve`;
      await fetch(renderWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-snapserve-webhook-secret': receivedSecret || WEBHOOK_SECRET
        },
        body: JSON.stringify(body)
      });
    } catch (renderErr) {
      console.error('Render forwarding failed:', renderErr);
    }
  }

  // 3. Store in Neon DB if configured
  if (DATABASE_URL) {
    try {
      const sql = neon(DATABASE_URL);
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
        VALUES (${status}, ${body.callId || body.call?.id || null}, ${phone}, ${JSON.stringify(body)})
      `;
    } catch (dbErr) {
      console.error('Neon DB webhook insert failed:', dbErr);
    }
  }

  return res.status(200).json({ success: true, received: true });
};
