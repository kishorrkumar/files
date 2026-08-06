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
    student_name: 'Aditi Rao',
    course: 'UI/UX Design Mastery',
    duration: 145,
    summary: 'Lead expressed interest in UI/UX Design course.',
    success_evaluation: 'success',
    recording_url: 'https://app.snapserve.ai/recordings/call-123.mp3',
    transcript: 'Agent: Hello! Lead: I want to know about Design course.',
    status: 'completed'
  });

  assert.equal(firstCall.id, 1);
  assert.equal(firstCall.agent_id, 'agent-001');
  assert.equal(firstCall.duration, 145);
  assert.equal(firstCall.success_evaluation, 'success');
  assert.equal(firstCall.recording_url, 'https://app.snapserve.ai/recordings/call-123.mp3');
  assert.equal(firstCall.status, 'completed');

  const calls = await getCalls(callsPath);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].summary, 'Lead expressed interest in UI/UX Design course.');
  assert.equal(calls[0].success_evaluation, 'success');
  assert.equal(calls[0].recording_url, 'https://app.snapserve.ai/recordings/call-123.mp3');
  assert.equal(calls[0].phone, '+919876543210');
  assert.equal(calls[0].student_name, 'Aditi Rao');
  assert.equal(calls[0].course, 'UI/UX Design Mastery');
});
