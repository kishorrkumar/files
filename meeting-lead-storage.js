const { neon } = require('@neondatabase/serverless');
const { databaseUrl } = require('./database-config');

let sqlClient;
let schemaReady = false;

function database() {
  const url = databaseUrl();
  if (!url) throw new Error('DATABASE_URL is required for SnapServe meeting leads.');
  if (!sqlClient) sqlClient = neon(url);
  return sqlClient;
}

async function ensureSchema(sql) {
  if (schemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS snapserve_meeting_leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ref_id VARCHAR(20) UNIQUE NOT NULL,
      full_name VARCHAR(120) NOT NULL,
      phone VARCHAR(24) NOT NULL,
      email VARCHAR(254) NOT NULL,
      interest VARCHAR(40) NOT NULL,
      attend VARCHAR(40) NOT NULL,
      lead_status VARCHAR(20) NOT NULL DEFAULT 'new',
      call_status VARCHAR(20) NOT NULL DEFAULT 'not_called',
      call_attempts INTEGER NOT NULL DEFAULT 0,
      assigned_agent_id TEXT,
      last_call_id TEXT,
      last_called_at TIMESTAMPTZ,
      call_notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE snapserve_meeting_leads ADD COLUMN IF NOT EXISTS lead_status VARCHAR(20) NOT NULL DEFAULT 'new'`;
  await sql`ALTER TABLE snapserve_meeting_leads ADD COLUMN IF NOT EXISTS call_status VARCHAR(20) NOT NULL DEFAULT 'not_called'`;
  await sql`ALTER TABLE snapserve_meeting_leads ADD COLUMN IF NOT EXISTS call_attempts INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE snapserve_meeting_leads ADD COLUMN IF NOT EXISTS assigned_agent_id TEXT`;
  await sql`ALTER TABLE snapserve_meeting_leads ADD COLUMN IF NOT EXISTS last_call_id TEXT`;
  await sql`ALTER TABLE snapserve_meeting_leads ADD COLUMN IF NOT EXISTS last_called_at TIMESTAMPTZ`;
  await sql`ALTER TABLE snapserve_meeting_leads ADD COLUMN IF NOT EXISTS call_notes TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE snapserve_meeting_leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
  await sql`CREATE INDEX IF NOT EXISTS snapserve_meeting_leads_created_idx ON snapserve_meeting_leads (created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS snapserve_meeting_leads_call_status_idx ON snapserve_meeting_leads (call_status)`;
  schemaReady = true;
}

function normalize(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    ref_id: row.ref_id || '',
    name: row.full_name || '',
    phone: row.phone || '',
    email: row.email || '',
    interest: row.interest || '',
    attend: row.attend || '',
    lead_status: row.lead_status || 'new',
    call_status: row.call_status || 'not_called',
    call_attempts: Number(row.call_attempts) || 0,
    agent: row.assigned_agent_id || '',
    last_call_id: row.last_call_id || '',
    last_called_at: row.last_called_at || '',
    call_notes: row.call_notes || '',
    created_at: row.created_at || '',
    updated_at: row.updated_at || ''
  };
}

async function getMeetingLeads() {
  const sql = database();
  await ensureSchema(sql);
  const rows = await sql`
    SELECT * FROM snapserve_meeting_leads
    ORDER BY created_at DESC
    LIMIT 1000
  `;
  return rows.map(normalize);
}

async function getMeetingLead(leadId) {
  const sql = database();
  await ensureSchema(sql);
  const rows = await sql`
    SELECT * FROM snapserve_meeting_leads
    WHERE id::text = ${String(leadId || '')}
    LIMIT 1
  `;
  return normalize(rows[0]);
}

async function updateMeetingLeadAgent(leadId, agentId) {
  const sql = database();
  await ensureSchema(sql);
  const rows = await sql`
    UPDATE snapserve_meeting_leads
    SET assigned_agent_id = ${String(agentId || '')}, updated_at = NOW()
    WHERE id::text = ${String(leadId || '')}
    RETURNING *
  `;
  return normalize(rows[0]);
}

function meetingCallStatus(value) {
  const status = String(value || '').toLowerCase().replace(/[\s-]+/g, '_');
  if (['pending', 'queued', 'ringing', 'initiated', 'in_progress', 'calling'].includes(status)) return 'calling';
  if (['completed', 'success', 'successful', 'ended'].includes(status)) return 'completed';
  if (['no_answer', 'unanswered', 'busy'].includes(status)) return 'no_answer';
  if (['failed', 'error', 'rejected', 'cancelled', 'canceled'].includes(status)) return 'failed';
  return '';
}

async function recordMeetingLeadCall(leadId, { agentId, callId, status, countAttempt = true }) {
  const sql = database();
  await ensureSchema(sql);
  const callStatus = meetingCallStatus(status) || 'calling';
  const rows = await sql`
    UPDATE snapserve_meeting_leads
    SET assigned_agent_id = ${String(agentId || '')},
        last_call_id = ${String(callId || '')},
        call_status = ${callStatus},
        call_attempts = call_attempts + ${countAttempt ? 1 : 0},
        last_called_at = CASE WHEN ${countAttempt} THEN NOW() ELSE last_called_at END,
        updated_at = NOW()
    WHERE id::text = ${String(leadId || '')}
    RETURNING *
  `;
  return normalize(rows[0]);
}

async function updateMeetingLeadFromWebhook(phone, status, callId) {
  const callStatus = meetingCallStatus(status);
  const digits = String(phone || '').replace(/\D/g, '').slice(-10);
  if (!digits || !callStatus) return null;
  const sql = database();
  await ensureSchema(sql);
  const rows = await sql`
    UPDATE snapserve_meeting_leads
    SET call_status = ${callStatus},
        last_call_id = COALESCE(NULLIF(${String(callId || '')}, ''), last_call_id),
        updated_at = NOW()
    WHERE id = (
      SELECT id FROM snapserve_meeting_leads
      WHERE RIGHT(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = ${digits}
      ORDER BY created_at DESC LIMIT 1
    )
    RETURNING *
  `;
  return normalize(rows[0]);
}

module.exports = {
  getMeetingLeads,
  getMeetingLead,
  updateMeetingLeadAgent,
  recordMeetingLeadCall,
  updateMeetingLeadFromWebhook,
  meetingCallStatus
};
