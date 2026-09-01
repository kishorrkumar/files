const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { normalizeMessage, saveMessage, getMessages } = require('../message-storage');

test('normalizes a SnapServe post-call notification for the inbox', () => {
  const message = normalizeMessage({
    callId: 'call-42',
    status: 'completed',
    transcript: 'Agent: Hello',
    dispositionResult: { outcome: 'Interested' },
    phone: '+919876543210'
  });
  assert.equal(message.call_id, 'call-42');
  assert.equal(message.status, 'completed');
  assert.equal(message.phone, '+919876543210');
  assert.match(message.disposition, /Interested/);
});

test('stores and returns notification updates without a database', async () => {
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'message-store-')), 'messages.json');
  await saveMessage(filePath, { callId: 'one', status: 'completed' });
  await saveMessage(filePath, { callId: 'two', status: 'failed' });
  const messages = await getMessages(filePath);
  assert.equal(messages.length, 2);
  assert.equal(messages[0].call_id, 'two');
});
