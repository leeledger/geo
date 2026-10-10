# Architect Brief — Step 42 · 자동 코드 수리: 혼자 시작·멈춤·재개, 합치기는 원장 버튼

원장 결정 2026-10-10(1안). 결정 D72~D79 · KG-42-x 는 BUILD-LOG.

## Goal
수리 대기 코드 일감이 있으면 06:50 에 스위치와 무관하게 수리안(가지·가드·검토·승인 일감)이 만들어지고, 원장은 현황판에서 「합치기 / 버리기」 한 번만 누른다. 멈춤·재개는 규칙이 스스로 한다.

## 지금 (확인한 사실)
- `gh variable list`: REPAIR_ENABLED **없음**(설정된 적 없음). 지금 승인 합치기(mode=merge)도 `승인합치기()` 692줄에서 막힌다
- 정해진 실행은 `수리()` 630줄 `!ENABLED && !손으로` 에서 「스위치 꺼짐」 활동만 남기고 끝. 현황판·아침 보고는 이 활동 문구로 「꺼짐」을 판정(agents.ts:342, client-status.ts:45, pm-report.mjs:127~160)
- 멈춤은 `geo.settings repair_paused='true'` 한 값. 이유는 활동 문구에만. 재개는 사람만
- web 에 GitHub 토큰 없음. 현황판 버튼은 전부 server action(web/lib/task-actions.ts) → DB 만 씀
- 승인 merge 는 `손으로`(dispatch + triggering_actor 가 [bot] 아님)일 때만. 버튼이 사람 계정 토큰으로 dispatch 해야 이 가드가 그대로 산다

## Flow
```
06:50 schedule / 사람 run
 └ 지난수리확인()
     ├ [새] 승인 대기 7일 지남 → 수리 '만료' · 승인 일감 '닫힘' · 조사 '수리 대기'
     ├ 승인 일감 닫힘/완료 → 거절처리 (그대로)
     └ 합침 확인·재발 되돌림 (그대로) ──되돌림 실패──► 멈춤(revert-failed, 사람만)
                                       └7일 2번──────► 멈춤(revert-twice)
 └ 수리()
     ├ [새] 자동재개() — 멈춤이면 재개판정(kind) → 풀면 기록
     ├ 멈춤? → 끝
     ├ 봇 dispatch? → 끝 (그대로)
     ├ [지움] !ENABLED → 끝
     ├ [새] 승인 대기 >= 3 → 끝
     ├ 하루 1건·claude·조사 고르기·전력·금지경로 (그대로)
     ├ 만들기() → 가드 → 검토
     │    fail → '검토 불합격' + 일감 이유 → [새] 연속 3 fail? → 멈춤(review-fail-3)
     │    pass → ENABLED && 무인허용 && !needs_owner ? 합치기(무인, 그대로)
     │          : '승인 대기' + 승인 일감(사람말·왜·검토·숫자에 닿음)
현황판 [합치기] → server action → GitHub dispatch repair.yml mode=merge task=N (PAT = leeledger)
     → 승인합치기(): 손으로·ENABLED·멈춤·승인일감 사람대기·가지 머리·가드·재검토 (전부 그대로)
       못 합치면 [새] 승인 일감 payload.merge_result = {at, why}
현황판 [버리기] → 승인 일감 '닫힘' → 다음 실행 거절처리 (기존 길)
```

## Build Order

### 42a — 순수 판정 (먼저, 시험과 함께)
새 파일 `web/lib/repair-core.mjs` (의존성 0 — repair.yml 은 academy 에 pg 만 깐다. company.mjs 가 `../../web/lib/*.mjs` 를 이미 import 함)
- `멈춤무게 = { "revert-failed": 3, legacy: 3, "revert-twice": 2, "review-fail-3": 1 }`
- `멈춤합치기(지금, 새것)` → 무거운 쪽을 남긴다. revert-failed 위에 다른 멈춤이 와도 revert-failed 유지
- `재개시각(pause)` → revert-twice: `last_revert_at + 7d` · review-fail-3: `at + 7d` · revert-failed / legacy(이유 JSON 없음): `null`
- `재개판정(pause, { revertsSince, recurring }, now)` → `{ ok, why }`. revert-twice: 재개시각 지남 && revertsSince===0 && recurring===0. review-fail-3: 재개시각 지남. 나머지 늘 false(why="되돌리기 실패 — 사람이 main 확인")
- `연속불합격(rows)` → rows = 최근 3행(42b-7 SQL). 3행이고 전부 status='검토 불합격'이면 true
- `만료인가(row, now)` → status='승인 대기' && created_at 이 168시간 넘음
- `숫자경로` 배열 + `숫자닿음(files)` → bool. 시작 목록(.mjs): `ai-measure check-index bing-check import-ai-measurements openai-gap who-wins query-audit rescan growth-import scout loop-review api-cost`. **Flag: Bob 이 academy/scripts/*.mjs 전부를 `insert into|update ` + 측정·판정 표 이름(ai_*, *measure*, index*, crawl*, serp*, growth_*, probe*)으로 grep 해 목록을 확정하고 REVIEW-REQUEST 에 근거(파일 → 표)를 적는다.** 금지 경로(audit·verdict·report·case-report·pilot-report)는 어차피 못 고치니 넣어도 무해
- `수리상태({ paused, pause, pending, queue, switchOn }, now)` → `{ kind: "none"|"making"|"waiting"|"paused", text }`. 우선순위 paused > waiting > making > none
  - paused: `스스로 멈춤 — {이유 사람말} · {재개시각 ? "M/D 이후 재발 없으면 수리안 만들기 다시 시작" : "되돌리기가 실패해 사람이 main 을 확인해야 다시 시작"}`
  - waiting: `승인 기다림 {n}건`(queue>0 이면 ` · 수리안 만들 것 {m}건`). switchOn===false 면 ` · 비상 스위치가 꺼져 있어 합치기가 막혀 있음`
  - making: `수리안 만드는 중 — {m}건 대기, 매일 06:50 1건`
  - none: `고칠 것 없음`
  - 날짜는 `timeZone: "Asia/Seoul"` (CLAUDE.md 함정)
- 문구에 「켜기」「켤지」「원장님 결정」 금지

### 42b — repair.mjs (순서대로)
1. `import { … } from "../../web/lib/repair-core.mjs"`
2. `ensure()` 뒤에 `geo.settings repair_switch` = ENABLED ? '1' : '0' 저장 (현황판이 GitHub 변수를 못 읽음)
3. `멈추기(이유)` → `멈추기(kind, 이유, extra={})`: 지금 `repair_pause` JSON 을 읽어 `멈춤합치기` → `repair_pause = {kind, reason, at, last_revert_at?, repairs?}` 저장, `repair_paused='true'`(옛 키 그대로 — 사람이 'false' 로 푸는 길 유지). 활동 `수리공 멈춤 — {이유} · {재개시각 ? "M/D 이후 스스로 다시 시작" : "사람이 풀 때까지"}`
   - 372줄 7일 2번 → `멈추기("revert-twice", …, { last_revert_at: 방금 되돌린 시각 })`
   - 363줄 되돌리기 실패 → `멈추기("revert-failed", …)`
4. 읽을 때: `repair_paused` 가 'true' 가 아니면 멈춤 아님(`repair_pause` 무시). 'true' 인데 `repair_pause` 없음 → kind legacy
5. `자동재개()` 새 함수 — `수리()` 맨 앞(멈춤 확인 전). paused 이고 `재개판정` ok 면: `repair_paused='false'`, `repair_pause` 지움, `repair_resumed_at = now()`, 활동 `수리공 다시 시작 — {why}. 수리안 만들기만 — 합치기는 원장 승인`. 입력 SQL:
   - revertsSince: `select count(*) from geo.repairs where status in ('되돌림','되돌림 실패') and updated_at > $last_revert_at`
   - recurring: status='합침' 수리의 조사 payload 가 `absent_at > merged_at and seen_at > absent_at` 인 수
   - 재개 뒤 무인 합치기는 기존 `무인허용()` 의 `r === 0`(되돌림 이력 0) 때문에 안 열린다 — 손대지 않는다
6. `수리()`: 630~635줄 `!ENABLED && !손으로` 블록 **삭제**. 다른 가드 전부 그대로. 하루 상한 확인 뒤 `select count(*) from geo.repairs where status='승인 대기'` >= 3 이면 로그만 남기고 끝
7. 검토 불합격 두 곳(673줄 수리(), 734줄 승인합치기()) 뒤 `연속확인()`: `select id, status, note from geo.repairs where review is not null and status not in ('dry','dry 폐기','revert-test') and created_at > coalesce($resumed_at, 'epoch') order by id desc limit 3` → `연속불합격` 이면 `멈추기("review-fail-3", "검토 연속 3번 불합격 (수리 a·b·c)", { repairs })`. 일감마다 이유는 기존 evidence 줄이 적는다 — 지우지 말 것
8. `지난수리확인()` 맨 앞: 승인 대기 중 `만료인가` → 수리 '만료' + note, 승인 일감 `status='닫힘'` evidence 「7일 안 눌림 — 닫음」, 조사 `'수리 대기'` evidence 「수리안 {id} 7일 만료 — 다시 대기」, 활동. **기존 거절 루프보다 반드시 먼저**(안 그러면 닫힌 승인 일감을 거절로 읽는다). 644줄 `전력` 목록에 '만료' 넣지 말 것
9. `수리지침` 278줄 JSON 에 `"사람말":"원장님이 읽을 한두 문장 — 무엇이 틀렸고 고치면 무엇이 달라지나. 파일·함수 이름 쓰지 않는다"`. `만들기` 반환에 `사람말`, `checks` 에 `사람말·touches_numbers·숫자파일`
10. `승인일감()` payload 에 `{ repair_id, task_id, 사람말, 왜: diagnosis.결론 ?? 조사 title, verdict, notes(한줄 200), touches_numbers, 숫자파일, 명령 }`. 제목 `수리안 {repair_id} — {사람말 || 요약}`. detail 의 거절 안내를 「현황판 버리기 버튼」으로
11. `승인합치기()` 가 합치지 않고 나가는 모든 길(스위치 꺼짐·멈춤·수리안 없음·머리 바뀜·main 이 같은 파일 바꿈·가드·재검토 fail·한도·시간 모자람·푸시 포기)에서 승인 일감 `payload.merge_result = {at, why}` 기록(조용한 실패 금지). 692줄 활동 문구 → `비상 스위치 꺼짐 — 합치지 않았습니다`
12. 머리 주석(1~20줄)·repair.yml 머리 주석: 「REPAIR_ENABLED=1 일 때만 main 에 합친다(비상 스위치). 수리안 만들기는 스위치와 무관」. yml 실행 로직은 그대로
- Flag: 견습 5건·`무인허용()`·`needs_owner`·가드·금지 경로·`손으로`·승인 일감 사람 대기 확인·재검토 — **한 줄도 약하게 하지 않는다**. Richard 가 diff 로 대조한다

### 42c — 현황판·아침 보고
- `web/lib/agents.ts` 514줄 근처: settings `repair_paused, repair_pause, repair_switch` + `count(*) geo.repairs where status='승인 대기'` + `count(*) geo.agent_tasks where kind='investigate' and status='수리 대기' and payload->'diagnosis'->>'분류'='code'` → `JudgeInput.repair`. `judge` isRepair 블록(337~343)을 `수리상태()` 로: paused → state "off" + text, 그 밖엔 기존 판정 흐름 유지하고 reason 이 없을 때 text. 「스위치 꺼짐」 접두어 판정 삭제
- `web/lib/client-status.ts:44~61` + `client-status-core.mjs:41,75`: `repairOff` → `repairText`. 75줄은 `자동 코드 수리 — {n}건 · {며칠째} ({repairText})`
- `academy/scripts/pm-report.mjs:127~160`: 「꺼진날」 쿼리·문장 삭제 → 같은 입력으로 `수리상태` 계산, kind 가 paused/waiting 일 때만 확인필요 한 줄(paused 면 이유·재개 날짜, waiting 이면 「현황판에서 합치기/버리기」)
- `web/lib/todo-text.ts:144` repair-approval: title `수리안 {repair_id} — {사람말}`(plain·cut 80), why `{왜 한 줄} · 검토 {통과|불합격} — {notes}`, `numbers: touches_numbers`. 새 action `{ type: "repair", taskId, href(compare), switchOn, requestedAt, result }`
- `web/app/admin/ops/Todo.tsx`: type "repair" → 「숫자에 닿음」 표시 · `[합치기]` `[버리기]` 두 form · `[바뀐 곳 보기]` 링크. switchOn===false 면 합치기 disabled + 「비상 스위치가 꺼져 있어 합칠 수 없음」. requestedAt 있고 result 없으면 「합치는 중 (요청 HH:MM)」, result 있으면 「합치지 못함 — {why}」
- `web/lib/task-actions.ts`:
  - `approveRepair(form)`: isAdmin → `kind='repair-approval' and status='사람 대기'` 확인 → payload.merge_requested_at 30분 안이면 무시 → `POST https://api.github.com/repos/leeledger/geo/actions/workflows/repair.yml/dispatches` body `{ref:"main", inputs:{mode:"merge", task:String(payload.task_id)}}`, `Authorization: Bearer ${process.env.GH_DISPATCH_TOKEN}`. 204 → payload `merge_requested_at=now, merge_result=null`, 활동 `원장 합치기 요청`. 그 외·토큰 없음 → payload `merge_result={at, why:"요청 실패 {status}" | "토큰 없음"}`, 활동 ok=false. 상태는 '사람 대기' 그대로(승인합치기가 사람 대기만 합친다)
  - `discardRepair(form)`: 같은 확인 → `status='닫힘'`, evidence 「원장이 버림」, 활동. 다음 실행 `거절처리`가 기존대로
- 「수리 켜기」 할 일·문구 전부 제거
- `web/.env.example` 에 `GH_DISPATCH_TOKEN=` 줄과 범위 주석

## Escalate (원장 — Arch 가 대신 정하지 않음)
- **E1 REPAIR_ENABLED=1.** 변수가 없어 승인 버튼을 눌러도 합쳐지지 않는다(뜻을 안 바꾸면 이렇다). 켜면: 버튼 합치기 가능 + 기존 규칙대로 승인 합친 5건이 7일 버티고 되돌림 0 이면 무인 합치기. 0 = 비상 정지. Arch 권고: 배포 때 `gh variable set REPAIR_ENABLED --body 1`. 원장 OK 한 줄 필요
- **E2 GH_DISPATCH_TOKEN.** 세분화 PAT(leeledger, 저장소 geo 하나, Actions read/write 만 — 코드 푸시 불가). 만드는 건 사람(1분). 대안 PC `gh auth token`(repo·workflow 전체) — 폭이 넓어 권고 안 함. 넣을 땐 `vercel env add GH_DISPATCH_TOKEN production < file` 후 `env pull` 길이 확인(BOM 함정)
- 토큰 없어도 배포는 된다: 카드가 「합치지 못함 — 토큰 없음」과 기존 `gh workflow run …` 명령 복사를 보여 준다

## Failure modes
| 경로 | 실제로 일어날 일 | 처리 | 원장이 보나 |
|---|---|---|---|
| 스위치 없이 수리안 생성 | 한도 소진·claude 실패 | 기존 한도 skip · 실패 2번 사람 대기 | 보임(일감) |
| 승인 대기 쌓임 | 안 누름 → 매일 Claude 2회 | >=3 이면 생성 멈춤 · 7일 만료 | 「승인 기다림 n건」 |
| 합치기 버튼 | 토큰 없음/만료 401 | merge_result, 카드 「합치지 못함」 | 보임 |
| 합치기 버튼 | dispatch 됐는데 스위치 0·멈춤·main 바뀜 | 각 길에서 merge_result | 보임 |
| 버튼 두 번 | run 2개 | 30분 무시 + concurrency + 두 번째는 승인 대기 없음 | 무해 |
| 만료 vs 거절 순서 | 닫힌 승인 일감을 거절로 읽어 영영 자동 수리 안 함 | 만료 먼저(42b-8) | — |
| 재개 직후 재멈춤 | 옛 불합격 3행이 다시 세짐 | resumed_at 이후 행만 | — |
| revert-failed 위 revert-twice | 덜 무거운 멈춤이 덮어 자동 재개 → 깨진 main 위 수리 | 멈춤합치기 무거운 쪽 유지 + 시험 | 「사람이 main 확인」 |
| 옛 paused=true(이유 없음) | 자동 재개해 버림 | legacy → 사람만 | 보임 |
| 숫자 목록 누락 | 측정 스크립트 수리에 표시 없음 | Bob grep 근거 + Richard 대조 | KG |

## Test map
새 `academy/scripts/test-repair-core.mjs` (DB·git 없음, 다른 test-*.mjs 꼴):
- 멈춤합치기: revert-failed 위 revert-twice/review-fail-3 → revert-failed 유지 · review-fail-3 위 revert-twice → revert-twice [새]
- 재개시각: revert-twice = last_revert+7d · review-fail-3 = at+7d · revert-failed/legacy = null [새]
- 재개판정: 6일 23시간 false · 7일+0+0 true · 7일+revertsSince 1 false · 7일+recurring 1 false · revert-failed 30일 false · legacy false [새]
- 연속불합격: 3 fail true · 2 fail+승인 대기 false · 2행 false [새]
- 만료인가: 167시간 false · 169시간 true · 합침 상태 false [새]
- 숫자닿음: ai-measure.mjs true · write-draft.mjs false · 확정 목록 전부 true [새]
- 수리상태: 4 kind 문구 · paused+pending → paused · switchOn false 문구 · KST 날짜(UTC 15:30 → 다음 날) · 「켜」「원장님 결정」 미포함 [새]
기존 회귀(고쳐서 통과):
- `test-ops-words.mjs:103` 「judge 수리 꺼짐」 → paused/waiting/none 입력, 「켤지」 미포함 단언 [TESTED→수정]
- `test-ops-words.mjs:26~33`·`test-client-status.mjs` repairOff → repairText [TESTED→수정]
- `test-todo-words.mjs` repair-approval: 「수리안 n —」·숫자에 닿음·type repair [새]
- `node scripts/repair.mjs --guard-test` 21건 ✓ [TESTED]
- 나머지 test-*.mjs 0 실패 · tsc web·academy 0 (`node ./node_modules/typescript/bin/tsc` — npx 함정)
- [GAP — 배포 뒤 실측] repair.mjs DB 경로(자동재개·만료·연속확인 SQL). Bob 은 SQL 을 REVIEW-REQUEST 에 붙이고 운영 DB 에 select 판(읽기만)으로 돌린 결과를 적는다

## Out of Scope
- 견습 5건·무인 합치기 규칙·가드 변경 · 현황판 「멈춤 풀기」 버튼(KG-42-1) · 같은 조사 반복 만료 상한(KG-42-2) · repair.yml 실행 로직

## Acceptance
- test-repair-core 전부 ✓ · 회귀 0 실패 · guard-test ✓ · tsc 0
- `grep -rn "켤지\|수리 켜기\|켜 줘\|스위치 꺼짐" web/lib web/app academy/scripts` → repair.mjs 비상 스위치 활동 외 0
- diff 대조: `무인허용`·`견습건수`·`needs_owner`·`손으로`·`승인합치기` 가드 줄 변화 0 (merge_result 기록 추가만)
- 배포 뒤: `gh workflow run repair.yml -f mode=run`(leeledger) → 스위치 없이 수리안 1건 → /admin/ops 할 일에 「수리안 n — 사람말」·검토·(해당 시) 숫자에 닿음·[합치기][버리기]. 수리 줄 「승인 기다림 1건 · 수리안 만들 것 1건」(E1 전이면 「비상 스위치…막혀 있음」)
- E2 뒤: 합치기 → Actions 에 repair run(triggering_actor=leeledger) → E1 전이면 카드 「합치지 못함 — 비상 스위치 꺼짐」
- 아침 보고(pm-report --force)에 「꺼져 있습니다」 문장 없음
