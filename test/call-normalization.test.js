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

test('normalizes exact SnapServe API schema with dispositionResult and costCents', () => {
  const { categorizeDisposition } = require('../call-normalization');
  const rawPayload = {
    id: 456,
    agentId: 123,
    status: 'completed',
    toNumber: '+919876543210',
    fromNumber: '+917971543255',
    durationSeconds: 84,
    costCents: 700,
    transcript: 'Agent: Hello...',
    callSummary: 'Caller asked about clinic hours.',
    dispositionResult: 'Interested',
    recordingUrl: 'https://app.snapserve.ai/recordings/call-456.mp3'
  };

  const call = callFromPayload(rawPayload);
  assert.equal(call.snapserve_call_id, '456');
  assert.equal(call.agent_id, '123');
  assert.equal(call.to_number, '+919876543210');
  assert.equal(call.from_number, '+917971543255');
  assert.equal(call.duration, 84);
  assert.equal(call.cost, '₹7.00');
  assert.equal(call.disposition, 'Interested');
  assert.equal(call.summary, 'Caller asked about clinic hours.');
  assert.equal(call.status, 'completed');

  const catInterested = categorizeDisposition(call.disposition);
  assert.equal(catInterested.key, 'interested');

  const catCallback = categorizeDisposition('Call Back Requested');
  assert.equal(catCallback.key, 'callback');

  const catVoicemail = categorizeDisposition('No Answer', 'no-pickup');
  assert.equal(catVoicemail.key, 'voicemail');

  const catNotInterested = categorizeDisposition('Not Interested');
  assert.equal(catNotInterested.key, 'not_interested');

  const catFailed = categorizeDisposition('', 'failed');
  assert.equal(catFailed.key, 'failed');
});
