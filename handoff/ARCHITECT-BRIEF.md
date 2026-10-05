# Architect Brief — Step 38 (고객사 등록 화면 · 세팅 점검 · 체크리스트)

선행: Step 37(ff9865c) 배포 뒤 시작. 37 리뷰 반영으로 clients.mjs 가 바뀌면 그 위에서.
Step 39(다음): 바깥 글 범용화(KG-37-1, 확인한 사실 목록) · 로그인 창 버튼(open-login → pc-runner) · GSC 권한 탐침 · 자사 0원 리허설 화면. 38 에서 손대지 않는다.

## Goal
원장이 /admin/clients 에서 고객사 정보를 넣으면 행·설정·IndexNow 키가 생기고, 사이트를 실제로 열어 본 결과(derived)가 채워지고, 고객 상세 맨 위 체크리스트가 됨/기다림/사람 몫을 말한다. CLI 는 안 쓴다.

## 관계 결정 (/admin/clients ↔ /admin/pilots)
- 고객사를 만드는 곳은 /admin/clients 하나. createPilot 은 더는 geo.clients 에 insert 하지 않는다.
- 파일럿은 고객 상세(/admin/clients/[slug])의 「파일럿 시작」 폼에서. 계약 칸(담당자·입금·약관·환불 절·필요한 준비·경쟁사·지역·동네·업종·대상)은 지금 pilots 폼 칸 그대로 옮긴다. 이름·도메인·slug·이름 판별 말은 고객 행에서 읽는다.
- /admin/pilots 는 진행 목록·관리 그대로. 만들기 폼 자리에 「새 고객사는 고객사 화면에서 등록합니다」 링크 한 줄.
- 파일럿은 relation 외부 고객만(지금 검사 유지). 자사 리허설은 39.

## Flow
```
[등록 폼] --저장--> 등록(core) ─ tx: insert geo.clients(status active|test, config, answer_pattern, alias)
                                 └ commit (점검 실패해도 등록은 남는다)
     └-> 세팅점검(domain,key)  실제 fetch 5개 병렬, 각 8초 · 전체 20초
           home / robots.txt / sitemap(robots 의 Sitemap: 또는 /sitemap.xml) / llms.txt / /<key>.txt
         -> update derived (근거: 상태코드·content-type·본문 앞 300자)
     └-> redirect 상세 -> 체크리스트(row, derived, pilot) 순수 -> 칸마다 됨|기다림|사람|해당없음

[company.mjs 매시] active DB 고객 중 derived.checkedAt 없음/24h 지남, 한 번에 3곳 → 세팅점검 → derived
                   → 체크리스트 → 사람 칸 = agent_tasks 사람 대기 upsert (dedupe setup-<칸>) / 됨 = 완료로 닫음
[상세 「다시 점검」] → 세팅점검 즉시
[상세 「지우기」] status test 만 → tx: client_id·pilot_id 칸 표 전부 delete → 같은 tx 에서 남은 행 세기 → 0 아니면 rollback·오류
```

## Build Order
1. **web/lib/client-core.mjs (+ .d.mts)** — growth-core 처럼 academy 도 import 하는 순수·DB 주입 모듈. 담는 것:
   - `입력검사(form값)` → {ok, 칸, 오류[]}. 이름 2~40 · slug `^[a-z0-9-]{1,40}$` · 도메인: 스킴·경로·포트 떼고 호스트만, IP 글자·localhost·점 없는 호스트 거부 · 이름 판별 말(쉼표, 2~40자, 1~10개) 필수 · 경쟁 검색어 3~8 필수 · 브랜드 검색어(선택, 기본 [이름]) · 제외 앞말(선택) · 주소 일부·전화 끝 4자리(선택) · relation 자사/외부 · 시험 고객 체크 · GSC 쓰기 체크(기본 켬).
   - `등록(q, 입력)` — slug 가 코드덩어리(1·2·3) 또는 DB 에 있으면 거부(덮어쓰지 않는다 — 지금 createPilot 의 on conflict update 는 등록에서 안 씀). 같은 도메인 고객이 있으면 거부. alias: 외부는 nextAlias, 자사는 이름. IndexNow 키 = randomUUID 하이픈 뺀 32자, mode 「우리」. config = {v:1, brandWords?, hitWords, queries{compete,brand}, presence[], answerTerms[], answerExclude[], indexnow{mode,key}, gsc:false, wantGsc}. answer_pattern = answerPattern(말, 제외앞말). answerTerms·answerExclude 원문을 config 에 두는 이유: 정규식은 되돌릴 수 없어 고치기 폼이 원래 말을 보여 줘야 한다.
   - `고치기(q, slug, 입력)` — slug 불변. 도메인이 바뀌면 derived 를 {} 로. answer_pattern 다시 만듦.
   - `세팅점검(domain, key, {fetch})` → derived. 키 이름은 37 고객설정이 읽는 것과 맞춘다: `llmsTxt.ok`(200 · text/plain|text/markdown · 본문이 `<` 로 시작 안 함), `homeLdTypes`(ld+json 전부, @graph·배열 재귀). 더해: `checkedAt`, `home{status}`, `robots{status, blocked[], head}`(AI 봇 이름 또는 * 묶음에 `Disallow: /` 이고 `Allow: /` 없음 → 막힘), `sitemap{status,url,pages}`(sitemapindex 면 자식 5개까지 loc 셈), `indexnowFile{status, ok}`(본문 trim === 키), `errors[]`. 추측 값 금지 — 못 열면 그 칸은 status 와 오류만.
   - AI 봇 목록은 web/lib/crawler-class.ts AI_BOTS 와 같게 — 시험이 둘을 맞춰 본다(GROWTH_SLUGS 방식).
   - `체크리스트(row, derived, {pilot, approvedQuestions})` 순수 → [{칸, 상태, 사람말, 할일}]. 칸:
     사이트 열림 · AI 크롤러 허용(robots) · 사이트맵 · llms.txt · 홈 JSON-LD · IndexNow 키 파일 · 구글 서치콘솔 권한 · AI 측정(파일럿·질문 승인) · 바깥 글(39 전까지 늘 「해당없음 — 꺼짐」).
     「고객 담당에게 보낼 것」(robots·사이트맵·llms·JSON-LD·키 파일 중 빠진 것)은 사람 칸 **하나**로 묶고, 할일에 그대로 복사해 보낼 글(파일 이름·내용 포함)을 만든다. 원장 몫 칸은 최대 3개(전달·GSC·파일럿) — 원장 할 일 최소.
   - `지우기(q, slug)` — status 「test」 아니면 거부. information_schema 로 geo·academy 의 client_id·pilot_id 칸 표 전부(test-new-client.mjs 46~63행 방식). **.catch 로 삼키지 않는다** — 한 tx, 끝에 남은 행 세서 0 아니면 rollback·던짐.
2. **web/lib/answer-pattern.ts** — `answerPattern(raw, exclude="")` 제외 앞말이 있으면 각 말 앞에 부정 lookbehind `(?<!앞말\s*)`. 기존 한 인자 호출 결과 글자 그대로(회귀 시험). answer_pattern 은 JS 에서만 쓰인다(Arch grep: SQL 정규식 사용 0) — Bob 이 한 번 더 grep.
3. **academy/clients.mjs 고객설정** — `config.presence` 말 → presenceRe(lit, 없으면 null 그대로). KG-37-3 닫음. 그 밖 칸 손대지 않음.
4. **web/lib/client-actions.ts** (server actions, guard 는 pilot-actions 와 같은 isAdmin) — 등록·고치기·다시점검·GSC 받음(config.gsc=true)·지우기. 등록은 commit 뒤 점검(실패해도 상세로). 실패는 `?err=` 사람 말 한 줄(Step 28 D23 방식).
   - Flag: 이 Next 버전 server action 시간 한도를 node_modules/next/dist/docs 에서 확인. 점검 20초가 넘을 수 있으면 저장만 하고 「점검 중 — 다음 매시에」로 돌린다. 추측 금지.
   - GSC 받음 버튼은 원장 말을 믿는 임시 길이다. 39 의 탐침이 화면 원문으로 확인한다. submit-gsc 실패는 지금도 활동 줄에 보인다(조용하지 않음).
5. **web/app/admin/clients/page.tsx** — 목록(이름·도메인·자사/외부·시험·체크리스트 요약 「사람 n · 기다림 n」) + 등록 폼. **[slug]/page.tsx** — 맨 위 체크리스트, 그 아래 고치기 폼, 점검 근거(상태코드·본문 앞부분), 「파일럿 시작」(외부·파일럿 없음일 때), 지우기(시험만). 코드 고객 3곳은 목록에 「코드 설정 — 화면에서 안 고침」으로만.
   - 한글 `word-break: keep-all`. 문구는 사람 말(메모리 「현황판은 사람 말로」). 로그 조각 금지.
6. **web/lib/pilot-actions.ts createPilot** — `client_id` 를 받아 고객 행을 읽는다. geo.clients insert/upsert 줄 삭제. 나머지(질문·과업·감사·승인 행) 그대로. pilots/page.tsx 만들기 폼 → 링크. 폼 칸은 상세로 옮김.
7. **academy/scripts/company.mjs** — 매시 재점검(active, 24h, 3곳, 고객당 20초) + 체크리스트 사람 칸 동기화(함수는 client-core, company 는 부르기만 — E2E 가 같은 함수를 부른다). title 은 사람 말: 「<이름>: 고객 담당에게 보낼 것이 있습니다」「<이름>: 구글 서치콘솔 권한을 받아 주세요」「<이름>: 파일럿을 시작해 주세요」. 활동 줄 agent 「setup」.
   - Flag: todo-text.ts 가 kind 로 문구를 고르니 kind 「setup」 분기를 추가해 할일 글(링크 /admin/clients/<slug>)을 띄운다.
8. **web/lib/agents.ts PIPES**(KG-37-2) — id 1·2·3 밖은 config 로: indexnow = mode 「우리」 && key && derived.indexnowFile.ok, marketing = config.marketing.enabled === true. posts false.
9. **AdminNav** 「고객사」 추가. **CLAUDE.md** 함정 줄 「고객사를 추가하면 clients.mjs 에 한 덩어리…」 → 「고객사는 /admin/clients 에서 등록한다. 빈 칸은 상세 체크리스트가 말한다. 코드 3곳(학원·아이로그·문서딱)만 clients.mjs」.
- Flag: 고객 이름·도메인은 관리 화면·DB 에만. 공개 페이지·케이스 리포트·공개 로그에 새 길 0. derived 에 남는 본문 앞부분도 관리 화면에서만.
- Flag: 사이트 fetch 는 등록한 도메인 https 만, redirect 는 같은 호스트(www 차이 허용)까지. 다른 호스트로 가면 따라가지 않고 그 상태 기록.

## Failure modes
| 경로 | 실제로 날 일 | 처리 | 사람이 보나 |
|---|---|---|---|
| 저장 시 점검 | 고객 사이트가 느림·죽음 | 8초/20초 한도, 등록은 이미 commit, 칸 「점검 못 함(코드/시간 초과)」=기다림, 매시 재시도 | 보임 |
| 도메인 입력 | `http://10.0.0.1:3000/x` 같은 값 | 입력검사 거부, 오류 한 줄 | 보임 |
| 중복 | 문서딱 slug·docttak.com 을 다시 등록 | 거부(덮어쓰기 없음) | 보임 |
| robots 파서 | 묶음 해석이 틀려 막힘을 놓침 | 픽스처 시험(봇 막힘·* 막힘·Allow 예외·빈 파일·404) | 시험 |
| 매시 동기화 | 사람 일감이 매시 새로 생김 | dedupe setup-<칸>, upsert, 됨이면 완료 | 시험 |
| 지우기 | FK 순서·빠진 표로 행이 남음 | 한 tx, 남은 행 0 확인 아니면 rollback+오류 | 보임 |
| 지우기 | 진짜 고객을 지움 | status test 만, 서버에서 다시 검사 | 보임 |
| createPilot 변경 | 옛 pilots 폼 경로가 고객 행을 안 만들어 깨짐 | 폼 제거·링크, client_id 없으면 오류 | 보임 |
| 가림 | 새 외부 고객 이름이 영업 자료로 샘 | 37 strict 가림 그대로 + E2E 에서 고객사말에 새 이름 확인 | 시험 |
| 시험 고객 | 매시 루프·할 일 목록에 섞임 | company 재점검·동기화는 active 만 | 시험 |
| 점검 근거 | 고객 사이트 본문이 DB 에 커짐 | 칸마다 앞 300자만 | 시험 |

## Test map
- 입력검사: 각 칸 빈 값·길이·도메인 정리(스킴/경로/포트/IP/localhost) [GAP → 새 시험]
- 등록: 새 고객 · 코드 slug 거부 · DB slug 거부 · 같은 도메인 거부 · 외부 alias · 키 형식 [GAP]
- answerPattern 두 인자 · 한 인자 기존 글자 그대로 [기존 일부 TESTED, 제외 앞말 GAP]
- 세팅점검 가짜 fetch: robots 5꼴 · sitemap/sitemapindex · llms(HTML 대체 페이지) · ld+json(@graph·배열·깨진 JSON) · 키 파일 일치/불일치/404 · 시간 초과 · 다른 호스트 redirect [GAP]
- 체크리스트: 모든 칸 됨 · 전달 묶음 하나 · wantGsc 꺼짐=해당없음 · 파일럿 없음/질문 미승인 · 자사는 파일럿 칸 해당없음 [GAP]
- AI_BOTS 목록 일치 [GAP]
- 고객설정 presence → presenceRe [GAP]; 37 test-clients 82 전부 [TESTED, 회귀]
- 동기화: 생성·중복 없음·완료로 닫힘·test 제외 [GAP]
- 지우기: test 아님 거부 · 남은 행 0 [GAP]
- createPilot(client_id): 기존 외부 고객에 파일럿·질문 20·과업 생성, geo.clients 행 수 그대로 [GAP]
- PIPES DB 고객 [GAP]

## Out of Scope
- 바깥 글 범용화·확인한 사실 칸(KG-37-1) · 로그인 창 버튼 · GSC 권한 탐침 · 자사 리허설 화면 → Step 39
- 진짜 고객 지우기/중지 · slug 바꾸기 → Known Gaps
- 학원·아이로그·문서딱 코드 덩어리 이전 — 하지 않음(37 결정)

## Acceptance
- 새 시험 `academy/scripts/test-client-core.mjs`(Test map 전부, DB·네트워크 없이) 통과. test-clients 82 · test-docttak · test-marketing · test-growth-import 기존 통과 그대로. web tsc exit 0(`node ./node_modules/typescript/bin/tsc --noEmit -p .`).
- 끝에서 끝 `academy/scripts/test-client-screen.mjs --live`: 로컬 `next dev`(운영 DB) → `/admin/enter?key=` 로 세션 → Playwright 로 **화면 폼에서** 시험 고객 등록(시험 체크. 도메인은 우리 것인 `geo-rose-nine.vercel.app`. docttak.com 도 한 번 넣어 중복 거부 확인) → 상세에 체크리스트가 뜨고 derived.checkedAt·robots.status·sitemap.pages·homeLdTypes 가 실제 값 → 체크리스트 기대값(키 파일 없음 → 「고객 담당에게 보낼 것」 사람 칸에 키 파일 이름 포함) → 동기화 함수를 그 id 로 돌려 사람 대기 일감 확인 → 화면 「지우기」 → client_id·pilot_id 표 전부 0 · slug 0. 로그 원문을 REVIEW-REQUEST 에.
- 회귀(37 과 같은 묶음, 전/후 diff 0): daily-agent --dry · check-index --dry · marketing-draft --no-claude --client docttak · pilot-report --dry 3곳 · indexnow --list · briefing · health.
- /admin/pilots 기존 진행 고객 화면 그대로 열림(운영 주소 확인).
- CLAUDE.md 함정 줄 교체. BUILD-LOG 에 지은 것·결정·KG.
