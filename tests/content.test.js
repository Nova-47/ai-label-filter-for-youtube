// content.js end to end, in tests/harness.js (fake chrome.*, DOM, fetch and
// clock; no network).
const test = require('node:test');
const assert = require('node:assert/strict');
const { browser, fixture, reply } = require('./harness');

const LABELLED = 'yHG-pivADos';
const U = 'UCp1mMtCnO_11BC4dbGv4BSA';
const watch = (id) => 'https://www.youtube.com/watch?v=' + id;

test('watch page: one masked lookup → banner → verdict and channel saved', async () => {
  const b = browser({ respond: () => reply(200, fixture('labelled-yHG-pivADos.json')) });
  b.store.selfcheck = { at: b.now() };                   // today's self-check already done
  const t = b.tab(watch(LABELLED));
  await b.run(5000);
  assert.equal(b.requests.length, 1);
  assert.equal(b.requests[0].masked, true);
  assert.equal(b.requests[0].credentials, 'omit');
  assert.equal(b.requests[0].videoId, LABELLED);
  assert.ok(t.banner(), 'banner shown');
  assert.ok(t.html.classList.contains('ailf-on'));
  const v = b.store.verdicts[LABELLED];
  assert.deepEqual([v[0], v[3], v[4]], [1, U, 'eigi_and_ai']);
  assert.equal(b.store.channels[U].h, 'eigi_and_ai');
  assert.deepEqual(b.store.channels[U].ai, [LABELLED]);
  t.navigate(watch(LABELLED) + '&t=5');                   // cached now: no new request
  await b.run(5000);
  assert.equal(b.requests.length, 1);
});

// Review E7: two tabs with card lookups on, each with its own queue.
test('requests: one at a time and ≥ 1 s apart across tabs', async () => {
  const b = browser();
  Object.assign(b.store, { selfcheck: { at: b.now() }, settings: { lookups: true } });
  const tabs = ['a', 'b'].map((p) => {
    const t = b.tab('https://www.youtube.com/');
    return { t, cards: [1, 2, 3, 4, 5].map((i) => t.addCard((p + i).padEnd(11, 'x'))) };
  });
  await b.run(1000);
  for (const { t, cards } of tabs) t.intersect(cards, true);
  await b.run(30000);
  assert.equal(b.requests.length, 10);
  assert.equal(b.maxInflight, 1);
  const at = b.requests.map((r) => r.at);
  for (let i = 1; i < at.length; i++) assert.ok(at[i] - at[i - 1] >= 1000, `gap ${at[i] - at[i - 1]} ms`);
});

test('requests: a watch page left before its turn is not looked up', async () => {
  const b = browser();
  b.store.selfcheck = { at: b.now() };
  const t = b.tab(watch('aaaaaaaaaaa'));
  await b.run(50);                                  // a's request is out, the lock held
  t.navigate(watch('bbbbbbbbbbb'));                 // b waits for the lock...
  await b.run(50);
  t.navigate(watch('ccccccccccc'));                 // ...and is left before its turn
  await b.run(10000);
  assert.deepEqual(b.requests.map((r) => r.videoId), ['aaaaaaaaaaa', 'ccccccccccc']);
});

test('requests: a block in one tab stops the request already queued in another', async () => {
  const b = browser({ respond: () => reply(429), eventMs: 2000 }); // even if onChanged is late
  b.store.selfcheck = { at: b.now() };
  b.tab(watch('aaaaaaaaaaa'));
  b.tab(watch('bbbbbbbbbbb'));
  await b.run(10000);
  assert.equal(b.requests.length, 1);
  assert.equal(b.store.breaker.reason, 'HTTP 429');
});

// Review N5: a reply that never comes must not hold the lock for good.
test('requests: a hung request times out after 10 s and frees the lock', async () => {
  const b = browser({ respond: (r) => (r.videoId === 'aaaaaaaaaaa' ? null : reply(200, fixture('normal-dQw4w9WgXcQ.json'))) });
  b.store.selfcheck = { at: b.now() };
  b.tab(watch('aaaaaaaaaaa'));
  await b.run(50);
  b.tab(watch('bbbbbbbbbbb'));                      // waits for the lock
  await b.run(30000);
  assert.deepEqual(b.requests.map((r) => r.videoId), ['aaaaaaaaaaa', 'bbbbbbbbbbb']);
  assert.equal(b.requests[1].at - b.requests[0].at, 10000 + 1000); // timeout, then the 1 s gap
  assert.equal('breaker' in b.store, false);        // no reply is not a refusal
  assert.ok(b.store.verdicts.bbbbbbbbbbb);
});

// Review E2: the mask rejected used to cost two requests per video, the
// second one ~400 KB.
test('requests: a rejected mask is remembered, never retried unmasked, and backs off', async () => {
  let status = 400;
  const b = browser({ respond: () => reply(status, status === 200 ? fixture('normal-dQw4w9WgXcQ.json') : '{"error":{}}') });
  b.store.selfcheck = { at: b.now() };
  const t = b.tab(watch('aaaaaaaaaaa'));
  await b.run(3000);
  t.navigate(watch('bbbbbbbbbbb'));
  await b.run(3000);
  t.navigate(watch('ccccccccccc'));
  await b.run(3000);
  assert.equal(b.requests.length, 1);
  assert.ok(b.requests.every((r) => r.masked));
  assert.equal(b.store.breaker.reason, 'HTTP 400');
  assert.equal(b.store.breaker.n, 1);
  assert.equal(b.store.breaker.until, b.requests[0].at + 100 + 15 * 60000);
  await b.run(15 * 60000);                     // pause over: one masked try, still refused
  t.navigate(watch('ddddddddddd'));
  await b.run(3000);
  assert.equal(b.requests.length, 2);
  assert.equal(b.store.breaker.n, 2);           // next pause 30 min
  await b.run(30 * 60000);
  status = 200;
  t.navigate(watch('eeeeeeeeeee'));
  await b.run(3000);
  assert.equal(b.requests.length, 3);
  assert.equal('breaker' in b.store, false);    // a good reply clears it
  assert.ok(b.requests.every((r) => r.masked));
});

// Review E1: the fallback version used to stick for the whole page load.
test('requests: clientVersion is read from the page once its script is there', async () => {
  const b = browser();
  b.store.selfcheck = { at: b.now() };
  const t = b.tab(watch('aaaaaaaaaaa'));
  await b.run(3000);
  t.document.scripts.push({ src: '', textContent: 'ytcfg.set({"INNERTUBE_CONTEXT_CLIENT_VERSION":"2.20990101.00.00"});' });
  t.navigate(watch('bbbbbbbbbbb'));
  await b.run(3000);
  assert.deepEqual(b.requests.map((r) => r.clientVersion), ['2.20261012.01.00', '2.20990101.00.00']);
});

// Review E6: scroll through 8 screens of 6 cards, half a second each, then
// stop. The cards on the last screen used to wait for 27 stale lookups.
test('card lookups: on-screen cards first, scrolled-away cards dropped', async () => {
  const b = browser();
  Object.assign(b.store, { selfcheck: { at: b.now() }, settings: { lookups: true } });
  const t = b.tab('https://www.youtube.com/');
  const screens = [...Array(8)].map((_, s) => [...Array(6)].map((_, i) => t.addCard(`s${s}card${i}`.padEnd(11, 'x'))));
  await b.run(1000);                              // load + first scan: all cards observed
  assert.equal(t.io.targets.size, 48);
  for (let s = 0; s < 8; s++) {
    t.intersect(screens[s], true);
    if (s) t.intersect(screens[s - 1], false);
    await b.run(500);
  }
  const stop = b.now();
  const last = new Set(screens[7].map((c) => c.dataset.ailfVid));
  await b.run(30000);
  const after = b.requests.filter((r) => r.at >= stop);
  assert.ok(after.length && after.every((r) => last.has(r.videoId)), 'only the screen in view');
  assert.ok(after[0].at - stop <= 3000, `first after stop: ${after[0].at - stop} ms`);
  assert.equal(b.requests.filter((r) => last.has(r.videoId)).length, 6);
  assert.ok(b.requests.length <= 6 + 4, `${b.requests.length} requests`);
});

test('card lookups: nothing while the tab is in the background', async () => {
  const b = browser();
  Object.assign(b.store, { selfcheck: { at: b.now() }, settings: { lookups: true } });
  const t = b.tab('https://www.youtube.com/');
  const cards = [1, 2, 3].map((i) => t.addCard(('bg' + i).padEnd(11, 'x')));
  await b.run(1000);
  t.visibility(true);
  t.intersect(cards, true);
  await b.run(10000);
  assert.equal(b.requests.length, 0);
  t.visibility(false);
  await b.run(10000);
  assert.equal(b.requests.length, 3);
});

// Review E3: three tabs restored at once used to run the check three times.
test('self-check: one run per day across tabs; first labelled canary ends it', async () => {
  const b = browser({ respond: (r) => reply(200, fixture(r.videoId === LABELLED ? 'labelled-yHG-pivADos.json' : 'normal-dQw4w9WgXcQ.json')) });
  for (let i = 0; i < 3; i++) b.tab('https://www.youtube.com/');
  await b.run(10000);
  assert.deepEqual(b.requests.map((r) => r.videoId), [LABELLED]);
  assert.equal(b.store.selfcheck.state, 'ok');
  assert.equal('channels' in b.store, false);           // canaries never count towards flags
  b.tab('https://www.youtube.com/');                    // same day: skipped
  await b.run(10000);
  assert.equal(b.requests.length, 1);
  await b.run(24 * 3600000);
  b.tab('https://www.youtube.com/');                    // next day: runs again
  await b.run(10000);
  assert.equal(b.requests.length, 2);
});

// Review E4 and M2: a refused request used to end as "unknown" (no warning),
// one canary gone as "broken" (false warning). Review N1: nothing readable
// (a changed reply shape) used to end as "missing" (no warning).
test('self-check: HTTP 400 and unreadable labels warn, one canary gone does not', async () => {
  const run = async (respond) => {
    const b = browser({ respond });
    b.tab('https://www.youtube.com/');
    await b.run(10000);
    return [b.store.selfcheck.state, b.requests.length];
  };
  const renamed = fixture('labelled-yHG-pivADos.json').replaceAll('videoPrimaryInfoRenderer', 'videoPrimaryInfoRendererV2');
  assert.deepEqual(await run(() => reply(400, '{"error":{}}')), ['error', 1]);
  assert.deepEqual(await run(() => reply(200, '{}')), ['broken', 2]);
  assert.deepEqual(await run(() => reply(200, renamed)), ['broken', 2]);  // owner reads, label can't (review X2)
  assert.deepEqual(await run((r) => reply(200, r.videoId === LABELLED ? '{}' : fixture('normal-dQw4w9WgXcQ.json'))), ['missing', 2]);
  assert.deepEqual(await run(() => reply(200, fixture('normal-dQw4w9WgXcQ.json'))), ['broken', 2]);
  assert.deepEqual(await run(() => new Error('offline')), ['unknown', 1]);
});

// Review N2: opened on a watch page, the canary queued behind the page's own
// request; that one was refused, so the canary was never sent, yet the day's
// run was used up as "unknown".
test('self-check: a run paused before it could send is given back', async () => {
  const b = browser({ respond: () => reply(400, '{"error":{}}') });
  const t = b.tab(watch('aaaaaaaaaaa'));
  await b.run(10000);
  assert.deepEqual(b.requests.map((r) => r.videoId), ['aaaaaaaaaaa']);  // the canary was not sent
  assert.equal('selfcheck' in b.store, false);                          // and the run not used up
  await b.run(15 * 60000);                                              // back-off over
  t.navigate('https://www.youtube.com/');
  await b.run(10000);
  assert.deepEqual(b.requests.map((r) => r.videoId), ['aaaaaaaaaaa', LABELLED]);
  assert.equal(b.store.selfcheck.state, 'error');
});

// Review N3: one 503 on the canary used to leave the warning up for a day
// after later replies were fine.
test('self-check: a "refused" warning clears on the next good reply', async () => {
  let n = 0;
  const b = browser({ respond: () => (n++ ? reply(200, fixture('normal-dQw4w9WgXcQ.json')) : reply(503)) });
  const t = b.tab('https://www.youtube.com/');
  await b.run(10000);
  const at = b.store.selfcheck.at;
  assert.equal(b.store.selfcheck.state, 'error');
  await b.run(16 * 60000);
  t.navigate(watch('aaaaaaaaaaa'));
  await b.run(10000);
  assert.deepEqual(b.requests.map((r) => r.videoId), [LABELLED, 'aaaaaaaaaaa']);  // the check does not rerun
  assert.equal('breaker' in b.store, false);
  assert.deepEqual(b.store.selfcheck, { at });
});

// Review E5: two tabs saving at about the same time; one tab's verdict and
// channel used to be overwritten by the other's write.
test('saving: two tabs saving at once both keep their verdicts', async () => {
  const b = browser({
    setLatency: 1500,                                   // a slow write widens the window
    respond: (r) => reply(200, fixture(r.videoId === 'dQw4w9WgXcQ' ? 'normal-dQw4w9WgXcQ.json' : 'autodubbed-nG8aoy69iIo.json')),
  });
  b.store.selfcheck = { at: b.now() };
  b.tab(watch('dQw4w9WgXcQ'));
  b.tab(watch('nG8aoy69iIo'));
  await b.run(30000);
  assert.deepEqual(Object.keys(b.store.verdicts).sort(), ['dQw4w9WgXcQ', 'nG8aoy69iIo']);
  assert.deepEqual(Object.keys(b.store.channels).sort(), ['UC8F8MJyWevV2EzzLxZnSRLg', 'UCuAXFkgsw1L7xaCfnd5JJOw']);
});

test('saving: seen-day updates alone write nothing; only changed keys are written', async () => {
  const NO_OWNER = '{"contents":{"twoColumnWatchNextResults":{"results":{"results":{"contents":[{"videoPrimaryInfoRenderer":{}}]}}}}}';
  const b = browser({ respond: (r) => reply(200, r.videoId === 'dQw4w9WgXcQ' ? fixture('normal-dQw4w9WgXcQ.json') : NO_OWNER) });
  const day = Math.floor(b.now() / 86400000);
  Object.assign(b.store, { selfcheck: { at: b.now() }, verdicts: { aaaaaaaaaaa: [0, day - 3, day - 3] } });
  const t = b.tab('https://www.youtube.com/');
  t.addCard('aaaaaaaaaaa');
  await b.run(10000);
  assert.deepEqual(b.writes, []);                         // the card was seen today: no write for that
  t.navigate(watch('bbbbbbbbbbb'));                       // verdict without a channel
  await b.run(10000);
  assert.deepEqual(b.writes, ['verdicts']);
  assert.equal(b.store.verdicts.aaaaaaaaaaa[2], day);     // the seen day rode along
  t.navigate(watch('dQw4w9WgXcQ'));
  await b.run(10000);
  assert.deepEqual(b.writes, ['verdicts', 'channels,verdicts']);
});

test('saving: a channel changed while its save is being written is saved again', async () => {
  const b = browser({ setLatency: 1500, respond: () => reply(200, fixture('labelled-yHG-pivADos.json')) });
  b.store.selfcheck = { at: b.now() };
  const t = b.tab(watch(LABELLED));
  await b.run(3500);                                    // the first save is being written
  t.navigate(watch('uxZZg64CUDM'));                     // same channel, labelled too
  await b.run(20000);
  assert.deepEqual(b.store.channels[U].ai, [LABELLED, 'uxZZg64CUDM']);
});

test('card lookups: a card that scrolls away while waiting for the lock is skipped', async () => {
  const b = browser();
  Object.assign(b.store, { selfcheck: { at: b.now() }, settings: { lookups: true } });
  const feed = b.tab('https://www.youtube.com/');
  const card = feed.addCard('cardcardcar');
  await b.run(1000);
  b.tab(watch('aaaaaaaaaaa'));                          // another tab takes the lock
  await b.run(50);
  feed.intersect([card], true);                         // queued, waits for the lock
  await b.run(400);
  feed.intersect([card], false);                        // gone before its turn
  await b.run(5000);
  assert.deepEqual(b.requests.map((r) => r.videoId), ['aaaaaaaaaaa']);
  feed.intersect([card], true);                         // back in view: looked up now
  await b.run(5000);
  assert.deepEqual(b.requests.map((r) => r.videoId), ['aaaaaaaaaaa', 'cardcardcar']);
});

// Review M7: in hide mode an auto-flagged channel's unlabelled videos used to
// vanish with no reason shown. Now that reason is always dimmed with its chip.
test('auto-flagged channel: marked "channel" with chip, and the CSS never hides it', async () => {
  const b = browser();
  const U = 'UCMMmm45yro8eyHzadofoG4A';
  Object.assign(b.store, { selfcheck: { at: b.now() }, channels: { [U]: { h: 'foreverharmony_official', ai: ['v1', 'v2'] } } });
  const t = b.tab('https://www.youtube.com/');
  const flagged = t.addCard('aaaaaaaaaaa', '/@ForeverHarmony_Official');
  const plain = t.addCard('bbbbbbbbbbb', '/@someoneelse');
  await b.run(1000);
  assert.equal(flagged.dataset.ailf, 'channel');
  assert.equal(flagged.children[0].className, 'ailf-chip');
  assert.equal(flagged.children[0].firstChild.textContent, 'Channel: 2 labelled videos');
  assert.equal(flagged.children[0].lastChild.hidden, false);       // "Allow channel"
  assert.equal('ailf' in plain.dataset, false);
  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'content.css'), 'utf8');
  const hide = css.match(/([^{}]*)\{\s*display:\s*none !important;/g).filter((r) => r.includes('[data-ailf]'));
  assert.equal(hide.length, 1);
  assert.match(hide[0], /\[data-ailf\]:not\(\[data-ailf="channel"\]\)/);
  assert.match(css, /html\.ailf-on \[data-ailf="channel"\] > \.ailf-chip/);
});

// Review L3: a card reused for another video by changing only its link's
// href was not re-checked until some other DOM change.
test('a reused card whose link alone changes is checked again', async () => {
  const b = browser();
  const day = Math.floor(b.now() / 86400000);
  Object.assign(b.store, { selfcheck: { at: b.now() }, verdicts: { aiaiaiaiaia: [1, day, day, 0, 0] } });
  const t = b.tab('https://www.youtube.com/');
  assert.deepEqual(JSON.parse(JSON.stringify(t.mo.options)), { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
  const card = t.addCard('aiaiaiaiaia');
  await b.run(1000);
  assert.equal(card.dataset.ailf, 'label');
  card.link.getAttribute = () => '/watch?v=cleancleanc';         // href-only change
  t.mutate();                                                       // what the attribute record triggers
  await b.run(1000);
  assert.equal('ailf' in card.dataset, false);
  assert.equal(card.dataset.ailfVid, 'cleancleanc');
});
