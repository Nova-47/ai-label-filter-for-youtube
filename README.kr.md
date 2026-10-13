<p align="center"><img src="icons/icon128.png" width="96" height="96" alt=""></p>

# AI Label Filter for YouTube

YouTube가 "AI로 제작됨" 라벨을 붙인 영상을 흐리게 하거나 숨기고, 걸러진 이유를 보여 주는 크롬 확장 프로그램입니다. 추측하지 않고 서버나 계정도 쓰지 않습니다.

[English](README.md)

[Releases](https://github.com/Nova-47/ai-label-filter-for-youtube/releases)에서 zip을 받아 Chrome에 로드합니다([방법](#설치)). Chrome 웹 스토어에는 없습니다. [60초 안에 확인하기](#60초-안에-확인하기).

![데모: 흐리게 처리된 영상을 클릭 한 번으로 다시 표시](docs/demo.gif)

![검색 결과에서 라벨 붙은 영상이 이유와 함께 흐리게 표시됨](docs/feed-dim.png)

![라벨 붙은 영상의 시청 페이지 배너](docs/watch-banner.png)

![팝업](docs/popup.png)

> YouTube가 라벨을 붙인 영상만 거릅니다. AI 영상 대부분에는 라벨이 없습니다. 더 넓게 거르려면 커뮤니티 목록 AiSList나 "Check every visible video"를 켜세요(둘 다 기본 꺼짐).

YouTube가 제목 아래에 AI 배지를 표시한 영상만 AI로 봅니다. 모델이나 제목·썸네일 휴리스틱은 쓰지 않습니다. 기본값에서는 카드를 흐리게 하고, 이유와 **Show**(보기) 버튼, 카드에 채널 링크가 있으면 **Allow channel**(채널 허용) 버튼도 있는 칩을 붙입니다. 숨기려면 팝업에서 **Hide**를 고르면 됩니다.

서버, 의존성, 빌드 단계가 없습니다. 필요한 권한은 `storage`와 www.youtube.com 콘텐츠 스크립트입니다. 모든 네트워크 요청은 두 함수 중 하나에서 나갑니다([아래](#검토하는-방법) 참고).

---

## 설치

1. [Releases](https://github.com/Nova-47/ai-label-filter-for-youtube/releases)에서 `ai-label-filter-for-youtube-<버전>.zip`을 받아 폴더에 압축을 풉니다. (저장소를 클론해도 됩니다. 빌드할 것이 없어서 그대로 로드됩니다.)
2. `chrome://extensions`를 열고 오른쪽 위의 **개발자 모드**를 켭니다.
3. **압축해제된 확장 프로그램을 로드합니다**를 누르고 그 폴더를 고릅니다.

Chrome 110 이상이 필요합니다.

## 60초 안에 확인하기

기본값에서는 이미 알고 있는 영상만 피드에서 거르므로, 막 설치하면 아무 변화가 없습니다. 확인 방법:

1. YouTube가 AI로 제작됐다고 라벨을 붙인 [이 영상](https://www.youtube.com/watch?v=yHG-pivADos)을 엽니다. 몇 초 뒤 왼쪽 아래에 "YouTube labels this video as made with AI" 배너가 **Hide this channel**(이 채널 숨기기), **Dismiss**(닫기) 버튼과 함께 뜹니다.
2. 그 채널 페이지(@eigi_and_ai)로 가거나 영상을 검색해 봅니다. 결과가 기기에 저장됐기 때문에, 그 영상 카드는 어디에 나오든 "YouTube AI label" 칩과 함께 흐리게 보입니다.
3. 피드를 더 넓게 거르려면 팝업에서 **Hide channels listed in AiSList**(약 29,000개 채널이 담긴 커뮤니티 목록. 내려받기 권한을 Chrome이 묻습니다)나 **Check every visible video**(화면에 보이는 영상마다 YouTube에 한 번에 하나씩 묻습니다)를 켭니다.

---

## 판정 방식

### 신호

YouTube는 AI로 제작됐다고 라벨을 붙인 영상의 제목 아래에 "AI" 배지를 표시합니다. 이 배지는 YouTube 웹 앱이 시청 페이지를 불러올 때 받는 데이터에는 있지만, 홈·검색·사이드바 카드 데이터에는 없습니다. 라벨을 확인하려면 이 확장이 YouTube 웹 앱이 시청 페이지를 불러올 때 쓰는 `/youtubei/v1/next` 엔드포인트에 작은 요청 1건을 보냅니다.

응답에 그 배지, 즉 스타일 `BADGE_STYLE_TYPE_SIMPLE`과 아이콘 `INFO`를 가진 `metadataBadgeRenderer`가 있을 때만 AI 영상으로 봅니다. 자동 더빙 영상에도 같은 스타일의 배지가 붙지만 아이콘이 달라서 해당하지 않습니다. 배지 글자가 아니라 아이콘을 보기 때문에 YouTube 화면 언어와 상관없이 동작합니다.

### 어디서 확인하나

| 위치 | 요청 | 동작 |
|---|---|---|
| 시청 페이지 (`/watch?v=…`) | 연 영상 1건. 결과가 이미 저장돼 있으면 보내지 않음 | 라벨이 있으면 **Hide this channel** / **Dismiss** 배너를 띄웁니다. |
| 피드 (기본) | 없음 | 기기에 이미 있는 정보로만 거릅니다. 저장된 결과, 채널 목록, 확인한 영상 대부분에 라벨이 있는 채널, 켰다면 AiSList입니다. |
| **Check every visible video**를 켠 피드 | 화면에 보이고 저장된 결과가 없는 카드마다 1건 | 라벨이 확인되는 대로 거릅니다. |

카드는 홈, 구독, 검색, 채널 페이지, 재생목록, 시청 페이지 사이드바, Shorts 선반에서 찾습니다.

### 카드를 거르는 이유

아래 순서로 판단합니다.

1. **Always shown channels**(항상 보일 채널): 이 목록에 있는 채널은 거르지 않습니다.
2. **Hidden channels**(숨긴 채널): **Hide this channel**로 추가한 채널입니다. 칩: "Your blocklist".
3. **YouTube AI label**: 영상 자체에 라벨이 있습니다. 칩: "YouTube AI label".
4. **확인한 영상 대부분에 라벨이 있는 채널**(선택, 기본 켜짐 — 팝업에서 끌 수 있음): 이 기기에서 이 채널의 서로 다른 영상을 마지막으로 확인한 20개 중 확인한 영상이 5개 이상이고 그중 60% 이상에 라벨이 있습니다. 같은 영상을 다시 확인하면 한 번만 세고 가장 최근 자리로 옮기며, 가장 최근 결과를 씁니다. 칩: "Channel: N of last M checked videos AI-labelled". M은 그 표본의 영상 수입니다(최대 20). 영상에 붙은 라벨이 아니라 추론이기 때문에 Hide 모드에서도 숨기지 않고 늘 이유와 함께 흐리게 표시합니다. 팝업 스위치 **Also dim channels whose recent videos are mostly AI-labelled**로 이 규칙을 끌 수 있습니다. 꺼도 확인한 영상은 계속 세므로, 다시 켜면 바로 적용됩니다. 팝업에는 지금 이 규칙으로 흐리게 표시 중인 채널이 "N of last M"과 함께 나오고, **Allow** 버튼을 누르면 그 채널이 Always shown channels에 들어가 이 규칙보다 늘 우선합니다.
5. **Listed in AiSList**: AiSList를 켠 경우에만 해당합니다. 칩: "Listed in AiSList".

해당하는 규칙이 없으면 보여 줍니다. 1, 2, 4, 5번은 카드에 채널 링크(`/@handle`이나 `/channel/UC…`)가 있어야 적용됩니다.

결과는 라벨이 없는 영상은 30일(YouTube가 나중에 라벨을 붙일 수 있어서), 라벨이 있는 영상은 180일 동안 저장합니다.

### 화면에서 보이는 것

- **Dim + reason**(흐리게 + 이유, 기본값): 카드를 흐리게 하고 이유를 적은 칩을 붙입니다. **Show**는 그 영상을 이 탭에서 새로고침할 때까지 원래대로 보여 주고, **Allow channel**은 채널을 Always shown channels에 추가합니다(카드에 채널 링크가 있을 때만 나옵니다).
- **Hide**(숨기기): 걸러진 카드를 화면에서 없앱니다. 채널에서 확인한 영상 대부분에 라벨이 있다는 이유만으로 걸러진 카드는 흐리게 남습니다. 무엇이 숨겨졌는지 보려면 팝업의 "This page"에서 **Reveal**을 누릅니다. 그 탭이 **Hide again**을 누르거나 새로고침할 때까지 칩이 붙은 흐린 화면으로 바뀝니다.
- **시청 페이지 배너**: 연 영상에 라벨이 있으면 모드와 상관없이 뜹니다. **Hide this channel**은 채널을 Hidden channels에 추가합니다(채널을 알 수 없거나 이미 목록에 있으면 버튼이 빠집니다). Always shown channels에 있는 채널이면 배너가 뜨지 않습니다. 영상 자체를 가리지는 않습니다.

무엇이든 실패하면(네트워크 오류, 시간 초과, 예상과 다른 응답, 삭제된 영상) 영상을 보여 주고 아무것도 저장하지 않습니다.

---

## YouTube로 보내는 요청

시청 페이지, 카드 확인, 하루 1회 자가 진단 모두 같은 요청을 YouTube 페이지 자체(콘텐츠 스크립트)에서 보냅니다.

- `POST https://www.youtube.com/youtubei/v1/next?prettyPrint=false&fields=<마스크>`
- 본문: `{"context":{"client":{"clientName":"WEB","clientVersion":"…","hl":"en","gl":"US"}},"videoId":"…"}`. 바뀌는 것은 영상 ID뿐입니다. 클라이언트 버전은 YouTube 페이지에서 읽고, 찾기 전까지는 최근 버전 하나를 고정값으로 보냅니다.
- 쿠키를 빼고 보냅니다(`credentials: 'omit'`). 요청이 YouTube·Google 계정과 연결되지 않고, YouTube는 로그인하지 않은 방문자에게 하듯 답합니다.
- 필드 마스크로 두 가지만 요청합니다. 제목 아래 배지, 그리고 채널 ID와 @handle입니다. 응답은 약 400 KB가 아니라 약 0.4 KB입니다.
- **브라우저 전체에서 한 번에 하나씩.** 모든 youtube.com 탭이 잠금 하나를 같이 쓰고, 각 요청은 이전 응답을 받고 나서 최소 1초 뒤에 나갑니다. 카드 확인은 여기에 0~1초를 무작위로 더 기다립니다.
- 요청마다 10초가 지나면 끊습니다.
- 마스크 없이 다시 보내는 재시도는 없습니다.

YouTube가 정상적으로 답하지 않으면 모든 탭에서 요청을 한동안 멈춥니다.

| 응답 | 동작 |
|---|---|
| HTTP 403·429, 모든 리다이렉트, HTML "unusual traffic"/CAPTCHA/"Sorry" 페이지 | YouTube 요청을 24시간 동안 모두 멈춥니다. 팝업에 "YouTube pushed back (…), so all requests are paused until …"이 뜹니다. |
| HTTP 400·404·5xx, JSON이 아닌 응답 | YouTube 요청을 15분 동안 모두 멈춥니다. 계속 반복되면 멈추는 시간이 30분, 1시간, … 으로 두 배씩 늘어나 최대 24시간이 됩니다. 정상 응답이 한 번 오면 풀립니다. 팝업에 "YouTube refused a request (…), so requests are paused until …"이 뜹니다. |

요청이 멈춘 동안에도 이미 저장된 정보로는 계속 거릅니다.

기본 설정에서는 결과가 아직 저장되지 않은 시청 페이지마다 요청 1건, 그리고 자가 진단이 하루 한두 건 보냅니다.

### 하루 1회 자가 진단

24시간에 한 번, 브라우저 단위로(탭마다가 아니라) YouTube 페이지를 열거나 이동할 때, 2026-10-13에 라벨이 붙어 있던 영상 두 개를 확인합니다. `yHG-pivADos`(@eigi_and_ai)를 먼저 묻고, 여기서 라벨이 보이지 않을 때만 `Xpg-JIuJ_cU`(@foreverharmony_official)를 묻습니다. "Check every visible video"가 꺼져 있어도 돌기 때문에 보통 하루에 요청 한두 건을 보냅니다. 필터링이 꺼져 있거나 요청이 멈춘 동안에는 돌지 않습니다. 아무것도 보내기 전에 요청이 멈추면, 요청이 다시 허용될 때 돕니다. 확인이 끝나기 전에 페이지가 닫히거나 새로고침되면, 5분 이상 지난 뒤 여는 페이지에서 다시 돕니다. 결과는 저장하지 않고 채널 판정에도 넣지 않습니다.

| 결과 | 팝업 |
|---|---|
| 카나리아 영상에서 라벨이 보임 | 없음 |
| 라벨을 읽을 수 없음: 두 영상이 다 있는데 둘 다 라벨이 없거나, 채널은 읽히는데 라벨이 안 읽히거나, 두 영상 모두 아무것도 읽히지 않음(YouTube 응답 형식이 바뀌면 이렇게 보입니다) | "Label detection may be broken (YouTube may have changed something)." |
| YouTube가 확인 요청을 거부함 (HTTP 400·404·5xx, JSON 아님) | "YouTube refused the daily label check, so labels may not be read right now." 다음에 YouTube에서 정상 응답이 오면 사라집니다. |
| 한 영상이 사라졌고(삭제 또는 비공개) 다른 영상에는 라벨이 없음 | 없음 |
| 오프라인이거나 요청이 차단됨 | 없음 (차단은 따로 안내가 뜹니다) |

---

## 개인정보

서버가 없고 개발자에게 아무것도 전송하지 않습니다. 이 확장이 보내는 요청은 아래가 전부입니다.

| 언제 | 요청 | 받는 곳 | 내용 | 쿠키 |
|---|---|---|---|---|
| 결과가 저장되지 않은 시청 페이지를 열 때 | `POST /youtubei/v1/next` 1건 (필드 마스크) | `www.youtube.com` | 영상 ID와 위의 클라이언트 필드 | 보내지 않음 |
| **Check every visible video**를 켰을 때 | 같은 요청, 화면에 보이고 저장된 결과가 없는 카드마다 | `www.youtube.com` | 그 영상의 ID | 보내지 않음 |
| 하루 1회 (자가 진단) | 같은 요청, 정해진 영상 한두 개 | `www.youtube.com` | 그 영상들의 ID | 보내지 않음 |
| AiSList를 켰을 때: 24시간에 최대 1회, 그리고 켤 때와 **Refresh now**를 누를 때 | [AiSList 차단 목록 파일](https://github.com/Override92/AiSList) `GET` | `raw.githubusercontent.com` | 일반 파일 다운로드. 하루 1회 확인 때는 갖고 있는 사본의 ETag를 보내서, 목록이 그대로면 다시 받지 않습니다 | 보내지 않음 |

여느 웹 요청과 마찬가지로 YouTube와 GitHub는 IP 주소와 브라우저 user agent를 봅니다.

모든 데이터는 기기의 `chrome.storage.local`에 저장합니다. `chrome.storage.sync`나 다른 곳에는 저장하지 않습니다.

- 설정
- Hidden channels와 Always shown channels (채널 ID나 @handle, 추가한 시각)
- 영상별 결과: 영상 ID, 라벨 여부, 확인한 날, 카드를 마지막으로 본 날. 라벨 영상은 채널 ID와 @handle도. 최대 20,000개.
- 응답에서 본 채널별: 채널 ID, @handle, 마지막으로 확인한 서로 다른 영상 20개의 ID와 각각의 라벨 여부·확인 시각, 마지막 결과를 받은 날. 최대 5,000개. 넘으면 라벨 영상이 적고 오래 안 본 채널부터 지우고, 흐리게 표시 중인 채널과 목록에 있는 채널은 항상 남깁니다.
- AiSList를 켰다면: 내려받은 목록과 다운로드 정보 (항목 수, ETag, 시각, 마지막 오류)
- 요청이 멈췄는지, 언제까지인지, 왜인지, 마지막 요청을 보낸 시각
- 자가 진단을 마지막으로 돌린 시각과 결과

걸러진 카드 개수는 저장하지 않습니다. 팝업이 열 때마다 열린 YouTube 탭에 묻습니다. 확장을 삭제하면 모두 지워집니다.

분석 도구, 원격 측정, YouTube Data API, 계정은 쓰지 않습니다. 자세한 내용은 [PRIVACY.md](PRIVACY.md)를 참고하세요.

---

## 권한

| 권한 | 필요한 이유 |
|---|---|
| `storage` | 위에 적은 데이터를 기기에 저장합니다. |
| `*://www.youtube.com/*` 콘텐츠 스크립트 | YouTube 페이지의 영상·채널 링크를 읽고, 카드를 흐리게 하거나 숨기고, 시청 페이지 배너를 띄우고, 라벨 요청을 YouTube 페이지 자체에서 보냅니다. 요청이 `www.youtube.com`에서 나가므로 호스트 권한이 필요 없습니다. |
| 선택: `https://raw.githubusercontent.com/*` | AiSList를 켤 때만 요청하고, 그 목록을 내려받는 데만 씁니다. AiSList를 끄면 권한을 반납합니다. `chrome://extensions`에서 권한을 없애면 AiSList를 끄고 사본을 지웁니다. |

`tabs`, `history`, "모든 웹사이트의 데이터 읽기 및 변경" 같은 권한은 요청하지 않습니다. 팝업은 YouTube 탭의 콘텐츠 스크립트에 직접 물어서 페이지별 개수를 받으므로 `tabs` 권한이 필요 없습니다.

---

## 설정 (팝업)

팝업은 영어로만 되어 있습니다.

| 설정 | 기본값 | 설명 |
|---|---|---|
| 머리글의 스위치 ("Turn filtering on or off") | 켜짐 | 필터링, 배너, YouTube로 보내는 모든 요청을 켜거나 끕니다. |
| Filtered videos: **Dim + reason** / **Hide** | Dim + reason | Dim은 카드를 흐리게 하고 이유를 보여 주고, Hide는 화면에서 없앱니다([화면에서 보이는 것](#화면에서-보이는-것) 참고). |
| **Check every visible video** | 꺼짐 | 화면에 보이고 저장된 결과가 없는 카드를 YouTube에 묻습니다. 가장 최근에 보인 카드부터, 탭이 앞에 있을 때만, 영상마다 탭당 한 번입니다. 차례가 오기 전에 화면에서 벗어난 카드는 건너뜁니다. |
| **Also dim channels whose recent videos are mostly AI-labelled** | 켜짐 | [카드를 거르는 이유](#카드를-거르는-이유)의 4번 규칙을 적용합니다. 끄면 채널에서 확인한 영상 때문에 흐려지는 카드는 없고, 라벨 영상은 그대로 거릅니다. |
| **Hide channels listed in AiSList** | 꺼짐 | [AiSList](https://github.com/Override92/AiSList)에 있는 채널을 거릅니다. 목록은 24시간에 최대 한 번 내려받고, **Refresh now**로 다시 받을 수 있습니다. 처음에는 팝업에 "Community list (optional)" 카드가 **Turn on** / **Not now** 버튼과 함께 뜹니다. |
| **Hidden channels** | 비어 있음 | **Hide this channel**로 추가한 채널입니다. **Remove**로 뺍니다. |
| **Always shown channels** | 비어 있음 | **Allow channel**이나 "Dimmed for their channel"의 **Allow**로 추가한 채널입니다. **Remove**로 뺍니다. |
| **Dimmed for their channel** | — | 채널 규칙이 켜져 있을 때 나옵니다. 지금 4번 규칙으로 흐리게 표시 중인 채널과 "N of last M"을 보여 줍니다. **Allow**를 누르면 Always shown channels에 들어갑니다. 없으면 "None right now."라고 나옵니다. |

한 목록에 채널을 넣으면 다른 목록에서는 빠집니다. **Remove**는 @handle로 넣었든 채널 ID로 넣었든 그 채널을 지웁니다.

팝업에는 열린 YouTube 페이지에서 이유별로 몇 개를 걸렀는지와 요청이 멈췄거나 자가 진단에서 문제가 나왔을 때의 경고도 나옵니다.

---

## 검토하는 방법

- 의존성, 빌드 단계, 압축(minify)된 코드가 없습니다. 릴리스 zip에는 저장소의 확장 파일이 바이트 단위로 그대로 들어갑니다. `scripts/package.sh`는 파일을 골라 zip으로 묶습니다.
- 모든 네트워크 요청은 두 곳 중 하나에서 나갑니다. `content.js`의 `request()`(YouTube)와 `background.js`의 `doRefresh()`(AiSList, 켰을 때만)입니다.
- 판정 규칙, 응답 해석, 요청 정지, 자가 진단 판정은 `shared.js`의 평범한 함수이고, 브라우저 없이 `node --test`로 테스트합니다.

## 알려진 한계

- **라벨이 붙은 영상은 일부입니다.** AI 영상 대부분에는 YouTube 라벨이 없고, 이 확장은 추측하지 않습니다.
- **Shorts와 라이브 페이지는 확인하지 않습니다.** `/shorts/…`, `/live/…` 페이지에서는 요청을 보내지 않고 배너도 뜨지 않습니다. 피드에 나오는 Shorts 카드는 다른 카드처럼 거릅니다.
- **시청 페이지 사이드바 카드는 채널 목록과 맞출 수 없습니다.** 채널 링크가 없어서 Hidden channels, Always shown channels, 채널 판정, AiSList가 적용되지 않고, 이미 알고 있는 라벨만 적용됩니다.
- **재생목록·믹스 카드는 첫 영상으로 판정합니다.** 카드 링크가 영상 하나를 가리키기 때문에, 그 영상 때문에 재생목록 카드 전체가 걸러질 수 있습니다.
- **시크릿 창은 요청 제한이 따로일 수 있습니다.** 시크릿 모드에서 확장을 허용하면 시크릿 창이 별도의 요청 대기열을 쓸 수 있어서, 일반 창의 요청과 간격이 맞춰지지 않을 수 있습니다.
- **EU 동의 페이지는 테스트하지 않았습니다.** YouTube가 요청을 동의 페이지로 리다이렉트하면 다른 리다이렉트처럼 24시간 멈추고, 다른 HTML 페이지로 답하면 15분부터 시작해 멈춥니다.
- **Hidden channels에는 라벨 영상의 배너에서만 채널을 추가할 수 있습니다.** 채널을 직접 입력하는 기능은 없습니다.
- **`www.youtube.com`만 지원합니다.** `m.youtube.com`은 지원하지 않습니다.
- **YouTube 내부 엔드포인트를 씁니다.** 문서화된 API가 아니라서 언제든 바뀌거나 막힐 수 있습니다. 그러면 라벨 영상도 숨기지 않고 그대로 보여 줍니다.

---

## 자주 묻는 질문

**왜 머신러닝이나 휴리스틱을 쓰지 않나요?**
제목·썸네일·음성으로 추측하면 오탐이 생기고, 영상이 왜 사라졌는지 알 수 없게 됩니다. 이 확장은 YouTube 라벨, 사용자 본인의 채널 목록, 그리고 (켰다면) 자체 검토 절차가 있는 커뮤니티 목록만 씁니다. 걸러진 카드에는 모두 확인하고 되돌릴 수 있는 이유가 있습니다.

**왜 YouTube와 통신해야 하나요?**
YouTube는 홈·검색·사이드바 카드 데이터에 AI 라벨을 넣지 않고, 영상 시청 페이지 데이터에만 넣습니다. 확장의 백그라운드 서비스 워커에서 보내면 YouTube가 거부하기 때문에 YouTube 페이지에서 보냅니다.

**YouTube가 요청을 제한하거나 차단할 수 있나요?**
내부 엔드포인트라서 보장은 없고, 요청은 사용자의 IP 주소에서 나갑니다. 이 확장은 요청 빈도를 낮게 유지하고([YouTube로 보내는 요청](#youtube로-보내는-요청) 참고), 쿠키를 빼고, YouTube가 거부하면 멈춥니다. 피드에서 요청을 아예 보내지 않으려면 **Check every visible video**를 꺼 두세요(기본값).

**누가 봐도 AI 영상인데 그대로 보여요.**
YouTube 라벨이 없는 영상일 가능성이 큽니다. **Hide channels listed in AiSList**를 켜면 더 넓게 거를 수 있습니다.

**AiSList가 AI 채널이 아닌 채널을 걸렀어요.**
그 카드에서 **Allow channel**을 누르면 다시는 걸러지지 않습니다. 모두를 위해 목록을 고치려면 [AiSList의 삭제 요청 절차](https://github.com/Override92/AiSList)를 이용해 주세요. 이 확장은 목록을 수정하지 않습니다.

---

## 개발

- 테스트: `node --test` (의존성 없음). `tests/harness.js`가 가상 시계를 갖춘 가짜 브라우저에서 `content.js`를 돌립니다.
- 릴리스용 zip: `scripts/package.sh`가 `dist/ai-label-filter-for-youtube-<버전>.zip`을 만듭니다.
- 디버그 로그: `content.js` 맨 위의 `DEBUG`를 `true`로 바꾸면 `[AI Label Filter]`로 시작하는 메시지가 콘솔에 찍힙니다.

## 출처

- 영상마다 필드 마스크를 건 `/youtubei/v1/next` 요청 1건으로 YouTube AI 라벨을 읽는 방법은 [Weedout for YouTube](https://github.com/masteranza/weedout-for-youtube)(MIT)에서 왔습니다. `content.js`의 카드 컨테이너 목록과 클라이언트 버전 읽기는 Weedout 코드를 고쳐 쓴 것이고, Weedout의 MIT 고지는 `content.js` 머리 주석에 있습니다.
- [AiSList](https://github.com/Override92/AiSList) (Override92)는 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) 라이선스입니다. 이 확장에 포함되어 있지 않으며, 켠 경우에만 브라우저가 원본에서 직접 내려받습니다. 이 확장은 무료·비상업용이며 AiSList와 제휴 관계가 없습니다.

## 기여

큰 변경은 먼저 Issue를 열어 주세요. Pull Request는 환영합니다.

## 라이선스

[MIT](LICENSE)

이 프로젝트는 YouTube 또는 Google LLC와 제휴, 보증, 후원 관계가 없습니다. YouTube는 Google LLC의 상표입니다.
