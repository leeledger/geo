# Review Feedback — Step 10 (수리공) 3차
Date: 2026-09-22
Ready for Builder: YES
Commits reviewed: 83ce049 · 0807cf9 · 26ba9f2 (2차 Should Fix 1~3 반영)

## Must Fix
없음.

## Should Fix
- (기록만) 확인 실행은 결론만 본다. company.mjs 처럼 안에서 오류를 잡고 0 으로 끝나는 스크립트는 수리가 깨뜨려도 「성공」으로 나온다. BUILD-LOG Known Gap 으로 둔다.
- (기록만) 0807cf9 이후 Actions 에서 돈 것은 guard-test 뿐이다. 띄운 이 판별과 작업 트리 검사를 거치는 run·revert-test 는 아직 실제로 안 돌았다. 아래 체크리스트 2번이 그 시험을 대신한다.

## Escalate to Architect
없음.

## Cleared
- **띄운 이**: `REPAIR_ACTOR=github.triggering_actor`. 봇이 dispatch 한 실행은 확인만 하고, merge 는 사람이 띄운 것만 합친다. 정해진 시각 실행은 킬 스위치가 꺼져 있으면 확인만 한다. 로컬 실행은 사람으로 본다.
- **company.mjs**: repair.yml 이 실패해도 다시 띄우지 않는다. 사람 대기로 올린다(rerun 도 없다).
- **거절 경로**: 승인 일감이 사람 대기일 때만 합친다. 완료·닫힘·없음이면 행은 거절로, 조사는 사람 대기로 간다. 거절된 조사는 다시 자동 수리하지 않는다. 합친 뒤 승인 일감은 스크립트가 완료로 닫지만, 그때 행은 이미 `합침` 이라 거절로 잘못 읽히지 않는다.
- **가드**: `process[`·`Reflect.*(process`·`{ env } = process` 를 막는다. `fetch(`·`request(`·`.post(`·`process` 가 든 수정은 needs_owner 가 되어 무인 합치기를 하지 않는다. 시험 21/21 통과(run 35705965069).
- **작업 트리 검사**: 깨끗할 때만 돈다. academy/node_modules 는 gitignore 대상이라 Actions 의 `npm install pg --no-save` 에 걸리지 않는다.
- **회귀 없음**: 합치기·되돌리기·지난수리확인·견습 해제·하루 1건 모두 그대로다.

## 원장이 켜기 전·켤 때 할 일 (순서대로)
1. 멈춤이 아닌지 확인한다: `select value from geo.settings where key='repair_paused'` 가 없거나 `false`.
2. 킬 스위치를 켜기 **전에** 한 번 시험한다 — `gh workflow run repair.yml -f mode=revert-test` 가 success 로 끝나는지 본다(작업 트리 검사·푸시·되돌리기). 수리 대기 조사가 있으면 `gh workflow run repair.yml -f mode=run` 도 돌린다. 로그 첫 줄에 「사람이 띄움」이 찍히는지 보고, 검토 pass 면 승인 일감이 생기는지 본다. 스위치가 꺼져 있으니 main 은 안 건드린다.
3. 켠다 — 파이프 말고 인자로: `gh variable set REPAIR_ENABLED --body 1 --repo leeledger/geo`. 그다음 `gh variable get REPAIR_ENABLED --repo leeledger/geo` 가 정확히 `1` 인지 본다.
4. /admin/ops 에 「자동 수리 승인 대기」가 뜨면 compare 링크로 diff 전체를 직접 읽는다. 아래 중 하나라도 걸리면 거절한다:
   - 원래 신호 규칙의 임계값·제외 조건이 다 있나
   - 새 fetch·주소·환경변수·process 가 있나 — 있으면 특히 천천히 본다. 이런 수정은 견습이 끝나도 늘 원장 승인으로 온다
   - 고객사 이름이나 숫자를 지어내지 않나
   - 줄 수가 이유에 맞나
5. **승인**: `gh workflow run repair.yml -f mode=merge -f task=<조사 id>` **만** 돌린다. 이때 승인 일감을 「완료」로 표시하지 **않는다** — 완료 표시는 거절로 읽힌다. 합쳐지면 스크립트가 알아서 완료로 닫는다.
   로그에서 셋을 본다: 「✓ main <sha>」, 확인 실행 결과(company·scout 등)가 ✓ 인지, BUILD-LOG 끝에 「### 자동 수리 — 조사 …」가 붙었는지. GITHUB_TOKEN 으로 main 에 푸시하는 첫 실제 경로다. 거절되면 `포기` 로 남고 main 은 그대로다.
6. **거절**: /admin/ops 에서 그 승인 일감을 「완료」로 표시한다(또는 `update geo.agent_tasks set status='닫힘' where dedupe_key='repair-approve-<id>'`). 다음 수리공 실행이 거절로 적는다. 그 조사는 다시 자동 수리하지 않는다.
7. **끄기**: `gh variable set REPAIR_ENABLED --body 0 --repo leeledger/geo` — 새 수리·합치기만 멈춘다. 지난 수리 되돌리기는 계속 돈다(의도).
   비상 정지: `insert into geo.settings (key,value) values ('repair_paused','true') on conflict (key) do update set value='true'`.
   멈춤 풀기(`value='false'`)는 원인을 본 뒤에 한다. 「되돌림 실패」로 멈췄다면 먼저 main 에 남은 수리 파일을 직접 되돌린다.
8. repair.yml 이 실패하면 회사 루프가 다시 띄우지 않고 사람 대기 일감을 올린다. 로그를 보고 사람이 다시 띄운다.
9. 무인 전환은 자동이다 — 승인해 합친 수리 5건이 7일 넘게 되돌림 없이 버티고, 멈춤이 아닐 때. 그 뒤에도 네트워크·환경에 닿는 수정은 늘 승인 대기로 온다.
