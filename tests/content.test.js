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

// Several videos per tab, two tabs, all at once (review E7).
test('requests: one at a time and ≥ 1 s apart across tabs', async () => {
  const b = browser();
  b.store.selfcheck = { at: b.now() };
  const ids = (p) => [1, 2, 3, 4].map((i) => (p + i).padEnd(11, 'x'));
  const tabs = [b.tab(watch(ids('a')[0])), b.tab(watch(ids('b')[0]))];
  for (const i of [1, 2, 3]) {
    await b.run(150);
    tabs[0].navigate(watch(ids('a')[i]));
    tabs[1].navigate(watch(ids('b')[i]));
  }
  await b.run(20000);
  assert.equal(b.requests.length, 8);
  assert.equal(b.maxInflight, 1);
  const at = b.requests.map((r) => r.at);
  for (let i = 1; i < at.length; i++) assert.ok(at[i] - at[i - 1] >= 1000, `gap ${at[i] - at[i - 1]} ms`);
});

test('requests: a block in one tab stops the request already queued in another', async () => {
  const b = browser({ respond: () => reply(429) });
  b.store.selfcheck = { at: b.now() };
  b.tab(watch('aaaaaaaaaaa'));
  b.tab(watch('bbbbbbbbbbb'));
  await b.run(10000);
  assert.equal(b.requests.length, 1);
  assert.equal(b.store.breaker.reason, 'HTTP 429');
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
