// Popup. Reads and writes chrome.storage.local directly; content.js and
// background.js react to storage changes. The page counts come from asking the
// active tab's content script, so no `tabs` permission is needed.
const A = globalThis.AILF;
const RAW_ORIGIN = 'https://raw.githubusercontent.com/*';
const DEFAULTS = { enabled: true, mode: 'hide', lookups: false, aislist: false, onboarded: false };
const REASONS = {
  label: 'YouTube AI label',
  channel: 'Channel with 2+ labelled videos',
  blocked: 'Your hidden channels',
  aislist: 'Listed in AiSList',
};
const KEYS = ['settings', 'blocked', 'allowed', 'channels', 'breaker', 'selfcheck', 'aislistMeta'];

const $ = (id) => document.getElementById(id);
let settings = { ...DEFAULTS };
let peek = false;

async function saveSettings(patch) {
  settings = { ...settings, ...patch };
  await chrome.storage.local.set({ settings });
}

// A rejected message means no content script, i.e. the tab isn't YouTube.
async function ask(msg) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab ? await chrome.tabs.sendMessage(tab.id, msg) : null;
  } catch {
    return null;
  }
}

function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 2880) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} days ago`;
}

function renderPage(res) {
  if (!res) return;
  peek = !!res.peek;
  const parts = Object.keys(REASONS).filter((r) => res.counts[r]).map((r) => `${REASONS[r]}: ${res.counts[r]}`);
  $('counts').textContent = !settings.enabled ? 'Filtering is off.'
    : parts.length ? parts.join(' · ') : 'Nothing filtered on this page.';
  // Auto-flagged channels are dimmed, never hidden: nothing to reveal for those.
  $('peek-row').hidden = !settings.enabled || settings.mode !== 'hide' ||
    !Object.keys(REASONS).some((r) => r !== 'channel' && res.counts[r]);
  $('peek').textContent = peek ? 'Hide again' : 'Reveal';
}

function renderChannels(listKey, list) {
  const ul = $(listKey);
  ul.replaceChildren();
  const entries = Object.entries(list || {}).sort((a, b) => (b[1].added || 0) - (a[1].added || 0));
  for (const [, e] of entries) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = e.handle ? `https://www.youtube.com/@${encodeURIComponent(e.handle)}`
      : `https://www.youtube.com/channel/${e.ucid}`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = e.handle ? '@' + e.handle : e.ucid;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Remove';
    // Removes every entry for this channel (handle or UC id), see shared.js.
    btn.addEventListener('click', async () => {
      const got = await chrome.storage.local.get(['channels', 'blocked', 'allowed']);
      const idx = A.buildIndex(got.channels, got.blocked, got.allowed);
      await chrome.storage.local.set({ [listKey]: A.listDrop(got[listKey] || {}, e, idx) });
    });
    li.append(a, btn);
    ul.append(li);
  }
  $(listKey + '-empty').hidden = entries.length > 0;
}

async function render() {
  const got = await chrome.storage.local.get(KEYS);
  settings = { ...DEFAULTS, ...got.settings };

  $('enabled').checked = settings.enabled;
  for (const r of document.querySelectorAll('input[name="mode"]')) r.checked = r.value === settings.mode;
  $('lookups').checked = settings.lookups;
  $('aislist').checked = settings.aislist;

  const paused = A.breakerOpen(got.breaker);
  $('paused').hidden = !paused;
  if (paused) {
    const b = got.breaker;
    $('paused').textContent = (b.n ? `YouTube refused a request (${b.reason}), so requests are paused until `
      : `YouTube pushed back (${b.reason}), so all requests are paused until `) +
      `${new Date(b.until).toLocaleString()}. Labels already seen still apply.`;
  }
  const check = got.selfcheck && got.selfcheck.state;
  $('broken').hidden = check !== 'broken' && check !== 'error';
  $('broken-why').textContent = check === 'error'
    ? 'YouTube refused the daily label check, so labels may not be read right now.'
    : 'Label detection may be broken (YouTube may have changed something).';

  $('onboarding').hidden = settings.onboarded || settings.aislist;
  const meta = got.aislistMeta || {};
  $('list-info').hidden = !settings.aislist;
  $('list-status').textContent = meta.error ? `Download failed: ${meta.error}.`
    : meta.fetchedAt ? `${(meta.count || 0).toLocaleString()} channels, updated ${ago(meta.fetchedAt)}.`
    : 'Downloading…';

  renderChannels('blocked', got.blocked);
  renderChannels('allowed', got.allowed);
  const flagged = Object.values(got.channels || {}).filter(A.isAutoFlagged).length;
  $('flagged').textContent = flagged
    ? `${flagged} channel${flagged > 1 ? 's' : ''} dimmed for having 2+ AI-labelled videos.` : '';

  renderPage(await ask({ action: 'status' }));
}

// Must run inside the click handler: Chrome only shows the permission prompt
// for a user gesture. background.js finishes the job if the popup closes.
async function turnListOn() {
  let granted = false;
  try { granted = await chrome.permissions.request({ origins: [RAW_ORIGIN] }); } catch { /* denied */ }
  if (!granted) { $('aislist').checked = false; return; }
  await saveSettings({ aislist: true, onboarded: true });
  chrome.runtime.sendMessage({ action: 'aislist:refresh' }).catch(() => {});
}

async function turnListOff() {
  await saveSettings({ aislist: false });
  await chrome.storage.local.remove(['aislistData', 'aislistMeta']);
  chrome.permissions.remove({ origins: [RAW_ORIGIN] }).catch(() => {});
}

$('enabled').addEventListener('change', (e) => saveSettings({ enabled: e.target.checked }));
$('lookups').addEventListener('change', (e) => saveSettings({ lookups: e.target.checked }));
for (const r of document.querySelectorAll('input[name="mode"]')) {
  r.addEventListener('change', () => saveSettings({ mode: r.value }));
}
$('aislist').addEventListener('change', (e) => (e.target.checked ? turnListOn() : turnListOff()));
$('list-on').addEventListener('click', turnListOn);
$('list-later').addEventListener('click', () => saveSettings({ onboarded: true }));
$('list-refresh').addEventListener('click', () => {
  $('list-status').textContent = 'Downloading…';
  chrome.runtime.sendMessage({ action: 'aislist:refresh' }).catch(() => {});
});
$('peek').addEventListener('click', async () => renderPage(await ask({ action: 'peek', on: !peek })));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && KEYS.some((k) => k in changes)) render();
});

render();
