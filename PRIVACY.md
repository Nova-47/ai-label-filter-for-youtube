# Privacy Policy: AI Label Filter for YouTube

Last updated: 2026-10-13

This extension does not collect, sell, or share personal or usage data. Nothing is sent to the developer. It has no server, account, analytics, or telemetry.

## What it stores

Everything is kept in your browser's extension storage on your device (`chrome.storage.local`). Nothing is stored in `chrome.storage.sync` or elsewhere:

- your settings: on or off, Dim + reason or Hide, whether "Check every visible video" and AiSList are on, and whether you have seen the AiSList offer
- your Hidden channels and Always shown channels lists: each channel's ID and/or @handle, and when you added it
- a result per checked video: its ID, whether it carries YouTube's AI label, the day it was checked and the day its card was last seen, and for labelled videos the channel's ID and @handle. Results are kept for 30 days for unlabelled videos and 180 days for labelled ones, for at most 20,000 videos.
- per channel seen in a result: its ID, its @handle, the IDs of up to 5 of its labelled videos (used to recognise channels with 2 or more labelled videos), and the day of its last result, for at most 5,000 channels
- if you turned AiSList on: the downloaded copy of the list, its entry count, its ETag, when it was last downloaded or tried, and the last download error
- whether requests to YouTube are paused, until when and why, and when the last request was sent
- when the daily self-check last ran and its result

The number of filtered cards is not stored; the popup asks the open YouTube tab for it each time.

This data never leaves your device. It is deleted when you uninstall the extension.

## Network requests

The extension makes these requests.

1. **To `www.youtube.com`**: `POST /youtubei/v1/next`, the endpoint YouTube's web app uses for watch-page data, to read whether a video carries YouTube's "Made with AI" label:
   - one request for the video you open on a watch page, unless its result is already stored;
   - if you turn on "Check every visible video" (off by default), one request per video on screen that has no stored result;
   - once a day, one or two requests for fixed reference videos, to check that label detection still works. This runs even when "Check every visible video" is off.

   Each request contains the video's ID and the YouTube web client fields (client name `WEB`, the client version, language `en`, region `US`). It is sent from the YouTube page itself with cookies left out, so it is not linked to your YouTube or Google account. Requests from all YouTube tabs go out one at a time, each at least 1 second after the previous reply (an incognito window may have its own queue). If YouTube answers with HTTP 403 or 429, a redirect, or an "unusual traffic"/"Sorry" page, all requests stop for 24 hours. If it refuses a request in another way (HTTP 400, 404, 5xx, or a reply that is not JSON), requests pause for 15 minutes, doubling up to 24 hours while it keeps happening.

2. **To `raw.githubusercontent.com`**, only if you turn on AiSList (off by default): a download of the public AiSList blocklist file when you turn it on, then at most once every 24 hours, and when you press "Refresh now". Nothing about you or your browsing is included in this request, and cookies are left out. The permission for this site is requested only when you turn the option on, and given back when you turn it off.

YouTube and GitHub can see your IP address and browser user agent, as with any web request. Their privacy policies apply.

The extension does not use the YouTube Data API or send data to any other party.

## Permissions

- `storage`: to keep the data listed above on your device.
- Content script on `*://www.youtube.com/*`: to read video and channel links on YouTube pages, dim or hide cards, show the watch-page banner, and send the requests to YouTube described above.
- Optional `https://raw.githubusercontent.com/*`: requested only when you turn on AiSList, used only to download that list, and removed when you turn AiSList off.

Questions: open an issue: https://github.com/Nova-47/ai-label-filter-for-youtube/issues
