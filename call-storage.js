const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');

function resolveCallsPath(callsPath) {
  if (!callsPath) {
    return path.join(__dirname, 'data', 'calls.csv');
  }
  return path.isAbsolute(callsPath) ? callsPath : path.resolve(process.cwd(), callsPath);
}

function escapeCsvValue(value) {
  const stringValue = value == null ? '' : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
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
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

async function ensureCallsFile(callsPath) {
  const directory = path.dirname(callsPath);
  await fsPromises.mkdir(directory, { recursive: true });

  if (!fs.existsSync(callsPath)) {
    await fsPromises.writeFile(
      callsPath,
      'id,agent_id,agent_name,phone,duration,summary,transcript,status,created_at\n',
      'utf8'
    );
  }
}

async function appendCall(callsPath, callData) {
  const resolvedPath = resolveCallsPath(callsPath);
  await ensureCallsFile(resolvedPath);

  const existingCalls = await getCalls(resolvedPath);
  const nextId = existingCalls.length > 0 ? existingCalls[existingCalls.length - 1].id + 1 : 1;
  const createdAt = callData.created_at || new Date().toISOString();

  const row = [
    nextId,
    callData.agent_id || '',
    callData.agent_name || '',
    callData.phone || '',
    callData.duration || 0,
    callData.summary || '',
    callData.transcript || '',
    callData.status || 'completed',
    createdAt
  ]
    .map(escapeCsvValue)
    .join(',') + '\n';

  await fsPromises.appendFile(resolvedPath, row, 'utf8');

  return {
    id: nextId,
    agent_id: callData.agent_id || '',
    agent_name: callData.agent_name || '',
    phone: callData.phone || '',
    duration: callData.duration || 0,
    summary: callData.summary || '',
    transcript: callData.transcript || '',
    status: callData.status || 'completed',
    created_at: createdAt
  };
}

async function getCalls(callsPath) {
  const resolvedPath = resolveCallsPath(callsPath);

  if (!fs.existsSync(resolvedPath)) {
    return [];
  }

  const content = await fsPromises.readFile(resolvedPath, 'utf8');
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return [];
  }

  return lines.slice(1).map((line) => {
    const [id, agent_id, agent_name, phone, duration, summary, transcript, status, created_at] = parseCsvLine(line);
    return {
      id: Number(id),
      agent_id,
      agent_name,
      phone,
      duration: Number(duration) || 0,
      summary,
      transcript,
      status,
      created_at
    };
  });
}

module.exports = {
  appendCall,
  getCalls
};
