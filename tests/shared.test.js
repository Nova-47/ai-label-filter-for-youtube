// Run from the repo root: node --test
// Fixtures are real masked `next` responses captured on 2026-10-13
// (see tests/fixtures/README.txt).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../shared.js');

const fixture = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));
const clone = (o) => JSON.parse(JSON.stringify(o));
const AI_BADGE = { metadataBadgeRenderer: { icon: { iconType: 'INFO' }, style: 'BADGE_STYLE_TYPE_SIMPLE', label: 'AI' } };

test('parseNext: labelled video', () => {
  assert.deepEqual(A.parseNext(fixture('labelled-yHG-pivADos.json')), {
    ai: true, ucid: 'UCp1mMtCnO_11BC4dbGv4BSA', handle: 'eigi_and_ai',
  });
  assert.deepEqual(A.parseNext(fixture('labelled-Xpg-JIuJ_cU.json')), {
    ai: true, ucid: 'UCMMmm45yro8eyHzadofoG4A', handle: 'foreverharmony_official',
  });
});

test('parseNext: auto-dubbed video has a SIMPLE badge and "How this was made", but is not AI', () => {
  const json = fixture('autodubbed-nG8aoy69iIo.json');
  const badge = json.contents.twoColumnWatchNextResults.results.results.contents[0].videoPrimaryInfoRenderer.badges[0];
  assert.equal(badge.metadataBadgeRenderer.style, 'BADGE_STYLE_TYPE_SIMPLE'); // the trap this test guards
  assert.deepEqual(A.parseNext(json), {
    ai: false, ucid: 'UC8F8MJyWevV2EzzLxZnSRLg', handle: 'obaydfox',
  });
});

test('parseNext: normal video', () => {
  assert.deepEqual(A.parseNext(fixture('normal-dQw4w9WgXcQ.json')), {
    ai: false, ucid: 'UCuAXFkgsw1L7xaCfnd5JJOw', handle: 'rickastleyyt',
  });
});

test('parseNext: "How this was made: Made with AI" alone never counts', () => {
  const json = fixture('normal-dQw4w9WgXcQ.json');
  json.engagementPanels[4].engagementPanelSectionListRenderer.content.structuredDescriptionContentRenderer.items[2] =
    { howThisWasMadeSectionViewModel: { bodyHeader: { content: 'Made with AI' } } };
  assert.equal(A.parseNext(json).ai, false);
});

test('parseNext: an AI badge in secondaryResults (sidebar) does not leak into the verdict', () => {
  const json = fixture('normal-dQw4w9WgXcQ.json');
  json.contents.twoColumnWatchNextResults.secondaryResults = {
    secondaryResults: { results: [{ videoPrimaryInfoRenderer: { badges: [AI_BADGE] } }, { badges: [AI_BADGE] }] },
  };
  json.contents.twoColumnWatchNextResults.results.results.contents.push(
    { compactVideoRenderer: { badges: [AI_BADGE] } });
  assert.equal(A.parseNext(json).ai, false);
});

test('parseNext: an INFO/SIMPLE badge on the owner (not the video) does not count', () => {
  const json = fixture('normal-dQw4w9WgXcQ.json');
  json.contents.twoColumnWatchNextResults.results.results.contents[2]
    .videoSecondaryInfoRenderer.owner.videoOwnerRenderer.badges = [AI_BADGE];
  assert.equal(A.parseNext(json).ai, false);
});

test('parseNext: unknown shapes give ai = null and never throw', () => {
  for (const bad of [null, undefined, 'x', 42, {}, { contents: {} }, { contents: { twoColumnWatchNextResults: { results: { results: { contents: 'no' } } } } }]) {
    assert.equal(A.parseNext(bad).ai, null);
  }
  const json = fixture('labelled-yHG-pivADos.json');
  json.contents.twoColumnWatchNextResults.results.results.contents.shift(); // videoPrimaryInfoRenderer gone
  const r = A.parseNext(json);
  assert.equal(r.ai, null);
  assert.equal(r.ucid, 'UCp1mMtCnO_11BC4dbGv4BSA');
});

test('isAiBadge: needs exactly BADGE_STYLE_TYPE_SIMPLE + INFO', () => {
  assert.equal(A.isAiBadge(AI_BADGE), true);
  const b = (style, iconType) => ({ metadataBadgeRenderer: { style, icon: { iconType } } });
  assert.equal(A.isAiBadge(b('SIMPLE', 'INFO')), false);
  assert.equal(A.isAiBadge(b('BADGE_STYLE_TYPE_SIMPLE', 'PERSON_RADAR_FILLED')), false);
  assert.equal(A.isAiBadge(b('BADGE_STYLE_TYPE_VERIFIED_ARTIST', 'INFO')), false);
  assert.equal(A.isAiBadge({ metadataBadgeRenderer: { style: 'BADGE_STYLE_TYPE_SIMPLE' } }), false);
  assert.equal(A.isAiBadge(null), false);
});

test('a full (unmasked-shape) response parses the same as the masked one', () => {
  const json = clone(fixture('labelled-yHG-pivADos.json'));
  json.contents.twoColumnWatchNextResults.secondaryResults = { secondaryResults: { results: [] } };
  json.responseContext = { visitorData: 'x' };
  assert.equal(A.parseNext(json).ai, true);
});

test('normalizeHandle', () => {
  assert.equal(A.normalizeHandle('@SuperCatLeague'), 'supercatleague');
  assert.equal(A.normalizeHandle('/@Eigi_and_AI'), 'eigi_and_ai');
  assert.equal(A.normalizeHandle('/@Eigi_and_AI/videos?view=0'), 'eigi_and_ai');
  assert.equal(A.normalizeHandle('https://www.youtube.com/@RickAstleyYT'), 'rickastleyyt');
  assert.equal(A.normalizeHandle('@M%C3%BAsicaB%C3%ADblicaInstrumental'), 'músicabíblicainstrumental');
  assert.equal(A.normalizeHandle('@Aiomo%E3%81%82%E3%81%84%E3%81%8A%E3%82%82'), 'aiomoあいおも');
  assert.equal(A.normalizeHandle('@Música'), 'música'); // NFD input → NFC
  assert.equal(A.normalizeHandle('@bad%E0%A4%A'), 'bad%e0%a4%a');   // malformed escape kept, no throw
  assert.equal(A.normalizeHandle('/channel/UCuAXFkgsw1L7xaCfnd5JJOw'), null);
  assert.equal(A.normalizeHandle('plainword'), null);
  assert.equal(A.normalizeHandle(null), null);
  // Same channel from the list and from a page link match
  assert.equal(A.normalizeHandle('@DPCartoon%C3%80i-v6k'), A.normalizeHandle('/@DPCartoonÀi-v6k'));
});

test('channelFromHref / videoIdFromHref', () => {
  assert.deepEqual(A.channelFromHref('/@Foo'), { handle: 'foo' });
  assert.deepEqual(A.channelFromHref('https://www.youtube.com/@Foo/shorts'), { handle: 'foo' });
  assert.deepEqual(A.channelFromHref('/channel/UCuAXFkgsw1L7xaCfnd5JJOw'), { ucid: 'UCuAXFkgsw1L7xaCfnd5JJOw' });
  assert.deepEqual(A.channelFromHref('/channel/UCuAXFkgsw1L7xaCfnd5JJOw/videos'), { ucid: 'UCuAXFkgsw1L7xaCfnd5JJOw' });
  assert.equal(A.channelFromHref('/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(A.channelFromHref('/channel/UCshort'), null);
  assert.equal(A.videoIdFromHref('/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(A.videoIdFromHref('/watch?v=yHG-pivADos&list=PL1&index=2'), 'yHG-pivADos');
  assert.equal(A.videoIdFromHref('/watch?list=PL1&v=yHG-pivADos'), 'yHG-pivADos');
  assert.equal(A.videoIdFromHref('/shorts/nG8aoy69iIo'), 'nG8aoy69iIo');
  assert.equal(A.videoIdFromHref('?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(A.videoIdFromHref('/watch?v=tooLongId12345'), null);
  assert.equal(A.videoIdFromHref('/@foo'), null);
});

test('parseList: AiSList format', () => {
  const text = [
    '! Title: AISList - Blocklist',
    '! License: CC BY-NC 4.0',
    '!',
    '@ChickofHonor-l',
    '@chickofhonor-L',              // duplicate after normalisation
    '  @SpacedHandle  ',
    '@DPCartoon%C3%80i-v6k\r',      // CRLF + percent-encoded
    '',
    'UCuAXFkgsw1L7xaCfnd5JJOw',     // channel id kept as is (case-sensitive)
    'https://example.com/not-a-handle',
    'junk line',
    '! trailing comment',
  ].join('\n');
  assert.deepEqual(A.parseList(text), [
    'chickofhonor-l', 'spacedhandle', 'dpcartoonài-v6k', 'UCuAXFkgsw1L7xaCfnd5JJOw',
  ]);
  assert.deepEqual(A.parseList(''), []);
});

test('cache: TTLs (clean 30 days, AI 180 days)', () => {
  const c = {};
  A.cachePut(c, 'clean000000', false, 1000);
  A.cachePut(c, 'aiaiaiaiaia', true, 1000, { ucid: 'UCuAXFkgsw1L7xaCfnd5JJOw', handle: 'x' });
  assert.equal(A.cacheGet(c, 'clean000000', 1030), false);
  assert.equal(A.cacheGet(c, 'clean000000', 1031), null);
  assert.equal(A.cacheGet(c, 'aiaiaiaiaia', 1180), true);
  assert.equal(A.cacheGet(c, 'aiaiaiaiaia', 1181), null);
  assert.equal(A.cacheGet(c, 'missing0000', 1000), null);
  assert.deepEqual(A.cacheOwner(c, 'aiaiaiaiaia'), { ucid: 'UCuAXFkgsw1L7xaCfnd5JJOw', handle: 'x' });
  assert.equal(A.cacheOwner(c, 'clean000000'), null);
});

test('cache: prune drops expired first, then least recently seen, down to 80%', () => {
  const c = {};
  for (let i = 0; i < 10; i++) A.cachePut(c, 'v' + i, false, 1000);
  c.v3[2] = 1005; c.v7[2] = 1006;            // seen recently
  A.cachePut(c, 'old', false, 900);           // expired clean verdict
  A.cachePrune(c, 1010, 5);
  assert.equal('old' in c, false);
  assert.equal(Object.keys(c).length, 4);     // floor(5 * 0.8)
  assert.ok('v3' in c && 'v7' in c);
  const small = {};
  A.cachePut(small, 'a', true, 1000);
  A.cachePrune(small, 1001, 5);
  assert.deepEqual(Object.keys(small), ['a']); // under the cap: untouched
});

test('channel aggregates and auto-flag (2+ labelled videos)', () => {
  const ch = {};
  const U = 'UCp1mMtCnO_11BC4dbGv4BSA';
  A.recordVerdict(ch, U, 'eigi_and_ai', 'vid00000001', true, 100);
  A.recordVerdict(ch, U, 'eigi_and_ai', 'vid00000001', true, 100); // same video again
  assert.equal(A.isAutoFlagged(ch[U]), false);
  A.recordVerdict(ch, U, null, 'vid00000002', false, 101);
  assert.equal(A.isAutoFlagged(ch[U]), false);
  A.recordVerdict(ch, U, null, 'vid00000003', true, 102);
  assert.equal(A.isAutoFlagged(ch[U]), true);
  assert.deepEqual(ch[U], { h: 'eigi_and_ai', ai: ['vid00000001', 'vid00000003'], d: 102 });
  A.recordVerdict(ch, 'not-a-ucid', 'x', 'vid00000004', true, 102);
  assert.equal(Object.keys(ch).length, 1);
  assert.equal(A.isAutoFlagged(undefined), false);
  assert.equal(A.isAutoFlagged({ ai: 'corrupt' }), false);
  const merged = A.mergeChannel({ h: null, ai: ['a'], d: 7 }, { h: 'x', ai: ['b', 'a'], d: 5 });
  assert.deepEqual(merged, { h: 'x', ai: ['a', 'b'], d: 7 });
  assert.equal(A.isAutoFlagged(merged), true);
});

test('channelsPrune: bounded; flagged and listed channels stay', () => {
  const ch = {};
  const id = (i) => 'UC' + String(i).padStart(22, '0');
  for (let i = 0; i < 10; i++) ch[id(i)] = { h: null, ai: [], d: 100 + i };
  ch[id(0)].ai = ['x1', 'x2'];                       // auto-flagged, oldest
  ch[id(1)].ai = ['x3'];                             // one labelled video
  const keep = new Set([id(2)]);                     // on a block/allow list
  A.channelsPrune(ch, keep, 10);
  assert.equal(Object.keys(ch).length, 10);          // at the cap: untouched
  ch[id(10)] = { h: null, ai: [], d: 200 };
  A.channelsPrune(ch, keep, 10);
  assert.deepEqual(Object.keys(ch).sort(), [0, 1, 2, 6, 7, 8, 9, 10].map(id)); // 80%: the 3 oldest plain ones go
  const tight = { [id(0)]: { ai: ['a', 'b'] }, [id(1)]: { ai: ['c'], d: 1 }, [id(2)]: { ai: [], d: 9 } };
  A.channelsPrune(tight, new Set(), 1);
  assert.deepEqual(Object.keys(tight), [id(0)]);     // plain first, then one-label; flagged stays
});

test('mergeDirty: a save keeps the other tab\'s entries and lays its own on top', () => {
  const stored = { a: [0, 10, 10], b: [1, 10, 12, 'UCx', 0] };
  const mine = { b: [1, 9, 13, 'UCx', 0], c: [0, 11, 11], d: [0, 11, 11] };
  assert.deepEqual(A.mergeDirty(stored, mine, ['b', 'c', 'gone'], A.mergeVerdict), {
    a: [0, 10, 10], b: [1, 10, 12, 'UCx', 0], c: [0, 11, 11], // b: the newer check wins; d: not dirty
  });
  const chans = A.mergeDirty({ U1: { h: 'x', ai: ['v1'], d: 3 } }, { U1: { h: null, ai: ['v2'], d: 4 } }, ['U1'], A.mergeChannel);
  assert.deepEqual(chans, { U1: { h: 'x', ai: ['v1', 'v2'], d: 4 } });
});

test('circuit breaker state transitions', () => {
  const now = 1_700_000_000_000;
  assert.equal(A.breakerOpen(null, now), false);
  const b = A.breakerTrip('HTTP 429', now);
  assert.deepEqual(b, { until: now + 24 * 3600 * 1000, reason: 'HTTP 429' });
  assert.equal(A.breakerOpen(b, now), true);
  assert.equal(A.breakerOpen(b, now + 23 * 3600 * 1000), true);
  assert.equal(A.breakerOpen(b, now + 24 * 3600 * 1000), false);
  assert.equal(A.breakerOpen({ until: 'garbage' }, now), false);
});

test('isBlockedResponse: what trips the breaker', () => {
  assert.equal(A.isBlockedResponse(403, 'basic', '{}'), true);
  assert.equal(A.isBlockedResponse(429, 'basic', ''), true);
  assert.equal(A.isBlockedResponse(0, 'opaqueredirect', ''), true);
  assert.equal(A.isBlockedResponse(200, 'basic', '<html>Our systems have detected unusual traffic</html>'), true);
  assert.equal(A.isBlockedResponse(200, 'basic', '  <!DOCTYPE html><form action="/sorry/index">'), true);
  assert.equal(A.isBlockedResponse(200, 'basic', JSON.stringify(fixture('labelled-yHG-pivADos.json'))), false);
  assert.equal(A.isBlockedResponse(200, 'basic', '{"note":"captcha in json is fine"}'), false);
  assert.equal(A.isBlockedResponse(400, 'basic', '{"error":{}}'), false);
  assert.equal(A.isBlockedResponse(500, 'basic', ''), false);
});

test('readResponse: blocked, bad (back off) or ok', () => {
  const labelled = JSON.stringify(fixture('labelled-yHG-pivADos.json'));
  assert.deepEqual(A.readResponse(429, 'basic', ''), { kind: 'blocked', why: 'HTTP 429' });
  assert.deepEqual(A.readResponse(0, 'opaqueredirect', ''), { kind: 'blocked', why: 'redirect' });
  assert.deepEqual(A.readResponse(200, 'basic', '<html>unusual traffic</html>'), { kind: 'blocked', why: 'HTTP 200' });
  for (const s of [400, 404, 500, 503]) assert.deepEqual(A.readResponse(s, 'basic', '{}'), { kind: 'bad', why: 'HTTP ' + s });
  assert.deepEqual(A.readResponse(200, 'basic', '<html>consent</html>'), { kind: 'bad', why: 'not JSON' });
  assert.deepEqual(A.readResponse(200, 'basic', ''), { kind: 'bad', why: 'not JSON' });
  assert.deepEqual(A.readResponse(200, 'basic', labelled),
    { kind: 'ok', ai: true, ucid: 'UCp1mMtCnO_11BC4dbGv4BSA', handle: 'eigi_and_ai' });
  assert.deepEqual(A.readResponse(200, 'basic', '{}'), { kind: 'ok', ai: null, ucid: null, handle: null });
});

test('backoff: 15 min, doubling, at most 24 h', () => {
  const now = 1_700_000_000_000;
  const min = 60000;
  let b = A.backoff(null, 'HTTP 400', now);
  assert.deepEqual(b, { until: now + 15 * min, reason: 'HTTP 400', n: 1 });
  b = A.backoff(b, 'HTTP 400', now);
  assert.equal(b.until, now + 30 * min);
  for (let i = 0; i < 10; i++) b = A.backoff(b, 'HTTP 500', now);
  assert.equal(b.n, 12);
  assert.equal(b.until, now + A.BREAKER_MS);
  assert.equal(A.backoff(A.breakerTrip('HTTP 429', now), 'HTTP 400', now).n, 1); // a block has no count
});

test('selfcheckVerdict: table', () => {
  const r = (status, body) => A.readResponse(status, 'basic', body);
  const LAB = JSON.stringify(fixture('labelled-yHG-pivADos.json'));
  const UNL = JSON.stringify(fixture('normal-dQw4w9WgXcQ.json'));
  const net = { kind: 'network' };
  const cases = [
    [[r(200, LAB)], 'ok'],
    [[r(200, UNL), r(200, LAB)], 'ok'],
    [[r(200, '{}'), r(200, LAB)], 'ok'],
    [[r(400, '{}')], 'error'],
    [[r(404, '')], 'error'],
    [[r(500, '')], 'error'],
    [[r(503, '')], 'error'],
    [[r(200, '<html>consent</html>')], 'error'],
    [[r(200, UNL), r(400, '{}')], 'error'],
    [[r(200, UNL), r(200, UNL)], 'broken'],
    [[r(200, '{}'), r(200, '{}')], 'missing'],      // both gone (removed/private)
    [[r(200, UNL), r(200, '{}')], 'missing'],
    [[r(200, '{}'), r(200, UNL)], 'missing'],
    [[r(200, UNL)], 'missing'],                     // one unlabelled canary alone never says broken
    [[net], 'unknown'],
    [[r(200, UNL), net], 'unknown'],
    [[r(429, '')], 'unknown'],                      // blocked: the popup shows the pause
    [[{ kind: 'paused' }], 'unknown'],
    [[], 'unknown'],
  ];
  for (const [results, want] of cases) {
    assert.equal(A.selfcheckVerdict(results), want, JSON.stringify(results.map((x) => x.kind + ':' + x.ai)));
  }
});

test('selfcheckDue: once a day, not while paused', () => {
  const now = 1_700_000_000_000;
  assert.equal(A.selfcheckDue(undefined, null, now), true);
  assert.equal(A.selfcheckDue({ at: now - A.DAY + 1 }, null, now), false);
  assert.equal(A.selfcheckDue({ at: now - A.DAY }, null, now), true);
  assert.equal(A.selfcheckDue({ at: now + 3600000 }, null, now), true);   // clock went back
  assert.equal(A.selfcheckDue({ state: 'ok' }, null, now), true);
  assert.equal(A.selfcheckDue(undefined, A.breakerTrip('HTTP 429', now), now), false);
});

test('canaries: two, from different channels', () => {
  assert.equal(A.CANARY_IDS.length, 2);
  assert.notEqual(A.parseNext(fixture('labelled-yHG-pivADos.json')).ucid,
    A.parseNext(fixture('labelled-Xpg-JIuJ_cU.json')).ucid);
  assert.deepEqual(A.CANARY_IDS, ['yHG-pivADos', 'Xpg-JIuJ_cU']);
});

test('enqueue / takeNext: newest first, unwanted entries dropped, capped', () => {
  const q = [];
  for (const v of ['a', 'b', 'c', 'd']) A.enqueue(q, v);
  A.enqueue(q, 'b');                                  // seen again: moves to the top
  assert.deepEqual(q, ['a', 'c', 'd', 'b']);
  assert.equal(A.takeNext(q, () => true), 'b');
  const onScreen = new Set(['a', 'c']);
  assert.equal(A.takeNext(q, (v) => onScreen.has(v)), 'c'); // 'd' scrolled away: dropped
  assert.deepEqual(q, ['a']);
  assert.equal(A.takeNext(q, () => false), null);
  assert.deepEqual(q, []);
  for (let i = 0; i < A.QUEUE_MAX + 5; i++) A.enqueue(q, 'v' + i);
  assert.equal(q.length, A.QUEUE_MAX);
  assert.equal(q[0], 'v5');                           // the oldest went first
  // Review E6 in miniature: screens s0..s7 queued while scrolling, s7 in view
  const scroll = [];
  for (let s = 0; s < 8; s++) for (let i = 0; i < 6; i++) A.enqueue(scroll, `s${s}c${i}`);
  const inView = (v) => v.startsWith('s7') || v.startsWith('s6c5');
  const order = [];
  for (let v; (v = A.takeNext(scroll, inView));) order.push(v);
  assert.deepEqual(order, ['s7c5', 's7c4', 's7c3', 's7c2', 's7c1', 's7c0', 's6c5']);
});

test('decide: allowlist > blocklist > label > channel flag > AiSList', () => {
  const U = 'UCp1mMtCnO_11BC4dbGv4BSA';
  const idx = (o = {}) => ({
    h2u: new Map([['eigi_and_ai', U]]), u2h: new Map([[U, 'eigi_and_ai']]),
    allow: new Set(), block: new Set(), flagged: new Set(), list: null, ...o,
  });
  const byHandle = { handle: 'eigi_and_ai' };
  const byUcid = { ucid: U };
  assert.equal(A.decide(null, byHandle, idx()), null);
  assert.equal(A.decide(false, null, idx()), null);
  assert.equal(A.decide(true, null, idx()), 'label');
  assert.equal(A.decide(null, byHandle, idx({ list: new Set(['eigi_and_ai']) })), 'aislist');
  assert.equal(A.decide(null, byUcid, idx({ list: new Set(['eigi_and_ai']) })), 'aislist'); // via u2h
  assert.equal(A.decide(null, byHandle, idx({ flagged: new Set([U]) })), 'channel');      // via h2u
  assert.equal(A.decide(true, byHandle, idx({ flagged: new Set([U]) })), 'label');
  assert.equal(A.decide(true, byHandle, idx({ block: new Set([U]) })), 'blocked');
  assert.equal(A.decide(true, byUcid, idx({ block: new Set([U]), allow: new Set(['eigi_and_ai']) })), null);
  assert.equal(A.decide(null, { handle: 'someoneelse' }, idx({ block: new Set([U]) })), null);
});

test('mask covers the two paths and nothing from the sidebar', () => {
  assert.match(A.NEXT_FIELDS, /videoPrimaryInfoRenderer\.badges/);
  assert.match(A.NEXT_FIELDS, /browseEndpoint\(browseId,canonicalBaseUrl\)/);
  assert.doesNotMatch(A.NEXT_FIELDS, /secondaryResults|engagementPanels/);
  const open = (A.NEXT_FIELDS.match(/\(/g) || []).length;
  assert.equal(open, (A.NEXT_FIELDS.match(/\)/g) || []).length);
});
