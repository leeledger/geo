# Review Request — Step 31 (성과가 개수로 늘어나는 고리 D38~D43)
Date: 2026-09-30
Ready for Review: YES
Status: DONE_WITH_CONCERNS — 새 시험 34 통과(test-grow-loop) · test-ilog-loop 33 통과 · web tsc 0 · 학원 daily-agent --dry 변경 전과 diff 0. D38~D42 가 걸리는 경로는 운영 DB 에 오늘 조건이 없어 가짜 행 시험으로만 탔다(DB 쓰기 금지 · 임시 DB 읽기 스크립트는 권한 거부)

## Files Changed
- academy/scripts/loop-grow.mjs (새 파일) — 전파찾기·전파칸·사다리짓기(D38) · 경쟁우세(D42, pilot-report-core 점유 재사용) · 후보고르기(후퇴 맨 앞 → 단계 → 우세 → 적중률) · 불리던글(D39) · 확장줄 · 승격일감(D40, probe-promote-<id>, 사람 대기, 30일 쿨다운) · 확장넣기(「했어요」 → pilot_questions extend q101~, 탐침 끔, payload.extend 로 한 번만)
- academy/scripts/loop-review.mjs:13-16,58,107-119 — 머리말 · `곳` export · `변형후보()`(승인 keyword 질문에서 틀 말을 뺀 기능 말 × 틀)
- academy/scripts/loop-review.mjs:227-309 — regress(같은 곳·같은 엔진, 앞 14일 ≥50% · 최근 7일 ≤25% · 양쪽 5건, 표본 부족·엔진 바뀜은 「비교 못 함」) · promote(한 곳 7일 4번 이상 ≥50%, 곳 안 합침) · variant 가지(아이로그, 하루 한도 안, 승인 질문과 같은 글 제외)
- academy/scripts/loop-review.mjs:350-378 — 사슬을 칸 목록으로 · gaps(뿌리 다음 칸부터 처음 0 인 칸, 7일 4건 이상 전부 0 · 안 잰 칸에서 멈춤)
- academy/scripts/loop-review.mjs:401-405 — 반환에 regress·regressUnknown·promote·gaps · 무게 맨 앞 regress, 끝 variant
- academy/scripts/daily-agent.mjs:24-37 — 머리말 · import
- academy/scripts/daily-agent.mjs:289 — 자기 점검에 `변형: 설정.probeVariants`
- academy/scripts/daily-agent.mjs:305-312 — 저장: 전파로 올린 칸이면 근거에 「전파: 행 #id(원질문 kind 「효과 있음」)」
- academy/scripts/daily-agent.mjs:340-350 — 확장넣기 · 승격일감 · 탐침글일감(첫 gap 하나) — DRY 면 읽기만. 「오늘 이미 행동」과 무관하게 돈다
- academy/scripts/daily-agent.mjs:415-424 — 경쟁사(geo.pilots.competitors, 못 읽으면 0) · 후퇴 Map · 후보고르기
- academy/scripts/daily-agent.mjs:438-463 — 전파중 설정 · 진단에 후퇴/우세(있을 때만) · 후퇴 질문은 불리던 글(인용 주소 → 없으면 제목 겹침 0.4) 재색인 먼저 · 사다리짓기
- academy/scripts/session-task.mjs:66-99 — `탐침글일감()`: 14일 지난 탐침 글 일감 닫기 · 열린 세션 글 1편 · 같은 문장 일감 있으면 안 엶 · 재료(academy.materials 안 쓴 것) 없으면 제목·본문에 「재료 필요」
- academy/clients.mjs:47-48 — 학원 draftWhere(D41 세션 글 자리)
- academy/clients.mjs:105-110 — 아이로그 probes "variants" + probeVariants(틀 「{기능} 앱·프로그램·무료」, strip 추천|무료|앱|프로그램)
- academy/scripts/ai-measure.mjs:23,305-321 — 탐침 줄에 확장 질문 union(form 'extend' → ai_probe_measurements, 같은 날짜면 확장 먼저, 확장 없으면 순서 불변)
- academy/scripts/ai-measure.mjs:479-480 — 탐침 도는 자사 고객(loop.probes)도 탐침재기 — 고객마다 하루 2(기존 고객별 셈)
- academy/scripts/pm-report.mjs:25,205-227,362 — body.확장 「확장 질문 n개 중 k개 불림(최근 7일 · m개는 아직 덜 잼)」, 확장 질문 있는 고객만(없으면 body 모양 불변)
- web/lib/pm-report.ts:30-31 · web/app/admin/ops/PmReport.tsx:92 — 현황판에 그 한 줄
- web/lib/pilots.ts:14-16 · web/lib/pilot-actions.ts:64 — 파일럿 패널·「승인」 버튼에서 stage 'extend' 제외(승인 버튼이 확장 질문을 20문항에 섞지 않게)
- academy/scripts/test-grow-loop.mjs (새 파일) — D38~D43 각각 걸림·안 걸림·표본 부족·엔진(곳) 바뀜, 가짜 q 로 일감·확장 넣기·dry
- academy/scripts/test-ilog-loop.mjs:75 — 아이로그 probes 기대값 false → "variants"

## 확인
- `node academy/scripts/test-grow-loop.mjs` → 34 통과 · 0 실패 (변이 확인: 후퇴 문턱을 ≤50% 로 바꾸면 1 실패)
- `node academy/scripts/test-ilog-loop.mjs` → 33 통과 · 0 실패
- `web: node ./node_modules/typescript/bin/tsc --noEmit` → 0
- 학원 `daily-agent --client robotncoding --dry` 전후 diff 없음. 오늘 행동이 이미 있어 선택까지 안 가므로 조기 종료 줄만 `if (false)` 로 바꾼 임시 사본으로도 전후 비교 — diff 없음(q15 discover 사람 대기 그대로). 임시 사본은 지움
- 아이로그 dry: 변화는 variant finding + 탐침 2개(「학원 관리 앱」「학원 관리 프로그램」, q13 에서)뿐
- pm-report --dry: 학원 줄·아이로그 줄 그대로, 확장 줄 없음(확장 질문 0개)

## Open Questions
- **확장 질문 approved=false**(Bob 결정). 설계서는 「pilot_questions 에 stage 'extend'」까지만 정했다. approved=true 로 두면 approved 로 거르는 곳 7군데(ai-measure·ai-web-measure·daily-agent·pilot-report·pm-report·measure-targets approved_n·web 패널)를 전부 고쳐야 하고 하나라도 빠지면 영업 숫자에 섞인다. false 면 기본이 안전하고 측정만 탐침 줄로 넣으면 된다. 대신 web 승인 버튼·패널은 extend 를 빼도록 고쳤다 — Richard 는 이 방향이 맞는지와 빠진 소비처가 없는지 봐 주세요
- 확장 질문을 넣을 때 원래 탐침을 끈다(같은 문장 두 번 재지 않게). 끈 탐침은 넓힘 출발에서도 빠진다 — 이미 자식이 있으면 영향 없음
- 아이로그 탐침 측정 몫: 고객마다 하루 2(학원 몫 안 줄임). 「하루 탐침 몫 안에서」를 고객당으로 읽었다. 둘이 2 를 나눠 쓰라는 뜻이면 학원 몫이 1 로 줄어 학원 출력이 바뀐다
- D41 「열린 세션 글 1편」을 고객의 세션 대기 question-draft 전부로 셌다(D35 run 짝 일감 포함)

## Out of Scope (logged in BUILD-LOG)
- KG-31-1 /admin/asks 탐침 격자에 확장 질문이 안 보임
- KG-31-2 화면 측정(ai-web-measure)은 확장 질문·아이로그 변형을 안 잼
- KG-31-3 승인 질문 후보 일감에 「안 넣음」 버튼 없음
- KG-31-4 D41 은 사슬 있는 학원만 · 아이로그는 열린 세션 글 6건에 막힘
- KG-31-5 D38~D42 조건 운영 DB 확인 못 함
