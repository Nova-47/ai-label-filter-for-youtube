// Every file the manifest and popup reference must exist, so a typo can't ship.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

test('manifest: MV3, minimal permissions', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual(manifest.optional_host_permissions, ['https://raw.githubusercontent.com/*']);
  assert.equal(manifest.host_permissions, undefined);
  assert.deepEqual(manifest.content_scripts.map((c) => c.matches), [['*://www.youtube.com/*']]);
  assert.ok(manifest.description.length <= 132);
});

test('manifest and popup: referenced files exist', () => {
  const files = new Set([
    manifest.background.service_worker,
    manifest.action.default_popup,
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
    ...manifest.content_scripts.flatMap((c) => [...(c.js || []), ...(c.css || [])]),
  ]);
  const popup = fs.readFileSync(path.join(root, 'popup.html'), 'utf8');
  for (const m of popup.matchAll(/(?:src|href)="([^":#]+)"/g)) files.add(m[1]);
  const bg = fs.readFileSync(path.join(root, manifest.background.service_worker), 'utf8');
  for (const m of bg.matchAll(/importScripts\('([^']+)'\)/g)) files.add(m[1]);
  for (const f of files) assert.ok(fs.existsSync(path.join(root, f)), `missing: ${f}`);
  assert.equal(manifest.content_scripts[0].js[0], 'shared.js'); // content.js depends on it
});
