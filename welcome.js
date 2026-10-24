// Welcome page, opened once on first install (background.js). Offers the
// AiSList switch (same path as the popup, see listswitch.js) and card lookups.
// Defaults are not changed here; only the user's clicks change settings.
const L = globalThis.AILF_LIST;

// Every user-visible string on this page.
const TEXT = {
  title: 'AI Label Filter is installed',
  intro: 'Right now it only acts on videos it already knows about, so your feed looks the same as before.',
  expect: 'The community list below helps most on topics with lots of AI uploads, such as AI music, lofi, ' +
    'jazz and history narration. On a personalised home feed it may change little.',
  listHeading: 'Community list (optional)',
  listBody: 'Filter channels listed in AiSList, a community-maintained list of channels that post AI videos. ' +
    'By default, videos from listed channels are dimmed and show why.',
  creditBefore: 'List by ',
  creditLink: 'Override92/AiSList',
  creditAfter: ' (CC BY-NC 4.0). It has a review process for channels listed by mistake.',
  listPrivacy: 'The list downloads from raw.githubusercontent.com once a day. Chrome will ask for permission. ' +
    'No data about you is sent.',
  listOn: 'Turn on AiSList',
  listLater: 'Not now',
  lookupsLabel: 'Check every visible video',
  lookupsCost: 'Optional. Reads the YouTube label of each video you scroll past by sending one request to YouTube ' +
    'at a time, at most one per second. YouTube labels only a small share of AI videos.',
  later: 'You can change both later from the extension’s toolbar icon.',
  // Status lines under the list buttons.
  denied: 'Chrome did not grant access, so the list is off.',
  skipped: 'The list stays off.',
  downloading: 'AiSList is on. Downloading the list…',
  ready: (n) => `AiSList is on: ${n.toLocaleString()} channels.`,
  failed: (why) => `AiSList is on, but the download failed (${why}). It will try again later.`,
};

const $ = (id) => document.getElementById(id);
for (const el of document.querySelectorAll('[data-t]')) el.textContent = TEXT[el.dataset.t];

let note = null; // 'denied' | 'skipped', shown while the list is off

async function render() {
  const { settings = {}, aislistMeta: meta = {} } = await chrome.storage.local.get(['settings', 'aislistMeta']);
  $('lookups').checked = !!settings.lookups;
  const on = !!settings.aislist;
  $('list-actions').hidden = on;
  const status = on
    ? (meta.error ? TEXT.failed(meta.error) : meta.fetchedAt ? TEXT.ready(meta.count || 0) : TEXT.downloading)
    : note ? TEXT[note] : '';
  $('list-status').textContent = status;
  $('list-status').hidden = !status;
}

$('list-on').addEventListener('click', async () => {
  note = (await L.turnOn()) ? null : 'denied';
  render();
});
// Same as the popup's "Not now": the popup stops offering the list.
$('list-later').addEventListener('click', async () => {
  note = 'skipped';
  await L.patchSettings({ onboarded: true });
  render();
});
$('lookups').addEventListener('change', (e) => L.patchSettings({ lookups: e.target.checked }));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && ('settings' in changes || 'aislistMeta' in changes)) render();
});

render();
