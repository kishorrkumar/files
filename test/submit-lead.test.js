const test = require('node:test');
const assert = require('node:assert/strict');

const submitLead = require('../api/submit-lead');

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; }
  };
}

test('rejects an invalid email as a field validation error', async () => {
  const req = {
    method: 'POST',
    body: {
      name: 'Bhaya',
      email: 'not-an-email',
      phone: '+910000000000',
      course: 'Full-Stack Web Development'
    }
  };
  const res = responseRecorder();

  await submitLead(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'A valid email is required.');
});

test('returns a clear service error when persistent storage is not configured', async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  try {
    const req = {
      method: 'POST',
      body: {
        name: 'Bhaya',
        email: 'lead@example.test',
        phone: '+910000000000',
        course: 'Full-Stack Web Development'
      }
    };
    const res = responseRecorder();

    await submitLead(req, res);

    assert.equal(res.statusCode, 503);
    assert.equal(
      res.body.error,
      'The admissions service is temporarily unavailable. Please try again shortly.'
    );
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

test('requires Hackathon interest and attendance selections', async () => {
  const req = {
    method: 'POST',
    body: {
      name: 'Priya Sharma',
      email: 'priya@example.com',
      phone: '+910000000000',
      course: 'SnapServe Voice AI Hackathon'
    }
  };
  const res = responseRecorder();

  await submitLead(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Please select your level of interest.');
});
