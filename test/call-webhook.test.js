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

test('upserts calls in bulk quickly and merges by snapserve_call_id', async () => {
  const { upsertCallsBulk } = require('../call-storage');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'call-bulk-'));
  const callsPath = path.join(tempDir, 'calls.csv');

  const batch = [
    { snapserve_call_id: 'c1', agent_name: 'Agent A', disposition: 'Interested', status: 'completed', duration: 30 },
    { snapserve_call_id: 'c2', agent_name: 'Agent B', disposition: 'Call Back Requested', status: 'no-pickup', duration: 15 }
  ];

  await upsertCallsBulk(callsPath, batch);
  let saved = await getCalls(callsPath);
  assert.equal(saved.length, 2);
  assert.equal(saved[0].disposition, 'Interested');
  assert.equal(saved[1].disposition, 'Call Back Requested');

  // Update existing call in next bulk batch
  await upsertCallsBulk(callsPath, [
    { snapserve_call_id: 'c1', summary: 'Updated summary', cost: '₹2.50' }
  ]);

  saved = await getCalls(callsPath);
  assert.equal(saved.length, 2);
  assert.equal(saved[0].disposition, 'Interested');
  assert.equal(saved[0].summary, 'Updated summary');
  assert.equal(saved[0].cost, '₹2.50');
});

test('gracefully falls back to local file when database throws or is unavailable', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'call-fallback-'));
  const callsPath = path.join(tempDir, 'calls.csv');

  // Should return empty array without throwing if file does not exist
  const empty = await getCalls(callsPath);
  assert.deepEqual(empty, []);

  // Writing a call should work cleanly
  const call = await appendCall(callsPath, {
    snapserve_call_id: 'test-fallback-1',
    agent_name: 'Admissions Assistant',
    disposition: 'Interested'
  });
  assert.equal(call.snapserve_call_id, 'test-fallback-1');

  const retrieved = await getCalls(callsPath);
  assert.equal(retrieved.length, 1);
  assert.equal(retrieved[0].snapserve_call_id, 'test-fallback-1');
  assert.equal(retrieved[0].disposition, 'Interested');
});
