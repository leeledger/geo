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

---
# Review Request — Step 14a 2차 (Richard 1차 반영) + 랜딩 정정
Date: 2026-09-22
Ready for Review: YES
커밋 3853b31(14a 반영) · 494bbc4(랜딩 바닥값 정정, 호출자 지시) — 둘 다 push·배포·운영 확인

## Files Changed
- web/lib/agents.ts — dueSlots(8일·요일·유예) · judge 재작성(수리공 자기 활동·merged7·pcoff·막힘 n일 전) · said(실행 완료/실패, 실패 「로그 확인」) · plain 보강 · readAgents 에 geo.repairs 7일 합침 수, 응답 err 제거
- web/lib/todo-text.ts (새) — todoText(task): kind·payload 대응표, cut() 어절 경계, doingOf() 조치 중
- web/lib/ops.ts:79,335,345 — tasks 에 payload
- web/app/admin/ops/Todo.tsx — todoText 사용, details 행동, 조치 중 흐리게 맨 뒤, 머리 건수는 조치 중 뺀 수
- web/app/admin/ops/AgentStrip.tsx:16 — 「PC 꺼짐」 라벨(회색 고정, .lt 기본색)
- web/app/admin/ops/page.tsx — td-more-d·doing CSS
- web/app/page.tsx:167-182, 206-226, 345, 516-575 · web/app/Count.tsx · web/lib/place.ts (새) — 랜딩 바닥값 제거(BUILD-LOG 정정 항목에 전후 인용)

## 시험 (judge-test2.cjs, 가짜 시각·가짜 활동 — DB 안 씀)
- 감사 06:30 정상 · 07:35 정상 · 08:15 지연 「감사 06:35 예정이었는데 기록이 없습니다」
- 어제 감사 없음 → 오늘 05:00 지연 「감사 9/22 06:35 …」 · 월요일 초안 없음 → 화요일 지연 「주간 초안 작성 9/21 06:07 …」 · 월요일 했으면 목요일 정상
- 활동 0 → ops·measure·content·deliver·sales 모두 정상 아님
- 옮긴 줄 「검색 노출 측정 실행 완료」 · 수리공 합침 0 → 「쉬는 중 · 합친 수리 없음 (최근 7일)」, 마지막 한 일 「수리 실패 — 로그 확인」(옮긴 줄 건너뜀) · 스위치 꺼짐 → 꺼짐
- 막힘 「영업 주간 실패 — 로그 확인 · 3일 전」
- PC 19:10 한 번 빔 → pcoff 「원장 PC 작업 19:10 기록 없음 — PC 가 꺼져 있었을 수 있습니다」 · 두 번 → 지연
- 할 일 실제 DB 5건 (내부 이름·R번호·영점·외톨이 조사·빈 괄호·주소 검사 통과):
  - [human] 상담 결과 미입력 2건 | 등록했는지 안 했는지를 적어야 노출이 매출로 이어지는지 압니다. | 입력하기
  - [human] 이번 주 영업 전화 — 연락일 지난 후보 10곳 (통화문 3곳) | 통화문 초안입니다. | 영업판 열기
  - [listing] 등재 필요: 「잠실 초등 코딩학원」 | 순위닷의 우리 학원 태그: …(2026-09-22 확인). | 열기
  - [investigate] 빙이 우리 글 47쪽 중 5쪽만 읽었습니다 | 자동 수리안이 검토에서 떨어졌습니다 — Claude 세션에서 고칩니다 | 조사 내용 보기
  - [brand-defense] 아이로그 — 우리 이름으로 검색해도 안 나옵니다 | 구글 서치콘솔 색인 요청과 … 확인해야 합니다 | 했어요
- 운영(배포 뒤): 4조합 내부 이름 0 · 가로 스크롤 0 · 콘솔 오류 0 · 로그아웃 401. 직원 줄: 운영·감사관 지연 · 수리공 쉬는 중 · 측정 정상 · 콘텐츠 정상 · 삽화 쉬는 중 · 유통 정상 · 영업 정상
- 스크린샷: shots/robotncoding-1280-first.png 외 · shots/todo-open-{1280,390}.png

## Open Questions
- 「조치 중」은 근거 마지막 줄 단어(제출·등록·고침·합침…)로 판단한다. 319 는 조치가 어디에도 기록되지 않아 안 보인다(KG)
- 수리공 「검토 불합격」을 막힘에서 뺐다 — 검토 관문이 제 일을 한 것으로 봄
- repair.mjs 스위치 꺼짐 줄이 생기면 합침 0 보다 꺼짐이 먼저다

---
# Review Request — Step 14b
Date: 2026-09-23
Ready for Review: YES
커밋 fb324d0 · push·배포·운영 확인 완료

## Files Changed
- web/app/admin/admin.css (새) — 관리 화면 토큰·공통 클래스 한 벌, globals 누수 끊기(:where, 특이도 0)
- web/app/admin/layout.tsx (새) — admin.css import 만
- web/app/admin/AdminNav.tsx (새) — 현황·초안·문의·리드·영업판·파일럿, aria-current
- web/app/admin/inquiry/page.tsx — 결과 미입력(등록/안 함 = resolveInquiry) 맨 위 · 새 문의 폼(addInquiry, 필드 그대로) · 지난 기록 최근 10 카드 + 자세히 · 요약 한 줄(실제 달 이름) · 설명 문단 제거 · 날짜 기본값 KST
- web/app/admin/drafts/page.tsx — 검토할 초안 N편 맨 위 · 카드: 제목·사실 확인 문장·도해 썸네일·발행(publishDraft, 도해 없으면 막힘)/버리기(discardDraft+confirm) · AI 티·짜임새는 걸릴 때 「N곳 — 보기」 · 자세히: 본문·검사 통과 문구·도해 다시 그리기(requeueIllustrate)·원문 되돌리기(revertDraft)·직접 고치기(saveDraft)
- web/app/admin/page.tsx — 리드 카드(changeLeadStatus select), 새로 연락할 사람 맨 위, 지난 연락 자세히, 카드 안 자세히에 점수·등급·도메인·경로, 시각 KST
- web/app/admin/outreach/page.tsx — 오늘 할 일(위 3곳 카드 + 통화문 펼침) · 나머지 7곳 자세히 · updateOutreach 필드 그대로
- web/app/admin/pilots/page.tsx — 한 줄 압축 풀어 씀 · 진행 고객 맨 위 · 등록 폼(createPilot, 13필드 그대로) 자세히
- web/app/admin/pilots/[id]/page.tsx — 풀어 씀 · 오늘 해야 할 일(기한 오늘·지남, 안 끝난 것) 맨 위 · 전체 업무·질문 20·측정 원장(엔진 이름만, 방법 이름 뺌)·정합성·콘텐츠 각각 details
- web/app/admin/login/* — .adm 토큰으로, 버튼 adm-btn
- web/lib/pilots.ts:19 — `measured_on::text as day` (파일럿 상세 404 원인)

## 확인 (로컬 + 운영 같은 스크립트 shoot-b.cjs)
| 화면 | 맨 위 | 390 첫 화면 위치 | 내부 이름 | 가로 | 콘솔 |
|---|---|---|---|---|---|
| 문의 | 결과 미입력 2건 | 111px | 0 | 0 | 0 |
| 초안 | 검토할 초안 (없음) | 64px | 0 | 0 | 0 |
| 리드 | 새로 연락할 사람 (없음) | 64px | 0 | 0 | 0 |
| 영업판 | 오늘 할 일 — 위에서 3곳 | 134px | 0 | 0 | 0 |
| 파일럿 | 진행 고객 1곳 | 100px | 0 | 0 | 0 |
| 파일럿 상세 | 오늘 해야 할 일 7건 | 243px | 0 | 0 | 0 |
| 로그인 | (폼만, 이동 줄 없음) | — | 0 | 0 | 0 |
- 스크린샷: scratchpad b14/ (로컬) · b14-prod/ (운영) — {inquiry,drafts,leads,outreach,pilots,pilot,login}-{1280,390}-{first,full}.png
- `--bg:` grep: admin.css · ops/page.tsx 두 곳 — ops 는 14a 검토 중이라 안 옮김(BUILD-LOG)

## Open Questions
- 서버 액션 4파일 인증 누락(BUILD-LOG KG, Arch 에스컬레이트) — 14b 범위 밖이라 안 고침
- 초안 본문을 자세히로 접은 것 — 원장이 발행 전 읽으려면 한 번 누른다. 펼쳐 둘지
- ops 옮기기는 14a 통과 뒤 작은 단계로
