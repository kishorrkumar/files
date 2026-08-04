const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { appendLead, getLeads } = require('../csv-storage');

test('appends leads to CSV and reads them back in order', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lead-csv-'));
  const csvPath = path.join(tempDir, 'leads.csv');

  const firstLead = await appendLead(csvPath, {
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '9876543210',
    course: 'Design',
    agent: 'agent-123'
  });

  const secondLead = await appendLead(csvPath, {
    name: 'John Smith',
    email: 'john@example.com',
    phone: '1234567890',
    course: 'Development',
    agent: 'agent-456'
  });

  assert.equal(firstLead.id, 1);
  assert.equal(secondLead.id, 2);

  const leads = await getLeads(csvPath);
  assert.deepEqual(leads, [
    {
      id: 1,
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '9876543210',
      course: 'Design',
      agent: 'agent-123',
      created_at: leads[0].created_at
    },
    {
      id: 2,
      name: 'John Smith',
      email: 'john@example.com',
      phone: '1234567890',
      course: 'Development',
      agent: 'agent-456',
      created_at: leads[1].created_at
    }
  ]);

  assert.equal(fs.existsSync(csvPath), true);
});
