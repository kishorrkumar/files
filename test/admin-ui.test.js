const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'admin.css'), 'utf8');
const javascript = fs.readFileSync(path.join(root, 'admin.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

test('organizes every admin feature into the workspace dropdown', () => {
  for (const workspace of ['analytics', 'agents', 'leads', 'calls']) {
    assert.match(html, new RegExp('<option value="' + workspace + '">'));
    assert.match(html, new RegExp('data-workspace="' + workspace + '"'));
  }
});

test('keeps admin structure, presentation, and behavior separated', () => {
  assert.match(html, /<link rel="stylesheet" href="\/admin\.css"\s*\/>/);
  assert.match(html, /<script src="\/admin\.js" defer><\/script>/);
  assert.match(css, /--page:\s*#f5f5f7/);
  assert.match(javascript, /function setWorkspace\(/);
});

test('serves modular admin assets behind admin authentication', () => {
  assert.match(server, /app\.get\('\/admin\.css', requireAdminPage/);
  assert.match(server, /app\.get\('\/admin\.js', requireAdminPage/);
});

