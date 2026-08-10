const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizePhoneForSnapserve,
  buildOutboundCallPayload,
  getLeadWebhookConfig,
  buildLeadWebhookPayload,
  syncLeadToSnapserve
} = require('../snapserve');

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
  process.env.SNAPSERVE_LEAD_WEBHOOK_URL = 'https://example.com/webhook';

  assert.equal(getLeadWebhookConfig().webhookUrl, 'https://example.com/webhook');
});

test('builds a lead payload for the webhook', () => {
  assert.deepEqual(buildLeadWebhookPayload({
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '9876543210'
  }), {
    phone: '9876543210',
    full_name: 'Jane Doe',
    email: 'jane@example.com'
  });
});

test('syncs the submitted phone, name and email to SnapServe', async () => {
  let request;
  const result = await syncLeadToSnapserve(
    { name: 'Jane Doe', email: 'jane@example.com', phone: '+910000000000' },
    {
      webhookUrl: 'https://example.test/lead-webhook',
      fetchImpl: async (url, options) => {
        request = { url, options };
        return { ok: true, status: 200, text: async () => '' };
      }
    }
  );

  assert.equal(result.synced, true);
  assert.equal(request.url, 'https://example.test/lead-webhook');
  assert.deepEqual(JSON.parse(request.options.body), {
    phone: '+910000000000',
    full_name: 'Jane Doe',
    email: 'jane@example.com'
  });
});
