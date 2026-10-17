# Architect Brief — Step 53

원장 원문(2026-10-17): 「모든 비번을저장해서 알아서해」 → KG-52-1 답 = 예. 결정 D188~D197 (BUILD-LOG). Step 52 브리프: handoff/research/ARCHITECT-BRIEF-step52.md

## Goal
Step 52 의 네이버 자동 재로그인을 자동화가 쓰는 모든 네이버 계정(학원 + 고객 프로필마다 따로)으로 넓히고, 원장이 `save-login --all` 한 번에 전부 입력한다.

## 계정 표 (D192)

| 계정 | 프로필 | 자동화가 쓰는 곳 | 분류 | 저장 파일 |
|---|---|---|---|---|
| 학원 네이버 | `.browser-profile` | naver-blog-post(이관) · smartplace-keyword(local-agent) · 서치어드바이저(같은 NID, 수동 도구) | (a) Step 52 → 53 에서 smartplace 에도 | `naver.xml` (이름 그대로) |
| 문서딱 네이버 | `.browser-profile-docttak` | naver-blog-post(고객 블로그) · kin-find(매일) | (a) 새로 | `naver-docttak.xml` |
| hostingkr 네이버 | `.browser-profile-hostingkr` | naver-blog-post(고객 블로그) | (a) 새로 | `naver-hostingkr.xml` |
| 이후 고객 | `.browser-profile-<slug>` | 같음 | (a) 자동으로 | `naver-<slug>.xml` |
| 구글(GSC·YouTube Studio·빙 가져오기 동의) | `.browser-profile` | submit-gsc · gsc-access · yt-* | (b) 사람 — 2단계 + 자동화 브라우저 로그인 거부(D183, 실측 안 함) | 없음 |
| 마이크로소프트(빙 웹마스터) | `.browser-profile` | bing-submit-urls | (b) 지금은 사람 — 계정 종류 모름(KG-53-1) | 없음 |
| 카카오(런즈) | `.browser-profile` | learns-login(수동 1회 도구) | (b) 카카오 2단계 | 없음 |
| 오늘학교(prompie-*) | `.browser-profile` | 수동 1회 도구, 일정 없음 | 범위 밖 | 없음 |
| 퍼플렉시티 | 없음 | ai-web-measure 일부러 로그아웃(D183) | 해당 없음 | 없음 |
| Brave 제출 · 빙 측정 | 새 브라우저 | 로그인 없음(grep 확인) | 해당 없음 | 없음 |

## Flow

```
호출자(naver-blog-post / smartplace-keyword / kin-find)
  └ nid 로 튐 또는 NID 쿠키 없음
      └ 네이버다시로그인(page, ctx, profileDir)          [auto-login.mjs]
          계정이름(profileDir) ── null ──> 「자동 로그인 안 함: 프로필 모름」
             │ "naver" | "naver-<slug>"
          자동로그인할까(계정, 저장값있음(계정), 상태읽기(계정), now)
             │ 안 함 → 「자동 로그인 안 함: <까닭>」
          자동로그인(page, ctx, 계정)  ← 복호화(계정) 그 계정 파일만
             ├ ok → 호출자가 원래 주소로 다시 가서 재확인
             └ 멈춤 → 「자동 로그인 멈춤: <사유> · 화면 <png>」 + 기존 「로그인이 필요」 줄 그대로
                       → local-agent / kin-find 사람 일감(근거에 멈춤줄)

save-login --all
  잠금(.open-session.lock) → [1] 계정마다 Get-Credential(취소=건너뜀)
                           → [2] 이번에 저장한 계정마다: 로그아웃 → nid 로그인 주소 → 자동로그인 → 멈추면 5분 손
                           → [3] 요약 표: 계정 · 저장 아이디 · 저장/건너뜀 · 시험 결과
```

## Build Order

### 53a auto-login.mjs (바꾸는 일 먼저 — 학원 동작은 그대로)
- `export function 계정이름(profileDir)` — `path.basename(path.resolve(profileDir))`. `.browser-profile` → `"naver"`. 정규식 `^\.browser-profile-([a-z0-9-]{1,40})$` → `naver-<slug>`. 그 밖은 `null`. **"naver" 로 떨어지는 기본값 없음** (D189). 상대·절대 경로 둘 다(local-agent 는 절대 경로를 넘긴다)
- `자동로그인할까(계정, 저장값, 상태, now)` — 첫 인자 PROFILE → 계정. 계정 null → `{할까:false, 까닭:"프로필 모름"}`. 나머지 그대로
- `export async function 네이버다시로그인(page, ctx, profileDir)` → `{ ok, 줄 }`. 위 흐름. 줄은 기존 `멈춤줄` 정규식에 걸리는 꼴 그대로(「자동 로그인 멈춤: …」 / 「자동 로그인 안 함: …」)
- `세션경고(q, n, 저장값, 지금, clientId = 1, 계정 = "naver")` — dedupe `naver-session-soon`(client 행마다), 안내 명령을 `node tools/save-login.mjs <계정>` 으로. `login-*` 키 금지(D185)
- `export function 저장아이디(계정)` — xml 의 `<S N="UserName">` 평문만 읽음(복호화 안 함, D176 공개값). 앞 백슬래시 떼기. 없으면 null
- 상태 파일은 계정마다(`<계정>.state.json`, 이미 name 인자로 그렇다). 학원 `naver` 는 blog-post·smartplace 가 같은 상태를 써서 학원 시도는 합쳐 20시간 1회 (D191)

### 53b 호출자
- `tools/naver-blog-post.mjs:215-227` — 분기를 `네이버다시로그인(page, ctx, PROFILE)` 로. 기존 「네이버 로그인이 필요합니다…」 줄 글자 그대로
- `naver-blog-post.mjs:233` — `PROFILE === ".browser-profile"` 대신 `계정이름(PROFILE)` 이 있으면(고객 포함): 저장값 있으면 `상태쓰기(계정, {blocked:false})`, `NID_AUT 남은 N일` 출력
- `tools/smartplace-keyword.mjs:46` — nid 면 `네이버다시로그인(page, ctx, <그 파일의 프로필 경로>)`; ok 면 원래 주소로 다시 goto 해서 nid 재확인; 아니면 줄 출력 후 기존 「로그인이 안 돼 있습니다.」 + 종료 2 그대로
- `tools/kin-find.mjs:~141` — `네이버쿠키(...) === "없음"` 이면 `https://nid.naver.com/nidlogin.login?url=https%3A%2F%2Fwww.naver.com%2F` 로 가서 `네이버다시로그인(page, ctx, 프로필)`; ok 면 쿠키 재확인 후 진행, 아니면 줄 출력 + 기존 「✗ 로그인이 필요합니다…」 분기 그대로. 로그인된 날엔 `세션남은일` → `세션경고(q, n, 저장값있음(계정), KST, c.id, 계정)` (DRY 면 DB 안 건드림). 로그인 일감에 멈춤줄
- `tools/local-agent.mjs`
  - 고객 블로그 `로그인일감`(~210): 사람로그인처럼 선택 `근거` 를 evidence 에 덧붙이는 SQL. detail 에 「node tools/save-login.mjs naver-<slug> 를 한 번 돌리면 그다음부터 혼자 다시 로그인합니다」 추가. `/로그인이 필요/` 분기에서 `멈춤줄(r.out)` 넘김
  - 고객 블로그 성공 뒤: `남은날줄(r.out)` 있으면 `세션경고(q, n, 저장값있음(계정), KST(), c.id, 계정)`
  - smartplace(~257) `사람로그인("naver", "네이버", 멈춤줄 근거)` 붙임
- Flag: open-session · login-poll · login-core · todo-text 는 안 건드린다. 「로그인 창 열기」 길 그대로
- Flag: 실행 옵션(launchPersistentContext 인자)·UA 그대로. stealth·쿠키 주입·캡차 우회 없음(D197)

### 53c save-login.mjs
- 인자: `naver` | `naver-<slug>`(위 정규식 + `tools/.browser-profile-<slug>` 폴더가 있어야) | `--all`. google·microsoft·그 밖 → 「자동 로그인 대상이 아닙니다 — node tools/open-session.mjs 로 사람이 로그인」 종료 1, PowerShell 안 부름
- 프로필 경로는 계정 → 프로필 한 방향 표에서만(학원 `.browser-profile`, 고객 `.browser-profile-<slug>`). 계정과 프로필이 어긋나는 조합을 만들 길이 없게
- Get-Credential 메시지: naver → 「네이버 — 학원 블로그 계정」, naver-<slug> → 「네이버 — <slug> 고객 블로그 계정(학원 계정 아님)」. slug 는 정규식 통과값만
- `--all`: 목록 = naver + 디스크의 `.browser-profile-<slug>` 전부(이름순). [1] 전부 입력 받기(취소 = 건너뜀, 있던 파일 그대로) → [2] 이번에 저장한 계정만 차례로 시험 → [3] 요약 표(계정 · 저장아이디 · 저장/건너뜀 · 시험 성공/멈춤 사유). 원장이 표의 아이디로 계정 뒤바뀜을 눈으로 확인
- 시험 로그인(단일·--all 같음): 그 계정의 프로필을 열고 nidlogin.logout → `https://nid.naver.com/nidlogin.login?url=https%3A%2F%2Fsection.blog.naver.com%2F` → `자동로그인(page, ctx, 계정)`. 블로그 아이디 몰라도 된다. 멈추면 5분 손(기존)
- 잠금: `.open-session.lock` 을 처음부터 끝까지 쥔다. 계정 바뀔 때마다·5분 대기 중 60초마다 `fs.utimesSync` 로 mtime 갱신. local-agent 는 13분 넘게 못 들어가면 그 회차를 건너뜀(exit 3, 기존) — 충돌 없음
- 종료코드: 시험한 계정이 전부 성공이면 0, 아니면 1

### 53d 시험 `academy/scripts/test-auto-login.mjs` (기존 138 유지 + 새로)
- Bob 은 실계정 로그인 금지, 실제 `tools/.secrets` 를 읽거나 쓰지 않는다(AUTO_LOGIN_SECRETS_DIR 임시 폴더). 가짜 nid 화면 + 계정마다 다른 카나리아 비번

## Failure modes

| 새 길 | 현실의 실패 | 처리 | 사람이 보나 |
|---|---|---|---|
| 고객 프로필 자동 로그인 | 학원 비번이 고객 프로필에 쳐짐(교차 사용) | 계정이름 단일 함수 · 기본값 없음 · 카나리아 시험 | 시험으로 막음 |
| 원장이 hostingkr 칸에 docttak 비번 입력 | 다른 계정으로 로그인 | --all 요약에 저장 아이디 표시. 쓰기 주소가 남의 블로그면 에디터 못 찾음 → 발행 안 됨(기존) | 요약 표 · 활동 실패 |
| 고객 계정 캡차·보호조치 | 멈춤 | blocked + 스크린샷 + login-naver-blog-<slug> 일감 근거 | 보임 |
| 비번 바뀜 | 틀림 | bad — save-login naver-<slug> 다시 돌릴 때까지 안 침 | 일감 근거 「비번틀림」 |
| 학원 계정 하루 두 번(blog + smartplace) | 연속 시도 | 같은 naver 상태 → 20시간 1회 | 없음(정상) |
| naver-../x 같은 인자 | 경로 탈출 | 정규식 거부 | 사용법 줄 |
| 새 고객 프로필 생김 | 저장값 없음 | 「자동 로그인 안 함: 저장값 없음」 + 기존 일감. 다음 --all 에 자동으로 잡힘 | 보임 |
| --all 이 13분 넘김 | local-agent 회차 놓침 | 기존 exit 3, 다음 회차 | 로그 |
| smartplace 로그인 뒤 다른 화면 | 엉뚱한 화면 읽기 | 원래 주소 재방문 + nid 재확인 | 없음(정상) |
| 구글·빙 세션 만료 | 그대로 사람 일감 | 기존 | 보임 |

치명 공백(시험 없음 + 처리 없음 + 조용함): 없음.

## Test map

- 계정이름: `.browser-profile`·절대경로 → naver · `.browser-profile-docttak`(상대·절대) → naver-docttak · `.browser-profile-../x`·`.browser-profile-`·`foo`·`.browser-profile-UP` → null [GAP→새]
- 자동로그인할까: 계정 null → 안 함 · 고객 계정 저장값 있음 → 함 · 고객 계정 저장값 없고 naver.xml 만 있음 → 안 함(저장값 없음) [GAP→새. 기존 「고객 프로필」 단정은 이것으로 바꿈]
- 카나리아: 임시 폴더에 naver.xml(카나리아A)·naver-docttak.xml(카나리아B) — docttak 가짜 화면에 B 만 쳐지고 A 는 페이지·로그·스크린샷·state 어디에도 없음. 반대도 [GAP→새]
- 네이버다시로그인: 줄이 멈춤줄 에 걸림 · 안 함 까닭 3종 [GAP→새]
- 세션경고: clientId·계정 넘기면 그 client 행·그 명령 문구 · 기본값은 기존과 같음 [TESTED 유지 + 새]
- 저장아이디: 앞 백슬래시 붙은 force11 → force11 · 파일 없음 → null · 비번 내용 안 나옴 [GAP→새]
- save-login 인자: google·microsoft·naver-없는slug·naver-../x → 종료 1, PowerShell 안 부름(인자 판정 함수를 export 해서 시험) [GAP→새]
- --all 목록: 임시 폴더에 프로필 둘 → [naver, naver-a, naver-b] 이름순 [GAP→새]
- 회귀: test-login.mjs 56/0 · test-kin.mjs 기존 수 · test-clients.mjs 기존 수 · test-auto-login 기존 138 중 바뀐 시그니처 단정만 고침(고친 수를 REVIEW-REQUEST 에)
- todo-text: 고객 client 행의 naver-session-soon 에도 login 동작 없음(D185) [새 1]

## Out of Scope
- 구글·마이크로소프트·카카오 자동 로그인 (KG-53-1, KG-53-2)
- open-session/login-poll/「로그인 창 열기」 변경
- 블로그 아이디와 로그인 아이디 자동 대조 (요약 표 눈 확인만, KG-53-3)
- naver-sa-* · naver-blog-tags · yt-* 등 수동 도구에 자동 로그인 붙이기
- 실계정 시험 로그인 — 원장이 node tools/save-login.mjs --all 1회

## Acceptance
1. node academy/scripts/test-auto-login.mjs 전부 통과(새 단정 포함), 카나리아 교차 0
2. 회귀: test-login 56/0, test-kin·test-clients 기존 수 그대로
3. node tools/save-login.mjs microsoft → 안내 + 종료 1, 창 안 뜸 · node tools/save-login.mjs naver-nope → 종료 1
4. git status 에 tools/.secrets 아무것도 안 보임
5. grep: `PROFILE === ".browser-profile"` 가 auto-login·naver-blog-post 에 0건, `복호화(` 호출은 auto-login.mjs 안 1곳
6. 원장 1회 node tools/save-login.mjs --all 요약 표가 실측(Arch 가 BUILD-LOG 에 적음)
