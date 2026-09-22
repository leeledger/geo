# Review Request — Step 14a
Date: 2026-09-22
Ready for Review: YES
커밋 b4b397f · 이미 push·배포됨(호출자 지시 「통과하면 push」 — 로컬 검사 통과 후 올림). 운영 /admin/ops 확인 완료(아래).

## Files Changed
- web/lib/agents.ts (새) — ROLES(역할 7·일별 시각표·countMirror) · plain() · engineName() · judge(role, input, now) 순수 판정 · readAgents() 쿼리 4개(활동 10일+일감 kind join · 안 끝난 일감 · repair_paused · claude_calls 오늘)
- web/app/api/admin/agents/route.ts (새) — isAdmin() 쿠키 검사, 401 / JSON no-store
- web/app/admin/ops/AgentStrip.tsx (새, client) — 45초 폴링 · document.hidden 이면 쉬고 보이면 즉시 · 실패 시 마지막 값 유지 + 「연결 끊김 · n분 전 값」 · 바뀐 줄 flash 1.8초 · 「n분 전」 1분마다 · 상태등 CSS · reduced-motion
- web/app/admin/ops/Todo.tsx (새) — 사람 대기 일감 + 상담 결과 미입력 파생 · 행동은 기존 finishTask/resolveNaverAttempt/링크 · 최대 5 · 0건 「없음」 · 못 읽으면 「못 읽었습니다」
- web/app/admin/ops/Growth.tsx — 카드 4장(AI 답변·답변 색인·글·문의) + 차트 하나 + GrowthMore(숫자 읽는 법·그 밖의 숫자·표 2개). 비교는 growth.ts Delta 그대로
- web/app/admin/ops/page.tsx — ①→⑤ 순서, SLOTS·HUMAN·옛 KPI·covLow·firstSeen 표 삭제, 크롤러 표 사람 이름, globals.css 누수 끊기
- web/app/admin/ops/AgentBoard.tsx — 할 일 목록·요약 카운트 제거, caveat·활동 문구 plain
- web/app/admin/ops/agent-board.css — 안 쓰는 staff-summary/todo/count/refresh/naver/done·ops-disclosure 규칙 삭제
- web/app/admin/ops/CoverageChart.tsx — aria-label 문구만
- web/lib/ops.ts — firstSeen · daysMeasured · withImages 제거(grep 소비처 0)
- academy/scripts/repair.mjs:628-633, 685-689 — 스위치 꺼짐 분기에 활동 한 줄
- 삭제: Live.tsx · Flow.tsx

## 검사 결과 (로컬 next dev + 운영 DB, 그리고 운영 주소에서 같은 스크립트 재실행 — 결과 동일)
| | robotncoding 1280 | robotncoding 390 | ilog 1280 | ilog 390 |
|---|---|---|---|---|
| 내부 이름(자세히 닫힘) claude-code·openrouter·api-·geo.·vendor·microsoft·anthropic·%·.yml | 0건 | 0건 | 0건 | 0건 |
| 「검색에 처음 나온 날」(자세히 열림 포함) | 없음 | 없음 | 없음 | 없음 |
| 가로 스크롤 닫힘/열림 | 0/0 | 0/0 | 0/0 | 0/0 |
| 콘솔 오류 | 0 | 0 | 0 | 0 |
| 첫 화면 (화면 높이 800/844) | ① 끝 388 · ② 끝 767 | ① 끝 655 | ① 221 · ② 600 | ① 300 |
| 직원 줄 보이는 줄 수 | 1 | 3 | 1 | 3 |
| 카드 보이는 줄 수 | 3,2,2,3 | 3,2,2,3 | 1,2,3,2 | 1,3,3,2 |
| 가장 작은 글자(①②③) | 14px | 14px | 14px | 14px |
- 코드에 「검색에 처음 나온 날」·firstSeen grep 0
- tsc: `node ./node_modules/typescript/bin/tsc --noEmit` 0
- 로그아웃 /api/admin/agents: 로컬 401 · 운영 401
- 45초 폴링(page.route 로 응답만 바꿔 끼움, DB 안 건드림): 요청 14:27:39Z · 14:28:24Z (45초 간격) → 측정 줄 46초·91초에 flash, 1.8초 뒤 빠짐. 500 을 끼우면 「연결 끊김 · 방금 값」, 7줄 유지. 이때 콘솔 오류는 그 500 한 건뿐
- reduced-motion 에뮬레이션: .lt · .ring · .ag-row 의 animation-name 전부 none
- 지연 판정 judge()(운영·감사관, 감사 06:35): 06:30 → 정상 · 07:35(+60) → 정상 · 08:15(+100) → 지연 「감사 06:35 예정이었는데 기록이 없습니다」. 수리공 「스위치 꺼짐」 활동 → 꺼짐 「스위치 꺼짐 — 켜는 건 원장님」. 삽화 활동·일감 없음 → 쉬는 중

## plain() 전후 (실제 DB 문구)
1. 「조사 · 영점 — 크롤러: microsoft 크롤러 커버리지 10.6% (5/47) · 처음 온 지 14.6일」 → 「조사 · 영점 — 크롤러: 빙 크롤러 커버리지 (5/47) · 처음 온 지 14.6일」
2. 「자동 수리안(가지 auto/fix-319)이 검토에서 떨어졌습니다: scout.mjs의 major 비교군에 microsoft를 넣을 때 R5(audit.mjs)와 동등」 → 「자동 수리안(가지)이 검토에서 떨어졌습니다: 의 major 비교군에 빙을 넣을 때 R5와 동등」
3. 「case-report 실패 /home/runner/work/geo/geo/academy/node_modules/pg-pool/index.js:45 Error.captureStackTrace(err)」 → 「case-report 실패 Error.captureStackTrace(err)」
4. 「자동 작업 실패: optimize.yml」 → 「자동 작업 실패: AI 답변 측정·판정」
5. 「로봇&코딩학원 — openai 커버리지 32.6% (최고 100%)」 → 「로봇&코딩학원 — ChatGPT 커버리지」
(합성 예: 「…커밋 f5b40e8 · claude-code-web 인용 0 · api-openrouter-gemini 측정 https://… --dry-run geo.agent_tasks」 → 「…커밋 · Claude 인용 0 · AI 측정」)

## 산출물 (scratchpad = C:\Users\force\AppData\Local\Temp\claude\C--dev-AGO-GEO\b2c2577b-fff2-4142-b28e-645690daf80e\scratchpad)
- shots/{robotncoding,ilog}-{1280,390}-{first,closed,open}.png (로컬) · prod/ 같은 이름(운영)
- shots/flash-1280.png · lost-1280.png · reduced-motion-1280.png · anim-frame-0..5.png
- video/page@ea4545feda3b4338eeb1d307ad012fa9.webm (상태를 골고루 바꿔 끼운 응답: 일하는 중·꺼짐·막힘·정상·쉬는 중·지연 + flash)

## Open Questions
- 「카드·행 3줄 이내(390)」: 블록(머리문장/비교/선택)은 늘 3개 이하. 보이는 줄로 세면 직원 줄은 390 에서 3줄(브리프 본문은 2줄이라 했음 — 상태·이름·시각 / 한 일 / 다음·오늘 건수가 358px 에 한 줄로 안 들어감). 카드 머리문장이 21px 라 2줄로 접히는 카드는 보이는 줄 3
- 직원 줄을 고객사로 거르지 않는 결정(BUILD-LOG) — 맞는지
- countMirror 를 일 단위로 둔 것 — write·snapshot 은 옮긴 줄을 센다
- 원장 PC 12:40·19:10 을 지연 판정에 넣음 — PC 꺼짐이 빨간 「지연」으로 뜬다. 원하면 빼기 쉽다
- 수리공 「꺼짐」은 다음 06:50 실행 전엔 안 보인다
- 운영·감사관 줄이 지금 실제로 「지연」: 회사 루프 활동이 19:36 뒤로 없다(BUILD-LOG KG)
- Vercel CLAUDE_DAILY_MAX 는 안 넣음 → 상한 표시 안 됨

## Out of Scope (logged in BUILD-LOG)
- 일감 문구 원천의 내부 이름 · 회사 루프 무소식 · 랜딩 page.tsx 의 8·460 대체값 · 14b 전부
