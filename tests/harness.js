// Runs content.js in node:vm against fakes: one "browser" (virtual clock,
// chrome.storage, Web Locks, network log) shared by any number of tabs, each
// with a DOM just big enough for cards and the banner. No network, no timers
// of its own: time only moves inside run(ms).
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const src = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const fixture = (name) => src('tests/fixtures/' + name);
const flush = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r)); };
const VIDEO_LINK = '/watch?v=';

function browser({ latency = 0, setLatency = latency, eventMs = 0, netMs = 100, respond = () => ({ status: 200, body: fixture('normal-dQw4w9WgXcQ.json') }) } = {}) {
  let now = Date.UTC(2026, 9, 13, 12);
  let seq = 0;
  const timers = [];
  const setTimeout = (fn, ms = 0) => { timers.push({ id: ++seq, at: now + Math.max(0, ms), fn }); return seq; };
  const clearTimeout = (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); };
  async function run(ms) {
    const end = now + ms;
    for (;;) {
      await flush();
      timers.sort((a, b) => a.at - b.at || a.id - b.id);
      if (!timers.length || timers[0].at > end) break;
      const t = timers.shift();
      now = t.at;
      t.fn();
    }
    now = end;
    await flush();
  }

  // chrome.storage.local: get/remove take `latency` ms, set `setLatency` ms
  // (writing a big object is the slow part); onChanged reaches all tabs
  // `eventMs` after the write.
  const store = {};
  const writes = [];   // keys of every set(), in order
  const listeners = [];
  const later = (fn, ms = latency) => new Promise((res) => setTimeout(() => res(fn()), ms));
  const changed = (ch) => setTimeout(() => { for (const l of listeners) l(structuredClone(ch), 'local'); }, eventMs);
  const local = {
    get: (keys) => later(() => {
      const out = {};
      for (const k of [].concat(keys)) if (k in store) out[k] = structuredClone(store[k]);
      return out;
    }),
    set: (o) => {
      const copy = structuredClone(o);   // like Chrome: the value as of the call
      return later(() => {
        writes.push(Object.keys(copy).sort().join(','));
        const ch = {};
        for (const [k, v] of Object.entries(copy)) { ch[k] = { oldValue: store[k], newValue: structuredClone(v) }; store[k] = v; }
        changed(ch);
      }, setLatency);
    },
    remove: (keys) => later(() => {
      const ch = {};
      for (const k of [].concat(keys)) if (k in store) { ch[k] = { oldValue: store[k] }; delete store[k]; }
      changed(ch);
    }),
  };

  // navigator.locks: exclusive, FIFO, `ifAvailable` supported. Shared by all tabs.
  const held = new Map();
  const locks = {
    request(name, opts, cb) {
      if (typeof opts === 'function') { cb = opts; opts = {}; }
      const q = held.get(name) || held.set(name, []).get(name);
      if (opts.ifAvailable && q.length) return Promise.resolve().then(() => cb(null));
      return new Promise((resolve, reject) => {
        const go = () => Promise.resolve().then(() => cb({ name })).then(resolve, reject)
          .finally(() => { q.shift(); if (q.length) q[0](); });
        q.push(go);
        if (q.length === 1) go();
      });
    },
  };

  // fetch: logs each request; `inflight` tracks concurrency across tabs.
  const requests = [];
  let inflight = 0;
  let maxInflight = 0;
  const fetch = (url, opts) => {
    const body = JSON.parse(opts.body);
    const req = { at: now, url, masked: url.includes('fields='), videoId: body.videoId,
      clientVersion: body.context.client.clientVersion, credentials: opts.credentials };
    requests.push(req);
    maxInflight = Math.max(maxInflight, ++inflight);
    return new Promise((res, rej) => setTimeout(() => {
      inflight--;
      const r = respond(req);
      if (r instanceof Error) return rej(r);
      res({ status: r.status, ok: r.status >= 200 && r.status < 300, type: r.type || 'basic', text: async () => r.body || '' });
    }, netMs));
  };

  class FakeDate extends Date {
    constructor(...a) { if (a.length) super(...a); else super(now); }
    static now() { return now; }
  }

  function tab(url) {
    const u = new URL(url);
    const location = { href: u.href, pathname: u.pathname, search: u.search, origin: u.origin };
    const win = {};
    const docEvents = {};
    const cards = [];
    const html = el('html');
    const body = el('body');
    const document = {
      hidden: false, scripts: [], documentElement: html, body,
      querySelectorAll(sel) {
        const live = cards.filter((c) => c.isConnected);
        if (sel === '[data-ailf-vid]') return live.filter((c) => 'ailfVid' in c.dataset);
        if (sel === '[data-ailf]') return live.filter((c) => 'ailf' in c.dataset);
        if (sel.includes(VIDEO_LINK)) return live.map((c) => c.link);
        return [];
      },
      getElementById: (id) => body.children.find((c) => c.id === id) || null,
      createElement: (tag) => el(tag),
      addEventListener: (name, fn) => { docEvents[name] = fn; },
    };
    let io = null;
    let mo = null;
    class IntersectionObserver {
      constructor(cb) { this.cb = cb; this.targets = new Set(); io = this; }
      observe(t) { this.targets.add(t); }
      unobserve(t) { this.targets.delete(t); }
      disconnect() { this.targets.clear(); }
    }
    class MutationObserver {
      constructor(cb) { this.cb = cb; mo = this; }
      observe(target, options) { this.options = options; }
      disconnect() {}
    }
    const ctx = vm.createContext({
      console, structuredClone, setTimeout, clearTimeout, fetch, Date: FakeDate, document, location,
      navigator: { locks }, AbortSignal: { timeout: () => undefined }, Element: class {},
      IntersectionObserver, MutationObserver,
      window: { addEventListener: (name, fn) => { win[name] = fn; } },
      chrome: {
        runtime: { id: 'test', sendMessage: async () => ({}), onMessage: { addListener() {} } },
        storage: { local, onChanged: { addListener: (fn) => listeners.push(fn) } },
      },
    });
    vm.runInContext('Math.random = () => 0.5;', ctx);
    vm.runInContext(src('shared.js'), ctx);
    vm.runInContext(src('content.js'), ctx);
    return {
      document, html, cards,
      navigate(to) {
        const n = new URL(to);
        Object.assign(location, { href: n.href, pathname: n.pathname, search: n.search });
        if (win['yt-navigate-finish']) win['yt-navigate-finish']();
      },
      banner: () => document.getElementById('ailf-banner'),
      addCard(vid, channelHref) {
        const card = el('ytd-rich-item-renderer');
        card.link = { getAttribute: () => VIDEO_LINK + vid, closest: () => card };
        if (channelHref) card.channelLink = { getAttribute: () => channelHref };
        cards.push(card);
        return card;
      },
      mutate: () => mo.cb([]),
      intersect: (list, on) => io.cb(list.filter((c) => io.targets.has(c)).map((target) => ({ target, isIntersecting: on }))),
      get io() { return io; },
      get mo() { return mo; },
      visibility(hidden) { document.hidden = hidden; if (docEvents.visibilitychange) docEvents.visibilitychange(); },
    };
  }

  return { tab, run, store, writes, requests, now: () => now, get maxInflight() { return maxInflight; } };
}

// The few DOM element features content.js uses.
function el(tag) {
  const dsKey = (n) => n.replace(/^data-/, '').replace(/-(\w)/g, (_, c) => c.toUpperCase());
  const classes = new Set();
  return {
    tagName: tag, id: '', className: '', textContent: '', hidden: false, isConnected: true,
    dataset: {}, children: [], parentElement: null,
    classList: {
      toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)),
      remove: (...c) => c.forEach((x) => classes.delete(x)),
      contains: (c) => classes.has(c),
    },
    setAttribute(n, v) { if (n.startsWith('data-')) this.dataset[dsKey(n)] = String(v); },
    hasAttribute(n) { return dsKey(n) in this.dataset; },
    removeAttribute(n) { delete this.dataset[dsKey(n)]; },
    querySelector(sel) {
      if (sel.includes(VIDEO_LINK)) return this.link || null;
      if (sel.includes('/@')) return this.channelLink || null;
      if (sel.includes('.ailf-chip')) return this.children.find((c) => c.className === 'ailf-chip') || null;
      const act = /data-act="(\w+)"/.exec(sel);
      return (act && this.children.find((c) => c.dataset.act === act[1])) || null;
    },
    append(...kids) { for (const k of kids) { k.parentElement = this; this.children.push(k); } },
    remove() {
      const p = this.parentElement;
      if (p) { p.children.splice(p.children.indexOf(this), 1); this.parentElement = null; }
    },
    set innerHTML(h) {
      this.children = [el('span'), ...[...h.matchAll(/data-act="(\w+)"/g)].map((m) => {
        const b = el('button');
        b.dataset.act = m[1];
        return b;
      })];
    },
    get firstChild() { return this.children[0]; },
    get lastChild() { return this.children[this.children.length - 1]; },
  };
}

const reply = (status, body = '', type) => ({ status, body, type });
module.exports = { browser, fixture, reply };
