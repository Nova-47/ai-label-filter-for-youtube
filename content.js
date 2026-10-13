// Content script for www.youtube.com (isolated world). Pure logic lives in
// shared.js (loaded first as `AILF`); this file does the DOM, the requests
// and storage. Rule everywhere: when anything fails, the video is shown.
(() => {
  'use strict';

  const A = globalThis.AILF;
  if (!A || !globalThis.chrome || !chrome.storage) return;

  const DEBUG = false;
  const log = (...args) => { if (DEBUG) console.debug('[AI Label Filter]', ...args); };

  // Video card containers, outermost first in spirit: when they nest (a lockup
  // inside a rich item) the outermost match is the one we hide. This list
  // breaks when YouTube renames its DOM; keep it the single source. Cards are
  // *found* through their links (below), never by these names alone.
  const CARD_SELECTOR_LIST = [
    'ytd-rich-item-renderer',            // home, subscriptions, channel grids
    'ytd-video-renderer',                // search results, history
    'ytd-compact-video-renderer',        // older watch-page sidebar
    'ytd-grid-video-renderer',           // older channel grids
    'ytd-playlist-video-renderer',       // playlist page
    'ytd-playlist-panel-video-renderer', // playlist panel on the watch page
    'ytd-reel-item-renderer',            // older Shorts shelves
    'yt-lockup-view-model',              // newer sidebar and grid lockups
    'ytm-shorts-lockup-view-model',      // Shorts shelves
    'ytm-shorts-lockup-view-model-v2',
  ];
  const CARD_SEL = CARD_SELECTOR_LIST.join(',');
  const VIDEO_LINK_SEL = 'a[href*="/watch?v="], a[href*="/shorts/"]';
  const CHANNEL_LINK_SEL = 'a[href*="/@"], a[href*="/channel/UC"]';

  const DEFAULTS = { enabled: true, mode: 'hide', lookups: false, aislist: false, onboarded: false };
  const FALLBACK_CLIENT_VERSION = '2.20261012.01.00'; // seen on youtube.com 2026-10-13

  // ── State ──────────────────────────────────────────────────────────────────
  // Preferences and shared data come from chrome.storage.local; everything
  // below `shown` is this tab only.
  let settings = { ...DEFAULTS };
  let cache = {};        // verdicts, see shared.js cacheGet
  let channels = {};     // per-channel aggregates, see shared.js recordVerdict
  let blocked = {};      // { key: { ucid, handle, added } }
  let allowed = {};
  let breaker = null;    // { until, reason } while YouTube requests are paused
  let listSet = null;    // AiSList entries, only while the subscription is on
  let idx = null;        // lookup sets for shared.js decide()
  let ready = false;
  const dirty = { verdicts: new Set(), channels: new Set() }; // unsaved, merged on save
  const shown = new Set();  // videos the user chose to "show anyway"
  let peek = false;         // popup "reveal": dim view in this tab only

  const alive = () => { try { return !!chrome.runtime.id; } catch { return false; } };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function rebuildIndex() {
    const h2u = new Map(), u2h = new Map(), flagged = new Set();
    for (const [ucid, c] of Object.entries(channels)) {
      if (c.h) { h2u.set(c.h, ucid); u2h.set(ucid, c.h); }
      if (A.isAutoFlagged(c)) { flagged.add(ucid); if (c.h) flagged.add(c.h); }
    }
    const keys = (o) => {
      const s = new Set();
      for (const e of Object.values(o)) {
        if (e.ucid) s.add(e.ucid);
        if (e.handle) s.add(e.handle);
        if (e.ucid && e.handle) { h2u.set(e.handle, e.ucid); u2h.set(e.ucid, e.handle); }
      }
      return s;
    };
    idx = { h2u, u2h, flagged, block: keys(blocked), allow: keys(allowed), list: settings.aislist ? listSet : null };
  }

  function applyRoot() {
    const de = document.documentElement;
    de.classList.toggle('ailf-on', ready && settings.enabled);
    de.classList.toggle('ailf-dim', settings.mode === 'dim' || peek);
  }

  // ── Storage ────────────────────────────────────────────────────────────────
  const setList = (text) => {
    listSet = typeof text === 'string' && text ? new Set(text.split('\n')) : null;
  };

  async function load() {
    try {
      const got = await chrome.storage.local.get(['settings', 'verdicts', 'channels', 'blocked', 'allowed', 'breaker']);
      settings = { ...DEFAULTS, ...got.settings };
      cache = got.verdicts || {};
      channels = got.channels || {};
      blocked = got.blocked || {};
      allowed = got.allowed || {};
      breaker = got.breaker || null;
      if (settings.aislist) setList((await chrome.storage.local.get('aislistData')).aislistData);
      chrome.runtime.sendMessage({ action: 'aislist:maybeRefresh' }).catch(() => {});
    } catch (e) { log('load failed', e); }
    ready = true;
    rebuildIndex();
    applyRoot();
    checkNav();
  }

  // Keep entries this tab changed but has not saved yet.
  const keepDirty = (fresh, mine, ids) => {
    for (const id of ids) if (mine[id]) fresh[id] = mine[id];
    return fresh;
  };

  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local' || !ready) return;
    const wasEnabled = settings.enabled;
    if (ch.settings) settings = { ...DEFAULTS, ...ch.settings.newValue };
    if (ch.blocked) blocked = ch.blocked.newValue || {};
    if (ch.allowed) allowed = ch.allowed.newValue || {};
    if (ch.breaker) breaker = ch.breaker.newValue || null;
    if (ch.verdicts) cache = keepDirty(ch.verdicts.newValue || {}, cache, dirty.verdicts);
    if (ch.channels) channels = keepDirty(ch.channels.newValue || {}, channels, dirty.channels);
    if (ch.aislistData) setList(ch.aislistData.newValue);
    else if (ch.settings && settings.aislist && !listSet) {
      chrome.storage.local.get('aislistData').then((g) => { setList(g.aislistData); rebuildIndex(); scheduleScan(); }, () => {});
    }
    rebuildIndex();
    applyRoot();
    if (!settings.enabled) removeBanner();
    if (settings.enabled && !wasEnabled) { lastHref = null; checkNav(); }
    scheduleScan();
  });

  // Debounced. Re-reads storage and merges, so tabs don't overwrite each other.
  let saveTimer = 0;
  function scheduleSave() {
    if (!saveTimer) saveTimer = setTimeout(save, 3000);
  }

  async function save() {
    saveTimer = 0;
    if (!alive()) return;
    try {
      const got = await chrome.storage.local.get(['verdicts', 'channels']);
      const v = keepDirty(got.verdicts || {}, cache, dirty.verdicts);
      const c = got.channels || {};
      for (const u of dirty.channels) if (channels[u]) c[u] = A.mergeChannel(c[u], channels[u]);
      dirty.verdicts.clear();
      dirty.channels.clear();
      A.cachePrune(v, A.today());
      await chrome.storage.local.set({ verdicts: v, channels: c });
    } catch (e) { log('save failed', e); }
  }

  // ── The one request: masked InnerTube `next` ───────────────────────────────
  // clientVersion is read from the `ytcfg.set({...})` inline script that every
  // youtube.com page ships in its HTML. Script text is plain DOM, so the
  // isolated world can read it: no MAIN-world script, no page-JS hooks, no
  // window messaging. The value only changes on a full page load, so it is
  // read once per load. If it is missing we fall back to a known version;
  // InnerTube accepted a 16-month-old version when tested. (Technique from
  // Weedout for YouTube, MIT.)
  let clientVersion = null;
  function getClientVersion() {
    if (clientVersion) return clientVersion;
    try {
      for (const s of document.scripts) {
        if (s.src) continue;
        const m = /"INNERTUBE_CONTEXT_CLIENT_VERSION":"([\d.]+)"/.exec(s.textContent);
        if (m) { clientVersion = m[1]; break; }
      }
    } catch { /* fall through */ }
    return (clientVersion = clientVersion || FALLBACK_CLIENT_VERSION);
  }

  function request(videoId, masked) {
    const url = location.origin + '/youtubei/v1/next?prettyPrint=false' +
      (masked ? '&fields=' + encodeURIComponent(A.NEXT_FIELDS) : '');
    return fetch(url, {
      method: 'POST',
      credentials: 'omit',   // no cookies: same answer as a logged-out visitor
      redirect: 'manual',    // a redirect here means a block page, see shared.js
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: { client: { clientName: 'WEB', clientVersion: getClientVersion(), hl: 'en', gl: 'US' } },
        videoId,
      }),
    });
  }

  // One request at a time, for every caller (watch page, card lookups, self-check).
  let lock = Promise.resolve();
  function serial(fn) {
    const p = lock.then(fn, fn);
    lock = p.catch(() => {});
    return p;
  }

  // → parseNext() result, or null on any failure or while paused.
  // `record: false` is for the self-check, whose videos must not count
  // towards channel flags.
  const lookup = (videoId, record = true) => serial(async () => {
    if (!alive() || A.breakerOpen(breaker)) return null;
    try {
      let res = await request(videoId, true);
      // The mask is the most fragile part. If YouTube rejects it, retry once
      // unmasked; parseNext reads only the scoped paths either way.
      if (res.status === 400) res = await request(videoId, false);
      const body = await res.text();
      if (A.isBlockedResponse(res.status, res.type, body)) {
        await trip(res.type === 'opaqueredirect' ? 'redirect' : 'HTTP ' + res.status);
        return null;
      }
      if (!res.ok) return null;
      const info = A.parseNext(JSON.parse(body));
      if (record && info.ai !== null) remember(videoId, info);
      return info;
    } catch (e) {
      log('lookup failed', videoId, e);
      return null;
    }
  });

  async function trip(reason) {
    breaker = A.breakerTrip(reason);
    queue.length = 0;
    try { await chrome.storage.local.set({ breaker }); } catch { /* still paused in this tab */ }
  }

  function remember(videoId, info) {
    A.cachePut(cache, videoId, info.ai, A.today(), info);
    dirty.verdicts.add(videoId);
    if (info.ucid) {
      A.recordVerdict(channels, info.ucid, info.handle, videoId, info.ai);
      dirty.channels.add(info.ucid);
    }
    rebuildIndex();
    scheduleSave();
    scheduleScan();
  }

  // ── Feed cards (Tier 1, no requests) ───────────────────────────────────────
  const REASON_TEXT = {
    label: () => 'YouTube AI label',
    blocked: () => 'Your blocklist',
    aislist: () => 'Listed in AiSList',
    channel: (ch) => {
      const ucid = A.channelKeys(ch, idx).find(A.isUcid);
      const n = (ucid && channels[ucid] && channels[ucid].ai.length) || A.AUTOFLAG_MIN_AI;
      return `Channel: ${n} labelled videos`;
    },
  };

  function cardChannel(card) {
    const a = card.querySelector(CHANNEL_LINK_SEL);
    return a ? A.channelFromHref(a.getAttribute('href')) : null;
  }

  function makeChip() {
    const chip = document.createElement('div');
    chip.className = 'ailf-chip';
    chip.innerHTML = '<span></span><button type="button" data-act="show">Show</button>' +
      '<button type="button" data-act="allow">Allow channel</button>';
    return chip;
  }

  function unmark(card, keepVid) {
    if (card.hasAttribute('data-ailf')) card.removeAttribute('data-ailf');
    const chip = card.querySelector(':scope > .ailf-chip');
    if (chip) chip.remove();
    if (!keepVid) card.removeAttribute('data-ailf-vid');
  }

  function mark(card, reason, ch) {
    if (card.dataset.ailf !== reason) card.dataset.ailf = reason;
    let chip = card.querySelector(':scope > .ailf-chip');
    if (!chip) card.append(chip = makeChip());
    const text = REASON_TEXT[reason](ch);
    if (chip.firstChild.textContent !== text) chip.firstChild.textContent = text;
    chip.lastChild.hidden = !ch;
  }

  // YouTube recycles card nodes for different videos, so every scan re-reads
  // the card's current video id and starts over when it changed.
  function judge(card, day) {
    const link = card.querySelector(VIDEO_LINK_SEL);
    const vid = link ? A.videoIdFromHref(link.getAttribute('href')) : null;
    if ((card.dataset.ailfVid || null) !== vid) {
      unmark(card);
      if (observed.has(card)) { io.unobserve(card); observed.delete(card); }
      if (!vid) return;
      card.dataset.ailfVid = vid;
    }
    if (!vid) return;
    const ch = cardChannel(card);
    const ai = A.cacheGet(cache, vid, day);
    if (ai !== null && cache[vid][2] !== day) { cache[vid][2] = day; dirty.verdicts.add(vid); scheduleSave(); }
    const reason = settings.enabled && !shown.has(vid) ? A.decide(ai, ch, idx) : null;
    if (reason) mark(card, reason, ch);
    else {
      unmark(card, true);
      if (ai === null && wantLookups() && !observed.has(card)) { observed.add(card); io.observe(card); }
    }
  }

  let scanQueued = false;
  function scheduleScan() {
    if (!scanQueued) { scanQueued = true; setTimeout(scan, 200); }
  }

  function scan() {
    scanQueued = false;
    if (!alive()) return shutdown();
    if (!ready) return;
    checkNav();
    const cards = new Set(document.querySelectorAll('[data-ailf-vid]'));
    for (const a of document.querySelectorAll(VIDEO_LINK_SEL)) {
      let card = a.closest(CARD_SEL);
      while (card && card.parentElement) {
        const outer = card.parentElement.closest(CARD_SEL);
        if (!outer) break;
        card = outer;
      }
      if (card) cards.add(card);
    }
    const day = A.today();
    for (const card of cards) {
      try { judge(card, day); } catch (e) { log('judge failed', e); unmark(card); }
    }
  }

  // ── Per-card lookups (Tier 2, off by default) ──────────────────────────────
  // Only cards that are on screen and still unknown; one request at a time,
  // at least 1 s apart plus jitter; each video tried once per tab.
  const io = new IntersectionObserver(onIntersect, { rootMargin: '200px 0px' });
  const observed = new WeakSet();
  const queue = [];
  const tried = new Set();
  let pumping = false;

  const wantLookups = () => settings.enabled && settings.lookups && !A.breakerOpen(breaker);

  function onIntersect(entries) {
    if (!wantLookups()) return;
    const day = A.today();
    for (const e of entries) {
      const vid = e.target.dataset.ailfVid;
      if (!e.isIntersecting || !vid || tried.has(vid) || A.cacheGet(cache, vid, day) !== null) continue;
      tried.add(vid);
      queue.push(vid);
      if (queue.length > 30) tried.delete(queue.shift()); // scrolled past long ago
    }
    pump();
  }

  async function pump() {
    if (pumping) return;
    pumping = true;
    try {
      while (queue.length && wantLookups()) {
        const vid = queue.shift();
        if (A.cacheGet(cache, vid, A.today()) !== null) continue;
        await lookup(vid);
        await sleep(1000 + Math.random() * 1000);
      }
    } finally { pumping = false; }
  }

  // ── Watch page (Tier 0): one request per video ─────────────────────────────
  const currentVideoId = () => (location.pathname === '/watch' ? A.videoIdFromHref(location.search) : null);
  let lastHref = null;
  let navGen = 0;

  // Called on yt-navigate-finish and from every scan, so a missed event is caught.
  function checkNav() {
    if (!ready || location.href === lastHref) return;
    lastHref = location.href;
    onNavigate();
  }

  async function onNavigate() {
    const gen = ++navGen;
    removeBanner();
    scheduleScan();
    if (!settings.enabled) return;
    maybeSelfCheck();
    const vid = currentVideoId();
    if (!vid) return;
    let ai = A.cacheGet(cache, vid, A.today());
    let owner = A.cacheOwner(cache, vid);
    if (ai === null) {
      const info = await lookup(vid);
      if (!info) return;
      ai = info.ai;
      owner = (info.ucid || info.handle) ? info : null;
    }
    if (ai === true && gen === navGen && settings.enabled) showBanner(owner);
  }

  function removeBanner() {
    const b = document.getElementById('ailf-banner');
    if (b) b.remove();
  }

  function showBanner(owner) {
    removeBanner();
    const keys = A.channelKeys(owner, idx);
    if (keys.some((k) => idx.allow.has(k))) return;
    const el = document.createElement('div');
    el.id = 'ailf-banner';
    el.setAttribute('role', 'status');
    el.innerHTML = '<span>YouTube labels this video as made with AI</span>' +
      '<button type="button" data-act="block">Hide this channel</button>' +
      '<button type="button" data-act="dismiss">Dismiss</button>';
    el.querySelector('[data-act="block"]').hidden = !keys.length || keys.some((k) => idx.block.has(k));
    el.ailfOwner = owner;
    (document.body || document.documentElement).append(el);
  }

  // ── Blocklist / allowlist ──────────────────────────────────────────────────
  // Adding a channel to one list removes it from the other.
  async function addChannel(listKey, ch) {
    const keys = A.channelKeys(ch, idx);
    const ucid = keys.find(A.isUcid) || null;
    const handle = keys.find((k) => !A.isUcid(k)) || null;
    if (!ucid && !handle) return;
    const otherKey = listKey === 'blocked' ? 'allowed' : 'blocked';
    try {
      const got = await chrome.storage.local.get([listKey, otherKey]);
      const list = got[listKey] || {}, other = got[otherKey] || {};
      for (const [k, e] of Object.entries(other)) {
        if ((ucid && e.ucid === ucid) || (handle && e.handle === handle)) delete other[k];
      }
      list[ucid || '@' + handle] = { ucid, handle, added: Date.now() };
      await chrome.storage.local.set({ [listKey]: list, [otherKey]: other });
    } catch (e) { log('list update failed', e); }
  }

  // Clicks on our chip and banner. Capture phase, so the card underneath
  // never sees the click (it would open the video).
  document.addEventListener('click', (e) => {
    const btn = e.target instanceof Element && e.target.closest('.ailf-chip button, #ailf-banner button');
    if (!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const act = btn.dataset.act;
    if (act === 'dismiss') return removeBanner();
    if (act === 'block') { addChannel('blocked', btn.parentElement.ailfOwner); return removeBanner(); }
    const card = btn.closest('[data-ailf-vid]');
    if (!card) return;
    if (act === 'show') shown.add(card.dataset.ailfVid);
    if (act === 'allow') addChannel('allowed', cardChannel(card));
    judge(card, A.today());
  }, true);

  // ── Self-check: is label detection still working? ──────────────────────────
  // Once a day per browser (not per tab), only while requests are allowed.
  async function maybeSelfCheck() {
    try {
      const { selfcheck } = await chrome.storage.local.get('selfcheck');
      if (A.breakerOpen(breaker) || (selfcheck && Date.now() - selfcheck.at < A.DAY)) return;
      // Claim today's run first so other tabs skip it.
      await chrome.storage.local.set({ selfcheck: { at: Date.now(), ok: selfcheck ? selfcheck.ok : null } });
      let ok = null;
      for (const id of A.CANARY_IDS) {
        const info = await lookup(id, false);
        if (!info) { ok = null; break; }      // network error or paused: unknown
        ok = info.ai === true;
        if (ok) break;
        await sleep(1500);
      }
      await chrome.storage.local.set({ selfcheck: { at: Date.now(), ok } });
    } catch (e) { log('self-check failed', e); }
  }

  // ── Popup ──────────────────────────────────────────────────────────────────
  // The popup asks us instead of needing the `tabs` permission.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return;
    if (msg.action === 'peek') { peek = !!msg.on; applyRoot(); }
    if (msg.action === 'status' || msg.action === 'peek') {
      const counts = {};
      for (const el of document.querySelectorAll('[data-ailf]')) counts[el.dataset.ailf] = (counts[el.dataset.ailf] || 0) + 1;
      sendResponse({ onYouTube: true, counts, peek });
    }
  });

  // ── Boot ───────────────────────────────────────────────────────────────────
  // Extension reloaded or removed while the tab stays open: stop and show everything.
  function shutdown() {
    mo.disconnect();
    io.disconnect();
    document.documentElement.classList.remove('ailf-on', 'ailf-dim');
    removeBanner();
  }

  const mo = new MutationObserver(scheduleScan);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('yt-navigate-finish', () => { checkNav(); scheduleScan(); });
  load();
})();
