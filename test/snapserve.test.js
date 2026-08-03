const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePhoneForSnapserve, buildOutboundCallPayload } = require('../snapserve');

test('normalizes a phone number to E.164 format', () => {
  assert.equal(normalizePhoneForSnapserve('+91 9876543210'), '+919876543210');
  assert.equal(normalizePhoneForSnapserve('9876543210'), '+9876543210');
  assert.equal(normalizePhoneForSnapserve(''), null);
});

test('builds a payload for the Snapserve outbound call API', () => {
  assert.deepEqual(buildOutboundCallPayload('+919876543210', 'agent-123'), {
    agentId: 'agent-123',
    toNumber: '+919876543210'
  });
});
