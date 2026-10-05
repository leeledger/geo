# Review Request — Step 37 (고객 설정을 DB 로)
Date: 2026-10-05
Ready for Review: YES
Status: DONE — 시험 전부 통과, 기존 3곳 회귀 diff 0(코드가 읽는 출력), E2E 운영 DB 16/16·남은 행 0. 우려 1건은 아래 「Escalate」(바깥 글 프롬프트가 문서딱 전용)

## Files Changed
- academy/clients.mjs:9-11 — 머리 주석: 새 고객은 덩어리 말고 geo.clients.config.
- academy/clients.mjs:19 — 배열 이름 `CODE_CLIENTS`(내용은 한 글자도 안 바꿈).
- academy/clients.mjs:239-249 — `CLIENTS = CODE_CLIENTS`(시험만) · `코드덩어리(slug)`(seed-*-panel 전용 한 곳 찾기) · `도메인정리`(measure-targets 에서 옮김, 거기서 다시 내보냄).
- academy/clients.mjs:251-298 — `lit`(특수 글자 전부 이스케이프) · 말 목록 읽기(40자·20개, 넘으면 자르지 않고 칸 기본값 + 「말이 너무 김」) · `pages[].all` → 순서 무관 lookahead 정규식(i).
- academy/clients.mjs:300-433 — `고객설정(row, env)` 순수 함수. 기본 ← derived ← config. 코드 덩어리와 같은 칸 + `출처`·`빠짐`. 칸 형이 틀리면 그 칸만 기본값.
- academy/clients.mjs:435-466 — `loadClients(q, {slug, includeTest, strict})`. `to_jsonb(c)` 로 읽어 config 칸이 없는 DB 에서도 돈다. DB 실패면 코드 3곳 + stderr 한 줄(strict 면 던짐). id 어긋남이면 코드 쓰고 경고.
- academy/clients.mjs:468-488 — `고객고르기(argv, q)`. --client·CLIENT_ID 로 콕 집으면 status 'test' 도. 없으면 오류에 DB slug 까지 나열.
- academy/clients.mjs:490-516 — `잠깐DB(fn)`: DB 가 없던 스크립트용. 스크립트들이 쓰던 연결 그대로(pg Pool·sslmode 지움·DATABASE_SSL_INSECURE).
- academy/clients.mjs:519-521 — `indexClients(list)`·`bySlug(slug, list)` 기본값 없앰.
- academy/measure-targets.mjs:14,23,29-38,45-46 — `고객설정준비(q)`(ALTER add column if not exists 두 줄) · 씨앗은 CODE_CLIENTS · `측정설정` 은 `코드덩어리 ?? 고객설정(row)`.
- academy/db/schema.sql:137-140 · web/db/schema.sql:91-93 — config·derived jsonb 칸(add column if not exists 만).
- academy/masks.mjs:87 — 고객사말 주석(모양 = loadClients 결과).
- academy/scripts/company.mjs:33-34,204-205,914-918 — 시작 준비에서 고객설정준비(실패해도 계속) · conf = loadClients · 고객 목록에서 status 'test' 뺌.
- academy/scripts/daily-agent.mjs:33,156-157,626-640 — 설정 = loadClients · brandHit null 이면 이름 질문은 인용으로만 적중 · 전체 대상에서 status 'test' 뺌 · 「<slug>: loop 없음 — 건너뜀」.
- academy/scripts/check-index.mjs:17,138-143 — 잠깐DB + 고객고르기 · domain 없으면 한 줄 건너뜀.
- academy/scripts/indexnow.mjs:26,78,87-100 — DB 고객: 「우리」+키일 때만, 보내기 전 키 파일 본문 확인. 「키 없음 — 안 보냄」·「키 파일 확인 안 됨(<코드>) — 안 보냄」. 코드 고객은 예전 길 그대로.
- academy/scripts/health.mjs:17,30-42 — DB 를 먼저 열어 loadClients(크롤러 확인과 같은 연결). domain 없으면 한 줄.
- academy/scripts/briefing.mjs:21,41-42,178,205-206 — loadClients · DB 고객의 기본 siteLog 는 「일부러」로 안 봄(장치 일감을 그대로 올림).
- academy/scripts/marketing-draft.mjs:15,25,37-38,292-310,339-344,374-377 — `--no-claude`(브리프 Flag: --dry 가 Claude 를 부른다) · 고객 = loadClients · DB 고객은 enabled·pages·disclosure 없으면 「<slug>: <칸> 없음 — 건너뜀」 · DB 고객 사실 줄에서 문서딱 사실 뺌 · DB 고객은 Claude 직전에 멈춤.
- academy/scripts/sales.mjs:30,79-80 · illustrate.mjs:24,414,515 — 가림 말 = loadClients(includeTest, strict). DB 가 열려 있으면 못 읽을 때 멈춘다.
- academy/scripts/ai-measure.mjs:23,230-231,490 — 탐침 설정을 loadClients 목록에서.
- academy/scripts/{who-wins,rescan,growth-import,verdict,log-intervention}.mjs — selectClients/bySlug/CLIENTS → 고객고르기/loadClients. who-wins 는 경쟁 검색어 없으면 한 줄.
- academy/scripts/seed-{panel,ilog-panel,docttak-panel}.mjs — bySlug → 코드덩어리(그 고객 전용 시드라 코드 정규식이 맞다).
- academy/scripts/scout.mjs:212 — 「clients.mjs 에 검색어를 넣고」 → geo.clients.config queries.compete(코드 3곳은 clients.mjs).
- tools/submit-gsc.mjs:19-35 — D19 DB 대체(DB고객·옛 고객고르기)를 지우고 잠깐DB + loadClients/고객고르기로.
- tools/bing-site.mjs:1,9-11 · bing-submit-urls.mjs:19 — bingClient 비동기(DB 고객도). 두 번째 인자로 연결을 바꿀 수 있게(시험은 DB 없이).
- tools/local-agent.mjs:23,94-95,153-163,273-297 — 고객들 = loadClients · indexClients(고객들) · 블로그는 코드 고객 그대로, DB 고객은 enabled && blogId(없으면 기록 한 줄) · 아이디 = blogId ?? env.
- web/lib/agents.ts:54 — 거짓이 된 문장(「clients.mjs 에 없는 고객은 아예 안 돈다」)만.
- academy/scripts/test-clients.mjs (새, 82개) — lit · 기본값 전 칸 · config 우선·derived · 형 오류 · 길이 상한 · pages all ↔ 문서딱 코드 정규식(승인 검색어 17개) · loadClients(정상/던짐/strict/q 없음/id 어긋남/test 행) · 고객고르기 · 측정설정 · 고객사말 · 가드.
- academy/scripts/test-new-client.mjs (새) — `--live` E2E. 시험 고객 넣고 → 1~6 → finally 에서 client_id·pilot_id 칸 있는 표 전부 지우고 남은 행 0 확인.
- academy/scripts/test-{docttak,grow-loop,growth-import,ilog-loop,marketing}.mjs — bySlug(…, CLIENTS)·indexClients(CLIENTS)·await bingClient(…, 오프라인).

## 시험·tsc
```
test-clients: 82 통과 · 0 실패
test-docttak: 32 통과 · 0 실패
test-grow-loop: 37 통과 · 0 실패
test-growth-import: 59 통과 · 0 실패
test-ilog-loop: 33 통과 · 0 실패
test-marketing: 38 통과 · 0 실패
illustrate --test: 전부 맞음 · sales --draft-test · sales --leak-test(운영 DB 읽기, 「지금 web/public/case/academy.html — 걸림 없음」) 통과
web: node ./node_modules/typescript/bin/tsc --noEmit -p .  → exit 0
가드 확인: academy/scripts 에 `import { CLIENTS } from "../clients.mjs"` 가짜 파일을 넣으면 test-clients 1 실패 → 지움
test-visit.mjs: ERR_UNKNOWN_FILE_EXTENSION (KG-36-10, 이 Step 전부터)
```
pages all 비교: 문서딱 11줄을 all 로 옮긴 가짜 config 가 승인 검색어 17개 모두 코드 정규식과 같은 안내 페이지를 고름(다름 0 — 표 없음).

## 회귀 — 기존 3곳 전후 출력 (cwd academy, 전 13:19 · 후 13:4x, scratchpad before/ · after/)
```
daily-agent --dry                       차이 0
check-index --dry (3곳, Bing·네이버 실시간)  차이 0
marketing-draft --no-claude --client docttak  차이 0   (전후 모두 --no-claude — 원래 --dry 는 Claude 를 불러 매번 다름)
pilot-report --dry --stage baseline (robotncoding · ilog · docttak)  차이 0 · 0 · 0
indexnow --list (3곳)                    차이 0
briefing                                차이 0
health 확인 줄 목록 (횟수·「N일 전」만 지움)   차이 0
pm-report --dry                         차이 있음 — 데이터 변화. pm-report 의 import 그래프(loop-grow → pilot-report-core)에 바뀐 파일이 없다:
  < 어제 9시부터 일 87건 중 6건이 실패했습니다.      > … 88건 중 6건 …
  < 근거 일 40건 · 실패 1건                        > 근거 일 41건 · 실패 1건
  < AI Gemini 2026-10-04 이름 6/20 …               > AI Gemini 2026-10-05 이름 5/15 …
  < AI Perplexity 2026-10-05 이름 9/11 …           > AI Perplexity 2026-10-05 이름 12/20 …
  (body JSON 도 같은 칸만. "끝" 시각은 비교에서 뺌)
```
E2E 뒤(config·derived 칸이 운영 DB 에 생긴 뒤) 빠른 묶음을 한 번 더: daily-agent·marketing·pilot robotncoding·docttak·indexnow·briefing·health 차이 0. pilot ilog 만 그사이 들어온 10-05 측정으로 「잰 날 4/7 → 5/7 · 표본 80 → 86」(데이터).

## E2E 로그 원문 — `node scripts/test-new-client.mjs --live` (운영 DB, exit 0)
```
시험 고객 id 6 (e2e-test, status test)
  ✓ 보통 목록엔 시험 고객 없음
  ✓ includeTest 목록에 고객설정으로
── check-index --dry --client e2e-test
   | ══ 시험고객 · docttak.com ══
   |   [Bing]
   |     색인    site:docttak.com           미노출
   |     경쟁    pdf 합치기 무료                 미노출
   |     브랜드   시험고객                       미노출
   |   [네이버 웹문서]
   |     색인    site:docttak.com           노출 1위
   |     경쟁    pdf 합치기 무료                 미노출
   |     브랜드   시험고객                       미노출
   |   [네이버 통합검색]
   |     색인    site:docttak.com           노출  (웹문서)
   |     경쟁    pdf 합치기 무료                 미노출
   |     브랜드   시험고객                       미노출
   |   경쟁 검색어  0/1   ← 이겨서 얻는 자리
   |   브랜드 방어  0/1
  ✓ check-index 끝까지 ✓ site:docttak.com 잼 ✓ 브랜드 「시험고객」 잼 ✓ 경쟁 1개 잼
── indexnow --client e2e-test (키 없음)
   |   e2e-test: 키 없음 — 안 보냄
  ✓ 키 없음 — 안 보냄
── indexnow --client e2e-test (키 있음·파일 없음)
   |   e2e-test: 키 파일 확인 안 됨(404) — 안 보냄
  ✓ 키 파일 확인 안 됨 — 안 보냄
── daily-agent --dry --client e2e-test
   | 시험고객 · 2026-10-05
   |   최근 7일 자동 측정 적중 0/1 · 측정된 질문 1/2
   |   [variant] 검색어를 바꿔 어디서 이름이 나오는지 잽니다
   |       근거: 아직 잰 변형 없음 · 오늘 새로: q1→「pdf 합치기 추천」
   |   (dry) 탐침 keyword q1 → 변형「pdf 합치기 추천」
   | q2「시험고객 어떤 사이트야?」 최근 7일 적중 0/1 (brand) · …
   | 행동: 시험고객 글은 이 저장소에서 쓰지 않습니다. Claude 세션에서 「시험고객 어떤 사이트야?」에 답하는 가이드 초안을 deliverables/e2e-test/guide/ 제안 에 씁니다. …
   | 상태: 세션 대기
  ✓ daily-agent 끝까지 ✓ 시험고객 하루 · 이름 질문 인용 없음 → 적중 0
── marketing-draft --dry --client e2e-test
   | 시험고객 바깥 글 2026-10-05 (월) — 채널 jisikin·cafe·blog · --dry
   | [지식iN] 「pdf 합치기 무료」 · 근거 /guide/pdf-merge/ · /pdf-merge/ · 근거 3221자 — Claude 안 부름(프롬프트가 문서딱 전용 — Step 38 전)
   | [카페] 쓸 질문이 없습니다(14일 안에 다 씀 또는 맞는 페이지 없음)
   | [블로그] 쓸 질문이 없습니다(14일 안에 다 씀 또는 맞는 페이지 없음)
   | Claude 호출 0회 · 관문 탈락 0 · 오류 0
  ✓ 검색어·페이지·근거 ✓ Claude 안 부름 ✓ 문서딱 사실(무료·가입 없음)을 안 붙임
  ✓ 고객사말에 「시험고객」·docttak.com
  ✓ ai-measure 대상에 없음
  ✓ 시험 고객 행 남은 것 0 (id 6)
16 통과 · 0 실패
```
(전문은 scratchpad e2e.txt. 위는 빈 줄·꼬리 안내 줄만 줄임.) 따로 조회: geo.clients = id 1·2·3 만 · client_id 6 의 ai_measurements·pilots·agent_tasks 0 · slug e2e-test 0.

3번 판단: daily-agent 는 승인 질문이 있어야 하루를 돈다 → 리허설 파일럿(값 0·취소일 오늘 — 배포된 ai-measure 가 그사이 돌아도 진행 중이 아니라 안 잰다) + 승인 질문 2(검색어 1·이름 1) + 이름 질문 측정 한 줄(인용 없음)을 넣었다. brandHit null 분기를 실제로 지나게 하려는 것. 모두 finally 에서 지웠다.

## Open Questions
- **Escalate — 바깥 글 프롬프트가 문서딱 전용.** marketing-draft 의 프롬프트·관문 문장(「문서딱 말고 다른 방법」「직접 만든 무료 도구」, 고정 사실 「모든 도구 무료·가입 없음·기기 안 처리」)이 문서딱 사실이다. 브리프대로 DB 고객을 돌리면 남의 사실을 지어 붙인다. 그래서 DB 고객은 검색어·페이지·근거까지만 고르고 Claude 직전에 멈춘다(사실 줄도 「안내 글 N편」만). 일반화는 Step 38 몫으로 KG-37-1. 이 선택이 맞는지 Arch 판단.
- `잠깐DB` 는 「새 연결 방식 만들지 말 것」에 걸리는가 — 연결 설정은 스크립트들이 쓰던 것과 같은 줄이고, DB 를 안 열던 스크립트(who-wins·indexnow·check-index 앞부분·bing-site·submit-gsc·growth-import)에 각자 Pool 을 복사해 넣는 대신 한 곳에 둔 것이다.
- 가드는 CLIENTS·selectClients 에 더해 CODE_CLIENTS 도 본다(measure-targets 의 answer_pattern 씨앗만 허용). 코드 3곳 전용 시드는 `코드덩어리(slug)` — 목록을 도는 길이 아니라 허용했다.
- company·daily-agent 전체 대상에서 status 'test' 를 뺐다(브리프 Failure mode 「시험 고객이 운영에 섞임」). 지금 배포된 옛 코드는 E2E 도는 몇 분 사이 시험 고객을 「loop 설정 없음」으로 건너뛰었을 것이다 — 남은 행 확인은 client_id 칸이 있는 표 전부로 했다.
- 회귀 기준은 13:19 에 뜬 「전」. marketing 은 Claude 를 안 부르려고 `--no-claude` 를 먼저 넣고 떴다(그 외 코드는 전 그대로).

## Out of Scope (logged in BUILD-LOG)
- KG-37-1 바깥 글 프롬프트 일반화(위 Escalate)
- KG-37-2 web/lib/agents.ts PIPES 가 id 고정(1·2·3) — DB 고객은 화면에 indexnow·marketing false 로 보인다(Step 38 화면)
- KG-37-3 local-agent·bing-submit-urls·submit-gsc 실행 확인 안 함(원장 로그인 브라우저를 연다 — 지시대로 안 돌림). 코드 3곳 경로는 같은 값(학원 먼저, indexClients 결과 같음 — 시험). 배포 뒤 12:40 local-agent 로그로 확인
- KG-37-4 E2E 가 geo.clients 시퀀스 6 을 썼다(다음 고객은 7부터)
- KG-37-5 submit-gsc 의 DB 고객 찾기가 status active·test 만(옛 D19 는 status 무관)
- KG-37-6 health 는 이제 DATABASE_URL 이 없으면 주소 확인 전에 멈춘다(전에는 주소 확인 뒤). Actions 는 늘 있다

## 2차 (Richard 보류 반영, 2026-10-05)
Status: DONE — 시험 99/99 외 기존 5개 그대로 통과, web tsc 0

### Must Fix
- academy/masks.mjs:109-121 — `DB고객말(q, 빼기)`: `select name, domain from geo.clients`(status 무관 — paused·ended 도), 실패하면 던짐(fail-closed).
- academy/scripts/sales.mjs:31,80-82 — 가릴말이 DB 가 열려 있으면 DB고객말 을 더한다(쉬는·끝난 고객 이름·도메인).
- academy/scripts/illustrate.mjs:25,415 — 같은 select 를 DB고객말 로 바꿈(같은 줄, 같은 동작).
- 시험(test-clients): paused·ended 행이 들어감 · SQL 에 status 조건 없음 · 한 글자 이름 뺌 · 빼기 id · 읽기 실패면 던짐 · sales·illustrate 가 이것을 씀.

### Should Fix
- ② academy/clients.mjs:429-430 · masks.mjs:96-99 — 고객설정이 `brandWords`(원문 말)를 같이 돌려주고, 고객사말은 있으면 그대로 넣고 brandRe 원문에서는 안 꺼낸다. 코드 3곳은 brandWords 가 없어 예전 길 그대로. 시험: 「C++코딩」「a.b(주)」 원문이 들어가고 「C코딩」·역슬래시 든 말은 없음 · 학원 「로봇앤코딩」은 그대로.
- ④ academy/measure-targets.mjs:100-101,109,140 — 측정대상(전체)·고객측정일 쿼리에 `coalesce(c.status,'') <> 'test'`. --client 로 이름을 주면(slug 길) 시험 고객도. 시험: 가짜 q 로 SQL 확인.
- ⑥ academy/scripts/test-clients.mjs 가드 — clients.mjs 를 가져오는 파일(정적·`import * as`·동적 `import()`)에 `CLIENTS`·`selectClients` 글자가 하나라도 있으면 실패. 가짜 글 네 꼴(as · `{…} = await import` · `import * as C … C.CLIENTS` · `(await import(…)).CLIENTS`)을 다 잡는지 + CODE_CLIENTS 는 measure-targets 만 + loadClients 만 쓰면 통과.
- ① Actions 가 부르는 rescan·growth-import·company·ai-measure 비교
  - growth-import `--dry`(DB 안 엶, 공개 저장소 GitHub 읽기만): 88305f7 의 clients.mjs·growth-import.mjs 로 잠깐 바꿔 「전」, 지금 코드로 「후」 → 차이 0
    ```
    문서딱: 저장소 리포트 1개 · DB (dry — 안 읽음) · 받을 주 2026-41
      2026-41 생성 2026-10-05 · 서치콘솔 7일 클릭 0 · 노출 36 · 순위 18.166666666666668 · Cloudflare 7일 요청 44596 · 페이지뷰 6651 · 5일 · 표 11/11/16
      열린 후보 이슈 없음(0건)
    문서딱: 정상 · 받은 주 2026-41 · 열린 후보 이슈 없음(0건)
    ```
  - rescan(dry 없음 — probe 스캔을 돌리고 DB 에 씀) · company(`--plan` 도 일감·활동을 씀) · ai-measure(dry 없음 — Claude 호출) — 실행 비교 안 함. 대신 시험으로: DB 가 코드 3곳 + 다른 고객을 줄 때 loadClients 앞 3곳이 옛 CLIENTS 의 모든 칸과 같은 값(같은 객체) · company conf(id)의 loop·publishes · ai-measure 탐침 loop.probes · rescan(고객고르기 인자 없음) 순서가 같다. **배포 뒤 로그로 확인**: serp.yml 07:41 의 rescan·growth-import, company.yml 매시, optimize.yml 의 ai-measure 가 3곳을 전과 같이 돌았는지.
  - 2차 뒤 빠른 묶음 다시: daily-agent·marketing(--no-claude)·pilot robotncoding·docttak·indexnow --list·health 줄 차이 0. pilot ilog(표본 86→100, 새 측정)·briefing(크롤러 989→990회)은 그사이 들어온 데이터.

### 시험·tsc (2차)
```
test-clients: 99 통과 · 0 실패
test-docttak: 32 · test-grow-loop: 37 · test-growth-import: 59 · test-ilog-loop: 33 · test-marketing: 38 — 모두 0 실패
illustrate --test 전부 맞음 · sales --leak-test 「지금 web/public/case/academy.html — 걸림 없음」 · sales --draft-test 통과
web tsc exit 0
```
E2E(--live)는 다시 안 돌렸다 — 바뀐 곳(가림 말·측정 대상 SQL)은 단위 시험이 덮고, 다시 돌리면 운영 시퀀스를 하나 더 쓴다.
