const { neon } = require('@neondatabase/serverless');
const csvStorage = require('./csv-storage');
const { databaseUrl } = require('./database-config');

let sqlClient;
let schemaReady = false;

function getDatabase() {
  const url = databaseUrl();
  if (!url) return null;
  if (!sqlClient) sqlClient = neon(url);
  return sqlClient;
}

async function ensureSchema(sql) {
  if (schemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS leads (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      course TEXT NOT NULL,
      agent TEXT,
      interest TEXT,
      attendance TEXT,
      source TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_course_check`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS interest TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS attendance TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS source TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new'`;
  await sql`CREATE INDEX IF NOT EXISTS leads_phone_idx ON leads (phone)`;
  await sql`CREATE INDEX IF NOT EXISTS leads_course_idx ON leads (course)`;
  schemaReady = true;
}

async function appendLead(csvPath, lead) {
  const sql = getDatabase();
  if (!sql) return csvStorage.appendLead(csvPath, lead);
  try {
    await ensureSchema(sql);
    const rows = await sql`
    INSERT INTO leads (name, email, phone, course, agent, interest, attendance, source, status, created_at)
    VALUES (
      ${lead.name || ''},
      ${lead.email || ''},
      ${lead.phone || ''},
      ${lead.course || ''},
      ${lead.agent || null},
      ${lead.interest || null},
      ${lead.attendance || lead.attend || null},
      ${lead.source || null},
      ${lead.status || 'new'},
      ${lead.created_at || new Date().toISOString()}
    )
    RETURNING id, name, email, phone, course, agent, interest, attendance, source, status, created_at
    `;
    return rows[0];
  } catch (error) {
    console.error('Database lead insert failed:', error.message);
    throw error;
  }
}

async function getLeads(csvPath) {
  const sql = getDatabase();
  if (!sql) return csvStorage.getLeads(csvPath);
  try {
    await ensureSchema(sql);
    return await sql`
      SELECT id, name, email, phone, course, agent, interest, attendance, source, status, created_at
      FROM leads
      ORDER BY created_at DESC
    `;
  } catch (error) {
    console.error('Database lead read failed:', error.message);
    throw error;
  }
}

async function updateLeadAgent(csvPath, leadId, agentId) {
  const sql = getDatabase();
  if (!sql) return csvStorage.updateLeadAgent(csvPath, leadId, agentId);
  try {
    await ensureSchema(sql);
    const rows = await sql`
    UPDATE leads
    SET agent = ${String(agentId)}
    WHERE id = ${Number(leadId)}
    RETURNING id, name, email, phone, course, agent, interest, attendance, source, status, created_at
    `;
    return rows[0] || null;
  } catch (error) {
    console.error('Database lead update failed:', error.message);
    throw error;
  }
}

module.exports = { appendLead, getLeads, updateLeadAgent };
