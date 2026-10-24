// background.js (AiSList subscription) with fake chrome.* and fetch; no network.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const LIST = '! comment\n@One\n@Two%C3%80\nUCuAXFkgsw1L7xaCfnd5JJOw\n';

function boot({ store = {}, granted = true, respond }) {
  const listeners = {};
  const on = (name) => ({ addListener: (fn) => { listeners[name] = fn; } });
  const requests = [];
  const tabs = [];
  const chrome = {
    storage: { local: {
      get: async (keys) => {
        const out = {};
        for (const k of [].concat(keys)) if (k in store) out[k] = structuredClone(store[k]);
        return out;
      },
      set: async (o) => { Object.assign(store, structuredClone(o)); },
      remove: async (keys) => { for (const k of [].concat(keys)) delete store[k]; },
    } },
    permissions: { contains: async () => granted, onAdded: on('added'), onRemoved: on('removed') },
    runtime: { onMessage: on('message'), onStartup: on('startup'), onInstalled: on('installed') },
    tabs: { create: async (props) => { tabs.push(props); return { id: tabs.length }; } },
  };
  const ctx = vm.createContext({
    chrome, console, structuredClone, Promise, Date,
    fetch: async (url, opts) => { requests.push({ url, opts }); return respond(store); },
  });
  ctx.globalThis = ctx;
  ctx.importScripts = (f) => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'background.js'), 'utf8'), ctx);
  const message = (action) => new Promise((res) => listeners.message({ action }, {}, res));
  return { store, requests, message, listeners, tabs };
}

const ok = (text, etag = '"v1"') => ({ status: 200, ok: true, text: async () => text, headers: { get: () => etag } });

test('background: downloads, parses and stores the list compactly', async () => {
  const b = boot({ store: { settings: { aislist: true } }, respond: () => ok(LIST) });
  await b.message('aislist:refresh');
  assert.equal(b.store.aislistData, 'one\ntwoà\nUCuAXFkgsw1L7xaCfnd5JJOw');
  assert.equal(b.store.aislistMeta.count, 3);
  assert.equal(b.store.aislistMeta.etag, '"v1"');
  assert.equal(b.store.aislistMeta.error, null);
  assert.equal(b.requests[0].url, 'https://raw.githubusercontent.com/Override92/AiSList/main/AiSList/aislist_blocklist.txt');
  assert.equal(b.requests[0].opts.credentials, 'omit');
});

test('background: does nothing while off or without the permission', async () => {
  const off = boot({ store: { settings: { aislist: false } }, respond: () => ok(LIST) });
  await off.message('aislist:refresh');
  const noPerm = boot({ store: { settings: { aislist: true } }, granted: false, respond: () => ok(LIST) });
  await noPerm.message('aislist:refresh');
  assert.equal(off.requests.length + noPerm.requests.length, 0);
});

test('background: at most once per 24 h, then a conditional request (304 keeps data)', async () => {
  const day = 86400000;
  const meta = { attemptedAt: Date.now() - day + 60000, fetchedAt: 1, etag: '"v1"', count: 3 };
  const b = boot({ store: { settings: { aislist: true }, aislistMeta: meta, aislistData: 'one' },
    respond: () => ({ status: 304, ok: false, headers: { get: () => null } }) });
  await b.message('aislist:maybeRefresh');
  assert.equal(b.requests.length, 0);                        // checked less than 24 h ago
  b.store.aislistMeta.attemptedAt = Date.now() - day - 1;
  await b.message('aislist:maybeRefresh');
  assert.equal(b.requests.length, 1);
  assert.equal(b.requests[0].opts.headers['If-None-Match'], '"v1"');
  assert.equal(b.store.aislistData, 'one');
  assert.ok(b.store.aislistMeta.fetchedAt > 1);
  await b.message('aislist:refresh');                         // forced right after: double-click guard
  assert.equal(b.requests.length, 1);
});

test('background: a failed or empty download keeps the last good copy', async () => {
  const store = { settings: { aislist: true }, aislistData: 'old', aislistMeta: { count: 1, etag: '"v0"' } };
  const b = boot({ store, respond: () => ({ status: 500, ok: false, headers: { get: () => null } }) });
  await b.message('aislist:refresh');
  assert.equal(b.store.aislistData, 'old');
  assert.equal(b.store.aislistMeta.error, 'HTTP 500');
  assert.equal(b.store.aislistMeta.count, 1);
  const e = boot({ store: { settings: { aislist: true }, aislistData: 'old' }, respond: () => ok('! only comments\n') });
  await e.message('aislist:refresh');
  assert.equal(e.store.aislistData, 'old');
  assert.equal(e.store.aislistMeta.error, 'no entries found');
});

test('background: turned off during the download leaves nothing behind', async () => {
  const b = boot({ store: { settings: { aislist: true } }, respond: (store) => { store.settings = { aislist: false }; return ok(LIST); } });
  await b.message('aislist:refresh');
  assert.equal('aislistData' in b.store, false);
  assert.equal('aislistMeta' in b.store, false);
});

test('background: permission granted/revoked toggles the setting', async () => {
  const b = boot({ store: { settings: { mode: 'dim' } }, respond: () => ok(LIST) });
  b.listeners.added({ origins: ['https://raw.githubusercontent.com/*'] });
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(b.store.settings, { mode: 'dim', aislist: true, onboarded: true });
  assert.equal(b.store.aislistMeta.count, 3);
  b.listeners.removed({ origins: ['https://raw.githubusercontent.com/*'] });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(b.store.settings.aislist, false);
  assert.equal('aislistData' in b.store, false);
});

test('background: opens the welcome page on first install only, settings untouched', async () => {
  const b = boot({ respond: () => ok(LIST) });
  for (const reason of ['update', 'chrome_update', 'shared_module_update']) b.listeners.installed({ reason, previousVersion: '1.0.0' });
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(b.tabs, []);
  b.listeners.installed({ reason: 'install' });
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(b.tabs.map((t) => ({ ...t })), [{ url: 'welcome.html' }]);
  assert.deepEqual(b.store, {});        // defaults stay: aislist and lookups off
  assert.equal(b.requests.length, 0);
});
