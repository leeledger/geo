# Review Request — Step 42 (자동 코드 수리: 혼자 시작·멈춤·재개, 합치기는 원장 버튼) + D80
Date: 2026-10-10
Ready for Review: YES
Status: DONE_WITH_CONCERNS — 코드·시험·tsc 통과. repair.mjs DB 경로(자동재개·만료·연속확인·merge_result)는 운영 DB 에 읽기 전용으로만 돌렸다. 실제 06:50 실행·버튼 dispatch 는 배포 뒤 실측(브리프 GAP)

## D80 (세션 수정 — 브리프 위에 얹음)
원장 「합치기는 늘 승인」. 무인 합치기는 `REPAIR_ENABLED=1` **그리고** `REPAIR_UNATTENDED=1` 일 때만. 빈 값이면 절대 없음.
- `web/lib/repair-core.mjs` `무인합치기(env, 견습끝, needs_owner)` = ENABLED==="1" && UNATTENDED==="1" && 견습끝 && !needs_owner
- repair.mjs 수리(): `const 무인 = ENABLED && UNATTENDED ? await 무인허용() : { ok: false, n: 0 }` → `if (!무인합치기(process.env, 무인.ok, 안.needs_owner))` 승인 대기. 옛 조건 `!무인.ok || needs_owner` 보다 엄격하기만 함(UNATTENDED 항이 더해짐). 무인허용() 본문은 한 줄도 안 바뀜
- 시험: test-repair-core 「REPAIR_ENABLED=1 · UNATTENDED 빈 값 · 승인 5건(견습 끝) → 무인 합치기 안 됨」 ✓ (빈 문자열·키 없음 둘 다)
- repair.yml env 에 `REPAIR_UNATTENDED: ${{ vars.REPAIR_UNATTENDED }}` 한 줄(실행 로직 무변). 변수·토큰은 만들지 않음

## Files Changed
- web/lib/repair-core.mjs (새) — 브리프 42a 순수 판정 전부 + 무인합치기(D80) + 수리입력(q)(세 화면이 같은 SQL). d.mts 동반
- academy/scripts/repair.mjs:20-22 — 머리 주석(비상 스위치·D80·스스로 멈춤/재개)
- academy/scripts/repair.mjs:31,49 — repair-core import · UNATTENDED
- academy/scripts/repair.mjs:117-124 — ensure 뒤 repair_switch 기록 · 설정() · 멈춤상태()
- academy/scripts/repair.mjs:147-189 — 멈추기(kind, 이유, extra)(멈춤합치기로 무거운 쪽 유지) · 자동재개() · 연속확인()
- academy/scripts/repair.mjs:414, 423-427 — 되돌리기 실패 → revert-failed · 7일 2번 → revert-twice(last_revert_at = 그 행의 DB updated_at)
- academy/scripts/repair.mjs:486-501 — 지난수리확인() 맨 앞 7일 만료(거절 루프보다 먼저)
- academy/scripts/repair.mjs:329, 577, 606 — 수리지침 「사람말」 · 만들기 반환에 사람말
- academy/scripts/repair.mjs:614-676 — 합치기() 반환 `{ ok, why }` (return false/true 자리만)
- academy/scripts/repair.mjs:692-708 — 승인일감 제목 「수리안 n — 사람말」·payload·거절 안내 → 버리기 버튼
- academy/scripts/repair.mjs:703-711 — 수리(): 자동재개() 맨 앞 · `!ENABLED && !손으로` 블록 삭제 · 승인 대기 >= 3 끝
- academy/scripts/repair.mjs:740-767 — 행.checks 에 사람말·touches_numbers·숫자파일 · 검토 불합격 뒤 연속확인 · D80 무인 문
- academy/scripts/repair.mjs:778-831 — 합치기결과() + 승인합치기의 모든 못 합침 길에 merge_result · 「비상 스위치 꺼짐」 활동
- academy/scripts/repair.mjs:930, 955 — 시작 줄에 UNATTENDED · merge 모드 예외도 merge_result
- .github/workflows/repair.yml — 머리 주석 · REPAIR_UNATTENDED env
- web/lib/agents.ts:3, 312, 336-338, 408, 509-510, 548 — JudgeInput.paused → repair(RepairInput) · paused 면 off+수리상태 문구 · 정상이면 reason 에 문구 · 「스위치 꺼짐」 판정 삭제 · 로더가 수리입력()
- web/lib/client-status.ts:3, 25, 45-46, 62 + client-status-core.mjs:41,75 + d.mts — repairOff → repairText(수리상태)
- academy/scripts/pm-report.mjs:14, 26, 128-129, 151-152, 172 — 꺼진날 쿼리·「켜 줘」 문장 삭제 → 수리상태. paused/waiting 만 확인 필요 줄
- web/lib/todo-text.ts:30-46, 128, 152-174 — TodoAction "repair" · TodoText.numbers · TodoContext(repairSwitch) · repair-approval 문장
- web/app/admin/ops/Todo.tsx:6, 19-44, 97-98, 164 — [바뀐 곳 보기][합치기][버리기] · 스위치 0 이면 합치기 disabled · 합치는 중/합치지 못함 · 숫자에 닿음
- web/app/admin/ops/page.tsx — .td-repair/.td-note/.td-num CSS 4줄
- web/lib/ops.ts:83-84, 234, 356-362 — company.repairSwitch(geo.settings repair_switch)
- web/lib/task-actions.ts:71-140 — approveRepair(dispatch, GH_DISPATCH_TOKEN, 30분 무시, merge_result/merge_requested_at) · discardRepair(닫힘 + 「원장이 버림」)
- web/.env.example — GH_DISPATCH_TOKEN 줄과 범위 주석
- academy/scripts/test-repair-core.mjs (새, 27건) · test-ops-words(judge 수리 3 입력 + 켤지 단언) · test-client-status(repairText) · test-todo-words(repair-approval 3건)

## 숫자경로 근거 (브리프 Flag — grep `insert into|update <schema>.<표>`)
| 파일 | 쓰는 표 |
|---|---|
| ai-measure | academy.ai_measurements · ai_probe_measurements (`insert into ${탐침 ? … : …}`, 263줄) |
| check-index | academy.serp_checks |
| import-ai-measurements | academy.ai_measurements |
| growth-import | geo.growth_reports |
| rescan | geo.scans · academy.site_pages |
| daily-agent (추가) | academy.ai_probe_questions — 무엇을 잴지 |
| loop-grow (추가) | academy.ai_probe_questions(active) · geo.pilot_questions |
| bing-check·openai-gap·who-wins·query-audit·scout·loop-review·api-cost | 표에 안 씀. 사람이 읽는 숫자를 계산 — 브리프 시작 목록대로 둠 |
claude-code(claude_calls)·audit·report·case-report 등은 금지 경로라 뺌. pm-report 는 측정 표를 읽기만(pm_reports 에 씀) — 안 넣음. 판단 필요하면 말해 달라.

## 운영 DB 읽기 전용 실측 (begin read only … rollback)
- settings repair_* 없음 → 수리입력 `{ paused:false, pending:0, queue:2, switchOn:null }` → making 「수리안 만드는 중 — 2건 대기, 매일 06:50 1건」
- 자동재개 revertsSince(epoch 이후) 0 · recurring 0 · 만료 후보 0
- 연속확인 rows 1행(수리 4 검토 불합격) → 연속 아님
- repairs: revert-test 3행이 review jsonb 'null' → 브리프 SQL `review is not null` 이면 이 꼴 행이 셈에 들어간다. `jsonb_typeof(review)='object'` 로 씀
- merge_result update 대상 SQL 은 존재하지 않는 task 0 으로 셈만(0행)

## Open Questions
- 만료는 승인 일감이 「사람 대기」일 때만 한다(원장이 닫은 것은 거절이 먼저). 조사 일감은 「수리 승인 대기」일 때만 수리 대기로 되돌린다 — 브리프보다 좁힘. 맞는지
- approveRepair: 30분 무시를 merge_result 가 있으면 풀었다(실패가 돌아왔는데 30분 못 누르면 답답). 두 번째 run 은 concurrency + 「승인 대기 없음」으로 무해
- 「원장 합치기 요청」 실패 활동 ok=false 가 수리 줄을 「막힘」으로 만든다(브리프대로). 카드에도 같은 이유가 뜨니 겹친다 — 그대로 둘지
- 승인합치기 `!손으로` 에도 merge_result 를 남긴다(TASK 있을 때). 봇 run 이 카드에 「사람이 띄운 실행이 아님」을 남길 수 있음
- merge 모드 예외(가지 머리 바뀜 등)는 맨 끝 catch 에서 「실패 — {메시지}」로 카드에 감 — 메시지가 기술 문장
- diff 대조: `무인허용`·`견습건수`·`needs_owner`·가드·금지 경로 줄 무변. `손으로` 줄은 merge_result 호출만 덧붙음. `!ENABLED && !손으로` 블록은 브리프대로 삭제

## Out of Scope (logged in BUILD-LOG)
- KG-42-4 사람이 repair_paused 를 'false' 로 손으로 풀면 repair_resumed_at 이 안 적혀 옛 불합격 행이 다시 세짐
- KG-42-5 합치기 요청 실패 활동이 수리 줄 「막힘」과 카드 이유로 겹침
- test-visit.mjs 는 academy/lib/visit.ts 를 node 로 바로 import 해 원래 안 돈다(이번 변경 무관)
- 배포 뒤 실측: 06:50 수리안 1건 → 카드 · E1(REPAIR_ENABLED)·E2(GH_DISPATCH_TOKEN) 전 「합치지 못함 — 토큰 없음/비상 스위치 꺼짐」
