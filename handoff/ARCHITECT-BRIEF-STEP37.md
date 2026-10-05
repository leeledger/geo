# Architect Brief — Step 37 (고객 설정을 DB 로 — 새 고객이 코드 수정 없이 돈다)

> Step 36 리뷰·배포 뒤 이 파일을 ARCHITECT-BRIEF.md 로 옮긴다. Step 36(clients.mjs `gsc`·`indexClients`, local-agent)이 들어간 코드 위에서 짓는다.
> 원장 지시(2026-10-05): 「고객사만 등록하는 화면을 만들고, 거기에 정보를 넣으면 알아서 세팅되는 시스템으로」.
> 쪼갬: **37 = 바탕(DB 설정 + 얇은 층 + 모든 스크립트 전환, 기존 3곳은 바뀌는 것 없음)** · 38 = 등록 화면·세팅 점검·체크리스트·로그인 버튼(BUILD-LOG 「2026-10-05 — Step 37 고객 등록 자동 세팅 설계」). 화면은 38 이다 — 37 은 화면 없이 DB 행 하나로 새 고객이 도는 것을 증명한다.

## Goal
geo.clients 행(+ `config` JSONB)만 있는 고객이 clients.mjs 수정 없이 노출 측정·색인 알림·점검·개선 루프·바깥 글 초안·가림 검사에 들어간다. 학원·아이로그·문서딱은 지금과 한 글자도 다르지 않게 돈다.

## 왜 (지금 무엇이 틀렸나 — Arch 확인)
- 스크립트 약 25곳이 `CLIENTS`·`selectClients`·`bySlug` 를 코드에서 바로 읽는다. 등록 화면(/admin/pilots)으로 들어온 고객은 measure-targets·submit-gsc 만 DB 로 대체되고 나머지(check-index·indexnow·health·daily-agent·marketing-draft·who-wins·briefing…)는 안 돈다.
- **가림 구멍(치명):** `masks.mjs 고객사말(CLIENTS)` 를 sales.mjs·illustrate.mjs 가 쓴다. DB 에만 있는 고객 이름은 영업 자료·도해 가림 검사에서 빠진다. 지금은 DB 고객이 3곳뿐이라 안 터졌다(2026-10-05 조회: geo.clients = id 1·2·3 만, 모두 active·자사).

## Flow
```
geo.clients (slug,name,domain,answer_pattern,relation,status,config jsonb,derived jsonb)
        |
        v
academy/clients.mjs
  loadClients(q, {slug?, includeTest?})
    +- 코드 덩어리(CODE_CLIENTS: 학원·아이로그·문서딱) 있으면 -> 그 덩어리 그대로 (출처 「코드」)
    +- 없으면 고객설정(row) = 기본값 <- derived <- config (뒤가 이김). 말은 전부 이스케이프해서 정규식으로
    DB 못 읽음 -> 코드 3곳만 + stderr 「DB 고객을 못 읽어 코드 고객 3곳만 돕니다」
        |
        v
각 스크립트 문: 필요한 칸이 없으면 그 고객만 건너뛰고 한 줄 「<slug>: <칸> 없음 — 건너뜀」 (조용히 빼지 않는다)
  check-index  도메인 있으면 늘 (색인 site: + 브랜드 기본 이름 + 경쟁 config)
  indexnow     indexnow.mode="우리" && key && 키 파일 본문=키 (그 자리에서 fetch) 일 때만
  health       llmsTxt true 일 때만 /llms.txt
  daily-agent  승인 질문 있는 고객(지금 조건). loop 은 기본값으로 채워져 「loop 설정 없음」 건너뜀이 없어짐
  marketing    marketing.enabled && pages>=1 && disclosure
  local-agent  gsc true / 블로그(marketing.enabled && blogId)
  masks        loadClients 전부 (코드 + DB)
```

## Build Order
1. **스키마** — web/db/schema.sql · academy/db/schema.sql: `alter table geo.clients add column if not exists config jsonb not null default '{}'::jsonb;` 와 같은 꼴로 `derived`. 실행 준비는 measure-targets `측정설정준비` 옆에 `고객설정준비(q)` (company.mjs 시작 준비가 부름, 실패해도 계속).
2. **clients.mjs** — 지금 배열을 `CODE_CLIENTS` 로 이름만 바꾸고 `export const CLIENTS = CODE_CLIENTS` 남김(시험용 — 6의 가드가 스크립트에서 못 쓰게 막는다). 새로:
   - `lit(word)` — 정규식 특수 글자(마침표·별표·더하기·물음표·꺾쇠·달러·중괄호·괄호·세로줄·대괄호·역슬래시) 전부 이스케이프. 말 하나 40자, 목록 20개 상한. 넘으면 자르지 말고 `빠짐`에 「말이 너무 김」.
   - `고객설정(row)` 순수 함수 -> 코드 덩어리와 **같은 모양**(brandRe·answerRe·queries·llmsTxt·publishes·siteLog·gsc·indexnowKey·loop·marketing) + `출처`{칸:'코드'|'입력'|'점검'|'기본'} + `빠짐`[칸]. 아래 표대로.
   - `async loadClients(q, {slug, includeTest})` — DB `status='active'`(includeTest 면 'test' 도) 행을 읽어 코드 덩어리 있는 slug 는 덩어리, 없는 slug 는 고객설정. 순서 = 코드 3곳(지금 순서, 학원 먼저) -> DB 고객 id 순. 코드 id 와 DB id 가 다르면 코드 쓰고 stderr 경고.
   - `async 고객고르기(argv, q)` = selectClients 의 비동기판(--client slug / CLIENT_ID / 전부). DB 고객도 찾는다. 없으면 지금 오류 문구 + DB 고객 slug 도 나열.
   - `indexClients`·`bySlug` 는 목록을 인자로 받게(기본값 CLIENTS 제거).
   - Flag: DB 연결은 스크립트들이 이미 쓰는 연결 도구를 grep 해서 재사용. 새 연결 방식 만들지 말 것.
3. **config 모양(v1) — 사람 입력은 말(글자)만. 정규식 원문은 DB 에 두지 않는다** (예외: 기존 answer_pattern — 등록 화면 answerPattern() 이 이미 이스케이프해 만든다)
   ```
   { v:1,
     brandWords?: string[]        // 검색 결과에서 우리로 셀 말. 기본 [domain] (아이로그 교훈: 이름 글자는 남과 겹친다)
     hitWords?: string[]          // loop.brandHit. 없으면 null -> 이름 질문은 인용(도메인)으로만 적중
     queries?: { compete: string[], brand?: string[] }   // 색인 site:<domain> 은 자동, brand 기본 [name]
     llmsTxt?: boolean, gsc?: boolean, siteLog?: string
     indexnow?: { mode: "우리"|"고객 배포"|"안 씀", key?: string }   // 기본 {mode:"우리"} — 키 없으면 안 보냄
     loop?: { draftWhere?, homeLdFix?, seeds?: string[], offsite?: [string,string] }
     marketing?: { enabled: boolean, pages: [{ all: string[][], guide, tool, also?: string[] }],
                   blogDays?: number[], disclosure?: string, blogId?: string } }
   ```
   - `pages[].all` = 모두 들어 있어야 하는 묶음들, 묶음 안은 하나만: `[["pdf"],["합치","병합"]]`. 순서 무관·대소문자 무시. 정규식은 lit 로만.
   - config 칸 형이 틀리면(배열 자리에 글자 등) 그 칸만 기본값 + `빠짐`에 「config.<칸> 형이 틀림」. 고객 전체를 죽이지 않는다.
   - `derived`(38 이 채운다): 37 은 `derived.llmsTxt.ok`·`derived.homeLdTypes` 가 있으면 읽기만. 없으면 기본값.
4. **기본값(새 고객)** — brandRe = lit(brandWords) 를 세로줄로 · answerRe = answer_pattern(i) · presenceRe null · publishes false · siteLog 「방문 기록 장치 없음」 · gsc false · loop: homeLd = [`"@type"`, lit(domain)] (+ derived.homeLdTypes 에 Organization·LocalBusiness·SoftwareApplication·WebSite 중 첫 것이 있으면 `"<그것>"` 추가), homeLdMissing 「홈 JSON-LD 에 @type 또는 <domain> 없음」, homeLdFix 「고객 사이트는 우리 저장소에서 고치지 않습니다. 고객 담당에게 넘깁니다.」, draft "session", draftWhere `deliverables/<slug>/guide/ 제안`, probes "variants", probeVariants {forms:["{기능} 추천","{기능} 무료"], strip: 추천·무료·방법·사이트·앱·프로그램, seeds: config 것}, offsite = 문서딱 두 줄에서 고객 고유 말을 뺀 일반 문장(Bob 이 문장 확정, 사실 지어내지 않게) · marketing: blogDays [1,4], blogProfile `.browser-profile-<slug>`, blogId = config.blogId ?? env NAVER_BLOG_ID_<SLUG>.
5. **스크립트 전환** — `grep -rln "clients.mjs" academy tools web` 전부(2026-10-05 Arch 목록: masks·measure-targets·ai-measure·briefing·check-index·company·daily-agent·health·illustrate·indexnow·log-intervention·loop-review·marketing-draft·pilot-report·rescan·sales·scout·session-task·verdict·who-wins·submit-gsc·bing-submit-urls·local-agent·ai-web-measure). `CLIENTS`/`selectClients`/`bySlug(` 직접 쓰기 -> `await loadClients(q)` / `await 고객고르기(argv, q)`. 각 문은 Flow 표대로, 건너뛸 때 한 줄.
   - measure-targets `측정설정`: 덩어리 대신 loadClients 결과의 domain·answerRe. submit-gsc D19 DB 대체 분기는 loadClients 로 흡수(지움).
   - indexnow.mjs: 코드 고객은 지금 그대로(indexnowKeyFile·indexnowKey). DB 고객은 mode "우리" + key 일 때 `https://<domain>/<key>.txt` 본문이 key 와 같을 때만 보낸다. 아니면 「<slug>: 키 파일 확인 안 됨(<상태코드>) — 안 보냄」.
   - masks `고객사말` 은 brandRe·presenceRe 없어도 이름·도메인을 넣는다(지금도 optional — 시험으로 고정). sales·illustrate 는 loadClients 결과를 넘긴다.
   - web/lib/agents.ts 설명 글 중 「clients.mjs 에 없는 고객은 아예 안 돈다」처럼 거짓이 되는 문장만 고침.
   - Flag: daily-agent·loop-review 가 brandHit 를 RegExp 로 가정하는 곳(`.test(`) — null 이면 인용만 보는 분기. 코드 3곳 경로는 안 바뀌게.
   - Flag: 모듈 맨 위 top-level await 로 DB 를 열지 말 것(시험이 DB 없이 import 한다). main 안에서 부른다.
6. **가드 시험(함정 없애기)** — academy/scripts/test-clients.mjs 에 「clients.mjs 와 test-*.mjs 밖에서 `CLIENTS`·`selectClients` 를 import 하면 실패」 검사(파일 grep). 앞으로 누가 코드 목록을 바로 읽으면 시험이 깨진다.
7. clients.mjs 머리 주석에 「새 고객은 덩어리 말고 geo.clients.config」 한 줄. CLAUDE.md 함정 줄 교체는 38(화면이 생긴 뒤).

## 칸 전수 표 (새 고객 기준. 코드 3곳은 덩어리 그대로)
(a) 등록 화면 입력 · (b) 사이트를 읽어 도출 · (c) 기본값 · (d) 사람만
| 칸 | 쓰는 곳 | 새 고객 | 37 출처 | 38 |
|---|---|---|---|---|
| id·slug·name·domain·relation·alias | 전부 | (a) | geo.clients | 등록 화면 |
| answerRe | ai-measure·ai-web-measure | (a) 이름 판별 말 | answer_pattern | + 「앞에 붙으면 남」 제외 앞말 |
| brandRe | check-index·masks | (c) 도메인 | config.brandWords | 고급 칸 |
| presenceRe | who-wins·masks | (c) 없음 | — | (a) 주소 일부·전화 끝 4자리(말 -> lit) |
| queries | check-index | (c) site:·이름 + (a) 경쟁 3~8 | config.queries | 필수, 비면 원장 차례 |
| llmsTxt | health | (b) /llms.txt 200·text/plain·HTML 아님 | config/derived | 세팅 점검 |
| indexnowKey | indexnow | (a)+(d) 키 생성, 고객이 파일 올림 | config.indexnow | 등록 때 생성, 파일 확인되면 「됨」 |
| indexnowKeyFile·publishes·학원 presenceRe | 학원만 | 코드 전용 | 코드 | — |
| siteLog | briefing·Visits | (c) | 기본 문구 | — |
| gsc | local-agent | (d) 고객 GSC 에 우리 계정 권한 | config.gsc | PC 탐침 확인 뒤 켬 |
| loop.brandHit | daily-agent | (a) 우리만의 말 | config.hitWords | 화면 |
| loop.homeLd·Missing·Fix | daily-agent | (b) 홈 JSON-LD @type | 기본 + derived | 세팅 점검 |
| loop.draft·draftWhere·probes·probeVariants·offsite | daily-agent·loop-review·company | (c) | 기본 | — |
| marketing.pages | marketing-draft | (a) 검색어 말 -> 사이트맵 주소 | config | 사이트맵 주소 고르기 |
| marketing.blogDays·blogProfile | marketing-draft·local-agent | (c) | 기본 | — |
| marketing.disclosure | marketing-draft | (a) 사람이 확인한 문구 | config | 필수 |
| blogId (옛 NAVER_BLOG_ID_<SLUG>) | local-agent | (a) | config ?? env | 화면 |
| 블로그 개설·로그인·GSC 권한·캡차 | — | (d) | — | 원장 차례 줄 + 로그인 버튼 |

## Out of Scope (38 또는 Known Gaps)
- 등록 화면·고객 상세 체크리스트·세팅 점검(setup-check)·원장 차례 줄·로그인 버튼·GSC 권한 탐침 -> Step 38
- 코드 3곳을 DB 로 옮기기 — 안 한다. 손으로 다듬은 정규식(「똑똑한」「(주)아이로그」 제외)은 코드에 남는다. 38 화면은 「코드 설정(고칠 때는 세션)」으로 보여 준다
- web 화면 변경(agents.ts 설명 문장 빼고) · CLAUDE.md 함정 줄 -> 38

## Failure modes
| 새 경로 | 실제로 터질 일 | 처리 | 보이나 |
|---|---|---|---|
| loadClients DB 읽기 | Actions 에서 DB 일시 끊김 | 코드 3곳만 + stderr 한 줄 | 로그. 학원 레퍼런스는 안 멈춤 [시험] |
| config 형 오류 | 38 화면 버그로 compete 가 글자 | 그 칸 기본값 + 빠짐 | 건너뜀 줄 [시험] |
| 사람 말 -> 정규식 | 「C++ 학원」「a.b」「(주)」 | lit 이스케이프, 길이 상한 | [시험] |
| 코드·DB id 어긋남 | 누가 DB id 를 바꿈 | 코드 쓰고 경고 | stderr [시험] |
| 시험 고객이 운영에 섞임 | E2E 중 매시 company 가 돎 | status 'test' 는 includeTest 없이 안 읽음 · finally 에서 지움 · 지워졌는지 확인 | [시험] |
| DB 고객 가림 | 영업 자료·도해에 고객 이름 | masks 가 loadClients 전부 | [시험] — 지금 구멍 |
| indexnow DB 고객 | 키만 넣고 파일 안 올림 -> 빙 403 누적 | 보내기 전 키 파일 확인 | 「키 파일 확인 안 됨」 줄 [시험] |
| brandHit null | `.test` on null -> 크래시 | 인용만 분기 | [시험] |
| 전환 하나 빠짐 | 새 고객만 조용히 안 잼(아이로그 사고 재발) | 가드 시험 6 | 시험 실패 [시험] |

## Test map
- [GAP->TESTED] test-clients.mjs(새, DB 없이): lit · 고객설정 기본값 전 칸 · config 형 오류 · pages `all` 매칭(문서딱 11줄을 all 로 옮긴 가짜 config 가 문서딱 승인 검색어에 코드 정규식과 같은 페이지를 고르는지 — 다르면 표로 찍고 Arch 판단) · loadClients(가짜 q: 정상/던짐/id 어긋남/test 행) · 고객고르기 · 가드(6) · 고객사말에 DB 고객 이름·도메인
- [TESTED] 기존 test-ilog-loop·test-grow-loop·test-docttak·test-marketing 그대로 통과
- [GAP->TESTED] 회귀(기존 3곳 diff 0): 전환 전 출력을 scratchpad 에 떠 두고 전환 뒤 diff — `daily-agent --dry`(학원·아이로그·문서딱), `check-index --dry`, `marketing-draft --dry --client docttak`, `pilot-report --dry`, `pm-report --dry`, health.mjs 확인 줄 목록
- [GAP->TESTED] 끝에서 끝 `test-new-client.mjs --live`(운영 DB): geo.clients 에 slug `e2e-test`·name 「시험고객」·domain docttak.com·status 'test'·measure_active false·config{queries:{compete:["pdf 합치기 무료"]}, indexnow:{mode:"우리"}(키 없음), marketing:{enabled:true, pages:[{all:[["pdf"],["합치","병합"]],guide:"/guide/pdf-merge/",tool:"/pdf-merge/"}], disclosure:"시험"}} 를 넣고 clients.mjs 수정 없이
  1. `check-index --dry --client e2e-test` 가 site:·「시험고객」·경쟁 1개를 잰다
  2. `indexnow --client e2e-test` 가 「키 없음 — 안 보냄」 (실제로 안 보냄)
  3. daily-agent 고객 하루가 기본 loop 로 끝까지 돈다(승인 질문이 있어야 돌면 시험 고객 파일럿·승인 질문 행을 넣고 끝에 지움 — Bob 판단, REVIEW-REQUEST 에 적음)
  4. `marketing-draft --dry --client e2e-test` 가 검색어·페이지·근거까지 고르고 Claude 를 안 부른다 (Flag: --dry 가 Claude 를 부르면 부르기 직전까지만 확인하는 길을 만들고 적는다)
  5. 고객사말(loadClients(includeTest)) 에 「시험고객」
  6. ai-measure 가 이 고객을 안 잰다(measure_active false·승인 0 — 돈·한도 안 씀)
  7. finally 에서 자식 행부터 지우고 남은 행 0 확인

## Acceptance
- 위 시험 전부 통과 · web tsc 0 (`node ./node_modules/typescript/bin/tsc` — `&` 경로 함정)
- 기존 3곳 회귀 diff 0 (diff 원문을 REVIEW-REQUEST 에)
- 가드: 스크립트에서 CLIENTS·selectClients 직접 import 0
- E2E 로그 원문을 REVIEW-REQUEST 에. 시험 고객 행이 운영 DB 에 안 남음
- 배포: Actions 스크립트라 git push(gh auth switch --user leeledger). web 은 agents.ts 문장 바뀌면 같이. 배포 뒤 다음 매시 company·03:23 snapshot·12:40 local-agent 가 3곳을 전과 같이 돌았는지 로그로 확인
