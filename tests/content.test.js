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
