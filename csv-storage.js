const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');

function resolveCsvPath(csvPath) {
  if (!csvPath) {
    return path.join(__dirname, 'data', 'leads.csv');
  }

  return path.isAbsolute(csvPath) ? csvPath : path.resolve(process.cwd(), csvPath);
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

async function ensureCsvFile(csvPath) {
  const directory = path.dirname(csvPath);
  await fsPromises.mkdir(directory, { recursive: true });

  if (!fs.existsSync(csvPath)) {
    await fsPromises.writeFile(csvPath, 'id,name,email,phone,course,agent,created_at\n', 'utf8');
  }
}

async function appendLead(csvPath, lead) {
  const resolvedPath = resolveCsvPath(csvPath);
  await ensureCsvFile(resolvedPath);

  const existingLeads = await getLeads(resolvedPath);
  const nextId = existingLeads.length > 0 ? existingLeads[existingLeads.length - 1].id + 1 : 1;
  const createdAt = lead.created_at || new Date().toISOString();
  const row = [
    nextId,
    lead.name || '',
    lead.email || '',
    lead.phone || '',
    lead.course || '',
    lead.agent || '',
    createdAt
  ]
    .map(escapeCsvValue)
    .join(',') + '\n';

  await fsPromises.appendFile(resolvedPath, row, 'utf8');

  return {
    id: nextId,
    name: lead.name || '',
    email: lead.email || '',
    phone: lead.phone || '',
    course: lead.course || '',
    agent: lead.agent || '',
    created_at: createdAt
  };
}

async function getLeads(csvPath) {
  const resolvedPath = resolveCsvPath(csvPath);

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
    const [id, name, email, phone, course, agent, createdAt] = parseCsvLine(line);
    return {
      id: Number(id),
      name,
      email,
      phone,
      course,
      agent,
      created_at: createdAt
    };
  });
}

module.exports = {
  appendLead,
  getLeads
};
