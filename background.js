// Service worker: only the opt-in AiSList subscription lives here. YouTube is
// never contacted from here (InnerTube answers 403 to extension origins);
// all YouTube requests are made by content.js from the youtube.com page.
importScripts('shared.js');

const A = globalThis.AILF;
const RAW_ORIGIN = 'https://raw.githubusercontent.com/*';
const MAX_BYTES = 5 * 1024 * 1024; // the list is ~0.5 MB; refuse anything absurd

// Download, parse and store the list. At most once per 24 h unless `force`
// (the popup's "Turn on" / "Refresh now"). On failure the last good copy stays.
// Calls run one after another, never in parallel.
let chain = Promise.resolve();
function refresh(force) {
  const run = () => doRefresh(force);
  return (chain = chain.then(run, run));
}

async function doRefresh(force) {
  const { settings, aislistMeta: meta = {} } = await chrome.storage.local.get(['settings', 'aislistMeta']);
  if (!settings || !settings.aislist) return;
  if (!(await chrome.permissions.contains({ origins: [RAW_ORIGIN] }))) return;
  const since = Date.now() - (meta.attemptedAt || 0);
  if (since < (force ? 10000 : A.DAY)) return; // forced: just skip double clicks

  const next = { ...meta, attemptedAt: Date.now(), error: null };
  try {
    const res = await fetch(A.AISLIST_URL, {
      cache: 'no-store',
      credentials: 'omit',
      headers: !force && meta.etag ? { 'If-None-Match': meta.etag } : {},
    });
    if (res.status === 304) {
      // 304 but no stored copy (the list was turned off and on during this
      // request): not a success. Drop the ETag and allow the next refresh at
      // once, so it downloads the list in full.
      const { aislistData } = await chrome.storage.local.get('aislistData');
      if (!aislistData) {
        delete next.etag;
        delete next.fetchedAt;
        delete next.count;
        next.attemptedAt = 0;
        throw new Error('no stored copy of the list');
      }
      next.fetchedAt = Date.now();
    } else if (!res.ok) {
      throw new Error('HTTP ' + res.status);
    } else {
      const text = await res.text();
      if (text.length > MAX_BYTES) throw new Error('list too large');
      const entries = A.parseList(text);
      if (!entries.length) throw new Error('no entries found');
      Object.assign(next, { etag: res.headers.get('ETag'), fetchedAt: Date.now(), count: entries.length });
      // One newline-joined string (~0.5 MB) instead of an array: compact, and
      // well under chrome.storage.local's quota (10 MB; 5 MB before Chrome
      // 114), so no unlimitedStorage.
      await chrome.storage.local.set({ aislistData: entries.join('\n') });
    }
  } catch (e) {
    next.error = String(e && e.message || e);
  }
  // The user may have turned the list off while we were downloading.
  const { settings: now } = await chrome.storage.local.get('settings');
  if (now && now.aislist) await chrome.storage.local.set({ aislistMeta: next });
  else await chrome.storage.local.remove(['aislistData', 'aislistMeta']);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || (msg.action !== 'aislist:maybeRefresh' && msg.action !== 'aislist:refresh')) return;
  refresh(msg.action === 'aislist:refresh').then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
  return true; // async response
});

// Permission granted or revoked (popup, or chrome://extensions). Handled here
// because the popup may close while Chrome shows the permission prompt.
async function setListEnabled(on) {
  const { settings = {} } = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({ settings: { ...settings, aislist: on, onboarded: true } });
  if (on) await refresh(true);
  else await chrome.storage.local.remove(['aislistData', 'aislistMeta']);
}

const isRaw = (p) => (p.origins || []).includes(RAW_ORIGIN);
chrome.permissions.onAdded.addListener((p) => { if (isRaw(p)) setListEnabled(true).catch(() => {}); });
chrome.permissions.onRemoved.addListener((p) => { if (isRaw(p)) setListEnabled(false).catch(() => {}); });

// First install only (not updates): open the welcome page, which offers the
// AiSList switch. tabs.create needs no permission.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.tabs.create({ url: 'welcome.html' }).catch(() => {});
});

chrome.runtime.onStartup.addListener(() => { refresh(false).catch(() => {}); });
