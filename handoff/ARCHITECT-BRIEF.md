# Architect Brief — Step 39

## Goal
DB 고객도 사람이 확인한 사실만으로 바깥 글을 쓰고(문서딱 출력은 그대로), 현황판 버튼 하나로 원장 PC 에 로그인 창(구글·네이버·빙·고객 블로그)이 2분 안에 뜨고, 고객 서치콘솔 권한을 화면 원문으로 판정할 자리가 생긴다.

세 덩어리. **덩어리마다 따로 커밋**(되돌리기 쉽게). 순서 39a → 39b → 39c. 0원 리허설 화면(④)은 Step 40 — 이번엔 안 한다.

---

## 39a — 바깥 글 범용화 (KG-37-1)

### 사실(Arch 확인, 코드)
- `academy/scripts/marketing-draft.mjs` 문서딱 전용인 곳: 프롬프트 첫 줄 「직접 만든 무료 도구」(155) · 「문서딱 말고」(126·127) · 「문서딱 링크는」(134·141·227·234) · 「문서딱이 안 하는 것」(167) · 「문서딱 주소」(168) · 「## 근거 — 오늘 가져온 문서딱 페이지 원문」(176) · 블로그 예시 「제출 마감 직전… 휴대폰만 있을 때」(147) · `대안이름` 목록(243) · `금지말` 셋째 줄 remove-background(49) · 고정 사실 문자열(340~342, 「/guide/」 세기) · `부르기전멈춤 = 안부름 || c.출처 !== "코드"`(344)
- DB 고객 marketing 해석은 `academy/clients.mjs` 고객설정 406~429. 화면 폼은 marketing 을 안 다룬다(client-core 159) — 지금 DB 고객은 화면으로 바깥 글을 켤 수 없다

### Build Order
1. **회귀 「전」부터 뜬다(코드 고치기 전).** `프롬프트`·`관문` 을 export 하고 시험용 고정 p(사이트맵·페이지 2개·사실 줄 — test-marketing 재료가 있으면 그것)로 문서딱 jisikin·cafe·blog 프롬프트 3개와 관문 이유(일부러 걸리는 post 2개)를 `academy/scripts/fixtures/marketing-prompt-docttak.txt` 에 그대로 저장. `--dry --no-claude --client docttak` 출력도 저장. Flag: `--no-claude` 는 프롬프트 직전에 멈추니 프롬프트 동일은 이 스냅샷으로만 증명된다
2. 문서딱 전용 글을 **설정으로 뺀다.** `clients.mjs` 문서딱 marketing 에 지금 글자 그대로:
   - `persona`: 지금 155 줄이 문서딱에 만드는 글 그대로(「너는 문서딱(docttak.com) 을 만든 사람이다. 직접 만든 무료 도구를 숨기지 않고 밝히며 정보를 나눈다.」)
   - `facts`: `[{ text: "모든 도구 무료·가입 없음" }, { text: "파일은 기기 안에서 처리하고 어디로도 보내지 않음" }]`
   - `guidePrefix: "/guide/"` (안내 글 수 세기)
   - `alternatives`: 지금 `대안이름` 9개
   - `banned`: 지금 금지말 셋째 줄(re·why)
   - `situations`: 「제출 마감 직전에 파일이 안 올라갈 때, 휴대폰만 있을 때」
3. `marketing-draft.mjs`: 위 리터럴 「문서딱」 → `c.name`. 사실 줄 = `[guidePrefix 있으면 「안내 글 N편」, ...facts.text].join(", ")`, 머리말 「(오늘 사이트맵 기준)」은 안내 글 수가 있을 때만. persona 없으면 기본 「너는 ${c.name}(${c.domain}) 쪽 사람이다. 소속을 숨기지 않고 밝히며 정보를 나눈다.」(사실 주장 없음). situations 없으면 「(예: …)」 통째로 뺀다. 금지말 = 공통 2줄 + c.marketing.banned. 대안찾기 목록 = c.marketing.alternatives ?? []
4. **사실 목록이 비면 안 쓴다.** `빠진칸`에 `marketing.facts` 추가 — facts 0개면 「사람이 확인한 사실 목록이 비었습니다 — 건너뜀」, Claude 안 부름, 종료코드 0(고장 아님). `부르기전멈춤` 은 `안부름` 만 남긴다
5. `clients.mjs` 고객설정: `marketing.facts`(배열 ≤10, text 1~200자, checkedOn `YYYY-MM-DD` 선택) · `persona`(≤300) · `guidePrefix`(`/`로 시작) · `alternatives`(글자 배열 ≤20) · `banned`(글자 배열 ≤20 → lit 로 정규식, why 「금지 말」) · `situations`(≤200). 형 틀리면 기존처럼 빠짐 줄 + 그 칸 비움
6. 화면: `/admin/clients/[slug]` 에 「바깥 글」 폼 한 덩어리(client-core 에 `바깥글입력검사`·`바깥글고치기`, client-actions 에 `updateMarketing`, useActionState). 칸: 켬 · 공개 문장 · **확인한 사실(한 줄 하나)** · 페이지(한 줄 「말1,말2 + 말3 | /guide/x/ | /tool/」 → all `[[말1,말2],[말3]]`, 기존 페이지줄 파서 형식) · 안내 경로 앞부분 · 대안 이름 · 금지 말 · 소속 소개(persona). 새로 들어온 사실 줄에 checkedOn = 저장한 날(KST), 기존 줄은 날짜 유지. 폼 위 한 줄: 「여기 적은 사실만 글에 들어갑니다. 원장님이 확인한 것만 적어 주세요」
   - 체크리스트에 바깥 글 줄: 켜짐+사실 0 → 「사실 목록이 비어 글을 안 씁니다」(사람 칸 아님 — 일감 안 만든다)
- Flag: 고정 사실을 사이트에서 긁어 자동으로 채우지 않는다. 사실은 사람 손으로만 들어간다
- Flag: 페이지 원문(말 묶음)을 config 에 둔다(정규식은 되돌리기 불가 — 고치기 폼용, Step 38 answerTerms 와 같다)

---

## 39b — 로그인 창 버튼 + 운영 정리

### 사실(Arch 확인, 2026-10-06 실측)
- 옛 작업 스케줄러 3개가 **켜진 채 돈다**: `schtasks /query` → `\Cited AI Measure` 다음 21:30 준비 · `\Cited Heartbeat` 준비 · `\Cited Local Agent` 19:10 준비. local-agent.log 10-06 12:40:**02** 시작(정각 = 스케줄러) → pc-runner 12:40:26 「이미 돌고 있습니다 — 건너뜀」인데 pc-runner.log 는 「끝 local-agent · 종료코드 0 · 0초」로 성공처럼 찍힘. ai-web-measure.log 10-03·04·05 21:30 실행(0/0)도 옛 작업. pc-runner --install 의 끄기가 안 먹었다
- 문서딱 Gemini 「답 없음」 멈춤은 로그상 **10-06 한 번**(그 전 10회 전부 20/20). 측정이 하루 한 번이라 못 잰 문항을 그날 다시 안 잰다 — 21:30 옛 작업이 우연히 메워 주던 자리(그날 안 잰 문항만 잼)
- 로그인 일감: local-agent 가 `login-naver`·`login-google`·`login-microsoft`(client 1, kind human) · `login-naver-blog-<slug>`(고객 id) 를 「사람 대기」로 올린다. 문구는 「node tools/open-session.mjs 를 실행해」
- 프로필 충돌: `.browser-profile` 은 local-agent 의 submit-gsc·bing-submit-urls·naver-blog-post 가 launchPersistentContext 로 쓴다(같은 프로필 두 번 못 연다). ai-web-measure 는 프로필 없는 `chromium.launch` — 충돌 없음
- pc-runner 는 일을 하나씩(`busy`) 돌린다. ai-web-measure 최대 180분·local-agent 90분 — 그 줄에 끼우면 2분 못 지킨다. pc-runner 는 DB 를 안 연다

### 흐름
```
현황판 「로그인 창 열기」(login-* 사람 대기 일감 옆)
   | requestLogin(id) — 서버 동작
   v
geo.agent_tasks  kind open-login · status 로컬 대기 · dedupe open-login-<대상>
   payload { profile: .browser-profile | .browser-profile-<slug>, sites: [google|naver|microsoft], from: <login 일감 id> }
   |
   v  pc-runner 별도 타이머(매분, busy 와 따로, LOGIN_POLL_HOURS 안에서만)
login-poll.mjs -- 로컬 대기 open-login 없음 → 바로 끝(쿼리 1번)
   | 있음
   +- .local-agent.lock 신선(2시간 안) & 같은 프로필 → note 「로컬 에이전트가 브라우저를 쓰는 중 — 끝나면 엽니다」, 그대로 둠
   +- .open-session.lock 있음 → 그대로 둠
   v
상태 실행 중 → .open-session.lock 쓰기 → open-session.mjs --only <sites> [--blog <profile>] (최대 12분)
   | 출력 「✓ <이름> 로그인 확인」 줄
   +- 요청한 곳 전부 ✓ → open-login 완료 + from 일감 완료(evidence 「창에서 로그인 확인」)
   +- 일부/없음     → open-login 실패(「아직 확인 안 된 곳: …」), from 일감 그대로 사람 대기
   lock 지움
local-agent 시작 때 .open-session.lock(13분 안) 있으면 기다렸다 시작(건너뛰지 않는다)
다음 local-agent 가 또 풀림을 보면 기존처럼 login-* 를 다시 사람 대기로(자기 교정)
```

### Build Order
1. **옛 작업 끄기(먼저).** `schtasks /change /tn "\Cited AI Measure" /disable` · `\Cited Heartbeat` · `\Cited Local Agent`(Git Bash 면 `//change //tn … //disable`, MSYS 경로 변환 주의 — CLAUDE.md 함정). 출력 원문을 BUILD-LOG 에. 거부되면 그 원문 + 원장 일감 1건(관리자 PowerShell 에 붙일 한 줄). 끈 뒤 `schtasks /query` 로 「사용 안 함」 확인
2. local-agent 가 잠금으로 건너뛸 때 **종료코드 3**. pc-runner `돌리기` 는 3 을 「건너뜀(다른 실행이 돌고 있음)」으로 기록(성공 아님). ai-web-measure 잠금 건너뜀도 같은 꼴이면 같게(Grep)
3. pc-runner `ai-web-measure` at `["10:00","16:00"]` — 두 번째는 그날 안 잰 문항만 잰다(기존 동작). 고객 순서 돌리기는 **안 한다**: 한 번 일어난 일이고, 학원(레퍼런스)이 맨 앞에서 매일 같은 조건으로 재는 게 우선
4. `tools/open-session.mjs` 일반화 — 기본(인자 없음) = 구글·네이버 서치어드바이저·**빙 웹마스터** 셋. `--only google,microsoft` 로 고르기. `--blog <profile>` 은 지금 그대로(네이버 블로그 하나)
   - 빙: open `https://www.bing.com/webmasters/submiturl?siteUrl=https%3A%2F%2Frobotncoding.com%2F`, isOut = bing-submit-urls 와 **같은 정규식** `/login|signin|\/webmasters\/about/i`(+ `login\.live\.com|login\.microsoftonline`). 판정 정규식은 한 파일(`tools/login-rules.mjs`)에서 bing-submit-urls·open-session·gsc-access 가 import
   - 네이버 판정 = 2026-10-05 NID_AUT 만료일(`expires > 0`) 그대로. 고치지 않는다
   - done 을 google/naver 고정 객체 → SITES 기준으로. **로그인 된 주소 판정이 두 번 연속(3초 간격) + goto 뒤 10초 지나야 ✓** — 리다이렉트 전 주소로 헛 ✓ 를 막는다(bing-submit-urls 가 9초 기다리는 이유)
   - 출력 「✓ <이름> 로그인 확인」은 login-poll 이 읽는다 — 글자 바꾸지 않는다
5. `tools/login-poll.mjs`(새) — 위 흐름. DB 연결은 local-agent 와 같은 줄(.env.local · 쿼리마다 열고 닫기). 활동 줄 `deliver`「로그인 창」 ok/실패. open-session 경로는 환경변수로 바꿔 끼울 수 있게(시험용 가짜)
6. `tools/pc-runner.mjs` — `setInterval` 하나 더(60초, `loginBusy` 따로). `LOGIN_POLL_HOURS`(academy/.env.local, 예 `8-24`) 안에서만 login-poll 을 띄운다. **빈 값 = 끔**. 끝나면 pc-runner 를 다시 띄워야 새 코드가 돈다(pid 끝내기 → VBS 가 1분 뒤 다시 띄움) → `--status`·로그로 확인
7. local-agent 시작 — `.open-session.lock`(13분 안) 있으면 30초 간격 최대 13분 기다림, 넘으면 「로그인 창이 안 닫힘 — 건너뜀」 종료코드 3
8. 웹: `web/lib/ops.ts` 일감 select 에 `dedupe_key` · `todo-text.ts` 에 dedupe `login-%` 분기 → action `{ type: "login" }`, why 「버튼을 누르면 원장 PC 에 로그인 창이 뜹니다(PC 가 켜져 있어야 합니다). 로그인하면 창은 스스로 닫힙니다」 · `Todo.tsx` 에 폼(SubmitButton 「로그인 창 열기」) · `task-actions.ts` `requestLogin` — 그 id 가 사람 대기 login-* 인지 확인, dedupe→sites 표(`login-google`→google, `login-naver`→naver, `login-microsoft`→microsoft, `login-naver-blog-<slug>`→blog 프로필 `.browser-profile-<slug>`, slug 는 그 고객 행에서 — dedupe 글자로 경로를 만들지 않는다), open-login upsert(이미 로컬 대기·실행 중이면 그대로 — 두 번 눌러도 창 하나). 눌렀으면 그 줄 「조치 중: 로그인 창 요청함(HH:MM KST)」
   - open-login 이 30분 넘게 로컬 대기면(PC 꺼짐) company 가 실패로 바꾸고 「PC 가 꺼져 있어 창을 못 열었습니다」. 기존 「늦음」 길이 있으면 그 길로(Grep)
9. login-* 일감 문구(local-agent 84~88·164~168) 「node … 를 실행해」 → 「현황판 「로그인 창 열기」를 누르거나 PC 에서 node tools/open-session.mjs」
- Flag(Escalate 대기): **Neon 요금제 모름.** 매분 쿼리는 그 시간 동안 DB 를 늘 깨워 둔다(자동 잠듦 기본 5분보다 짧다). 한도 있는 요금제면 컴퓨트 시간이 걸린다. 근거 없이 「괜찮다」 하지 않는다 — `LOGIN_POLL_HOURS` 빈 값으로 배포하고 세션 확인 뒤 켠다

---

## 39c — GSC 권한 탐침

### Build Order
1. `tools/gsc-access.mjs --client <slug> [--look] [--domain <d>]` — `.browser-profile`, 주소 = submit-gsc 와 같은 PROP(`gscProperty ?? sc-domain:<domain>`)로 `https://search.google.com/search-console?resource_id=<PROP>`, 9초 기다림. `--look` = 최종 URL + innerText 앞 60줄 + 보이는 버튼 글자(bing-submit-urls --look 꼴). `--domain` 은 원문 받기용(고객 행 없이 그 도메인만). 로그인 풀림 판정 = open-session 구글 isOut(login-rules.mjs)
2. 판정은 순수 함수 `권한판정(url, text)` → `"있음" | "없음" | "모름"`. **원문 fixture 가 들어오기 전엔 언제나 "모름".** Bob 은 「권한 없음」·「권한 있음」 정규식을 지어 넣지 않는다
3. local-agent: wantGsc 이고 config.gsc !== true 인 DB 고객마다 하루 한 번 탐침 → `derived.gscAccess = { state, at(KST), url, sample: 앞 600자 }`. state 「있음」일 때만 config.gsc = true(→ 매시 동기화가 setup-gsc 사람 칸을 닫는다). 「없음」「모름」은 config 안 바꿈. gsc 가 이미 true(원장 「권한 받음」)인 고객은 탐침하지 않는다(확인할 기준이 아직 없다)
4. 체크리스트 gsc 줄(client-core 574~576) 에 gscAccess 반영: 있음(날짜) · 없음(날짜) · 모름 「원장 PC 가 봤지만 판정 기준을 아직 못 정했습니다」 · 탐침 전 「원장 PC 가 아직 안 봤습니다」
5. **세션이 원장과 함께**(Acceptance 세션 3) 원문 두 개가 오면: `academy/scripts/fixtures/gsc-access-have.txt`·`gsc-access-none.txt`(첫 줄 URL) → 그 글자에서만 정규식 → 시험. 이것까지가 39c. 원문이 이번 세션에 안 오면 「모름」 그대로 배포하고 KG

---

## Failure modes
| 길 | 실제로 날 일 | 처리 | 사람이 보나 |
|---|---|---|---|
| 39a 사실 0개 | 켰는데 사실을 안 적음 | 건너뜀 줄 + 체크리스트 줄, 시험 | 보임 |
| 39a 문서딱 글자 회귀 | 리터럴 바꾸다 공백·문장부호 한 글자 바뀜 | 스냅샷 글자 비교 시험 | 시험이 막음 |
| 39a 사실 칸에 확인 안 된 말 | 원장 아닌 누가 채움 | 폼 문구 + checkedOn 날짜. 코드가 막을 수 없다 — 사람 몫 | 날짜로 추적 |
| 39a banned 특수문자 | 정규식 깨짐 | lit 로만 정규식, 시험 | — |
| 39b PC 꺼짐 | 눌렀는데 아무도 안 집음 | 30분 뒤 실패 줄 | 보임 |
| 39b 프로필 사용 중 | local-agent 가 같은 프로필 열고 있음 | 기다림 note, 끝나면 엶. local-agent 는 창 닫힐 때까지 기다림 | 보임 |
| 39b 창 안 닫힘 | 원장이 로그인 안 하고 자리 뜸 | open-session 12분 상한 → 실패 「확인 안 된 곳」 | 보임 |
| 39b 헛 ✓ | 리다이렉트 전 주소로 판정 | 두 번 연속 + 10초 규칙, 시험 | — |
| 39b 버튼 두 번 | 창 둘 → 프로필 충돌 | dedupe upsert + .open-session.lock | — |
| 39b DB 상시 깨움 | 요금 한도 | 빈 값 = 끔, 세션 확인 뒤 켬 | **escalate** |
| 39b 옛 작업 못 끔 | 권한 거부 | 원문 + 원장 일감 1건, 종료코드 3 으로 겹침이 로그에 보임 | 보임 |
| 39c 판정 기준 없음 | 원문 못 받음 | 「모름」만, config 안 바꿈 | 체크리스트에 보임 |
| 39c 탐침 중 구글 풀림 | 로그아웃 | 기존 login-google 일감(사람로그인) | 보임 |

## Test map
- 39a: 문서딱 프롬프트 3채널·관문 이유 스냅샷 같음 `[GAP→새]` · `--dry --no-claude` 문서딱 전후 차이 0 `[TESTED 방식]` · DB 고객 facts 0 → 건너뜀·Claude 0회 `[GAP→새]` · facts 있음 → 사실 줄·persona 기본값·「(예:」 없음·「문서딱」 0 `[GAP→새]` · 고객설정 facts·banned·alternatives·guidePrefix 형 틀림 → 빠짐 줄 `[GAP→새]` · 폼 페이지 줄 파서 `[GAP→새]` · 바깥글고치기 checkedOn 새 줄만 오늘 `[GAP→새]` · test-clients·test-marketing·test-docttak 회귀 `[TESTED]`
- 39b: dedupe→sites·profile 표 `[GAP→새]` · requestLogin 두 번 → 한 행·login-* 아닌 id 거부 `[GAP→새]` · login-poll 없음/잠금 중/전부 ✓/일부 ✓(가짜 open-session) `[GAP→새]` · open-session 판정 순수 함수(두 번 연속·10초·빙 정규식·NID_AUT) `[GAP→새]` · pc-runner 종료코드 3 기록·LOGIN_POLL_HOURS 창(빈 값 끔, 8-24, 0-24) `[GAP→새]` · todo-text login 분기 `[GAP→새]` · 30분 지난 open-login 실패 `[GAP→새]` · bing-submit-urls 판정이 login-rules 로 옮겨도 같은 결과(/webmasters/about) `[GAP→새]` · local-agent 기존 길 회귀 `[TESTED 일부]`
- 39c: 권한판정 fixture 전 「모름」 `[GAP→새]` · gscAccess 저장·「있음」만 config.gsc true·gsc true 고객은 탐침 안 함 `[GAP→새]` · 체크리스트 gsc 줄 4갈래 `[GAP→새]` · fixture 뒤 have/none `[세션 뒤]`

## Out of Scope
- ④ 자사 0원 리허설 화면 → Step 40
- 고객 측정 순서 돌리기(39b 3 결정) · KG-38-7·38-8 dispatcher · 진짜 고객 중지·지우기(KG-38-1·2)
- submit-gsc 가 권한 없는 속성에서 어떻게 실패하는지 고치기(탐침 원문 뒤)
- 바깥 글 사실을 사이트에서 자동 추출

## Acceptance
**Bob 이 확인**
- 39a: 스냅샷 시험 통과 · `node scripts/marketing-draft.mjs --client docttak --dry --no-claude` 전후 diff 0 · E2E 시험 고객(도메인 geo-rose-nine.vercel.app, status test, 끝에 화면 지우기·남은 행 0)으로 facts 0 → 건너뜀, facts 2줄 → `--dry --channels jisikin --max-calls 1` 실제 Claude 한 번: 프롬프트에 사실 2줄·「문서딱」 0·관문 결과 출력(DB 안 바뀜)
- 39b: 옛 작업 3개 「사용 안 함」(또는 거부 원문 + 일감) · 단위 시험 전부 · 로컬 next dev 에서 login 일감 버튼 → open-login 한 행·두 번 눌러도 한 행 · login-poll 을 가짜 open-session 으로 끝까지(실제 브라우저 안 엶) · pc-runner 다시 띄우고 `--status`
- 39c: `권한판정` 「모름」 시험 · local-agent 탐침 길은 가짜 탐침 출력으로
- 회귀: test-clients · test-client-core · test-marketing · test-docttak · daily-agent·briefing·health 전후 0 · web tsc(`node ./node_modules/typescript/bin/tsc`)

**세션이 원장과 함께 확인**(Bob 은 못 함 — 원장 로그인 브라우저)
1. Neon 콘솔 요금제·컴퓨트 한도(세션이 chrome-cdp 로 보면 원장 몫 0). 괜찮으면 `LOGIN_POLL_HOURS=8-24`
2. 현황판 login 일감(없으면 시험용 login-microsoft 한 건) 「로그인 창 열기」 → 2분 안에 창 → 로그인 → 창 스스로 닫힘 → 일감 완료. 원장 몫: 로그인 한 번
3. `node tools/gsc-access.mjs --client robotncoding --look` + `--domain example.com --look` 원문 → fixture 두 개 → Bob 이 정규식·시험(39c 5)
4. 다음 12:40 local-agent.log 에 「이미 돌고 있습니다」가 없는지(옛 작업 꺼짐 확인)
