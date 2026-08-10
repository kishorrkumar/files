const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { meetingCallStatus } = require('../meeting-lead-storage');

test('normalizes SnapServe meeting call states for the admin table', () => {
  assert.equal(meetingCallStatus('queued'), 'calling');
  assert.equal(meetingCallStatus('in-progress'), 'calling');
  assert.equal(meetingCallStatus('completed'), 'completed');
  assert.equal(meetingCallStatus('no answer'), 'no_answer');
  assert.equal(meetingCallStatus('rejected'), 'failed');
  assert.equal(meetingCallStatus('unknown'), '');
});

test('admin includes a separate meeting lead calling panel', () => {
  const admin = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
  assert.match(admin, /SnapServe Meeting Leads - Assign Agent/);
  assert.match(admin, /id="meetingLeadsBody"/);
  assert.match(admin, /sessionFetch\('\/call-meeting-lead'/);
  assert.match(admin, /sessionFetch\('\/meeting-leads'/);
});

test('meeting calls resolve the stored lead phone on the server', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const route = server.slice(
    server.indexOf("app.post('/call-meeting-lead'"),
    server.indexOf("app.get('/calls'")
  );
  assert.match(route, /getMeetingLead\(leadId\)/);
  assert.match(route, /phone: lead\.phone/);
  assert.doesNotMatch(route, /req\.body\?\.phone/);
});
