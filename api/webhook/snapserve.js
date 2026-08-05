require('dotenv').config();

const path = require('path');
const { neon } = require('@neondatabase/serverless');
const { upsertCall } = require('../../call-storage');

const DATABASE_URL = process.env.DATABASE_URL;
const RENDER_API_URL = process.env.RENDER_API_URL;
const CALLS_PATH = process.env.CALLS_CSV_PATH || path.join(__dirname, '..', '..', 'data', 'calls.csv');
const WEBHOOK_SECRET = process.env.SNAPSERVE_WEBHOOK_SECRET || process.env.snapserve_webhook_secret || '';

function normalizeCallStatus(status, call = {}) {
  const normalized = String(status || '').toLowerCase();
  const hasCompletedData = Number(call.duration || 0) > 0 &&
    Boolean(call.summary || call.transcript || call.recording_url);
  return (!normalized || normalized === 'unknown') && hasCompletedData ? 'completed' : (normalized || 'unknown');
}

function normalizeTranscript(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map(item => {
      if (typeof item === 'string') return item;
      return `${item.role || item.speaker || 'speaker'}: ${item.text || item.content || item.message || ''}`;
    }).join('\n');
  }
  return JSON.stringify(value, null, 2);
}

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
  const snapserve_call_id = body.callId || body.id || body.call?.id || body.payload?.callId || '';
  const agent_id = body.agent_id || body.agentId || body.agent?.id || body.call?.agentId || '';
  const agent_name = body.agent_name || body.agentName || body.agent?.name || body.call?.agentName || '';
  const phone = body.phone || body.toNumber || body.fromNumber || body.call?.toNumber || body.call?.phone || body.payload?.phone || '';
  const duration = Number(body.durationSeconds || body.duration || body.callDuration || body.call?.durationSeconds || body.call?.duration || 0);
  const summary = body.callSummary || body.call_summary || body.summary || body.call?.summary || body.analysis?.summary || '';
  const success_evaluation = body.successEvaluation || body.success_evaluation || body.call?.successEvaluation || body.analysis?.successEvaluation || '';
  const recording_url = body.recordingUrl || body.recording_url || body.call?.recordingUrl || body.payload?.recordingUrl || '';
  const transcript = normalizeTranscript(
    body.transcript || body.call_transcript || body.callTranscript ||
    body.call?.transcript || body.analysis?.transcript || body.messages
  );
  const status = normalizeCallStatus(
    body.status || body.call_status || body.callStatus || body.event || body.type,
    { duration, summary, transcript, recording_url }
  );

  // 1. Store locally in CSV
  try {
    await upsertCall(CALLS_PATH, {
      snapserve_call_id,
      agent_id,
      agent_name,
      phone,
      duration,
      summary,
      success_evaluation,
      recording_url,
      transcript,
      status,
      created_at: body.createdAt || body.created_at || body.call?.createdAt || '',
      ended_at: body.endedAt || body.ended_at || body.call?.endedAt || ''
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
        VALUES (${status}, ${snapserve_call_id || null}, ${phone}, ${JSON.stringify(body)})
      `;
    } catch (dbErr) {
      console.error('Neon DB webhook insert failed:', dbErr);
    }
  }

  return res.status(200).json({ success: true, received: true });
};
