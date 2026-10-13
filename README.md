<p align="center"><img src="icons/icon128.png" width="96" height="96" alt=""></p>

# AI Label Filter for YouTube

A Chrome extension that hides the YouTube videos YouTube itself labels as made with AI, and tells you why each one was hidden. No guessing, no server, no account.

[한국어](README.kr.md)

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![Version](https://img.shields.io/badge/version-1.0.0-orange) <!-- TODO verify: version in manifest.json -->
![License: MIT](https://img.shields.io/badge/license-MIT-green)

> **Read this first: it will not catch most AI videos.**
> The extension relies on YouTube's own "Made with AI" label. Many AI-generated videos don't have that label. Creators add some labels themselves, and since May 2026 YouTube also adds some automatically, but plenty of AI videos still have none. So the filter is precise (it never guesses from titles, thumbnails or a model) but it is not complete.
> To catch more, you can turn on [AiSList](https://github.com/Override92/AiSList), a community-maintained list of AI channels with its own review and removal process. It is off by default.

<!-- TODO screenshots (do not ship until real captures exist):
![Home feed with labelled videos dimmed, each showing why](docs/feed-dim.png)
![Banner on a labelled video's watch page](docs/watch-banner.png)
![Popup: counts per reason, lists, settings](docs/popup.png)
![Demo](docs/demo.gif)
-->

---

## Features

- **Uses YouTube's own label**: a video counts as AI only if YouTube shows its AI badge under the title
- **Watch page banner**: when the video you open is labelled, a banner offers **Hide this channel** or **Dismiss**
- **Feed filtering**: hides cards from home, search and the sidebar for known labelled videos, channels you blocked, channels flagged automatically, and (if you turn it on) channels listed in AiSList <!-- TODO verify: exact list of surfaces (subscriptions, channel pages, Shorts shelves) -->
- **Hide or dim**: hide cards (default), or dim them with a chip saying why
- **Show anyway**: reveal any single card with one click <!-- TODO verify: how "show anyway" is reached in hide mode -->
- **Allowlist**: channels you trust are never hidden, whatever the reason
- **Popup**: global on/off, counts per reason, your block list and allowlist
- **Fails open**: if anything goes wrong, videos are shown, not hidden

---

## How it decides

### The signal

YouTube shows a small "AI" badge under the title of videos it labels as made with AI. That badge is in the data YouTube's web app loads for a watch page, but not in the data for home, search or sidebar cards. So the only way to know whether a video in your feed is labelled is to ask YouTube about that video.

The extension does this with one small request per video to `/youtubei/v1/next`, the endpoint the YouTube web app itself uses to load a watch page. The request:

- is sent from the YouTube page itself (from `www.youtube.com`), not from a background service
- omits your cookies, so it is not tied to your YouTube or Google account
- asks for just a few fields (the badges under the title and the video's channel), so the reply is about 1 KB instead of several hundred KB

A video counts as AI **only** if the reply contains YouTube's AI badge (internally a `metadataBadgeRenderer` with style `BADGE_STYLE_TYPE_SIMPLE` and icon `INFO`). The "How this was made" panel on its own does **not** count, because YouTube also shows it for auto-dubbed videos and for footage marked "captured with a camera".

### Where it checks

| Where | Requests | What happens |
|---|---|---|
| Watch page | 1, for the video you opened | If the video is labelled, a banner offers **Hide this channel** / **Dismiss**. The result is cached. |
| Feeds (default) | none | Cards are hidden only from what is already known on your device (see below). |
| Feeds with **Check videos in feeds** on (off by default) | 1 per visible video that has no cached result, one at a time, at least 1 s apart | Labelled videos are hidden as they are found. |

### Why a card gets hidden

In this order:

1. **Allowlist**: if the channel is on your allowlist, the card is always shown.
2. **Blocked channel**: you blocked the channel (from the banner or the popup).
3. **Made with AI label**: the video itself was found to be labelled.
4. **Auto-flagged channel**: the extension has seen 2 or more labelled videos from this channel on your device.
5. **Listed in AiSList**: only if you turned AiSList on.

Otherwise the card is shown.

Results are cached on your device: 30 days for a video with no label (YouTube may add a label later), 180 days for a labelled one.

### When something goes wrong

- **Any error** (network failure, unexpected reply, removed video): the video is shown and nothing is cached.
- **YouTube pushes back** (HTTP 403 or 429, or its "unusual traffic" / "Sorry" page): all requests stop for 24 hours.
- **Daily self-check**: once a day the extension checks a few videos known to carry the label. If it no longer finds the label (for example because YouTube changed its data format), the popup warns that detection may be broken. <!-- TODO verify: self-check runs when the extension is globally off / while paused? -->

---

## Privacy

There is no server. Nothing is ever sent to the developer. Here is every request the extension makes:

| When | Request | Sent to | Contains | Your cookies |
|---|---|---|---|---|
| You open a watch page | 1 × `POST /youtubei/v1/next` (field-masked) | `www.youtube.com` | that video's ID and the standard YouTube web client fields <!-- TODO verify: exact request body (client name/version, hl/gl?) --> | not sent |
| **Check videos in feeds** is on | the same, per visible video with no cached result, at most 1 per second | `www.youtube.com` | that video's ID | not sent |
| Once a day (self-check) | the same, for a few reference videos | `www.youtube.com` | the reference videos' IDs | not sent |
| AiSList is on, at most once per 24 h | `GET` of the [AiSList blocklist file](https://github.com/Override92/AiSList) | `raw.githubusercontent.com` | an ordinary file download, nothing about you | not applicable |

As with any web request, YouTube and GitHub see your IP address and browser user agent. YouTube already knows which videos it shows you; these requests only ask it about those same videos.

Stored locally in `chrome.storage` and nowhere else: your settings, block list and allowlist, the per-video results cache, per-channel counts of labelled videos, the downloaded AiSList copy, and the hidden-card counts shown in the popup. <!-- TODO verify: storage.local only, or settings in storage.sync? --> Uninstalling the extension deletes all of it.

No analytics, no telemetry, no YouTube Data API, no account. Full policy: [PRIVACY.md](PRIVACY.md).

---

## Permissions

| Permission | Why it is needed |
|---|---|
| `storage` | Saves your settings, block list, allowlist, the results cache and the AiSList copy on your device. |
| Content script on `*://www.youtube.com/*` | Reads video and channel links on YouTube pages, hides or dims cards, shows the watch-page banner, and sends the label request from the YouTube page itself. Because the request comes from `www.youtube.com`, no extra host permission is needed. |
| Optional: `https://raw.githubusercontent.com/*` | Requested only at the moment you turn on AiSList, and used only to download that list. If you never turn it on, the extension never asks for it. <!-- TODO verify: is the permission removed again when AiSList is turned off? --> |

It does not ask for `tabs`, `history`, "read and change all your data on all websites", or anything else.

---

## Installation

> The extension is not on the Chrome Web Store yet. <!-- TODO: Chrome Web Store link once published --> Load it manually in developer mode:

1. Download or clone this repository
   ```
   git clone https://github.com/Nova-47/ai-label-filter-for-youtube.git
   ```
   <!-- TODO verify: final repository URL -->

2. Open Chrome and go to `chrome://extensions`

3. Enable **Developer mode** (toggle in the top-right corner)

4. Click **Load unpacked** and select the `ai-label-filter-for-youtube` folder

5. Open YouTube. Click the extension icon to see the settings and counts.

---

## Settings (popup)

<!-- TODO verify: setting names and wording against popup.html -->

| Setting | Default | What it does |
|---|---|---|
| On/off | On | Turns all filtering and requests on or off. |
| Hide / Dim | Hide | Hide removes the card; Dim fades it and shows why it was filtered. |
| Check videos in feeds | Off | Asks YouTube about visible feed videos that have no cached result (1 at a time, at least 1 s apart). |
| AiSList subscription | Off | Hides channels listed in AiSList. Downloads the list from GitHub at most once per 24 h. |
| Block list / Allowlist | empty | Channels you always hide / never hide. |

The popup also shows how many cards were hidden for each reason, and a warning if requests are paused or the daily self-check failed.

---

## FAQ

**Why not use machine learning or heuristics to detect AI videos?**
Guessing from titles, thumbnails or audio produces false positives, and then you can't tell why a video disappeared. This extension only acts on signals someone accountable made: YouTube's label, your own block list, and (if you opt in) a human-reviewed community list. Every hidden card has a reason you can see and undo.

**Why does it need to talk to YouTube at all?**
YouTube doesn't include the AI label in the data for home, search or sidebar cards; it is only in the data for a video's watch page. To know whether a video is labelled, the extension has to ask YouTube about that video. It asks YouTube directly from the YouTube page, without your cookies, and asks for only the few fields it needs. (YouTube rejects these requests when they come from an extension's background service worker, which is another reason they come from the page.)

**Does it slow YouTube down?**
By default it makes one extra request per watch page, with a reply of about 1 KB. Feed filtering by default is a local lookup with no network requests. With **Check videos in feeds** on, requests go out one at a time, at least 1 s apart, only for visible cards, and each result is cached (30 / 180 days).

**Can YouTube rate-limit or block me?**
The endpoint is YouTube's internal API, not a documented public one, so there are no guarantees: YouTube can limit or change it at any time. The extension keeps the rate low (see above), omits your cookies so requests are not tied to your account, and stops all requests for 24 hours if YouTube answers with 403, 429 or its "Sorry" page. The requests still come from your IP address. If you want no extra requests in feeds, leave **Check videos in feeds** off (the default).

**A video that is obviously AI is still showing. Why?**
Most likely it has no YouTube label. See the limitation at the top. You can block the channel from the popup, or turn on AiSList for broader coverage.

**AiSList hid a channel that isn't AI.**
Add the channel to your allowlist; it will never be hidden again. To get the entry fixed for everyone, use [AiSList's own removal process](https://github.com/Override92/AiSList). This extension doesn't edit the list.

**Does it skip Shorts?**
No. There is no Shorts auto-skip in v1. <!-- TODO verify: whether Shorts cards in feeds are filtered like other cards -->

**What if YouTube changes its data format?**
Then labelled videos stop being detected and are shown (the extension fails open). The daily self-check notices this and warns you in the popup.

---

## Development

<!-- TODO verify: test command and file layout from the code agent's notes -->

- Unit tests: `node --test`
- Build the Chrome Web Store zip: `scripts/package.sh` (writes `dist/ai-label-filter-for-youtube-<version>.zip`)

---

## Changelog

### v1.0.0
- Initial release

---

## Credits

- The technique of reading YouTube's AI label with one field-masked `/youtubei/v1/next` request per video is adapted from [Weedout for YouTube](https://github.com/masteranza/weedout-for-youtube) by masteranza (MIT). <!-- TODO verify: if any Weedout code was copied, include its MIT copyright notice -->
- [AiSList](https://github.com/Override92/AiSList) by Override92 is licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). It is not bundled with this extension; your browser downloads it from its source only if you turn the subscription on. This extension is free and non-commercial, and is not affiliated with AiSList.

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first.

## License

[MIT](LICENSE)

This project is not affiliated with, endorsed by, or sponsored by YouTube or Google LLC. YouTube is a trademark of Google LLC.
