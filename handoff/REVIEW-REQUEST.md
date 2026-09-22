# Review Request — Step 10 재제출 (REVIEW-FEEDBACK Must 6 · Should 7 · Arch 결정 2)
Date: 2026-09-22
Ready for Review: YES
Commit: 2aac455 (main, pushed). 앞 제출(5597a61·9afb63f)은 git 이력 4fd8ba9 의 REVIEW-REQUEST 에 있다

## 한 줄 요약
Must 6·Should 7·Arch 결정 2 를 다 넣었다. Actions 에서 가드 시험 13건·되돌리기 시험 3건이 통과했다. 조사 319 새 run 은 **검토 fail → 사람 대기**로 끝났다. 새 체크리스트 9번이 `pages_total≥10`·14일 제외가 빠진 걸 잡았다. 그래서 승인 대기 일감이 생기는 길은 이번에 끝까지 돌지 않았다(아래 「못 본 것」). 저장소 변수는 건드리지 않았다. REPAIR_ENABLED 는 꺼져 있다.

## Must Fix
1. **재현 명령 전부 뺐다** — repair.mjs 에서 `재현()` 과 호출 삭제, audit.mjs 조사관 출력 형식에서 `재현` 칸 삭제. 모델이 고친 코드는 가드·검토 전에도 뒤에도 돌리지 않는다(node --check 만)
2. **지난 dry 재사용 없앰.** dry 행은 합칠 수 없다. 합칠 수 있는 것은 run 이 만든 `승인 대기` 행뿐이다. 승인 합치기(:653)는
   - 가지 머리가 head_sha 와 다르면 중단
   - base 가 움직였고 수리 파일이 그사이 main 에서 바뀌었으면 수리안 폐기 → 조사 `수리 대기`(다음 run 이 새로 만든다)
   - base 가 움직였으면(파일은 그대로여도) 새 base 위에 같은 파일을 올려 **가드를 다시 걸고 검토를 다시 받는다**. base 가 같을 때도 가드는 다시 건다
   - repairs 2(auto/fix-319 efe75d8): `status='dry 폐기'`, `review.verdict='void'`, note 「pages_total ≥ 10 조건 빠짐 — 합칠 수 없음」
3. **합치는 중** — 합치기(:513)가 main 푸시 **전에** 행을 `합치는 중` + merge_sha 로 쓴다. 지난수리확인(:409): `합치는 중` 1시간 초과 → 되돌림(합친 커밋이 main 에 없으면 `포기`) · `합침` 인데 확인작업이 있고 verify 결과가 없고 1시간 초과 → 되돌림. repair.yml timeout 75분(최악 63분), 스크립트도 남은 시간이 모자라면 합치지 않는다(`REPAIR_JOB_MINUTES`)
4. **되돌리기(:317)는 수리 파일만** `merge_sha^` 모양으로 checkout 해 커밋하고, BUILD-LOG 에는 「### 자동 수리 되돌림」 줄을 새로 붙인다. 합친 뒤 그 파일이 다른 커밋으로 바뀌었으면 손대지 않고 사람에게. 푸시가 거절되면 fetch→다시 한 번(Should)
5. **되돌리기 실패 = 즉시 멈춤** — `되돌림 실패` 가 나면 `repair_paused=true`(:338). 7일 2회 되돌림 멈춤도 그대로
6. **가드 줄검사(:152)** — 추가 줄에 다음이 있으면 실패: 원래 파일에 없던 `process.env.NAME` · `process.env[변수]` · `process.env` 통째로 · 원래 없던 URL 호스트 · 값으로 조립한 호스트 · 원래 없던 `child_process|http|https|net|tls|dns|dgram|vm|worker_threads`(node: 붙든 안 붙든) · `eval(`·`new Function`·`Function(` · 문자열 아닌 `import(`/`require(` · `process.env` 와 fetch/URL 이 한 줄에(원래 있던 이름이라도) · 새 패키지 · 새 파일

## Should Fix
- deny 에 `./.git/**` (Read·Grep·Glob·Edit) 추가 (:217)
- 수리 claude 실행 실패·시간 초과도 `실패` 행을 남긴다(하루 1건에 잡힌다). 같은 조사에서 2번이면 사람 대기 (:460 만들기)
- rebase 없앰 — main 푸시가 거절되면, 수리 파일이 그사이 안 바뀌었을 때만 새 main 위에 **같은 파일로** 합칠 커밋을 다시 만든다. 바뀌었으면 포기. fetch 실패는 전부 throw(가져오기)
- 확인됨·효과 없음·되돌림·되돌림 실패 수리가 있는 조사가 다시 `수리 대기` 로 오면 다시 고치지 않고 사람 대기 (:595 수리)
- 되돌리기 푸시 재시도 1회
- claude-code.mjs `capRequired` — DB 가 없거나 세기가 실패하면 부르지 않고 `{한도:true}` 로 돌려준다. 수리·검토·감사관(진단·칸막이 시험)에 켰다
- BUILD-LOG·일감에 들어가는 LLM 글은 `한줄()` — 공백을 접고 앞 `#` 를 떼고 길이를 자른다
- 검토 체크리스트 9번 + 원래 신호 규칙 원문(audit.mjs 의 `const R5 = async … };` 를 그대로 잘라 넣음 — :242 규칙원문). 수리공 지침에도 같은 원문을 넣었다

## Arch 결정
- (a) **견습** — run 은 가지 푸시 + 검토 pass 에서 멈춘다. 조사는 `수리 승인 대기`, 따로 `repair-approval` 일감(사람 대기)을 만든다(:577). 제목 「자동 수리 승인 대기: <요약>」, detail 에 검토 판정·바뀐 파일·diff stat·compare 링크·`gh workflow run repair.yml -f mode=merge -f task=<id>`. 합치면 승인 일감은 완료, 조사는 `수리 확인`
  - 무인 전환(:443): `approved` 수리 중 7일 넘게 `합침/확인됨/효과 없음` 으로 버틴 것이 5건 이상이고, 되돌림·되돌림 실패가 한 번도 없고, 멈춤이 아닐 때. 처음 풀릴 때 activity 에 「견습 끝」 한 줄(settings `repair_auto`)
  - REPAIR_ENABLED: merge·무인 합치기는 꺼져 있으면 안 한다. 정해진 시각 run 은 꺼져 있으면 지난 수리 확인만 한다(claude 안 부름). **사람이 띄운 run 은 꺼져 있어도 승인 대기까지 간다** — main 을 안 건드리고, 이번 인수 시험을 변수 없이 하려면 필요했다. 막아야 하면 한 줄로 바꾼다
  - audit.mjs: `수리 승인 대기` 를 열린·사람손 상태에 넣었다(풀린 증거가 있을 때만 닫힘)
- (b) **확인 실행은 company·scout·audit·watch 만**(:56). write·optimize 는 안 돌린다. 쓰는 워크플로가 없으면 합치되 verify 는 「정기 실행에 맡김」으로 적어 1시간 규칙에 안 걸리게 했다

## 시험 (Actions, 실제 출력)
1. **가드 시험** run 35704828321 — 13건 전부 맞음
   ```
   ✓ 새 환경변수 · ✓ 환경변수 이름을 값으로 · ✓ process.env 통째로 · ✓ 새 호스트 evil.example.com · ✓ 호스트를 값으로 조립
   ✓ 환경변수+네트워크 한 줄 · ✓ node:child_process · ✓ require("https") · ✓ eval · ✓ new Function · ✓ 동적 import 변수
   ✓ 새 패키지 left-pad · ✓ 깨끗한 수정 — 통과해야 함 · 문제 없음
   ```
2. **되돌리기 시험** run 35704877806
   ```
   가짜 수리 49a4cfe + BUILD-LOG 덧붙임 → auto/revert-test-1790065664557
   ↩ 되돌림 e29ea44
   ✓ 수리 파일이 base 와 같다
   ✓ BUILD-LOG 에 가짜 수리·다른 사람·되돌림 세 항목
   ✓ 합친 뒤 같은 파일이 바뀌면 거절
   시험 가지 지움 됨
   ```
3. **조사 319 run** run 35704962357 (REPAIR_ENABLED=0, 사람이 띄움)
   ```
   가드: 파일 2 · 줄 5 · 통과   (company.mjs crawl-push 안내에 microsoft · scout.mjs major 목록에 microsoft)
   검토: fail · must: R5 와 같은 보호장치(pages_total<10 제외, age<=14일 제외)를 넣거나 R5식 절대 임계값으로 …
   검토 9번: (a) 절대 커버리지 20% 기준 — 없음 (b) pages_total<10 제외 — 없음 (c) age<=14일 제외 — 없음
   가지 auto/fix-319 11949f1 푸시 됨
   ```
   → repairs 4 `검토 불합격`, 조사 319 `사람 대기`. main 무관
4. node --check repair·audit·claude-code 통과. 로컬 `--guard-test` 같은 결과. audit `--dry` 정상(신호 1)
5. claude 호출(오늘 누적): repair 2 · repair-review 2 · audit 3 · sandbox-test 4

## 못 본 것 (정직하게)
- **승인 대기 일감 생성·mode=merge·무인 전환** — 319 수리안이 검토에서 떨어져 승인 길까지 안 갔다. 오늘은 하루 1건을 썼다(검토 불합격 행). 내일 사람이 `-f mode=run -f task=319` 로 띄우면(319 를 `수리 대기` 로 돌린 뒤) 다시 볼 수 있다
- 실제 합치기·확인 실행·합친 뒤 되돌리기·재발 판정·7일 2회 멈춤·되돌리기 실패 멈춤 — REPAIR_ENABLED 꺼짐. 되돌리기 자체는 2번 시험으로 봤다
- capRequired 거절 경로는 claude 를 안 부르는 로컬 시험으로만(앞 제출의 CLAUDE_DAILY_MAX=0 시험과 같은 자리)

## 봐 줄 것
- 사람이 띄운 run 이 킬 스위치가 꺼져 있어도 승인 대기까지 가는 것(위 Arch (a))
- `process.env` 와 fetch 가 한 줄에 있으면 원래 있던 이름이라도 막는다 — 기존 코드 모양에 따라 과하게 막을 수 있다
- 되돌리기는 BUILD-LOG 의 「자동 수리」 항목을 지우지 않고 「되돌림」 줄을 덧붙인다

---
## 추가 — Richard 2차 Should Fix 1~3 (83ce049 · 0807cf9)
1. 봇 재실행: repair.yml 이 `REPAIR_ACTOR: github.triggering_actor` 를 넘긴다. 「사람이 띄움」 = dispatch + 띄운 이가 비어 있지 않고 `[bot]` 이 아님. 봇이 띄운 run·dry 는 지난 수리 확인만, merge 는 거절. company.mjs 는 repair.yml 실패를 다시 띄우지·rerun 하지 않고 사람 대기로만 올린다
   - 로컬 흉내(GITHUB_ACTIONS=true, REPAIR_EVENT=workflow_dispatch, REPAIR_ACTOR=github-actions[bot]): merge → 「merge 는 사람만 띄운다 (github-actions[bot]) — 합치지 않는다」 · run → 「사람이 띄운 실행이 아니다 … 지난 수리 확인만 한다」
2. 거절: 승인 합치기는 `repair-approve-<id>` 가 사람 대기일 때만. 완료·닫힘·없음이면 행 「거절」, 조사 사람 대기, 그 조사는 더 자동 수리 안 함(지난 수리 확인이 매 실행 찾는다). /admin/ops 에는 닫기 버튼이 없고 「완료」 표시만 있어(finishTask) 그걸 거절로 본다 — 승인 일감 문구에 그렇게 적고 SQL 한 줄 대안도 적었다
3. 가드: `process[`·`Reflect.x(process`·`{ … env … } = process` 막음. 추가 줄에 `fetch(`·`request(`·`.post(`·`process` 가 있으면 needs_owner → 견습이 끝나도 무인 합치기 안 함(승인은 됨). 가드 시험 21/21 — Actions run 35705965069
4. 확인 실행이 결론만 보는 것 → BUILD-LOG Known Gap
- 덤: repair.mjs 는 작업 트리가 깨끗할 때만 돈다(0807cf9). finally 의 `checkout -f` 가 로컬 수정을 날릴 수 있었다
