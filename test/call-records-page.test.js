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

test('includes the 5 summary metric cards matching user screenshot', () => {
  assert.match(html, /id="dispCountTotal"/);
  assert.match(html, /id="dispCountCompleted"/);
  assert.match(html, /id="dispCountVoicemail"/);
  assert.match(html, /id="dispCountFailed"/);
  assert.match(html, /id="dispAvgDuration"/);
});

test('includes the exact 10 table columns matching user screenshot', () => {
  const expectedCols = [
    'DATE &amp; TIME', 'CALL ID', 'AGENT', 'FROM', 'TO',
    'CALL TYPE', 'STATUS', 'DISPOSITION', 'DURATION', 'COST'
  ];
  for (const col of expectedCols) {
    assert.ok(html.includes(`<th scope="col">${col}</th>`), `Missing header column ${col}`);
  }
});

test('provides waveform player, turn-by-turn chat transcript, and summary modals', () => {
  assert.match(html, /id="recordingWaveform"/);
  assert.match(html, /id="transcriptModal"/);
  assert.match(html, /id="summaryModal"/);
  assert.match(javascript, /WaveSurfer\.create/);
});

test('provides disposition quick buckets matching user mockup with badge counts', () => {
  assert.match(html, /id="dispBucketCountAll"/);
  assert.match(html, /id="dispBucketCountInterested"/);
  assert.match(html, /id="dispBucketCountCallback"/);
  assert.match(html, /id="dispBucketCountVoicemail"/);
  assert.match(html, /id="dispBucketCountNotInterested"/);
  assert.match(html, /id="dispBucketCountFailed"/);
});

test('provides both Excel spreadsheet (.xls) and CSV exports', () => {
  assert.match(html, /id="exportCallsBtn"/);
  assert.match(html, /id="exportCsvBtn"/);
  assert.match(javascript, /exportExcel\(\)/);
  assert.match(javascript, /exportCsv\(\)/);
  assert.match(javascript, /application\/vnd\.ms-excel/);
  assert.match(javascript, /text\/csv/);
});

