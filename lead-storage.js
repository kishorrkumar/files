const { neon } = require('@neondatabase/serverless');
const csvStorage = require('./csv-storage');

let sqlClient;
let schemaReady = false;

function getDatabase() {
  if (!process.env.DATABASE_URL) return null;
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
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
    INSERT INTO leads (name, email, phone, course, agent, created_at)
    VALUES (
      ${lead.name || ''},
      ${lead.email || ''},
      ${lead.phone || ''},
      ${lead.course || ''},
      ${lead.agent || null},
      ${lead.created_at || new Date().toISOString()}
    )
    RETURNING id, name, email, phone, course, agent, created_at
    `;
    return rows[0];
  } catch (error) {
    console.error('Database lead insert failed; using CSV fallback:', error.message);
    return csvStorage.appendLead(csvPath, lead);
  }
}

async function getLeads(csvPath) {
  const sql = getDatabase();
  if (!sql) return csvStorage.getLeads(csvPath);
  try {
    await ensureSchema(sql);
    return await sql`
      SELECT id, name, email, phone, course, agent, created_at
      FROM leads
      ORDER BY created_at DESC
    `;
  } catch (error) {
    console.error('Database lead read failed; using CSV fallback:', error.message);
    return csvStorage.getLeads(csvPath);
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
    RETURNING id, name, email, phone, course, agent, created_at
    `;
    return rows[0] || null;
  } catch (error) {
    console.error('Database lead update failed; using CSV fallback:', error.message);
    return csvStorage.updateLeadAgent(csvPath, leadId, agentId);
  }
}

module.exports = { appendLead, getLeads, updateLeadAgent };
