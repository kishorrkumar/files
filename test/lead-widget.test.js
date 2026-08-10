const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('loads the official SnapServe lead-capture widget with the configured campaign token', () => {
  assert.match(html, /https:\/\/app\.snapserve\.ai\/api\/widget\/lead-capture\.js/);
  assert.match(html, /data-token="9a9e6bb4-dbe5-40f2-853a-4a92eff1d965"/);
});

test('submits only interested leads with the supported SnapServe fields', () => {
  assert.match(html, /interest\.value === 'Yes, very interested'/);
  assert.match(html, /window\.SnapServe\.submit\(\{\s*phone,\s*full_name: name,\s*email\s*\}\)/s);
});

