const test = require('node:test');
const assert = require('node:assert/strict');

const { databaseUrl } = require('../database-config');

test('database URL accepts common Neon and Postgres environment names', () => {
  const original = {
    DATABASE_URL: process.env.DATABASE_URL,
    NEON_DATABASE_URL: process.env.NEON_DATABASE_URL,
    POSTGRES_URL: process.env.POSTGRES_URL,
    POSTGRES_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING
  };

  delete process.env.DATABASE_URL;
  process.env.NEON_DATABASE_URL = 'postgresql://neon';
  process.env.POSTGRES_URL = 'postgresql://postgres';
  assert.equal(databaseUrl(), 'postgresql://neon');

  process.env.DATABASE_URL = 'postgresql://primary';
  assert.equal(databaseUrl(), 'postgresql://primary');

  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
