# Chrome Web Store listing

Copy-paste source for the Developer Dashboard. Upload `dist/ai-label-filter-for-youtube-<version>.zip`
built by `scripts/package.sh`.

Trademark: use "for YouTube" phrasing only. No YouTube logo, red play button or YouTube screenshots
that suggest an official product in any graphic asset.

## Store listing tab

**Name** (from manifest): AI Label Filter for YouTube

**Summary** (from manifest, ≤132 chars; this text is 120):
Hide videos that YouTube itself labels as made with AI, and see why each was hidden. No server, no account, no tracking.
<!-- TODO verify: must match manifest.json "description" exactly -->

**Category:** Productivity → Tools <!-- TODO verify: or Make Chrome Yours → Functionality & UI -->

**Language:** English (add Korean below as a second localized listing if wanted)

**Description (English):**

```
Hide AI-labelled videos on YouTube, and always see why something was hidden.

AI Label Filter for YouTube uses YouTube's own "Made with AI" label. It does not guess from titles, thumbnails or a detection model, so it only hides a video when there is a concrete reason you can see.

BE AWARE: MANY AI VIDEOS ARE NOT LABELLED
YouTube's label covers only part of AI-generated content. Some labels are added by creators, some automatically by YouTube, and many AI videos have none. This extension is precise, not complete. For broader coverage you can turn on AiSList, a community-maintained list of AI channels with its own review and removal process (off by default).

WHAT IT DOES
• On a video page: if YouTube labels the video as made with AI, a banner offers "Hide this channel" or "Dismiss"
• In feeds: hides cards of videos already known to be labelled, channels you blocked, channels with 2 or more labelled videos, and (optional) channels listed in AiSList
• Optional "Check videos in feeds" (off by default): checks visible videos one at a time, at least 1 second apart, and caches the results
• Hide cards, or dim them with a chip that says why
• "Show anyway" for any card, an allowlist for channels you trust
• Popup with counts per reason, your block list and allowlist, and an on/off switch

SAFE BY DEFAULT
• If anything goes wrong, videos are shown, not hidden
• If YouTube signals too many requests, all checks pause for 24 hours
• A daily self-check warns you if label detection stops working

PRIVACY
No server, no account, no analytics. Nothing is sent to the developer. To read the label, the extension sends one small request per video to YouTube itself, from the YouTube page, without your cookies. If you turn on AiSList, the list is downloaded from GitHub at most once a day. All settings and results stay in your browser.

Open source (MIT): https://github.com/Nova-47/ai-label-filter-for-youtube

Credits: label technique adapted from Weedout for YouTube (MIT). AiSList by Override92 (CC BY-NC 4.0), not bundled, downloaded from its source only if you turn it on.

This extension is not affiliated with, endorsed by, or sponsored by YouTube or Google LLC. YouTube is a trademark of Google LLC.
```

**Description (Korean, optional localized listing):**

```
YouTube에서 AI 라벨이 붙은 영상을 숨기고, 무엇을 왜 숨겼는지 항상 보여줍니다.

AI Label Filter for YouTube는 YouTube 자체의 "AI로 제작됨(Made with AI)" 라벨을 사용합니다. 제목·썸네일·탐지 모델로 추측하지 않으므로, 확인할 수 있는 구체적인 이유가 있을 때만 영상을 숨깁니다.

알아 두세요: 라벨 없는 AI 영상이 많습니다
YouTube 라벨은 AI 생성 콘텐츠의 일부에만 붙습니다. 크리에이터가 직접 붙이는 라벨도, YouTube가 자동으로 붙이는 라벨도 있지만, 라벨이 없는 AI 영상이 많습니다. 이 확장은 정확하지만 완전하지 않습니다. 더 넓게 거르려면 AiSList를 켤 수 있습니다. 커뮤니티가 관리하는 AI 채널 목록으로, 자체 검토·삭제 요청 절차가 있습니다 (기본 꺼짐).

기능
• 시청 페이지: YouTube가 AI 제작 라벨을 붙인 영상이면 "이 채널 숨기기" 또는 "닫기" 배너 표시
• 피드: 라벨이 확인된 영상, 직접 차단한 채널, 라벨 영상이 2개 이상 확인된 채널, (선택) AiSList에 등록된 채널의 카드를 숨김
• 선택 기능 "피드 영상 확인" (기본 꺼짐): 보이는 영상을 한 번에 하나씩, 최소 1초 간격으로 확인하고 결과를 캐시
• 카드를 숨기거나, 이유 칩과 함께 흐리게 표시
• 카드별 "그래도 보기", 신뢰하는 채널을 위한 허용 목록
• 팝업: 이유별 숨긴 개수, 차단 목록과 허용 목록, 켜기/끄기 스위치

기본적으로 안전하게
• 문제가 생기면 영상을 숨기지 않고 보여줍니다
• YouTube가 요청이 너무 많다는 신호를 보내면 모든 확인을 24시간 멈춥니다
• 하루 1회 자가 진단으로 라벨 탐지가 고장나면 경고합니다

개인정보
서버, 계정, 분석 도구가 없습니다. 개발자에게는 아무것도 전송되지 않습니다. 라벨을 읽기 위해 영상마다 작은 요청 1건을 YouTube 페이지에서 YouTube로 직접, 쿠키 없이 보냅니다. AiSList를 켜면 목록을 GitHub에서 하루에 최대 한 번 내려받습니다. 모든 설정과 결과는 브라우저 안에만 저장됩니다.

오픈소스 (MIT): https://github.com/Nova-47/ai-label-filter-for-youtube

출처: 라벨 확인 기법은 Weedout for YouTube (MIT)에서 가져와 고쳐 썼습니다. AiSList는 Override92의 목록(CC BY-NC 4.0)이며, 확장에 포함되어 있지 않고 켠 경우에만 원본에서 내려받습니다.

이 확장 프로그램은 YouTube 또는 Google LLC와 제휴, 보증, 후원 관계가 없습니다. YouTube는 Google LLC의 상표입니다.
```
<!-- TODO verify: if the UI is English-only, quote the English button names in the Korean description -->

**Graphic assets** <!-- TODO: none of these exist yet; capture real screenshots, do not mock up YouTube UI as if official -->
- Store icon 128×128: `icons/icon128.png`
- Screenshots 1280×800: `store/screenshot-1.png` (feed with dimmed cards and reason chips), `store/screenshot-2.png` (watch-page banner), `store/screenshot-3.png` (popup)
- Small promo tile 440×280: `store/promo-small.png`

**Homepage URL:** https://github.com/Nova-47/ai-label-filter-for-youtube <!-- TODO verify: final repository URL -->
**Support URL:** https://github.com/Nova-47/ai-label-filter-for-youtube/issues

## Privacy practices tab

**Single purpose description:**
Hides or dims YouTube videos that YouTube itself labels as made with AI (plus channels the user blocks, channels with several labelled videos, and, if the user opts in, channels on the community list AiSList), and explains why each one was hidden.

**Permission justification: storage**
Stores the user's settings, channel block list and allowlist, a cache of per-video label results (so each video is checked at most once per 30 or 180 days), per-channel counts of labelled videos, and, if enabled, the downloaded AiSList copy. All of it stays on the device.

**Host permission justification** (content scripts on `*://www.youtube.com/*`):
The extension works only on YouTube. The content script reads video and channel links on YouTube pages, hides or dims the cards that should be filtered, shows a banner on watch pages of labelled videos, and sends the request that reads YouTube's AI label (one small POST to www.youtube.com/youtubei/v1/next per video, with cookies omitted) from the YouTube page itself. It does not run on any other site.

**Optional host permission justification** (`https://raw.githubusercontent.com/*`):
Requested at runtime only when the user turns on the AiSList subscription, which is off by default. Used only to download the public AiSList blocklist text file (https://github.com/Override92/AiSList) at most once every 24 hours. The file is a plain list of channel handles; it is parsed as data and never executed. Users who don't enable AiSList are never asked for this permission. <!-- TODO verify: exact URL path and whether the permission is removed when AiSList is turned off -->

**Remote code:** No, I am not using remote code. All JavaScript is included in the package. The optional AiSList download is a text list of channel names, treated as data only.

**Data usage:** check nothing (the extension does not collect any of the listed data types: nothing is sent to the developer or stored off the device), then tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

Note for review, if asked: the only data that leaves the device is the IDs of YouTube videos, sent to youtube.com itself (the site that served those videos) to read their AI label, without cookies. <!-- TODO verify: if a reviewer counts this as "Website content", tick that box and use this sentence as the explanation -->

**Privacy policy URL:**
https://github.com/Nova-47/ai-label-filter-for-youtube/blob/main/PRIVACY.md

## Distribution tab
- Visibility: Public
- Regions: All regions
- Pricing: Free (must stay free and ad-free: AiSList is CC BY-NC 4.0)
