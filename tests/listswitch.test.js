// listswitch.js: Chrome shows the permission prompt only while the click's
// user gesture is active, so turnOn() must call chrome.permissions.request
// synchronously, before its first await and before it returns.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const src = (f) => fs.readFileSync(path.join(root, f), 'utf8');

function load(granted) {
  const log = [];
  const asked = []; // vm objects have another realm's prototypes, so compare as JSON
  let store = { settings: { lookups: true } };
  const chrome = {
    permissions: {
      request: (p) => { log.push('request'); asked.push(JSON.stringify(p)); return Promise.resolve(granted); },
      remove: () => Promise.resolve(true),
    },
    storage: {
      local: {
        get: async () => { log.push('get'); return { ...store }; },
        set: async (o) => { log.push('set'); store = { ...store, ...o }; },
        remove: async () => {},
      },
    },
    runtime: { sendMessage: (m) => { log.push('msg:' + m.action); return Promise.resolve(); } },
  };
  const ctx = { chrome };
  ctx.globalThis = ctx;
  vm.runInNewContext(src('listswitch.js'), ctx);
  return { L: ctx.AILF_LIST, log, asked, settings: () => JSON.parse(JSON.stringify(store.settings)) };
}

test('turnOn: permission request happens before turnOn() returns', async () => {
  const { L, log, asked, settings } = load(true);
  const p = L.turnOn();
  log.push('sync-return');
  assert.deepEqual(log, ['request', 'sync-return']);
  assert.equal(await p, true);
  assert.deepEqual(log, ['request', 'sync-return', 'get', 'set', 'msg:aislist:refresh']);
  assert.deepEqual(asked, ['{"origins":["https://raw.githubusercontent.com/*"]}']);
  assert.deepEqual(settings(), { lookups: true, aislist: true, onboarded: true });
});

test('turnOn: request is synchronous with an injected save too; denial changes nothing', async () => {
  const { L, log, settings } = load(false);
  const saved = [];
  const p = L.turnOn(async (patch) => saved.push(patch));
  log.push('sync-return');
  assert.deepEqual(log, ['request', 'sync-return']);
  assert.equal(await p, false);
  assert.deepEqual(log, ['request', 'sync-return']);
  assert.deepEqual(saved, []);
  assert.deepEqual(settings(), { lookups: true });
});

// The callers must not await anything before calling turnOn(): not in
// turnListOn itself, and not in the popup listeners that call turnListOn.
test('popup and welcome: nothing is awaited before L.turnOn in the click path', () => {
  const cases = [
    ['popup.js', 'async function turnListOn()', 'L.turnOn('],
    ['popup.js', "$('aislist').addEventListener('change'", 'turnListOn'],
    ['popup.js', "$('list-on').addEventListener('click'", 'turnListOn'],
    ['welcome.js', "$('list-on').addEventListener('click'", 'L.turnOn('],
  ];
  for (const [file, start, call] of cases) {
    const text = src(file);
    const from = text.indexOf(start);
    assert.ok(from >= 0, `${file}: handler not found: ${start}`);
    const at = text.indexOf(call, from);
    assert.ok(at > from, `${file}: ${call} not called in handler: ${start}`);
    const before = text.slice(from, at).replace(/await\s*$/, '');
    assert.doesNotMatch(before, /\bawait\b/, `${file}: await before ${call} in ${start}`);
  }
});
