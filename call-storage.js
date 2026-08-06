const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const { neon } = require('@neondatabase/serverless');

const HEADERS = [
  'id', 'snapserve_call_id', 'agent_id', 'agent_name', 'phone', 'duration',
  'summary', 'success_evaluation', 'recording_url', 'transcript', 'status', 'created_at', 'ended_at'
];

let sqlClient;
let databaseSchemaReady = false;

function database() {
  if (!process.env.DATABASE_URL) return null;
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
  return sqlClient;
}

async function ensureDatabaseSchema(sql) {
  if (databaseSchemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS call_records (
      id BIGSERIAL PRIMARY KEY,
      snapserve_call_id TEXT,
      agent_id TEXT,
      agent_name TEXT,
      phone TEXT,
      duration INTEGER NOT NULL DEFAULT 0,
      summary TEXT,
      success_evaluation TEXT,
      recording_url TEXT,
      transcript TEXT,
      status TEXT NOT NULL DEFAULT 'unknown',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at TIMESTAMPTZ
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS call_records_snapserve_id_idx
    ON call_records (snapserve_call_id)
    WHERE snapserve_call_id IS NOT NULL AND snapserve_call_id <> ''
  `;
  await sql`CREATE INDEX IF NOT EXISTS call_records_phone_idx ON call_records (phone)`;
  await sql`CREATE INDEX IF NOT EXISTS call_records_created_at_idx ON call_records (created_at DESC)`;
  databaseSchemaReady = true;
}

function normalizedDatabaseCall(row) {
  return {
    ...row,
    id: Number(row.id),
    snapserve_call_id: row.snapserve_call_id || '',
    agent_id: row.agent_id || '',
    agent_name: row.agent_name || '',
    phone: row.phone || '',
    duration: Number(row.duration) || 0,
    summary: row.summary || '',
    success_evaluation: row.success_evaluation || '',
    recording_url: row.recording_url || '',
    transcript: row.transcript || '',
    status: row.status || 'unknown',
    created_at: row.created_at || '',
    ended_at: row.ended_at || ''
  };
}

async function getDatabaseCalls(sql) {
  await ensureDatabaseSchema(sql);
  const rows = await sql`
    SELECT id, snapserve_call_id, agent_id, agent_name, phone, duration,
           summary, success_evaluation, recording_url, transcript, status,
           created_at, ended_at
    FROM call_records
    ORDER BY created_at DESC
    LIMIT 1000
  `;
  return rows.map(normalizedDatabaseCall);
}

async function upsertDatabaseCall(sql, callData) {
  await ensureDatabaseSchema(sql);
  const snapserveId = String(callData.snapserve_call_id || callData.call_id || '');
  const existingRows = snapserveId
    ? await sql`SELECT * FROM call_records WHERE snapserve_call_id = ${snapserveId} LIMIT 1`
    : [];
  const existing = existingRows[0] ? normalizedDatabaseCall(existingRows[0]) : null;
  const merged = mergeCall(existing || {}, { ...callData, snapserve_call_id: snapserveId });

  if (existing) {
    const rows = await sql`
      UPDATE call_records SET
        agent_id = ${merged.agent_id || null},
        agent_name = ${merged.agent_name || null},
        phone = ${merged.phone || null},
        duration = ${Number(merged.duration) || 0},
        summary = ${merged.summary || null},
        success_evaluation = ${merged.success_evaluation || null},
        recording_url = ${merged.recording_url || null},
        transcript = ${merged.transcript || null},
        status = ${merged.status || 'unknown'},
        created_at = ${merged.created_at || existing.created_at || new Date().toISOString()},
        ended_at = ${merged.ended_at || null}
      WHERE id = ${existing.id}
      RETURNING *
    `;
    return normalizedDatabaseCall(rows[0]);
  }

  const rows = await sql`
    INSERT INTO call_records (
      snapserve_call_id, agent_id, agent_name, phone, duration, summary,
      success_evaluation, recording_url, transcript, status, created_at, ended_at
    ) VALUES (
      ${snapserveId || null}, ${merged.agent_id || null}, ${merged.agent_name || null},
      ${merged.phone || null}, ${Number(merged.duration) || 0}, ${merged.summary || null},
      ${merged.success_evaluation || null}, ${merged.recording_url || null},
      ${merged.transcript || null}, ${merged.status || 'unknown'},
      ${merged.created_at || new Date().toISOString()}, ${merged.ended_at || null}
    ) RETURNING *
  `;
  return normalizedDatabaseCall(rows[0]);
}

function resolveCallsPath(callsPath) {
  if (!callsPath) return path.join(__dirname, 'data', 'calls.csv');
  return path.isAbsolute(callsPath) ? callsPath : path.resolve(process.cwd(), callsPath);
}

function escapeCsvValue(value) {
  const stringValue = value == null ? '' : String(value);
  return /[",\n]/.test(stringValue)
    ? `"${stringValue.replace(/"/g, '""')}"`
    : stringValue;
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

async function ensureCallsFile(callsPath) {
  await fsPromises.mkdir(path.dirname(callsPath), { recursive: true });
  if (!fs.existsSync(callsPath)) {
    await fsPromises.writeFile(callsPath, HEADERS.join(',') + '\n', 'utf8');
  }
}

function rowFromCall(call) {
  return HEADERS.map(header => escapeCsvValue(call[header] ?? '')).join(',');
}

async function writeCalls(callsPath, calls) {
  const resolvedPath = resolveCallsPath(callsPath);
  await fsPromises.mkdir(path.dirname(resolvedPath), { recursive: true });
  const body = calls.map(rowFromCall).join('\n');
  await fsPromises.writeFile(resolvedPath, HEADERS.join(',') + '\n' + (body ? body + '\n' : ''), 'utf8');
}

async function getCalls(callsPath) {
  const sql = database();
  if (sql) {
    try {
      return await getDatabaseCalls(sql);
    } catch (error) {
      console.error('Database call read failed; using CSV fallback:', error.message);
    }
  }
  const resolvedPath = resolveCallsPath(callsPath);
  if (!fs.existsSync(resolvedPath)) return [];

  const content = await fsPromises.readFile(resolvedPath, 'utf8');
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length <= 1) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line, rowIndex) => {
    const values = parseCsvLine(line);
    const raw = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
    const localId = Number(raw.id);
    return {
      id: Number.isFinite(localId) && localId > 0 ? localId : rowIndex + 1,
      snapserve_call_id: raw.snapserve_call_id || raw.call_id || '',
      agent_id: raw.agent_id || '',
      agent_name: raw.agent_name || '',
      phone: raw.phone || '',
      duration: Number(raw.duration) || 0,
      summary: raw.summary || '',
      success_evaluation: raw.success_evaluation || '',
      recording_url: raw.recording_url || '',
      transcript: raw.transcript || '',
      status: raw.status || 'unknown',
      created_at: raw.created_at || '',
      ended_at: raw.ended_at || ''
    };
  });
}

function normalizedPhone(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

function mergeCall(existing, incoming) {
  const merged = { ...existing };
  for (const header of HEADERS) {
    const value = incoming[header];
    if (value !== undefined && value !== null && value !== '') merged[header] = value;
  }
  merged.duration = Number(incoming.duration ?? existing.duration) || 0;
  return merged;
}

async function upsertCall(callsPath, callData) {
  const sql = database();
  if (sql) {
    try {
      return await upsertDatabaseCall(sql, callData);
    } catch (error) {
      console.error('Database call upsert failed; using CSV fallback:', error.message);
    }
  }
  const resolvedPath = resolveCallsPath(callsPath);
  await ensureCallsFile(resolvedPath);
  const calls = await getCalls(resolvedPath);
  const snapserveId = String(callData.snapserve_call_id || callData.call_id || '');

  let index = snapserveId
    ? calls.findIndex(call => String(call.snapserve_call_id) === snapserveId)
    : -1;

  if (index < 0) {
    const incomingTime = new Date(callData.created_at || 0).getTime();
    index = calls.findIndex(call => {
      const existingTime = new Date(call.created_at || 0).getTime();
      return !call.snapserve_call_id &&
        normalizedPhone(call.phone) === normalizedPhone(callData.phone) &&
        String(call.agent_id) === String(callData.agent_id || '') &&
        Number.isFinite(incomingTime) && Number.isFinite(existingTime) &&
        Math.abs(existingTime - incomingTime) < 5000;
    });
  }

  if (index >= 0) {
    calls[index] = mergeCall(calls[index], { ...callData, snapserve_call_id: snapserveId });
    await writeCalls(resolvedPath, calls);
    return calls[index];
  }

  const nextId = calls.reduce((max, call) => Math.max(max, Number(call.id) || 0), 0) + 1;
  const created = mergeCall({
    id: nextId,
    snapserve_call_id: snapserveId,
    agent_id: '',
    agent_name: '',
    phone: '',
    duration: 0,
    summary: '',
    success_evaluation: '',
    recording_url: '',
    transcript: '',
    status: 'unknown',
    created_at: new Date().toISOString(),
    ended_at: ''
  }, callData);
  created.id = nextId;
  created.snapserve_call_id = snapserveId;
  calls.push(created);
  await writeCalls(resolvedPath, calls);
  return created;
}

async function appendCall(callsPath, callData) {
  return upsertCall(callsPath, callData);
}

module.exports = { appendCall, upsertCall, getCalls };
