// Pure helpers shared by content.js, background.js, popup.js and the node tests.
// No DOM, no chrome.* here: everything in this file can be unit-tested with
// `node --test`. In the extension it is loaded first and exposed as `AILF`.
(function (root) {
  'use strict';

  const DAY = 86400000;

  // ── InnerTube `next` request ───────────────────────────────────────────────
  // Partial-response mask: the full response is ~400 KB, this is ~0.4 KB.
  // Only two things are requested: the badges under the title and the
  // owner's channel id + @handle.
  const NEXT_FIELDS =
    'contents.twoColumnWatchNextResults.results.results.contents(' +
      'videoPrimaryInfoRenderer.badges.metadataBadgeRenderer(style,icon,label),' +
      'videoSecondaryInfoRenderer.owner.videoOwnerRenderer.navigationEndpoint.browseEndpoint(browseId,canonicalBaseUrl))';

  // Videos that carried YouTube's "AI" badge when checked on 2026-10-13, from
  // two channels (@eigi_and_ai, @foreverharmony_official). The daily
  // self-check expects at least one of them to still be detected.
  const CANARY_IDS = ['yHG-pivADos', 'Xpg-JIuJ_cU'];

  // Cache lifetimes and size. A "clean" verdict expires sooner because YouTube
  // may label a video later; AI labels are rarely removed.
  const TTL_CLEAN_DAYS = 30;
  const TTL_AI_DAYS = 180;
  const CACHE_MAX = 20000;
  const CHANNELS_MAX = 5000;

  const BREAKER_MS = DAY;        // pause all YouTube requests this long
  const RETRY_MS = 15 * 60000;   // first pause after a refused request (doubles)
  const REQUEST_GAP_MS = 1000;   // between two YouTube requests, browser-wide
  const SELFCHECK_STALE_MS = 5 * 60000; // a self-check unfinished this long was cut off
  const AUTOFLAG_MIN_AI = 2;     // labelled videos needed to flag a channel (implied by
                                 // the two below today; kept so the rule reads in full)
  const AUTOFLAG_MIN_CHECKED = 3; // checked videos needed to flag a channel
  const AUTOFLAG_MIN_RATIO = 0.6; // and this share of its checked videos labelled
  const CHANNEL_WINDOW = 20;     // most recent checked videos kept per channel

  const AISLIST_URL =
    'https://raw.githubusercontent.com/Override92/AiSList/main/AiSList/aislist_blocklist.txt';

  // ── Verdict parsing ────────────────────────────────────────────────────────
  // The one signal that counts: a metadataBadgeRenderer under the video title
  // with style BADGE_STYLE_TYPE_SIMPLE *and* the INFO icon. Both are needed:
  // auto-dubbed videos also get a SIMPLE badge, with a different icon
  // (PERSON_RADAR_FILLED). Checking the icon, not the label text, keeps this
  // independent of the UI language.
  function isAiBadge(badge) {
    const b = badge && badge.metadataBadgeRenderer;
    return !!b && b.style === 'BADGE_STYLE_TYPE_SIMPLE' && !!b.icon && b.icon.iconType === 'INFO';
  }

  const arr = (x) => (Array.isArray(x) ? x : []);

  // Read only the scoped paths, so the same function is safe on a full
  // (unmasked) response: secondaryResults (the sidebar) is never visited.
  // Returns { ai: true | false | null, ucid, handle }.
  // ai === null means "can't tell" (no videoPrimaryInfoRenderer at all, e.g. a
  // removed video or a changed response shape); callers treat it as unknown
  // and never cache it.
  function parseNext(json) {
    const out = { ai: null, ucid: null, handle: null };
    const contents = json && json.contents && json.contents.twoColumnWatchNextResults &&
      json.contents.twoColumnWatchNextResults.results &&
      json.contents.twoColumnWatchNextResults.results.results &&
      json.contents.twoColumnWatchNextResults.results.results.contents;
    for (const c of arr(contents)) {
      if (!c || typeof c !== 'object') continue;
      if (c.videoPrimaryInfoRenderer) {
        out.ai = out.ai === true || arr(c.videoPrimaryInfoRenderer.badges).some(isAiBadge);
      }
      const owner = c.videoSecondaryInfoRenderer && c.videoSecondaryInfoRenderer.owner &&
        c.videoSecondaryInfoRenderer.owner.videoOwnerRenderer;
      const be = owner && owner.navigationEndpoint && owner.navigationEndpoint.browseEndpoint;
      if (be) {
        if (isUcid(be.browseId)) out.ucid = be.browseId;
        out.handle = normalizeHandle(be.canonicalBaseUrl);
      }
    }
    return out;
  }

  // ── Channels and links ─────────────────────────────────────────────────────
  const isUcid = (s) => typeof s === 'string' && /^UC[\w-]{22}$/.test(s);

  // "@Foo", "/@Foo/videos", "https://www.youtube.com/@Foo", "%C3%80i" → "foo"/"ài".
  // Canonical form: decoded, NFC, lowercase, without the leading "@".
  function normalizeHandle(s) {
    if (typeof s !== 'string') return null;
    const m = s.match(/(?:^|\/)@([^/?#\s]+)/);
    if (!m) return null;
    let h = m[1];
    try { h = decodeURIComponent(h); } catch { /* malformed %-escape: keep raw */ }
    h = h.normalize('NFC').toLowerCase();
    return h || null;
  }

  // Channel referenced by a link: { handle } for /@name, { ucid } for /channel/UC…
  function channelFromHref(href) {
    if (typeof href !== 'string') return null;
    const u = href.match(/\/channel\/(UC[\w-]{22})(?:[/?#]|$)/);
    if (u) return { ucid: u[1] };
    if (!/(?:^|\/)@/.test(href)) return null;
    const handle = normalizeHandle(href.replace(/^https?:\/\/[^/]+/, ''));
    return handle ? { handle } : null;
  }

  function videoIdFromHref(href) {
    if (typeof href !== 'string') return null;
    const m = href.match(/[?&]v=([\w-]{11})(?![\w-])/) || href.match(/\/shorts\/([\w-]{11})(?![\w-])/);
    return m ? m[1] : null;
  }

  // ── AiSList ────────────────────────────────────────────────────────────────
  // Format: "!" comments, one "@handle" or "UC…" id per line. Returns the
  // compact form we store: one entry per line, handles normalised (lowercase,
  // so they can never collide with the case-sensitive "UC…" ids).
  function parseList(text) {
    const out = new Set();
    for (const raw of String(text).split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('!')) continue;
      if (isUcid(line)) { out.add(line); continue; }
      if (line.startsWith('@')) {
        const h = normalizeHandle(line);
        if (h) out.add(h);
      }
    }
    return [...out];
  }

  // ── Verdict cache ──────────────────────────────────────────────────────────
  // cache: { videoId: [ai 0|1, checkedDay, seenDay, ucid?, handle?] }. Days
  // since epoch keep the stored object small. `seenDay` makes eviction
  // least-recently-seen. AI entries also keep the owner, so a cached verdict
  // can still offer "Hide this channel" without a new request.
  const today = (now = Date.now()) => Math.floor(now / DAY);

  function cacheGet(cache, id, day) {
    const e = cache[id];
    if (!e) return null;
    const ttl = e[0] ? TTL_AI_DAYS : TTL_CLEAN_DAYS;
    return day - e[1] > ttl ? null : e[0] === 1;
  }

  function cachePut(cache, id, ai, day, owner) {
    cache[id] = ai ? [1, day, day, (owner && owner.ucid) || 0, (owner && owner.handle) || 0] : [0, day, day];
  }

  const cacheOwner = (cache, id) => {
    const e = cache[id];
    return e && (e[3] || e[4]) ? { ucid: e[3] || null, handle: e[4] || null } : null;
  };

  // Drop expired entries first, then least recently seen, down to 80% of max.
  function cachePrune(cache, day, max = CACHE_MAX) {
    for (const id in cache) if (cacheGet(cache, id, day) === null) delete cache[id];
    const ids = Object.keys(cache);
    if (ids.length <= max) return cache;
    ids.sort((a, b) => (cache[a][2] || 0) - (cache[b][2] || 0));
    for (const id of ids.slice(0, ids.length - Math.floor(max * 0.8))) delete cache[id];
    return cache;
  }

  // ── Channel aggregates ─────────────────────────────────────────────────────
  // channels: { ucid: { h: handle, v: [[videoId, 1 labelled | 0 clean], …], d: last verdict day } }.
  // `v` is a window of the last CHANNEL_WINDOW distinct videos checked from
  // the channel, oldest first. A video checked again is updated in place and
  // moved to the end, so it counts once and a changed verdict replaces the old
  // one; past the window the oldest video drops out. The rule is computed over
  // this window only, so a channel that changes course is judged by what it
  // posts now, and labelled and clean videos are sampled the same way.
  // Entries saved in an older format (no `v`) have no usable checked count:
  // they are not flagged, and the next verdict for the channel starts a new
  // window (their old video ids are dropped).
  // Size: 5,000 channels (CHANNELS_MAX) with full windows and a 16-character
  // handle are 2.14 MB as JSON (measured with JSON.stringify in node), and the
  // whole `channels` object is rewritten on each save.
  const isWindow = (c) => !!c && Array.isArray(c.v);

  function recordVerdict(channels, ucid, handle, videoId, ai, day) {
    if (!isUcid(ucid)) return channels;
    let c = channels[ucid];
    if (!isWindow(c)) c = channels[ucid] = { h: (c && c.h) || null, v: [] };
    if (handle) c.h = handle;
    c.d = day;
    c.v = c.v.filter((e) => Array.isArray(e) && e[0] !== videoId);
    c.v.push([videoId, ai ? 1 : 0]);
    if (c.v.length > CHANNEL_WINDOW) c.v = c.v.slice(-CHANNEL_WINDOW);
    return channels;
  }

  // Two tabs may have updated the same channel. `b` is this tab's copy: its
  // window is laid on top of the stored one (`a`), so b's verdict wins for a
  // video both have, and the result is cut back to the window. An old-format
  // side loses to a window, as recordVerdict would have replaced it.
  function mergeChannel(a, b) {
    if (!a || !b) return a || b;
    const d = Math.max(a.d || 0, b.d || 0), h = b.h || a.h || null;
    if (isWindow(a) !== isWindow(b)) return { ...(isWindow(a) ? a : b), h, d };
    if (!isWindow(a)) return { h, ai: [...new Set([...(a.ai || []), ...(b.ai || [])])].slice(0, 5), d };
    const mine = new Set(b.v.map((e) => e[0]));
    const v = [...a.v.filter((e) => !mine.has(e[0])), ...b.v].slice(-CHANNEL_WINDOW);
    return { h, v, d };
  }

  // Labelled and checked counts over a channel's window, or null for an
  // old-format entry.
  const channelCounts = (c) => (isWindow(c)
    ? { ai: c.v.filter((e) => Array.isArray(e) && e[1] === 1).length, checked: c.v.length } : null);

  function isAutoFlagged(c) {
    const n = channelCounts(c);
    return !!n && n.checked >= AUTOFLAG_MIN_CHECKED && n.ai >= AUTOFLAG_MIN_AI
      && n.ai / n.checked >= AUTOFLAG_MIN_RATIO;
  }

  // Past `max` entries, drop down to 80%: channels without a labelled video
  // first, then the rest, least recently seen first. Auto-flagged channels
  // and the ones in `keep` (block/allow list keys) always stay.
  function channelsPrune(channels, keep, max = CHANNELS_MAX) {
    const ids = Object.keys(channels);
    if (ids.length <= max) return channels;
    const n = (u) => (channelCounts(channels[u]) || { ai: 0 }).ai;
    const out = ids.filter((u) => !isAutoFlagged(channels[u]) && !keep.has(u))
      .sort((a, b) => n(a) - n(b) || (channels[a].d || 0) - (channels[b].d || 0));
    for (const u of out.slice(0, ids.length - Math.floor(max * 0.8))) delete channels[u];
    return channels;
  }

  // ── Saving ─────────────────────────────────────────────────────────────────
  // Tabs share storage. A save re-reads it and lays the entries this tab
  // changed (`ids`) on top: verdicts newest-checked wins, channels merge.
  function mergeDirty(stored, mine, ids, merge) {
    for (const id of ids) if (mine[id]) stored[id] = merge(stored[id], mine[id]);
    return stored;
  }

  const mergeVerdict = (a, b) => (a && a[1] > b[1] ? a : b);

  // ── Circuit breaker ────────────────────────────────────────────────────────
  // A 403/429, a redirect (requests use redirect:'manual'; `next` never
  // redirects normally, a block sends you to google.com/sorry) or an HTML
  // CAPTCHA page instead of JSON means YouTube is rate-limiting this IP.
  // Then *every* request stops for 24 h.
  function isBlockedResponse(status, type, body) {
    if (status === 403 || status === 429 || type === 'opaqueredirect') return true;
    return typeof body === 'string' && /^\s*</.test(body) &&
      /unusual traffic|captcha|\/sorry\//i.test(body);
  }

  const breakerOpen = (b, now = Date.now()) => !!b && typeof b.until === 'number' && now < b.until;
  const breakerTrip = (reason, now = Date.now()) => ({ until: now + BREAKER_MS, reason: String(reason) });

  // Wait before the next request until REQUEST_GAP_MS after `last`: the last
  // reply, or the last send if its tab was reloaded mid-request (from any
  // tab). At most the gap, so a clock set back cannot stall requests.
  const requestWait = (last, now = Date.now()) =>
    (Number.isFinite(last) ? Math.min(REQUEST_GAP_MS, Math.max(0, last + REQUEST_GAP_MS - now)) : 0);

  // Any other refusal (400: mask or clientVersion rejected, 404, 5xx, a reply
  // that isn't JSON) pauses requests too: 15 min, doubling while it keeps
  // happening (`n` in a row), at most 24 h. A good reply clears it. There is
  // no unmasked retry, so a rejected mask never costs ~400 KB per video.
  function backoff(prev, reason, now = Date.now()) {
    const n = ((prev && prev.n) || 0) + 1;
    return { until: now + Math.min(BREAKER_MS, RETRY_MS * 2 ** (n - 1)), reason: String(reason), n };
  }

  // What one `next` reply means: { kind: 'blocked' | 'bad', why } or
  // { kind: 'ok', ai, ucid, handle }.
  function readResponse(status, type, body) {
    if (isBlockedResponse(status, type, body)) {
      return { kind: 'blocked', why: type === 'opaqueredirect' ? 'redirect' : 'HTTP ' + status };
    }
    if (!(status >= 200 && status < 300)) return { kind: 'bad', why: 'HTTP ' + status };
    try { return { kind: 'ok', ...parseNext(JSON.parse(body)) }; } catch { return { kind: 'bad', why: 'not JSON' }; }
  }

  // ── Self-check ─────────────────────────────────────────────────────────────
  // Due once a day (by the last run's start), never while requests are paused.
  // A run still `pending` after SELFCHECK_STALE_MS was cut off (its tab was
  // closed or reloaded before the verdict was stored): due again, so it
  // can't use up the day.
  const selfcheckDue = (sc, b, now = Date.now()) =>
    !breakerOpen(b, now) && !(sc && typeof sc.at === 'number' && now >= sc.at && now - sc.at < DAY &&
      !(sc.pending && now - sc.at >= SELFCHECK_STALE_MS));

  // `results`: lookup() results for the canaries, in order (the check stops at
  // the first labelled one or the first failure). Verdicts:
  //   ok       a canary still shows the label
  //   error    YouTube refused the request or sent an unusable reply (warn)
  //   unknown  offline, paused or blocked: no news (the popup shows pauses)
  //   broken   the label can't be found (warn): every canary is there and
  //            none is labelled; or a canary's owner reads but its label
  //            can't (`ai: null`); or no canary reads at all. A changed reply
  //            shape looks like the last two, two canaries gone at once rarely
  //   missing  mixed: one canary is gone (removed or private, nothing reads)
  //            and the other is not labelled: can't tell, no warning; time to
  //            pick new canaries
  function selfcheckVerdict(results) {
    if (results.some((r) => r.kind === 'ok' && r.ai === true)) return 'ok';
    if (results.some((r) => r.kind === 'bad')) return 'error';
    if (!results.length || results.some((r) => r.kind !== 'ok')) return 'unknown';
    if (results.some((r) => r.ai === null && (r.ucid || r.handle))) return 'broken';
    const all = (ai) => results.every((r) => r.ai === ai);
    return results.length >= 2 && (all(false) || all(null)) ? 'broken' : 'missing';
  }

  // ── Card lookup queue (Tier 2) ─────────────────────────────────────────────
  // Newest first: what is on screen now came into view last. A video seen
  // again moves to the top; past QUEUE_MAX the oldest entries go.
  const QUEUE_MAX = 30;
  function enqueue(queue, vid, max = QUEUE_MAX) {
    const i = queue.indexOf(vid);
    if (i >= 0) queue.splice(i, 1);
    queue.push(vid);
    if (queue.length > max) queue.shift();
    return queue;
  }

  // The next video to look up, or null. Entries no longer wanted (scrolled
  // away, card reused, verdict known) are dropped on the way.
  function takeNext(queue, wanted) {
    while (queue.length) {
      const vid = queue.pop();
      if (wanted(vid)) return vid;
    }
    return null;
  }

  // ── Decision ───────────────────────────────────────────────────────────────
  // Why a card should be hidden, or null to show it. Order matters: the
  // allowlist always wins; the user's own blocklist comes before automatic
  // reasons. `ch` is { ucid?, handle? } (either may be missing), `idx` the
  // lookup sets from buildIndex().
  function decide(videoAi, ch, idx) {
    const keys = channelKeys(ch, idx);
    if (keys.some((k) => idx.allow.has(k))) return null;
    if (keys.some((k) => idx.block.has(k))) return 'blocked';
    if (videoAi === true) return 'label';
    if (keys.some((k) => idx.flagged.has(k))) return 'channel';
    if (idx.list && keys.some((k) => idx.list.has(k))) return 'aislist';
    return null;
  }

  // All keys a channel is known by: its UC id, its handle, and whichever of the
  // two we learned from earlier `next` responses (idx.h2u / idx.u2h).
  function channelKeys(ch, idx) {
    if (!ch) return [];
    const ucid = ch.ucid || (ch.handle && idx.h2u.get(ch.handle)) || null;
    const handle = ch.handle || (ucid && idx.u2h.get(ucid)) || null;
    return [ucid, handle].filter(Boolean);
  }

  // The lookup sets decide() needs: handle <-> UC id pairs learnt from `next`
  // replies and list entries, auto-flagged channels, and the list keys.
  function buildIndex(channels, blocked, allowed, list = null) {
    const h2u = new Map(), u2h = new Map(), flagged = new Set();
    for (const [ucid, c] of Object.entries(channels || {})) {
      if (c.h) { h2u.set(c.h, ucid); u2h.set(ucid, c.h); }
      if (isAutoFlagged(c)) { flagged.add(ucid); if (c.h) flagged.add(c.h); }
    }
    const keys = (o) => {
      const s = new Set();
      for (const e of Object.values(o || {})) {
        if (e.ucid) s.add(e.ucid);
        if (e.handle) s.add(e.handle);
        if (e.ucid && e.handle) { h2u.set(e.handle, e.ucid); u2h.set(e.ucid, e.handle); }
      }
      return s;
    };
    return { h2u, u2h, flagged, block: keys(blocked), allow: keys(allowed), list };
  }

  // ── Block / allow lists ────────────────────────────────────────────────────
  // { key: { ucid, handle, added } }, key = the UC id if known, else "@handle".
  // Keys of every entry for the same channel as `ch`: same UC id, same
  // handle, or linked through a known handle <-> id pair.
  function listKeysFor(list, ch, idx) {
    const want = new Set(channelKeys(ch, idx));
    return Object.keys(list).filter((k) => channelKeys(list[k], idx).some((x) => want.has(x)));
  }

  // Put a channel under one key, replacing every entry for it, so it never
  // sits under two keys and "Remove" (listDrop) really removes it.
  function listPut(list, ch, idx, added) {
    const keys = channelKeys(ch, idx);
    let ucid = keys.find(isUcid) || null, handle = keys.find((k) => !isUcid(k)) || null;
    for (const k of listKeysFor(list, ch, idx)) {
      ucid = ucid || list[k].ucid || null;
      handle = handle || list[k].handle || null;
      delete list[k];
    }
    if (ucid || handle) list[ucid || '@' + handle] = { ucid, handle, added };
    return list;
  }

  function listDrop(list, ch, idx) {
    for (const k of listKeysFor(list, ch, idx)) delete list[k];
    return list;
  }

  const api = {
    NEXT_FIELDS, CANARY_IDS, TTL_CLEAN_DAYS, TTL_AI_DAYS, CACHE_MAX, CHANNELS_MAX, BREAKER_MS, RETRY_MS,
    REQUEST_GAP_MS, SELFCHECK_STALE_MS, AUTOFLAG_MIN_AI, AUTOFLAG_MIN_CHECKED, AUTOFLAG_MIN_RATIO, CHANNEL_WINDOW, AISLIST_URL, DAY, QUEUE_MAX,
    isAiBadge, parseNext, isUcid, normalizeHandle, channelFromHref, videoIdFromHref,
    parseList, today, cacheGet, cachePut, cacheOwner, cachePrune, recordVerdict, mergeChannel, channelCounts, isAutoFlagged,
    channelsPrune, mergeDirty, mergeVerdict, isBlockedResponse, breakerOpen, breakerTrip, requestWait, backoff, readResponse,
    selfcheckDue, selfcheckVerdict, enqueue, takeNext, decide, channelKeys, buildIndex, listKeysFor, listPut, listDrop,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AILF = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
