# Review Request — Step 41 (문서딱 지식iN: 실제 질문 먼저, 등록 직전까지 자동)
Date: 2026-10-10
Ready for Review: YES
Status: DONE_WITH_CONCERNS — 코드·시험 통과. 실제 kin-find 첫 실행 후보 0(아래), 운영 DB 표는 아직 없음(KG-41-1)

## 첫 실행 결과 (실측)
`node tools/kin-find.mjs --client docttak --dry --look` — 검색 9회 · 질문 7개 열어 봄 · 후보 0. 7개 모두 7일 지남(2013~2023 질문이 최신순 목록 위에 뜸 — 목록 날은 마지막 답 날). 캡차 없음 · 로그인 유지 · 오늘 검색 상한 10회 다 씀

## Files Changed
- web/lib/kin-core.mjs (새) — 목록·질문 원문 읽기, 날짜, 후보 거름, 하루 1건(답차례), open-kin 요청·정리, 창 결과 말. 순수 + q
- web/lib/kin-core.d.mts (새) — 타입
- web/lib/marketing-core.mjs:25-40 · academy/db/schema.sql:225-241 · web/db/schema.sql:254-270 — geo.kin_questions(url unique, note 칸 추가) · marketing_posts.kin_question_id
- tools/kin-find.mjs (새) — 프로필로 kin.naver.com 검색·질문 열기만. 3~6초 쉼, 검색 하루 10회(.kin-find-day.json), 후보 하루 3, 캡차 → 멈춤 + 사람 일감, 못 읽음 → 실패 활동. --look 이 fixture 를 찍음
- tools/kin-open.mjs (새) — 질문 페이지 열기 → 「답변」(입력칸 열기) → 본문 채움 + 클립보드. 등록 버튼 코드 없음. 원장이 닫거나 12분
- tools/kin-backlog.mjs (새, 안 돌림) — 카페 초안 버림 · 지식iN 초안은 실제 질문 붙여 다시 씀 또는 버림. 기본 찍기만, --apply
- tools/login-poll.mjs:58-63, 89-101 — open-kin 도 집어 kin-open 을 띄우고 결과를 일감에 남김
- tools/local-agent.mjs:239-261 — marketing.kin 고객: 그날 첫 차례 kin-find → 답차례 → marketing-draft --kin-question
- academy/scripts/marketing-draft.mjs:34-38, 138-146, 192-195, 354-367, 379-381, 459-470 — 매일채널(블로그만), --kin-question(질문 본문·「질문에 나온 상황에만」·질문 글은 지시 아님), 질문 근거·대조표, kin_question_id 저장·질문 상태
- academy/scripts/company.mjs:42, 579-582 — 30분 안 집힌 open-kin → 실패 「PC 가 안 켜져 있었습니다」
- academy/clients.mjs:224-225 — 문서딱 marketing.kin = true
- web/lib/marketing.ts:28-32, 51-66 · web/lib/marketing-actions.ts:43-59 · web/app/admin/ops/Marketing.tsx — 질문 제목·날짜·본문 200자·링크, 「이 질문에 답하기」, 「올렸어요」 주소 기본값 = 질문 주소, 답 창 상태 줄. 질문 없는 옛 초안은 버튼 없음
- .github/workflows/optimize.yml:90 — 주석만(기본 채널이 블로그만이라 Actions 에서 지식iN·카페가 빠짐)
- academy/scripts/test-kin.mjs (새, 64) · test-docttak.mjs:173-188 (+3) · fixtures/kin/ (원문 5개, 로그인 아이디 지움)

## 시험
test-kin 64 · test-docttak 35 · test-marketing 51 · 스냅샷 같음 · test-login 56 · test-clients 99 · test-client-core 186 · test-ops-words 532 · test-todo-words 14 — 실패 0. web tsc 0 · academy tsc 0

## Open Questions
- 하루 1건을 local-agent(답차례)에만 둔 것 — marketing-draft 를 손으로 부르면 상한 밖. 밀린 초안 정리 때문에 이렇게 했다
- 질문 글을 숫자 근거에 넣은 것(질문자 숫자 통과)이 맞는지
- 첫 실행 후보 0 — KG-41-3 (검색어 꼴·분야 목록) Arch 판단

## Out of Scope (logged in BUILD-LOG)
- KG-41-1 운영 DB DDL 이 웹 배포보다 먼저여야 함
- KG-41-2 PC 쪽 코드는 리뷰 전에도 작업 트리에서 돈다(내일 12:40)
- KG-41-3 후보 0 지속 가능성
- KG-41-4 open-kin 로컬 대기가 일감판 「밖에 밀림」에 잡힘
