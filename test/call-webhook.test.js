const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { appendCall, getCalls } = require('../call-storage');

test('appends call records to CSV and retrieves them accurately', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'call-csv-'));
  const callsPath = path.join(tempDir, 'calls.csv');

  const firstCall = await appendCall(callsPath, {
    agent_id: 'agent-001',
    agent_name: 'Admissions Assistant',
    phone: '+919876543210',
    duration: 145,
    summary: 'Lead expressed interest in UI/UX Design course.',
    success_evaluation: 'success',
    transcript: 'Agent: Hello! Lead: I want to know about Design course.',
    status: 'completed'
  });

  assert.equal(firstCall.id, 1);
  assert.equal(firstCall.agent_id, 'agent-001');
  assert.equal(firstCall.duration, 145);
  assert.equal(firstCall.success_evaluation, 'success');
  assert.equal(firstCall.status, 'completed');

  const calls = await getCalls(callsPath);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].summary, 'Lead expressed interest in UI/UX Design course.');
  assert.equal(calls[0].success_evaluation, 'success');
  assert.equal(calls[0].phone, '+919876543210');
});
