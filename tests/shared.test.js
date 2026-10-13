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

// Video ids and verdicts in a channel's window, oldest first.
const ids = (c) => c.w.map((e) => A.parseEntry(e).id);
const pairs = (c) => c.w.map((e) => { const p = A.parseEntry(e); return [p.id, p.ai ? 1 : 0]; });
const T = 1_790_000_000_000; // ms
const win = (list) => list.map(([id, ai, s]) => A.makeEntry(id, s, ai));

test('window entries: id, base-36 seconds and verdict in one string', () => {
  assert.equal(A.makeEntry('dQw4w9WgXcQ', 1790000000, true), 'dQw4w9WgXcQ:tlpwu81');
  assert.deepEqual(A.parseEntry('dQw4w9WgXcQ:tlpwu81'), { id: 'dQw4w9WgXcQ', t: 1790000000, ai: true });
  assert.deepEqual(A.parseEntry(A.makeEntry('a-_b', 5, false)), { id: 'a-_b', t: 5, ai: false });
  for (const bad of [null, 1, ['a', 1], 'nocolon1', ':tlpwu81', 'a:tlpwu82', 'a:1', 'a:!!1']) assert.equal(A.parseEntry(bad), null, String(bad));
});

test('channel aggregates: a window of recent distinct videos, re-checks do not inflate', () => {
  const ch = {};
  const U = 'UCp1mMtCnO_11BC4dbGv4BSA';
  A.recordVerdict(ch, U, 'eigi_and_ai', 'vid00000001', true, 100, T);
  A.recordVerdict(ch, U, 'eigi_and_ai', 'vid00000001', true, 100, T); // same video again
  assert.equal(A.isAutoFlagged(ch[U]), false);
  A.recordVerdict(ch, U, null, 'vid00000002', false, 101, T + 1000);
  A.recordVerdict(ch, U, null, 'vid00000002', false, 101, T + 2000); // clean re-check
  assert.deepEqual(A.channelCounts(ch[U]), { ai: 1, checked: 2 });
  A.recordVerdict(ch, U, null, 'vid00000003', true, 102, T + 3000);
  assert.deepEqual(ch[U], { h: 'eigi_and_ai', w: win([['vid00000001', 1, T / 1000], ['vid00000002', 0, T / 1000 + 2], ['vid00000003', 1, T / 1000 + 3]]), d: 102 });
  A.recordVerdict(ch, U, null, 'vid00000001', true, 103, T + 4000); // re-check: moves to the end, not added
  assert.deepEqual(ids(ch[U]), ['vid00000002', 'vid00000003', 'vid00000001']);
  A.recordVerdict(ch, U, null, 'vid00000003', false, 103, T + 5000); // verdict changed: moved to newest
  assert.deepEqual(A.channelCounts(ch[U]), { ai: 1, checked: 3 });
  assert.deepEqual(pairs(ch[U]).at(-1), ['vid00000003', 0]);
  // A clock set back still records the new verdict as the newest.
  A.recordVerdict(ch, U, null, 'vid00000004', true, 103, T - 99000);
  assert.deepEqual(A.parseEntry(ch[U].w.at(-1)), { id: 'vid00000004', t: T / 1000 + 5, ai: true });
  A.recordVerdict(ch, 'not-a-ucid', 'x', 'vid00000004', true, 102);
  assert.equal(Object.keys(ch).length, 1);
  assert.equal(A.isAutoFlagged(undefined), false);
  assert.equal(A.isAutoFlagged({ w: 'corrupt' }), false);
  assert.equal(A.isAutoFlagged({ w: [null, 'x', ['a', 1], ...win([['a', 1, 1], ['b', 1, 2], ['c', 1, 3], ['d', 1, 4]])] }), false); // 4 of 4 valid
  // The window keeps the last CHANNEL_WINDOW videos; the oldest drops out.
  assert.equal(A.CHANNEL_WINDOW, 20);
  const big = {};
  for (let i = 0; i < 25; i++) A.recordVerdict(big, U, null, 'v' + i, false, 1);
  assert.equal(big[U].w.length, A.CHANNEL_WINDOW);
  assert.deepEqual([ids(big[U])[0], ids(big[U]).at(-1)], ['v5', 'v24']);
});

test('auto-flag rule: checked >= 5, labelled >= 2 and labelled / checked >= 0.6', () => {
  assert.equal(A.AUTOFLAG_MIN_CHECKED, 5);
  assert.equal(A.AUTOFLAG_MIN_AI, 2);
  assert.equal(A.AUTOFLAG_MIN_RATIO, 0.6);
  const U = 'UCp1mMtCnO_11BC4dbGv4BSA';
  const cases = [
    // [labelled, checked, flagged]
    [2, 2, false],
    [2, 3, false],
    [3, 3, false],
    [4, 4, false],
    [2, 4, false],
    [4, 5, true],
    [3, 5, true],
    [2, 5, false],
    [5, 5, true],
    [5, 12, false],
    [1, 1, false],
    [3, 6, false],
    [4, 6, true],
    [6, 10, true],
    [12, 20, true],
    [11, 20, false],
    [0, 0, false],
  ];
  for (const [ai, checked, want] of cases) {
    const ch = {};
    for (let i = 0; i < checked; i++) A.recordVerdict(ch, U, null, 'v' + i, i < ai, 1);
    assert.equal(A.isAutoFlagged(ch[U]), want, `${ai} of ${checked}`);
    if (checked) assert.deepEqual(A.channelCounts(ch[U]), { ai, checked });
    // Checking every video again changes nothing.
    for (let i = 0; i < checked; i++) A.recordVerdict(ch, U, null, 'v' + i, i < ai, 2);
    assert.equal(A.isAutoFlagged(ch[U]), want, `${ai} of ${checked}, re-checked`);
    if (checked) assert.deepEqual(A.channelCounts(ch[U]), { ai, checked });
  }
});

test('auto-flag over the window: long histories, flips and channels that change course', () => {
  const U = 'UCp1mMtCnO_11BC4dbGv4BSA';
  const run = (seq) => {
    const ch = {};
    for (const [id, ai] of seq) A.recordVerdict(ch, U, null, id, ai, 1);
    return ch[U];
  };
  const many = (n, prefix, ai) => Array.from({ length: n }, (_, i) => [prefix + i, ai]);
  // 30 labelled then 5 clean: last 20 are 15 of 20 labelled.
  let c = run([...many(30, 'a', true), ...many(5, 'o', false)]);
  assert.deepEqual(A.channelCounts(c), { ai: 15, checked: 20 });
  assert.equal(A.isAutoFlagged(c), true);
  // Same counts, clean first: still flagged.
  assert.equal(A.isAutoFlagged(run([...many(5, 'o', false), ...many(30, 'a', true)])), true);
  // 3 labelled and 40 clean, either order: not flagged.
  assert.equal(A.isAutoFlagged(run([...many(3, 'a', true), ...many(40, 'o', false)])), false);
  c = run([...many(40, 'o', false), ...many(3, 'a', true)]);
  assert.deepEqual(A.channelCounts(c), { ai: 3, checked: 20 });
  assert.equal(A.isAutoFlagged(c), false);
  // Review M1: 40 clean, then YouTube labels 10 of them. The window still
  // holds 20 videos, 10 labelled: 50%, not flagged.
  c = run([...many(40, 'o', false), ...many(10, 'o', true)]);
  assert.deepEqual(A.channelCounts(c), { ai: 10, checked: 20 });
  assert.equal(A.isAutoFlagged(c), false);
  // Review M2: 7 clean, then the channel switches to 100 labelled videos.
  c = run([...many(7, 'o', false), ...many(100, 'a', true)]);
  assert.deepEqual(A.channelCounts(c), { ai: 20, checked: 20 });
  assert.equal(A.isAutoFlagged(c), true);
  // And back: a flagged channel that turns clean stops being flagged.
  c = run([...many(20, 'a', true), ...many(9, 'o', false)]);
  assert.equal(A.isAutoFlagged(c), false);                           // 11 of 20
});

test('auto-flag: re-checking the same labelled video does not reach the bar', () => {
  const U = 'UCp1mMtCnO_11BC4dbGv4BSA', ch = {};
  for (let i = 0; i < 5; i++) A.recordVerdict(ch, U, null, 'same', true, i);
  assert.deepEqual(A.channelCounts(ch[U]), { ai: 1, checked: 1 });
  assert.equal(A.isAutoFlagged(ch[U]), false);
  for (const id of ['b', 'c']) for (let i = 0; i < 5; i++) A.recordVerdict(ch, U, null, id, true, 6 + i);
  assert.deepEqual(A.channelCounts(ch[U]), { ai: 3, checked: 3 });
  assert.equal(A.isAutoFlagged(ch[U]), false);                       // 3 of 3: too few checked
  // A clean video re-checked many times still counts once: 3 of 4.
  for (let i = 0; i < 5; i++) A.recordVerdict(ch, U, null, 'clean', false, 11 + i);
  assert.deepEqual(A.channelCounts(ch[U]), { ai: 3, checked: 4 });
  assert.equal(A.isAutoFlagged(ch[U]), false);
  A.recordVerdict(ch, U, null, 'clean2', false, 16);
  assert.deepEqual(A.channelCounts(ch[U]), { ai: 3, checked: 5 });
  assert.equal(A.isAutoFlagged(ch[U]), true);                        // 3 of 5
  // Re-checks do not push other videos out of the window.
  const w = {};
  for (let i = 0; i < 20; i++) A.recordVerdict(w, U, null, 'v' + i, i < 12, 1);
  for (let i = 0; i < 50; i++) A.recordVerdict(w, U, null, 'v19', false, 2);
  assert.deepEqual(A.channelCounts(w[U]), { ai: 12, checked: 20 });
});

test('auto-flag: entries in any older format are not flagged and start over', () => {
  const U = 'UCp1mMtCnO_11BC4dbGv4BSA';
  const olds = [
    { h: 'x', ai: ['a', 'b', 'c', 'd', 'e', 'f'], d: 5 },                       // first format
    { h: 'x', ai: ['a', 'b', 'c', 'd', 'e', 'f'], ok: [], d: 5 },               // 10 + 10
    { h: 'x', v: [['a', 1], ['b', 1], ['c', 1], ['d', 1], ['e', 1], ['f', 1]], d: 5 }, // window without times
  ];
  for (const old of olds) {
    assert.equal(A.channelCounts(old), null);
    assert.equal(A.isAutoFlagged(old), false);
    assert.equal(A.buildIndex({ [U]: old }, {}, {}).flagged.size, 0);
    const ch = { [U]: clone(old) };
    A.recordVerdict(ch, U, null, 'f', false, 6, T);                   // next verdict: new window
    assert.deepEqual(ch[U], { h: 'x', w: win([['f', 0, T / 1000]]), d: 6 });
    for (const id of ['g', 'h', 'i', 'j']) A.recordVerdict(ch, U, null, id, true, 7);
    assert.equal(A.isAutoFlagged(ch[U]), true);                      // 4 of 5
  }
});

test('mergeChannel: newest entry per video, then the newest 20; window beats old format', () => {
  const merged = A.mergeChannel(
    { h: null, w: win([['a', 1, 10], ['c', 0, 11], ['x', 0, 30]]), d: 7 },
    { h: 'h', w: win([['b', 1, 12], ['a', 1, 13], ['x', 1, 20]]), d: 5 });
  // x: the stored copy checked it later (30), so this tab's older verdict loses.
  assert.deepEqual(merged, { h: 'h', w: win([['c', 0, 11], ['b', 1, 12], ['a', 1, 13], ['x', 0, 30]]), d: 7 });
  const tie = A.mergeChannel({ w: win([['a', 0, 5]]) }, { w: win([['a', 1, 5]]) });
  assert.deepEqual(pairs(tie), [['a', 1]]);                          // same second: this tab wins
  const long = A.mergeChannel(
    { h: null, w: win(Array.from({ length: 20 }, (_, i) => ['s' + i, 0, 100 + i])) },
    { h: null, w: win(Array.from({ length: 5 }, (_, i) => ['m' + i, 1, 200 + i])) });
  assert.equal(long.w.length, A.CHANNEL_WINDOW);
  assert.deepEqual([ids(long)[0], ids(long).at(-1)], ['s5', 'm4']);
  const mixed = A.mergeChannel({ h: 'h', ai: ['a', 'b', 'c'], d: 9 }, { h: null, w: win([['z', 0, 1]]), d: 4 });
  assert.deepEqual(mixed, { h: 'h', w: win([['z', 0, 1]]), d: 9 });
  const vOld = A.mergeChannel({ h: 'h', v: [['a', 1]], d: 9 }, { h: null, w: win([['z', 0, 1]]), d: 4 });
  assert.deepEqual(vOld.w, win([['z', 0, 1]]));
  assert.deepEqual(A.mergeChannel({ h: null, ai: ['a'], d: 7 }, { h: 'x', ai: ['b', 'a'], d: 5 }), { h: 'x', ai: ['a', 'b'], d: 7 });
  assert.equal(A.mergeChannel(undefined, merged), merged);
});

test('mergeChannel: two tabs each add a video to a full window, both survive', () => {
  const U = 'UCp1mMtCnO_11BC4dbGv4BSA';
  const base = {};
  for (let i = 0; i < 20; i++) A.recordVerdict(base, U, null, 'old' + i, false, 1, T + i * 1000);
  const tab1 = clone(base), tab2 = clone(base);
  A.recordVerdict(tab1, U, null, 'new1', true, 2, T + 60000);
  A.recordVerdict(tab2, U, null, 'new2', true, 2, T + 61000);
  // Tab 1 saves first; tab 2's save merges onto what tab 1 stored, and the
  // other way round.
  for (const [stored, mine] of [[tab1[U], tab2[U]], [tab2[U], tab1[U]]]) {
    const m = A.mergeChannel(stored, mine);
    assert.equal(m.w.length, 20);
    assert.deepEqual(ids(m).slice(-2), ['new1', 'new2']);
    assert.deepEqual(ids(m).slice(0, 2), ['old2', 'old3']);          // the two oldest drop out
    assert.deepEqual(A.channelCounts(m), { ai: 2, checked: 20 });
  }
  // A stale tab still holding an old clean verdict for a video cannot undo
  // the newer labelled verdict another tab stored.
  const fresh = clone(base), stale = clone(base);
  A.recordVerdict(fresh, U, null, 'old5', true, 3, T + 90000);
  A.recordVerdict(stale, U, null, 'other', false, 2, T + 70000);
  const m = A.mergeChannel(fresh[U], stale[U]);
  assert.deepEqual(pairs(m).find((p) => p[0] === 'old5'), ['old5', 1]);
  assert.deepEqual(ids(m).slice(-2), ['other', 'old5']);
});

test('channelsPrune: bounded; flagged and listed channels stay; fewest labelled in the window go first', () => {
  const ch = {};
  const id = (i) => 'UC' + String(i).padStart(22, '0');
  for (let i = 0; i < 10; i++) ch[id(i)] = { h: null, w: [], d: 100 + i };
  ch[id(0)].w = win([['x1', 1, 1], ['x2', 1, 2], ['x4', 1, 3], ['x5', 1, 4], ['x6', 0, 5]]); // auto-flagged, oldest
  ch[id(1)].w = win([['x3', 1, 1]]);                 // one labelled video
  const keep = new Set([id(2)]);                     // on a block/allow list
  A.channelsPrune(ch, keep, 10);
  assert.equal(Object.keys(ch).length, 10);          // at the cap: untouched
  ch[id(10)] = { h: null, w: [], d: 200 };
  A.channelsPrune(ch, keep, 10);
  assert.deepEqual(Object.keys(ch).sort(), [0, 1, 2, 6, 7, 8, 9, 10].map(id)); // 80%: the 3 oldest plain ones go
  // Sorted by labelled videos in the window, not window length: c (1 labelled,
  // 5 checked) goes before e (2 labelled, 2 checked), old formats count as 0.
  const tight = {
    [id(0)]: { w: win([['a', 1, 1], ['b', 1, 2], ['e', 1, 3], ['f', 1, 4], ['g', 1, 5]]) },
    [id(1)]: { w: win([['c', 1, 1], ['c2', 0, 2], ['c3', 0, 3], ['c4', 0, 4], ['c5', 0, 5]]), d: 1 },
    [id(2)]: { w: win([['e1', 1, 1], ['e2', 1, 2]]), d: 0 },
    [id(3)]: { v: [['o1', 1], ['o2', 1], ['o3', 1]], d: 9 },
  };
  A.channelsPrune(tight, new Set(), 3);
  assert.deepEqual(Object.keys(tight).sort(), [id(0), id(2)]);
});

test('mergeDirty: a save keeps the other tab\'s entries and lays its own on top', () => {
  const stored = { a: [0, 10, 10], b: [1, 10, 12, 'UCx', 0] };
  const mine = { b: [1, 9, 13, 'UCx', 0], c: [0, 11, 11], d: [0, 11, 11] };
  assert.deepEqual(A.mergeDirty(stored, mine, ['b', 'c', 'gone'], A.mergeVerdict), {
    a: [0, 10, 10], b: [1, 10, 12, 'UCx', 0], c: [0, 11, 11], // b: the newer check wins; d: not dirty
  });
  const chans = A.mergeDirty({ U1: { h: 'x', w: win([['v1', 1, 1], ['c1', 0, 2]]), d: 3 } }, { U1: { h: null, w: win([['v2', 1, 3]]), d: 4 } }, ['U1'], A.mergeChannel);
  assert.deepEqual(chans, { U1: { h: 'x', w: win([['v1', 1, 1], ['c1', 0, 2], ['v2', 1, 3]]), d: 4 } });
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

test('requestWait: until 1 s after the last send, never longer', () => {
  const now = 1_700_000_000_000;
  assert.equal(A.requestWait(undefined, now), 0);
  assert.equal(A.requestWait('garbage', now), 0);
  assert.equal(A.requestWait(now - 300, now), 700);
  assert.equal(A.requestWait(now - 1000, now), 0);
  assert.equal(A.requestWait(now - 5000, now), 0);
  assert.equal(A.requestWait(now + 3600 * 1000, now), 1000); // clock set back
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
  const RENAMED = LAB.replaceAll('videoPrimaryInfoRenderer', 'videoPrimaryInfoRendererV2'); // owner reads, label can't
  const NO_OWNER = '{"contents":{"twoColumnWatchNextResults":{"results":{"results":{"contents":[{"videoPrimaryInfoRenderer":{}}]}}}}}';
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
    [[r(200, '{}'), r(200, '{}')], 'broken'],       // nothing reads: shape changed, or both gone (review N1)
    [[r(200, RENAMED), r(200, RENAMED)], 'broken'],
    [[r(200, RENAMED), r(200, UNL)], 'broken'],     // the video is there, its label unreadable
    [[r(200, UNL), r(200, RENAMED)], 'broken'],
    [[r(200, RENAMED)], 'broken'],
    [[r(200, NO_OWNER), r(200, UNL)], 'broken'],    // reads as unlabelled, no owner: not "gone"
    [[r(200, UNL), r(200, '{}')], 'missing'],       // one gone, the other unlabelled
    [[r(200, '{}'), r(200, UNL)], 'missing'],
    [[r(200, '{}')], 'missing'],
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
  const S = A.SELFCHECK_STALE_MS;
  assert.equal(A.selfcheckDue({ at: now - S + 1, pending: true }, null, now), false); // may still be running
  assert.equal(A.selfcheckDue({ at: now - S, pending: true }, null, now), true);      // cut off: retry
  assert.equal(A.selfcheckDue({ at: now - S, state: 'ok' }, null, now), false);
  assert.equal(A.selfcheckDue({ at: now - S }, null, now), false);                    // done, warning cleared
  assert.equal(A.selfcheckDue({ at: now - S, pending: true }, A.breakerTrip('HTTP 429', now), now), false);
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

test('buildIndex: handle/id pairs from channels and list entries, auto-flags, list keys', () => {
  const U = 'UCp1mMtCnO_11BC4dbGv4BSA', V = 'UCuAXFkgsw1L7xaCfnd5JJOw';
  const idx = A.buildIndex({ [U]: { h: 'eigi_and_ai', w: ['a:11', 'b:21', 'c:31', 'd:41', 'e:50'] } },
    { k: { ucid: V, handle: 'rickastleyyt' } }, { '@foo': { ucid: null, handle: 'foo' } }, new Set(['x']));
  assert.equal(idx.h2u.get('eigi_and_ai'), U);
  assert.equal(idx.u2h.get(V), 'rickastleyyt');                 // learnt from a list entry
  assert.deepEqual([...idx.flagged].sort(), [U, 'eigi_and_ai'].sort());
  assert.deepEqual([...idx.block].sort(), [V, 'rickastleyyt'].sort());
  assert.deepEqual([...idx.allow], ['foo']);
  assert.deepEqual([...idx.list], ['x']);
  assert.equal(A.buildIndex(undefined, undefined, undefined).list, null);
});

// Review L2: allowed from a home card (handle only), later from a search
// card (UC id) used to leave two entries, and removing one kept it allowed.
test('listPut / listDrop: one key per channel; Remove removes every alias', () => {
  const U = 'UCp1mMtCnO_11BC4dbGv4BSA';
  const allowed = {};
  A.listPut(allowed, { handle: 'eigi_and_ai' }, A.buildIndex({}, {}, allowed), 1);
  assert.deepEqual(allowed, { '@eigi_and_ai': { ucid: null, handle: 'eigi_and_ai', added: 1 } });
  const learnt = { [U]: { h: 'eigi_and_ai', ai: [] } };      // a `next` reply taught us the pair
  A.listPut(allowed, { ucid: U }, A.buildIndex(learnt, {}, allowed), 2);
  assert.deepEqual(allowed, { [U]: { ucid: U, handle: 'eigi_and_ai', added: 2 } });
  // Old data with two entries for one channel: Remove by either drops both.
  const dup = { '@eigi_and_ai': { ucid: null, handle: 'eigi_and_ai' }, [U]: { ucid: U, handle: null } };
  assert.deepEqual(A.listDrop({ ...dup }, dup['@eigi_and_ai'], A.buildIndex(learnt, {}, dup)), {});
  assert.deepEqual(A.listDrop({ ...dup }, dup[U], A.buildIndex(learnt, {}, dup)), {});
  // Without a known pair the two stay separate, and other channels are untouched.
  const other = { '@foo': { ucid: null, handle: 'foo' } };
  assert.deepEqual(A.listDrop({ ...dup, ...other }, dup[U], A.buildIndex({}, {}, {})), { '@eigi_and_ai': dup['@eigi_and_ai'], ...other });
  // Known by handle only, then the same handle again: still one entry, UC id kept.
  const blocked = { [U]: { ucid: U, handle: 'eigi_and_ai', added: 1 } };
  A.listPut(blocked, { handle: 'eigi_and_ai' }, A.buildIndex({}, blocked, {}), 3);
  assert.deepEqual(blocked, { [U]: { ucid: U, handle: 'eigi_and_ai', added: 3 } });
  assert.deepEqual(A.listPut({}, null, A.buildIndex({}, {}, {}), 1), {});
  // No pair known anywhere but the entry itself: still the same channel.
  const none = A.buildIndex({}, {}, {});
  assert.deepEqual(A.listDrop({ [U]: { ucid: U, handle: 'eigi_and_ai' } }, { handle: 'eigi_and_ai' }, none), {});
  assert.deepEqual(A.listPut({ [U]: { ucid: U, handle: 'eigi_and_ai', added: 1 } }, { handle: 'eigi_and_ai' }, none, 4),
    { [U]: { ucid: U, handle: 'eigi_and_ai', added: 4 } });
});

test('mask covers the two paths and nothing from the sidebar', () => {
  assert.match(A.NEXT_FIELDS, /videoPrimaryInfoRenderer\.badges/);
  assert.match(A.NEXT_FIELDS, /browseEndpoint\(browseId,canonicalBaseUrl\)/);
  assert.doesNotMatch(A.NEXT_FIELDS, /secondaryResults|engagementPanels/);
  const open = (A.NEXT_FIELDS.match(/\(/g) || []).length;
  assert.equal(open, (A.NEXT_FIELDS.match(/\)/g) || []).length);
});

// The popup lists the channels the channel rule dims, with the same test
// content.js uses (isAutoFlagged) and minus allowed or hidden channels.
test('flaggedChannels: auto-flagged only, minus allow/block lists, most labelled first', () => {
  const U1 = 'UCaaaaaaaaaaaaaaaaaaaaaa', U2 = 'UCbbbbbbbbbbbbbbbbbbbbbb', U3 = 'UCcccccccccccccccccccccc', U4 = 'UCdddddddddddddddddddddd';
  const channels = {
    [U1]: { h: 'four', w: ['v1:a1', 'v2:b1', 'v3:c1', 'v4:d1', 'v5:e0'] },          // 4 of 5
    [U2]: { h: 'five', w: ['v1:a1', 'v2:b1', 'v3:c1', 'v4:d1', 'v5:e1'] },          // 5 of 5
    [U3]: { h: 'few', w: ['v1:a1', 'v2:b1', 'v3:c1', 'v4:d1'] },                   // under 5 checked
    [U4]: { w: ['v1:a1', 'v2:b1', 'v3:c1', 'v4:d0', 'v5:e0'] },                     // 3 of 5, no handle
  };
  assert.deepEqual(A.flaggedChannels(channels, {}, {}), [
    { ucid: U2, handle: 'five', ai: 5, checked: 5 },
    { ucid: U1, handle: 'four', ai: 4, checked: 5 },
    { ucid: U4, handle: null, ai: 3, checked: 5 },
  ]);
  for (const c of Object.values(channels)) {
    assert.equal(A.flaggedChannels({ x: c }, {}, {}).length, A.isAutoFlagged(c) ? 1 : 0);
  }
  // Allowed by handle only still matches the UC id (channelKeys, as decide()).
  const allowed = { '@four': { ucid: null, handle: 'four', added: 1 } };
  const blocked = { [U4]: { ucid: U4, handle: null, added: 1 } };
  assert.deepEqual(A.flaggedChannels(channels, blocked, allowed).map((f) => f.ucid), [U2]);
  assert.deepEqual(A.flaggedChannels(null, null, null), []);
  // An allow entry beats the rule in decide().
  const idx = A.buildIndex(channels, blocked, allowed);
  assert.equal(A.decide(false, { ucid: U1 }, idx), null);
  assert.equal(A.decide(false, { ucid: U2 }, idx), 'channel');
});
