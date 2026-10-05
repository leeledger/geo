# Review Feedback — Step 36
Date: 2026-10-05
Ready for Builder: NO

## Must Fix
- .github/workflows/serp.yml:24,54-62 (confidence: 7/10) — 잡 전체가 `timeout-minutes: 8` 인데 최근 serp 실행이 5분 37초~6분 8초다(gh run list 10/2~10/5). 새 단계에는 단계 시간 한도가 없고, growth-import.mjs:30 의 `fetch(url, { headers: ... })` 에는 AbortSignal 이 없다(undici 기본값은 헤더·본문 각각 300초). GitHub 응답이 느리면 잡이 8분에서 취소된다. 잡 시간 초과에는 `continue-on-error` 가 듣지 않는다. 그러면 「바뀐 게 있으면 커밋」이 안 돌고 학원 케이스 리포트 커밋이 날아간다. 브리프가 「실패해도 기존 단계는 산다」고 했는데 시간 초과 길에서는 이게 깨진다. — 고칠 것: 새 단계에 `timeout-minutes: 2` 를 단다. 받기() 의 fetch 에 `signal: AbortSignal.timeout(20000)` 을 준다. 잡 한도를 10분으로 올릴지 정한다(지금 여유가 2분뿐이다).

## Should Fix
- web/app/admin/ops/GrowthReport.tsx:141 · academy/scripts/growth-import.mjs:108 (confidence: 8/10) — `o.updatedAt.slice(0, 10)`. GitHub 의 updated_at 은 UTC ISO 문자열이다. KST 00:00~08:59 에 갱신된 이슈는 하루 전 날짜로 찍힌다. 정기 실행(월 09:23 KST = 00:23 UTC)에서는 날짜가 우연히 맞는다. 수동 재실행이면 틀린다. CLAUDE.md 함정 「DB 시각은 UTC」와 같은 종류다. — `new Date(o.updatedAt).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })` 로 바꾼다.
- web/lib/growth-core.mjs:102-103 (confidence: 6/10, 확인할 것) — gsc·cf JSON 은 `week` 말고는 모양을 안 본다. growth-import 의 say 줄이 `last7` 은 우연히 걸러 준다. 그런데 `gsc.range7`·`cf.until`·`cf.last7.uniques` 가 빠진 리포트는 DB 에 그대로 들어간다. 그러면 GrowthReport.tsx:112·119 의 `md(undefined)` → `.slice` TypeError 로 문서딱 /admin/ops 페이지가 통째로 깨지고, pilot-report 는 `NaN` 을 찍는다. — parseGrowthReport 에서 gsc 는 range7.startDate/endDate·last7 네 숫자, cf 는 until·last7 네 숫자를 확인한다. 하나라도 없으면 그 칸만 null 로 두고 notes 에 「모양 다름」을 남긴다. 시험 2개를 더한다.
- academy/scripts/growth-import.mjs:30,72 (confidence: 6/10) — `f.url`(목록 API 의 download_url)에 Authorization 헤더를 실어 보낸다. 호스트는 확인하지 않는다. 지금은 GitHub 이 주는 값이라 위험이 작다. 그래도 토큰은 확인한 호스트에만 보내는 게 맞다. — `new URL(f.url).host === "raw.githubusercontent.com"` 이 아니면 그 주를 실패로 넘긴다.
- tools/local-agent.mjs:300-301 (confidence: 6/10) — `bing-site-<slug>` 일감을 닫는 update 가 `빙.ok` 와 상관없이 돈다. 미등록 문구가 아닌 실패(버튼 못 찾음, exit 1)에서도 닫힌다. 지금은 빙미등록 문구를 아무도 안 찍어서 해가 없다. KG-36-8 로 정규식을 넣는 날 바로 헛닫힘이 된다. — `if (빙.ok)` 일 때만 닫는다. KG-36-8 에 같이 적는다.
- tools/local-agent.mjs:267,276 (confidence: 5/10, 확인할 것) — gsc-submit 일감을 이제 gsc:true 고객 것만 본다. company.mjs:830 의 announce 는 글을 내는 고객이면 누구에게나 gsc-submit 을 만든다. 그래서 아이로그 같은 gsc:false 고객의 「로컬 대기」 일감이 생기면 영영 안 닫힌다. 지금 열린 아이로그 gsc-submit 행이 있는지 한 번 본다. 있으면 Known Gaps 에 적는다.

## Escalate to Architect
- 빙 「등록 안 됨」 판정(브리프 A-2·Acceptance 의 --look 원문)이 빠졌다. 원장 로그인 브라우저를 여는 일을 분류기가 거부했다. Bob 은 추측 정규식을 안 썼고 KG-36-8 로 남겼다. 맞는 처리다. 지금 문서딱이 빙에 없으면 매일 「빙 주소 제출」 실패 줄로 보이고, 원장 일감은 안 생긴다. 브리프 Acceptance 「원장 할 일 새 줄: 빙 미등록일 때 1줄」은 아직 못 지켰다. 이대로 배포할지, --look 을 먼저 받을지 Arch 가 정한다.
- Open Question 「옛 이슈가 남아 있으면 옛 주 표시가 계속 보인다」·「표 한 행이라도 못 읽으면 표 전체 null」 — 둘 다 사실대로 보이는 쪽이라 코드상 문제는 없다. 제품 판단으로 확인만 바란다.

## Cleared
아래는 확인했고 통과다. clients.mjs 색인 고객 고르기(학원 먼저), 인자 없는 bing-submit-urls·submit-gsc 가 학원으로 도는 것, local-agent 고객별 활동 줄·로그인 막힘에서 멈춤, pc-runner 순차 실행(busy)과 90분 한도, growth-core 파서와 weeksToFetch, growth-import 의 매개변수 SQL·dry 모드, 양쪽 schema·company DDL, 현황판 카드(문서딱 탭에만, 「방문자」 단독 표현 없음, 꼬리 두 줄, 없는 주를 0 으로 안 채움, 멈춤 판정 KST), pilot-report 절(행 있을 때만), Visits·briefing 문구. test-growth-import 50·test-docttak 32 는 다시 돌려서 통과를 확인했다.

---

# Review Feedback — Step 36 2차 (6989c9e)
Date: 2026-10-05
Ready for Builder: YES

## Must Fix
없음.

## 1차 항목 확인
- MF serp 시간 한도 — 닫힘. 잡 10분(세션 결정), 단계 `timeout-minutes: 2`, 받기()는 fetch 마다 `AbortSignal.timeout(20_000)`. 단계 한도에 걸려도 continue-on-error 가 커밋 단계를 살린다.
- SF1 KST 날짜 — 닫힘. `kstDay()` 가 sv-SE·Asia/Seoul 을 쓰고, 못 읽으면 null 이다(빈 값·undefined 도 null). 카드와 growth-import 요약 둘 다 바꿨다.
- SF2 JSON 모양 — 닫힘. gscShape·cfShape 가 화면·pilot-report 가 읽는 칸을 다 본다. 하나라도 빠지면 그 덩어리만 null 이 되고, notes·실패 줄에 「모양 다름」이 남는다. 카드의 null 길은 이미 「리포트에 없음」이라 페이지가 깨지지 않는다.
- SF3 토큰 호스트 — 닫힘. api.github.com·raw.githubusercontent.com 에만 싣는다.
- SF4 빙 일감 헛닫힘 — 닫힘. `빙.ok` 일 때만 닫는다.
- SF5 gsc 없는 고객 일감 — 닫힘. 「닫힘」은 audit·company 가 이미 쓰는 상태 값이다. evidence 칸은 `not null default ''` 라 `||` 가 null 로 지워지지 않는다.

## Should Fix
없음.

## 덧붙임 (확신도 4, 막지 않음)
- tools/local-agent.mjs:268 — company.mjs 의 일감() upsert 는 「닫힘」 행을 다시 연다(`when geo.agent_tasks.status = '닫힘' then $9`). gsc-submit 은 announce 에서 글당 한 번 만들어지니 지금은 열고 닫기를 반복하지 않는다. announce 가 같은 글에 다시 돌게 되면 매일 「해당 없음」 활동 줄이 생긴다. 그런 일이 보이면 그때 Known Gaps 에 적는다.

## Escalate to Architect
- KG-36-8(빙 미등록 판정) — 세션이 미루고 배포하기로 정했다. 더 볼 것 없다.

## Cleared
2차 diff 전체(serp.yml, growth-import, growth-core + .d.mts, GrowthReport.tsx, local-agent)를 봤다. 1차 Must Fix 1건과 Should Fix 5건이 닫혔고 새로 깨진 곳은 없다. test-growth-import 59개를 다시 돌려 통과를 확인했다.
