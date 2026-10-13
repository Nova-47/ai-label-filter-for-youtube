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

  // Videos that carried YouTube's "AI" badge when checked on 2026-10-13.
  // The daily self-check expects at least one of them to still be detected.
  const CANARY_IDS = ['yHG-pivADos', 'e9D14ALX3s0'];

  // Cache lifetimes and size. A "clean" verdict expires sooner because YouTube
  // may label a video later; AI labels are rarely removed.
  const TTL_CLEAN_DAYS = 30;
  const TTL_AI_DAYS = 180;
  const CACHE_MAX = 20000;

  const BREAKER_MS = DAY;        // pause all YouTube requests this long
  const RETRY_MS = 15 * 60000;   // first pause after a refused request (doubles)
  const REQUEST_GAP_MS = 1000;   // between two YouTube requests, browser-wide
  const AUTOFLAG_MIN_AI = 2;     // labelled videos needed to flag a channel

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
  // channels: { ucid: { h: handle, ai: [videoIds] } }.
  // Labelled video ids are kept (max 5) so the same video is never counted twice.
  function recordVerdict(channels, ucid, handle, videoId, ai) {
    if (!isUcid(ucid)) return channels;
    const c = channels[ucid] || (channels[ucid] = { h: null, ai: [] });
    if (handle) c.h = handle;
    if (ai && !c.ai.includes(videoId) && c.ai.length < 5) c.ai.push(videoId);
    return channels;
  }

  // Two tabs may have updated the same channel; keep the union of both.
  function mergeChannel(a, b) {
    if (!a || !b) return a || b;
    return { h: b.h || a.h, ai: [...new Set([...a.ai, ...b.ai])].slice(0, 5) };
  }

  const isAutoFlagged = (c) => !!c && Array.isArray(c.ai) && c.ai.length >= AUTOFLAG_MIN_AI;

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
  // lookup sets built by the content script.
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

  const api = {
    NEXT_FIELDS, CANARY_IDS, TTL_CLEAN_DAYS, TTL_AI_DAYS, CACHE_MAX, BREAKER_MS, RETRY_MS, REQUEST_GAP_MS,
    AUTOFLAG_MIN_AI, AISLIST_URL, DAY, QUEUE_MAX,
    isAiBadge, parseNext, isUcid, normalizeHandle, channelFromHref, videoIdFromHref,
    parseList, today, cacheGet, cachePut, cacheOwner, cachePrune, recordVerdict, mergeChannel, isAutoFlagged,
    isBlockedResponse, breakerOpen, breakerTrip, backoff, readResponse, enqueue, takeNext, decide, channelKeys,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AILF = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
