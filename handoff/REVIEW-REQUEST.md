# Review Request — Step 36
Date: 2026-10-05
Ready for Review: YES
Status: DONE_WITH_CONCERNS — 빙 「등록 안 됨」 판정만 BLOCKED(아래)

## Files Changed
- academy/clients.mjs:37-38 — 학원 `gsc: true`.
- academy/clients.mjs:156-165 — 문서딱 siteLog 문구(「연결 전」 지움)·`gsc: true`·`growthReports`.
- academy/clients.mjs:259-261 — `indexClients()` gsc:true 만, 학원 먼저(local-agent 고르기, 시험 대상).
- tools/bing-site.mjs (새) — `빙미등록` 글자(bing-submit-urls·local-agent 공용), `bingClient(argv)` 인자 없으면 학원.
- tools/bing-submit-urls.mjs:11,17-20,33 — `--client <slug>`, SITE = 고객 도메인. 인자 없으면 robotncoding.com 그대로.
- tools/local-agent.mjs:23-24,264-305 — 구글 색인·빙 제출을 `indexClients()` 차례로. submit-gsc 고객당 20분, 활동 줄 clientId = 그 고객, gsc-submit 일감 닫기를 고객별로. 구글·빙 로그인 막힘이면 한 번 알리고 멈춤(로그인을 고객이 같이 씀). 빙 미등록이면 사람 대기 `bing-site-<slug>`, 다음 실행에 등록돼 있으면 닫음.
- tools/pc-runner.mjs:35-37 — local-agent limitMin 60 → 90.
- web/lib/growth-core.mjs + .d.mts (새) — GROWTH_DDL, parseGrowthReport, parseOpportunityIssue, weeksToFetch, weekOfName, weekMonday, reportStalled, GROWTH_FOOT, GROWTH_SLUGS.
- academy/db/schema.sql:221-238 · web/db/schema.sql:251-268 — geo.growth_reports + RLS(GROWTH_DDL 과 같은 줄).
- academy/scripts/company.mjs:37,201-202 — 시작 준비에서 GROWTH_DDL(실패해도 계속).
- academy/scripts/growth-import.mjs (새) — 목록 → 없는 주만 원문 → upsert, 후보 이슈 → opportunity 갱신, agent_activity 한 줄. `--dry` 는 DB 안 엶.
- .github/workflows/serp.yml:54-62 — 케이스 리포트 뒤·커밋 앞에 growth-import 단계(continue-on-error, GITHUB_TOKEN = 기본 토큰).
- web/lib/growth-reports.ts (새) — readGrowthReports(clientId): 최근 12주, 멈춤 판정, 최신 opportunity. 표 없음(42P01)이면 빈 결과.
- web/app/admin/ops/GrowthReport.tsx (새) — 카드. 주별 표·그래프(서치콘솔 주 2개 이상)·쿼리 28일 상위 10·페이지 28일 상위 5·제안 줄·꼬리 두 줄·「첫 리포트 전」·빨간 「리포트 멈춤」.
- web/app/admin/ops/page.tsx:10-11,22,150,171-172,209 — 읽기 추가, GROWTH_SLUGS 탭이나 행이 있는 탭에만 카드(Visits 바로 아래).
- web/app/admin/ops/Visits.tsx:25,28 — 문서딱 문구만(「연결 전」 → 아래 카드 안내). 학원·아이로그 문구 그대로.
- academy/scripts/briefing.mjs:206 — 「크롤러 기록  장치 없음(일부러) · {siteLog}」.
- academy/scripts/pilot-report.mjs:23,325-349 — 그 고객 행이 있을 때만 「구글 검색·서버 통계 ({이름} 성장 리포트)」 절. 기간 안 = 생성일이 파일럿 범위 안.
- academy/scripts/test-growth-import.mjs (새) + fixtures/growth-2026-41.md (실 리포트 원문) — 50개.
- academy/scripts/test-docttak.mjs:84 — siteLog 기대값을 새 문구로.

## 돌리는 자리 — serp.yml 인 이유
snapshot.yml 은 DB 를 안 연다(pg 설치도 DATABASE_URL 도 없음). DB 를 이미 열고 매일 한 번 돌며 Claude 를 안 부르는 곳은 serp(07:41)·scout(06:37)다. serp 는 측정 일이고 `.env.local` 을 이미 만든다. 커밋 단계 앞에 둬야 그 단계가 `.env.local` 을 지우기 전에 돈다. 실패해도 케이스 리포트 커밋은 간다.

## pc-runner 90분 근거
- 차례로 도는지 코드로 확인함: `tick()` 이 `busy` 로 막고 JOBS 를 `await 돌리기(job)` 로 하나씩 돈다. ai-web-measure(10:00, 180분)가 12:40 을 넘기면 local-agent 는 기다렸다가 따라잡는다(`차례()` = 오늘 지난 시각 뒤 미실행). 같은 `.browser-profile` 을 동시에 안 연다.
- 평소 local-agent 는 71~500초(pc-runner.log 9/29~10/2). 색인 고객이 둘이 되며 구글 20분·빙 10분 상한이 고객마다 붙어 그것만 60분이다. 60분 한도면 둘 다 막힌 날 네이버 이관·블로그·Brave 몫이 없다. 모든 상한의 합(약 135분)보다 작다 — 그런 날은 pc-runner 가 끊고 다음 실행이 이어 간다(gsc-done·bing-done 에 쌓여서 중복 없음).

## 실제 실행 결과
`node scripts/growth-import.mjs --client docttak --dry`
```
문서딱: 저장소 리포트 1개 · DB (dry — 안 읽음) · 받을 주 2026-41
  2026-41 생성 2026-10-05 · 서치콘솔 7일 클릭 0 · 노출 36 · 순위 18.166666666666668 · Cloudflare 7일 요청 44596 · 페이지뷰 6651 · 5일 · 표 11/11/16
  열린 후보 이슈 없음(0건)
문서딱: 정상 · 받은 주 2026-41 · 열린 후보 이슈 없음(0건)
```
운영 DB 실행(오케스트레이터 지시) → geo.growth_reports 생성, 행 (3, 2026-41): gsc.last7 {clicks 0, impressions 36, ctr 0, position 18.1667}, cf.last7.pageViews 6651·days 5, 표 11/11/16, opportunity {none:true,count:0}, source_url raw 주소. agent_activity measure 「문서딱 성장 리포트」 ok 「받은 주 2026-41 · 열린 후보 이슈 없음(0건)」. 두 번째 실행 「받을 주 없음」 exit 0.
행 수: 학원 0 · 아이로그 0 · 문서딱 1 → 학원·아이로그 탭에는 카드가 안 뜬다(GROWTH_SLUGS 에도 없음).

## 시험·tsc
```
test-growth-import 50 통과 · 0 실패
test-marketing     38 통과 · 0 실패
test-docttak       32 통과 · 0 실패
test-ilog-loop     33 통과 · 0 실패
test-grow-loop     37 통과 · 0 실패
web: node ./node_modules/typescript/bin/tsc --noEmit -p .  → exit 0
node --check local-agent.mjs · bing-submit-urls.mjs · pc-runner.mjs → 통과
```
pilot-report dry 비교(HEAD 판 vs 새 판): ilog baseline 같음 · robotncoding baseline 같음 · docttak final 같음 · docttak baseline 은 새 절 11줄만 늘어남(행이 생겼으므로). 행 없을 때 diff 0.

## BLOCKED — 빙 「등록 안 됨」
`node tools/bing-submit-urls.mjs --look --client docttak` 를 자동 모드 분류기가 거부했다(원장 로그인 브라우저를 여는 일). 화면 원문이 없어 정규식을 쓰지 않았다(브리프: 추측 금지). 그래서:
- bing-submit-urls 는 아직 `빙 웹마스터에 등록 안 됨` 을 안 찍는다. 문서딱이 빙에 없으면 지금은 「Submit URLs」 버튼 못 찾음 → exit 1 → 활동 줄 「빙 주소 제출」 실패(문서딱 client_id)로 보인다. 조용하진 않다.
- local-agent 쪽 사람 대기 일감은 지어 뒀다. 글자는 tools/bing-site.mjs 한 군데.
- 남은 일(KG-36-8): 세션이 `--look --client docttak`(그리고 학원 `--look`)을 돌려 60줄 원문을 받고, 그 원문으로만 정규식 + 「맞음 / 학원 화면 안 맞음」 시험 두 개를 넣는다.

## Open Questions
- 후보 이슈를 「제목의 주 행」에 붙이고, 이슈가 없으면 최신 주에 {none:true}. 카드는 opportunity 가 있는 가장 최근 행을 본다 — 이슈가 남아 있는데 새 주에 후보가 0이면 옛 이슈(옛 주 표시)가 계속 보인다. 그쪽이 이슈를 안 닫는 한 이게 사실이라 그대로 뒀다.
- 「0건(노출 기준 미달)」은 열린 이슈가 없을 때 뜬다. 서치콘솔 비밀값이 빠진 주도 이슈가 안 생겨 같은 말이 뜬다 — 그 주는 카드 위 「리포트 메모」와 「리포트에 없음」 칸이 같이 보인다.
- 표 행 하나라도 못 읽으면 그 표를 통째로 null 로 했다(브리프는 머리줄만 말함).
- web 이 clients.mjs 를 안 읽어 GROWTH_SLUGS 를 따로 뒀다. 시험이 growthReports 슬러그와 같은지 본다.

## Out of Scope (logged in BUILD-LOG)
- KG-36-8 빙 미등록 정규식·시험(위)
- KG-36-9 pc-runner 일꾼이 안 떠 있고, local-agent 를 다른 무언가가 12:40 에 띄움(pc-runner 실행은 10/3 부터 「이미 돌고 있습니다」로 0초)
- KG-36-10 test-visit.mjs ERR_UNKNOWN_FILE_EXTENSION(.ts import, 전부터)
- KG-36-11 「Cloudflare 토큰(D46)」 원장 할 일은 코드·열린 agent_tasks 에 없다 — 문서에 있으면 Arch 가 지운다
