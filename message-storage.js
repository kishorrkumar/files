const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const { databaseUrl } = require('./database-config');

let sqlClient;
let databaseSchemaReady = false;

function database() {
  const url = databaseUrl();
  if (!url) return null;
  if (!sqlClient) {
    const { neon } = require('@neondatabase/serverless');
    sqlClient = neon(url);
  }
  return sqlClient;
}

async function ensureDatabaseSchema(sql) {
  if (databaseSchemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS snapserve_webhooks (
      id BIGSERIAL PRIMARY KEY,
      webhook_id TEXT,
      event_type TEXT,
      call_id TEXT,
      phone TEXT,
      payload TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS snapserve_webhooks_call_id_idx ON snapserve_webhooks (call_id)`;
  await sql`CREATE INDEX IF NOT EXISTS snapserve_webhooks_created_at_idx ON snapserve_webhooks (created_at DESC)`;
  databaseSchemaReady = true;
}

function firstValue(payload, paths) {
  for (const keys of paths) {
    let value = payload;
    for (const key of keys) value = value?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
}

function normalizeMessage(payload = {}, stored = {}) {
  const call = payload.call || payload.data?.call || payload.data || payload;
  const disposition = firstValue(payload, [
    ['dispositionResult'], ['disposition'], ['data', 'dispositionResult'],
    ['call', 'dispositionResult'], ['call', 'disposition']
  ]);
  return {
    id: stored.id == null ? '' : Number(stored.id),
    webhook_id: String(stored.webhook_id || payload.webhookId || payload.webhook_id || payload.id || ''),
    event_type: String(stored.event_type || payload.event || payload.eventType || payload.type || 'post-call update'),
    call_id: String(stored.call_id || call.callId || call.call_id || call.id || payload.callId || payload.call_id || ''),
    phone: String(stored.phone || call.phone || call.toNumber || call.to_number || payload.phone || ''),
    agent_name: String(call.agentName || call.agent_name || payload.agentName || payload.agent_name || ''),
    status: String(call.status || payload.status || 'received'),
    summary: String(call.summary || call.callSummary || payload.summary || payload.callSummary || ''),
    transcript: typeof (call.transcript || payload.transcript) === 'string'
      ? (call.transcript || payload.transcript)
      : JSON.stringify(call.transcript || payload.transcript || ''),
    disposition: typeof disposition === 'string' ? disposition : JSON.stringify(disposition || ''),
    payload,
    created_at: stored.created_at || new Date().toISOString()
  };
}

async function saveDatabaseMessage(sql, payload) {
  await ensureDatabaseSchema(sql);
  const message = normalizeMessage(payload);
  const rows = await sql`
    INSERT INTO snapserve_webhooks (webhook_id, event_type, call_id, phone, payload)
    VALUES (${message.webhook_id || null}, ${message.event_type}, ${message.call_id || null},
            ${message.phone || null}, ${JSON.stringify(payload)})
    RETURNING id, webhook_id, event_type, call_id, phone, payload, created_at
  `;
  return normalizeMessage(JSON.parse(rows[0].payload), rows[0]);
}

async function getDatabaseMessages(sql) {
  await ensureDatabaseSchema(sql);
  const rows = await sql`
    SELECT id, webhook_id, event_type, call_id, phone, payload, created_at
    FROM snapserve_webhooks ORDER BY created_at DESC LIMIT 500
  `;
  return rows.map(row => normalizeMessage(JSON.parse(row.payload), row));
}

async function readLocalMessages(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const data = JSON.parse(await fsPromises.readFile(filePath, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function saveMessage(filePath, payload) {
  const sql = database();
  if (sql) return saveDatabaseMessage(sql, payload);
  const messages = await readLocalMessages(filePath);
  const message = normalizeMessage(payload, { id: (messages[0]?.id || 0) + 1 });
  messages.unshift(message);
  await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
  await fsPromises.writeFile(filePath, JSON.stringify(messages.slice(0, 500), null, 2), 'utf8');
  return message;
}

async function getMessages(filePath) {
  const sql = database();
  if (sql) return getDatabaseMessages(sql);
  return readLocalMessages(filePath);
}

module.exports = { normalizeMessage, saveMessage, getMessages };
