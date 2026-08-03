const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePhoneForSnapserve, buildOutboundCallPayload, getLeadWebhookConfig, buildLeadWebhookPayload } = require('../snapserve');

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

test('resolves the lead webhook URL from the supported environment variable names', () => {
  delete process.env.WEBHOOK_URL;
  process.env.Web_book_URL = 'https://example.com/webhook';

  assert.equal(getLeadWebhookConfig().webhookUrl, 'https://example.com/webhook');
});

test('builds a lead payload for the webhook', () => {
  assert.deepEqual(buildLeadWebhookPayload({
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '9876543210',
    course: 'Design',
    source: 'landing_page_form'
  }), {
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '9876543210',
    course: 'Design',
    source: 'landing_page_form'
  });
});
