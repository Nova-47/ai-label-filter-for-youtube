# Chrome Web Store listing

Copy-paste source for the Developer Dashboard. Upload `dist/ai-label-filter-for-youtube-<version>.zip`
built by `scripts/package.sh`.

Trademark: use "for YouTube" phrasing only. No YouTube logo, red play button or YouTube screenshots
that suggest an official product in any graphic asset.

## Store listing tab

**Name** (from manifest): AI Label Filter for YouTube

**Summary** (the manifest `description`, ≤132 chars; this text is 118; keep the two identical):
Dim videos YouTube labels as made with AI and show why, or hide them. Also channels you block. No server, no tracking.

**Category:** Productivity → Tools

**Language:** English (add Korean below as a second localized listing if wanted)

**Description (English):**

```
Dim YouTube videos labelled as made with AI. You can also turn on the community list AiSList. Each dimmed video shows why. Click "Show" to show it. When the card links its channel, you can use "Allow channel". Select "Hide" to remove filtered videos instead.

AI Label Filter for YouTube uses YouTube's own "Made with AI" label and, optionally, AiSList. It does not guess from titles, thumbnails, or a detection model. A video is filtered only when there is a reason you can see.

Open source (MIT), with no build step. Every network request is made in one of two functions. Nothing is sent to the developer.

MANY AI VIDEOS ARE NOT LABELLED
YouTube labels only some AI-generated content, so many AI videos have no label. Turn on AiSList for wider coverage. It is a community-maintained list of AI channels with its own review and removal process, and it is off by default. It works best on searches and topics with many AI uploads, such as AI music, lofi, jazz and history. A personalised home feed may change little.

WHAT IT DOES
• On a video page: if YouTube labels a video as made with AI, a banner offers "Hide this channel" or "Dismiss"
• In feeds: filters cards for labelled videos, channels you hid, and optionally channels listed in AiSList
• Other videos from a channel are dimmed, never hidden, when at least 5 of its last 20 different videos have been checked on your device and 60% or more are labelled (on by default; turn it off in the popup)
• Dim + reason (default): fades the card and adds a reason chip with "Show" and "Allow channel"
• Hide: removes filtered cards; "Reveal" in the popup shows hidden cards on the page
• "Also dim channels whose recent videos are mostly AI-labelled" (on by default): turns the channel rule on or off. The popup lists channels it dims, with "Allow" to always show each one
• Optional "Check every visible video" (off by default): asks YouTube about each visible video, one request at a time across all tabs and at least 1 second apart, then saves the result
• Popup: counts by reason for the open page, Hidden channels, Always shown channels and "Dimmed for their channel" lists, and an on/off switch

SAFE DEFAULTS
• If something fails, videos are shown, not hidden
• If YouTube pushes back (HTTP 403 or 429, a redirect, or its "Sorry" page), all requests stop for 24 hours. Other refusals pause requests for 15 minutes, doubling up to 24 hours
• Once a day, it checks up to two videos known to have the label. The popup warns you if the label can no longer be read or YouTube refuses the check

PRIVACY
No server, account, or analytics. Nothing is sent to the developer. To read the label, the extension sends a small request about the video to YouTube from the YouTube page, without your cookies. If you turn on AiSList, the list is downloaded from GitHub at most once a day. Settings and results stay in your browser.

Open source (MIT): https://github.com/Nova-47/ai-label-filter-for-youtube

Credits: label technique, card list and client version lookup adapted from Weedout for YouTube (MIT). AiSList by Override92 (CC BY-NC 4.0), not bundled, downloaded from its source only if you turn it on.

This extension is not affiliated with, endorsed by, or sponsored by YouTube or Google LLC. YouTube is a trademark of Google LLC.
```

**Description (Korean, optional localized listing):** the UI is English only, so button and setting names are quoted in English.

```
YouTube에서 AI 라벨이 붙은 영상을 흐리게 표시합니다. 커뮤니티 목록 AiSList도 켤 수 있습니다. 흐리게 표시된 영상마다 이유가 나옵니다. "Show"를 누르면 다시 보입니다. 카드에 채널 링크가 있으면 "Allow channel"도 쓸 수 있습니다. 걸러진 영상을 아예 없애려면 "Hide"를 선택하세요.

AI Label Filter for YouTube는 YouTube의 "AI로 제작됨(Made with AI)" 라벨과, 켠 경우 AiSList를 사용합니다. 제목, 썸네일, 탐지 모델로 추측하지 않습니다. 확인할 수 있는 이유가 있을 때만 영상을 거릅니다.

오픈소스(MIT)이며 빌드 과정이 없습니다. 모든 네트워크 요청은 두 함수 중 하나에서 보냅니다. 개발자에게 보내는 정보는 없습니다.

라벨 없는 AI 영상이 많습니다
YouTube 라벨은 AI 생성 콘텐츠 일부에만 붙기 때문에 라벨이 없는 AI 영상이 많습니다. 더 넓게 거르려면 AiSList를 켜세요. AiSList는 커뮤니티가 관리하는 AI 채널 목록으로, 자체 검토와 삭제 요청 절차가 있으며 기본으로 꺼져 있습니다. AI 영상이 많이 올라오는 검색어와 주제(AI 음악, 로파이, 재즈, 역사 등)에서 가장 효과가 큽니다. 개인화된 홈 피드는 별로 달라지지 않을 수 있습니다.

기능
• 시청 페이지: YouTube가 AI 제작 라벨을 붙인 영상에 "Hide this channel"(이 채널 숨기기) 또는 "Dismiss"(닫기) 배너를 표시합니다
• 피드: 라벨이 확인된 영상, 직접 숨긴 채널, 선택한 경우 AiSList에 있는 채널의 카드를 거릅니다
• 이 기기에서 마지막으로 확인한 채널의 서로 다른 영상 20개 중 5개 이상을 확인했고 그중 60% 이상에 AI 라벨이 있으면, 그 채널의 다른 영상은 라벨이 없어도 숨기지 않고 이유와 함께 흐리게 표시합니다(기본 켜짐, 팝업에서 끌 수 있음)
• "Dim + reason"(기본값): 카드를 흐리게 하고 이유, "Show", "Allow channel" 버튼이 있는 칩을 표시합니다
• "Hide": 걸러진 카드를 숨깁니다. 팝업의 "Reveal"로 현재 페이지에서 숨긴 카드를 볼 수 있습니다
• "Also dim channels whose recent videos are mostly AI-labelled"(기본 켜짐): 위 채널 규칙을 켜거나 끕니다. 팝업에 이 규칙으로 흐리게 표시 중인 채널이 나오며, "Allow"로 그 채널을 항상 보이게 할 수 있습니다
• 선택 기능 "Check every visible video"(기본 꺼짐): 화면에 보이는 영상을 모든 탭에서 한 번에 하나씩, 최소 1초 간격으로 YouTube에 확인하고 결과를 저장합니다
• 팝업: 현재 페이지의 이유별 개수, "Hidden channels", "Always shown channels", "Dimmed for their channel" 목록, 켜기/끄기 스위치를 보여 줍니다

안전 기본값
• 문제가 생기면 영상을 숨기지 않고 표시합니다
• YouTube가 거부하면(HTTP 403·429, 리다이렉트, "Sorry" 페이지) 모든 요청을 24시간 멈춥니다. 그 밖의 거부에는 15분부터 시작해 최대 24시간까지 두 배씩 늘려 멈춥니다
• 하루에 한 번 라벨이 붙은 영상 최대 두 개를 확인합니다. 라벨을 읽을 수 없거나 YouTube가 확인을 거부하면 팝업에 알립니다

개인정보
서버, 계정, 분석 도구가 없습니다. 개발자에게 전송되는 정보는 없습니다. 라벨을 읽기 위해 YouTube 페이지에서 YouTube로 영상에 대한 작은 요청을 쿠키 없이 보냅니다. AiSList를 켜면 목록을 GitHub에서 하루에 최대 한 번 내려받습니다. 설정과 결과는 브라우저에만 저장됩니다.

오픈소스 (MIT): https://github.com/Nova-47/ai-label-filter-for-youtube

출처: 라벨 확인 방법, 카드 목록, 클라이언트 버전 읽기는 Weedout for YouTube(MIT)에서 가져와 고쳐 썼습니다. AiSList는 Override92의 목록(CC BY-NC 4.0)이며, 확장에 포함되어 있지 않고 켠 경우에만 원본에서 내려받습니다.

이 확장 프로그램은 YouTube 또는 Google LLC와 제휴, 보증, 후원 관계가 없습니다. YouTube는 Google LLC의 상표입니다.
```

**Graphic assets** (screenshots are built from the real captures in `docs/`, never a mock-up that looks like an official YouTube product)
- Store icon 128×128: `icons/icon128.png`
- Screenshots 1280×800: `store/screenshot-1.png` (feed with dimmed cards and reason chips), `store/screenshot-2.png` (watch-page banner), `store/screenshot-3.png` (popup)
- Small promo tile 440×280: `store/promo-small.png`

**Homepage URL:** https://github.com/Nova-47/ai-label-filter-for-youtube
**Support URL:** https://github.com/Nova-47/ai-label-filter-for-youtube/issues

## Privacy practices tab

**Single purpose description:**
Dims or hides YouTube videos that YouTube itself labels as made with AI, plus channels the user hides and, if the user opts in, channels on the community list AiSList. Shows why each one was filtered. When at least 5 of a channel's videos have been checked on the device and 60% or more of the last 20 checked are labelled, its unlabelled videos are dimmed with that reason, never hidden (on by default; the user can turn this off in the popup).

**Permission justification: storage**
Stores in chrome.storage.local on the device: the user's settings; hidden and always-shown channel lists; a cache of per-video label results (so a video is not checked again for 30 days, or 180 days if labelled); per channel, the IDs of the last 20 different videos checked from it, each with whether it is labelled and the time it was checked (to recognise channels where at least 5 were checked and at least 60% are labelled; recorded even while that rule is switched off); whether requests to YouTube are paused; the last self-check result; and, if enabled, the downloaded AiSList copy. Nothing is stored anywhere else.

**Host permission justification** (content scripts on `*://www.youtube.com/*`):
The extension works only on YouTube. The content script reads video and channel links on YouTube pages, hides or dims the cards that should be filtered, shows a banner on watch pages of labelled videos, and sends the request that reads YouTube's AI label (one small POST to www.youtube.com/youtubei/v1/next per video, with cookies omitted, one at a time and at least 1 second apart) from the YouTube page itself. It does not run on any other site.

**Optional host permission justification** (`https://raw.githubusercontent.com/*`):
Requested at runtime only when the user turns on the AiSList subscription, which is off by default. Used only to download the public AiSList blocklist text file (https://raw.githubusercontent.com/Override92/AiSList/main/AiSList/aislist_blocklist.txt) at most once every 24 hours, or when the user presses "Refresh now". The file is a plain list of channel handles and IDs; it is parsed as data and never executed. Users who don't enable AiSList are never asked for this permission, and it is removed again when they turn AiSList off.

**Remote code:** No, I am not using remote code. All JavaScript is included in the package. The optional AiSList download is a text list of channel names, treated as data only.

**Data usage:** check nothing (the extension does not collect any of the listed data types: nothing is sent to the developer or stored off the device), then tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

Note for review, if asked: the only data that leaves the device is the IDs of YouTube videos, sent to youtube.com itself (the site that served those videos) to read their AI label, without cookies. If a reviewer counts this as "Website content", tick that box and use this sentence as the explanation.

**Privacy policy URL:**
https://github.com/Nova-47/ai-label-filter-for-youtube/blob/main/PRIVACY.md

## Distribution tab
- Visibility: Public
- Regions: All regions
- Pricing: Free (must stay free and ad-free: AiSList is CC BY-NC 4.0)
