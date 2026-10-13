# Privacy Policy: AI Label Filter for YouTube

Last updated: 2026-10-13

**This extension does not collect, sell, or share any personal or usage data. Nothing is ever sent to the developer. There is no server, no account, no analytics and no telemetry.**

## What it stores

Everything is kept in your browser's extension storage (`chrome.storage`) on your device: <!-- TODO verify: storage.local only, or settings in storage.sync? And this list of stored items against the code -->

- your settings (on/off, hide or dim, whether feed checking and AiSList are on)
- your channel block list and allowlist
- a cache of results per video (video ID, whether it carries YouTube's AI label, and when it was checked), kept for 30 days for unlabelled videos and 180 days for labelled ones
- per channel seen in a result: its ID, its @handle, how many of its videos were checked, and the IDs of up to 5 of its labelled videos (used to flag channels with 2 or more labelled videos)
- if you turned AiSList on, the downloaded copy of the list
- the number of cards hidden for each reason, the time of the last self-check, and whether requests are paused

This data never leaves your device. It is deleted when you uninstall the extension.

## Network requests

The extension makes only the following requests:

1. **To `www.youtube.com`** (`POST /youtubei/v1/next`, YouTube's own endpoint for watch-page data), to read whether a video carries YouTube's "Made with AI" label:
   - one request for the video you open on a watch page;
   - if you turn on "Check videos in feeds" (off by default), one request per visible video that has no cached result, one at a time, at least 1 second apart;
   - once a day, a request for a few reference videos, to check that label detection still works.

   Each request contains the video's ID and the standard YouTube web client fields. <!-- TODO verify: exact request body --> It is sent from the YouTube page itself with cookies omitted, so it is not linked to your YouTube or Google account. If YouTube answers with HTTP 403 or 429 or a "Sorry"/unusual-traffic page, all requests stop for 24 hours.

2. **To `raw.githubusercontent.com`**, only if you turn on the AiSList subscription (off by default): a download of the public AiSList blocklist file, at most once every 24 hours. Nothing about you or your browsing is included in this request. The permission for this site is requested only when you turn the option on.

As with any web request, YouTube and GitHub can see your IP address and browser user agent. Their own privacy policies apply to that.

The extension does not use the YouTube Data API and does not send data to any other party.

## Permissions

- `storage`: to keep the data listed above on your device.
- Content script on `*://www.youtube.com/*`: to read video and channel links on YouTube pages, hide or dim cards, show the watch-page banner, and send the requests described above.
- Optional `https://raw.githubusercontent.com/*`: requested only when you turn on AiSList, used only to download that list.

Questions: open an issue at https://github.com/Nova-47/ai-label-filter-for-youtube/issues <!-- TODO verify: final repository URL -->
