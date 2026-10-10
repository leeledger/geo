# Review Feedback — Step 42 (+D80)
Date: 2026-10-10
Ready for Builder: YES

## Must Fix
(없음)

## Should Fix
- web/lib/task-actions.ts:93-94,118 (confidence: 6/10) — 30분 막기는 읽고 나서 쓰는 순서라 원자적이지 않다. `if (Number.isFinite(요청) && Date.now() - 요청 < 30 * 60000 && !p.merge_result) return;` 다음에 dispatch 하고, 그 뒤에야 merge_requested_at 을 쓴다. 두 번 거의 동시에 누르면 dispatch 가 두 번 나간다. 피해는 없다: repair.yml `concurrency: group: repair` 가 차례로 돌리고, 두 번째 실행은 「승인 기다리는 수리안이 없음」에서 멈춘다. 다만 이 merge_result 가 이미 「완료」된 승인 일감에 남는다(화면에는 안 나옴). 고치려면 dispatch 전에 `update … set payload = payload || {merge_requested_at} where id=$1 and status='사람 대기' and (payload->>'merge_requested_at' is null or … < now()-30분 or payload ? 'merge_result') returning id` 처럼 한 문장으로 자리를 잡는다. 5분 넘으면 BUILD-LOG 로.
- academy/scripts/repair.mjs:799 (confidence: 5/10) — `if (!손으로) { … await 합치기결과("사람이 띄운 실행이 아님"); return; }`. 봇이 띄운 merge 실행이 merge_result 를 쓰면 카드에 「합치지 못함」이 뜨고 30분 막기도 풀린다. 원장이 누른 진짜 실행이 줄 서 있을 때 화면이 헷갈린다. 봇이 merge 를 띄우는 길이 지금은 없으니 Open Question 5 그대로 BUILD-LOG 에만 둬도 된다.

## Escalate to Architect
- (E1 재확인) 승인 버튼이 실제로 합치려면 REPAIR_ENABLED=1 이 있어야 한다. D80 으로 ENABLED=1 은 이제 「승인된 합치기만」이라 켜도 무인 합치기는 안 열린다. E1 의 위험 근거가 사라졌다 — 원장에게 다시 묻을 때 이 점을 같이 전할 것.

## 최우선 점검 결과
1. 승인 없이 main 에 합치는 길 — 없음. main 푸시는 합치기() 한 곳(repair.mjs:641)이고 부르는 곳은 두 곳뿐이다. :764 무인 길은 `무인합치기(process.env, …)` = `REPAIR_ENABLED === "1" && REPAIR_UNATTENDED === "1" && 견습끝 === true && !needs_owner` 뒤에만 열린다. UNATTENDED 가 빈 값이거나 키가 없으면 무인허용()도 안 부른다(:757). :831 승인 길은 손으로·ENABLED·멈춤 아님·승인 일감 「사람 대기」·가지 머리 같음·가드 재검사·base 가 움직였으면 재검토를 모두 거친다. 자동재개()는 repair_paused 만 푼다. 합치기는 여전히 승인 또는 UNATTENDED+무인허용(되돌림 이력 r===0, 그대로)을 거쳐야 한다. 견습·needs_owner·무인허용 본문은 바뀌지 않았다.
2. [합치기] 서버 동작 — approveRepair·discardRepair 둘 다 첫 줄이 `isAdmin()` 이고, 키 없이 부르니 쿠키로만 열린다. 대상은 `kind='repair-approval' and status='사람 대기'` 일감만이다. 토큰은 서버 env 에서 읽어 authorization 헤더에만 쓴다. 활동·payload·console 에는 why 문자열(「토큰 없음」「요청 실패 {status}」)만 남는다. Todo.tsx 로 넘어가는 값은 id 뿐이다. 반복 클릭은 30분 막기와 Actions concurrency 로 무해하다(위 Should Fix 참고).
3. 「되돌리기 실패」 멈춤 — 재개시각()이 revert-failed·legacy·모르는 종류에 null 을 돌려주고, 재개판정은 그 경우 ok:false 다. 멈춤합치기는 무거운 쪽(3)을 지킨다. 되돌림 2번(2)이나 불합격 3번(1)이 와도 덮이지 않는다. 사람이 손으로 풀어야만 풀린다.
4. 가드 — guard-test 21건 「전부 맞음」, test-repair-core 27/27 을 직접 돌려 확인했다. 금지·허용 정규식, 무인허용, 손으로 줄은 무변이다.
5. Bob 의 자기 판단 — (a) 만료를 「사람 대기」 승인 일감에만 건 것: 맞다. 원장의 버리기가 만료로 덮여 같은 조사를 다시 고치는 일을 막는다. (b) `jsonb_typeof(review)='object'`: 맞다. 수리기록()이 `JSON.stringify(row.review ?? null)` 로 jsonb 'null' 을 넣으니 `is not null` 은 틀린다. (c) merge_result 가 있으면 30분 막기를 푼 것: 받아들인다. 재실행은 concurrency 와 「승인 대기 없음」으로 무해하다. (d) legacy 문구: 맞다. 셋 다 브리프보다 안전한 쪽이다.

## Cleared
repair-core.mjs 전체, repair.mjs 의 수리()·승인합치기()·합치기()·되돌리고기록()·자동재개()·연속확인()·지난수리확인() 만료, task-actions approveRepair/discardRepair, Todo.tsx 카드, repair.yml env 를 검수했다. 원장 승인 없는 합치기 길은 없고 기존 가드도 약해지지 않았다.
