const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'call-records.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'call-records.css'), 'utf8');
const javascript = fs.readFileSync(path.join(root, 'call-records.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

test('serves call-records.html and assets behind admin authentication', () => {
  assert.match(server, /app\.get\('\/call-records', requireAdminPage/);
  assert.match(server, /app\.get\('\/call-records\.css', requireAdminPage/);
  assert.match(server, /app\.get\('\/call-records\.js', requireAdminPage/);
});

test('contains the exact filter bar matching user mockups', () => {
  assert.match(html, /id="callSearch"/);
  assert.match(html, /id="callStatusFilter"/);
  assert.match(html, /id="callAgentFilter"/);
  assert.match(html, /id="callDispositionFilter"/);
  assert.match(html, /id="callDateRangeFilter"/);
  assert.match(html, /id="callSortFilter"/);
  assert.match(html, /id="exportCallsBtn"/);
});

test('uses Name for column header instead of Student', () => {
  assert.match(html, /<th scope="col">NAME<\/th>/);
  assert.doesNotMatch(html, /STUDENT \/ LEAD/);
});

test('includes table columns for date, call id, name, agent, from, call type, status, disposition, duration, summary, recording, transcript', () => {
  const expectedCols = [
    'DATE &amp; TIME', 'CALL ID', 'NAME', 'AGENT', 'FROM',
    'CALL TYPE', 'STATUS', 'DISPOSITION', 'DURATION',
    'SUMMARY', 'RECORDING', 'TRANSCRIPT'
  ];
  for (const col of expectedCols) {
    assert.ok(html.includes(`<th scope="col">${col}</th>`), `Missing header column ${col}`);
  }
  assert.ok(!html.includes('<th scope="col">TO</th>'), 'TO column should be removed');
  assert.ok(!html.includes('<th scope="col">COST</th>'), 'COST column should be removed');
});

test('provides waveform player, turn-by-turn chat transcript, and summary modals', () => {
  assert.match(html, /id="recordingWaveform"/);
  assert.match(html, /id="transcriptModal"/);
  assert.match(html, /id="summaryModal"/);
  assert.match(javascript, /WaveSurfer\.create/);
});
