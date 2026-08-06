const test = require('node:test');
const assert = require('node:assert/strict');

const { callFromPayload, callsFromResponse } = require('../call-normalization');

test('normalizes a completed SnapServe call with summary and transcript', () => {
  const call = callFromPayload({
    call: {
      id: 42,
      agentId: 7,
      agentName: 'Admissions Agent',
      toNumber: '+918925109358',
      durationSeconds: 90,
      callSummary: 'Student is interested in the full-stack course.',
      messages: [{ role: 'agent', text: 'Hello' }, { role: 'student', text: 'I am interested' }],
      recordingUrl: '/recordings/call-42.mp3',
      metadata: { name: 'Kishore Kumar', course: 'Full-Stack Web Development' }
    }
  });

  assert.equal(call.snapserve_call_id, '42');
  assert.equal(call.status, 'completed');
  assert.equal(call.summary, 'Student is interested in the full-stack course.');
  assert.equal(call.student_name, 'Kishore Kumar');
  assert.equal(call.course, 'Full-Stack Web Development');
  assert.match(call.transcript, /student: I am interested/);
  assert.equal(call.recording_url, 'https://app.snapserve.ai/recordings/call-42.mp3');
});

test('accepts wrapped SnapServe call-list responses', () => {
  const calls = [{ id: 1 }, { id: 2 }];

  assert.deepEqual(callsFromResponse({ calls }), calls);
  assert.deepEqual(callsFromResponse({ data: { calls } }), calls);
  assert.deepEqual(callsFromResponse({ results: calls }), calls);
});
