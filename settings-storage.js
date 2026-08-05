const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const path = require('node:path');
const { neon } = require('@neondatabase/serverless');

const SETTINGS_PATH = process.env.SETTINGS_PATH || path.join(__dirname, 'data', 'settings.json');
let sqlClient;
let schemaReady = false;

function database() {
  if (!process.env.DATABASE_URL) return null;
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
  return sqlClient;
}

async function ensureSchema(sql) {
  if (schemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  schemaReady = true;
}

async function readFallback() {
  try {
    return JSON.parse(await fsPromises.readFile(SETTINGS_PATH, 'utf8'));
  } catch {
    return { auto_call_enabled: false };
  }
}

async function writeFallback(settings) {
  await fsPromises.mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  await fsPromises.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
}

async function getAutoCallEnabled() {
  const sql = database();
  if (sql) {
    try {
      await ensureSchema(sql);
      const rows = await sql`
        SELECT setting_value FROM app_settings WHERE setting_key = 'auto_call_enabled'
      `;
      return rows[0]?.setting_value === 'true';
    } catch (error) {
      console.error('Database settings read failed:', error.message);
    }
  }
  return Boolean((await readFallback()).auto_call_enabled);
}

async function setAutoCallEnabled(enabled) {
  const value = Boolean(enabled);
  const sql = database();
  if (sql) {
    try {
      await ensureSchema(sql);
      await sql`
        INSERT INTO app_settings (setting_key, setting_value, updated_at)
        VALUES ('auto_call_enabled', ${String(value)}, NOW())
        ON CONFLICT (setting_key)
        DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()
      `;
      return value;
    } catch (error) {
      console.error('Database settings write failed:', error.message);
    }
  }
  const settings = await readFallback();
  settings.auto_call_enabled = value;
  await writeFallback(settings);
  return value;
}

module.exports = { getAutoCallEnabled, setAutoCallEnabled };
