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
    ai: true, ucid: 'UCp1mMtCnO_11BC4dbGv4BSA', handle: 'eigi_and_ai', disclosure: 'Made with AI',
  });
});

test('parseNext: auto-dubbed video has a SIMPLE badge and "How this was made", but is not AI', () => {
  const json = fixture('autodubbed-nG8aoy69iIo.json');
  const badge = json.contents.twoColumnWatchNextResults.results.results.contents[0].videoPrimaryInfoRenderer.badges[0];
  assert.equal(badge.metadataBadgeRenderer.style, 'BADGE_STYLE_TYPE_SIMPLE'); // the trap this test guards
  assert.deepEqual(A.parseNext(json), {
    ai: false, ucid: 'UC8F8MJyWevV2EzzLxZnSRLg', handle: 'obaydfox', disclosure: 'Auto-dubbed',
  });
});

test('parseNext: normal video', () => {
  assert.deepEqual(A.parseNext(fixture('normal-dQw4w9WgXcQ.json')), {
    ai: false, ucid: 'UCuAXFkgsw1L7xaCfnd5JJOw', handle: 'rickastleyyt', disclosure: null,
  });
});

test('parseNext: "How this was made: Made with AI" alone never counts', () => {
  const json = fixture('normal-dQw4w9WgXcQ.json');
  json.engagementPanels[4].engagementPanelSectionListRenderer.content.structuredDescriptionContentRenderer.items[2] =
    { howThisWasMadeSectionViewModel: { bodyHeader: { content: 'Made with AI' } } };
  const r = A.parseNext(json);
  assert.equal(r.disclosure, 'Made with AI');
  assert.equal(r.ai, false);
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
  A.recordVerdict(ch, U, 'eigi_and_ai', 'vid00000001', true);
  A.recordVerdict(ch, U, 'eigi_and_ai', 'vid00000001', true); // same video again
  assert.equal(A.isAutoFlagged(ch[U]), false);
  A.recordVerdict(ch, U, null, 'vid00000002', false);
  assert.equal(A.isAutoFlagged(ch[U]), false);
  A.recordVerdict(ch, U, null, 'vid00000003', true);
  assert.equal(A.isAutoFlagged(ch[U]), true);
  assert.equal(ch[U].h, 'eigi_and_ai');
  assert.equal(ch[U].n, 4);
  A.recordVerdict(ch, 'not-a-ucid', 'x', 'vid00000004', true);
  assert.equal(Object.keys(ch).length, 1);
  assert.equal(A.isAutoFlagged(undefined), false);
  assert.equal(A.isAutoFlagged({ ai: 'corrupt' }), false);
  const merged = A.mergeChannel({ h: null, ai: ['a'], n: 3 }, { h: 'x', ai: ['b', 'a'], n: 2 });
  assert.deepEqual(merged, { h: 'x', ai: ['a', 'b'], n: 3 });
  assert.equal(A.isAutoFlagged(merged), true);
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

test('mask covers the three paths and nothing from the sidebar', () => {
  assert.match(A.NEXT_FIELDS, /videoPrimaryInfoRenderer\.badges/);
  assert.match(A.NEXT_FIELDS, /browseEndpoint\(browseId,canonicalBaseUrl\)/);
  assert.match(A.NEXT_FIELDS, /howThisWasMadeSectionViewModel\.bodyHeader/);
  assert.doesNotMatch(A.NEXT_FIELDS, /secondaryResults/);
  const open = (A.NEXT_FIELDS.match(/\(/g) || []).length;
  assert.equal(open, (A.NEXT_FIELDS.match(/\)/g) || []).length);
});
