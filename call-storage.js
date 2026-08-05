const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');

const HEADERS = [
  'id', 'snapserve_call_id', 'agent_id', 'agent_name', 'phone', 'duration',
  'summary', 'success_evaluation', 'recording_url', 'transcript', 'status', 'created_at', 'ended_at'
];

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
