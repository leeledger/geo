# Review Request — Step 10 (수리공)
Date: 2026-09-22
Ready for Review: YES
Commits: 544b0b7 (Step 9 Should 2차) · 5597a61 (Step 10) · 9afb63f (빈 변수·git status 고침) — main, pushed
(Step 9 제출본은 git 이력 3d1e65a 에 있다)

## 한 줄 요약
가지·diff·검토·되돌리기는 Actions 에서 실제로 돌았다. **main 에 실제로 합치는 것은 못 했다** — `gh variable set REPAIR_ENABLED --body 1` 이 권한 분류기에서 거절됐다(「안전하지 않은 에이전트 만들기」). 킬 스위치를 켜는 건 원장 결정으로 남긴다.

## Files Changed
- academy/scripts/repair.mjs (새 파일, 약 560줄)
  - :103-150 가드 — 허용 `academy/scripts/*.mjs` · 금지(claude-code·audit·repair·verdict·case-report·pilot-report·report·insert-diagrams·seed-post-*) · 지움 금지 · 파일 ≤3 · 줄 ≤80 · 추가 줄에 토큰 모양/실제 비밀값 없음 · 새 bare import(원래 그 파일에 없던 것) 금지 · node --check
  - :153 재현 — 진단의 `재현` 이 `node academy/scripts/x.mjs … --dry` 이고 그 스크립트 소스에 `"--dry"` 가 있을 때만 실행. --dry 를 모르는 스크립트는 진짜 일을 한다(company.mjs 가 그렇다)
  - :160-185 수리칸·검토칸 — 수리공 tools Read/Grep/Glob/Edit, allow `Read/Grep/Glob(./**)`·`Edit(./academy/scripts/*.mjs)`, dontAsk, deny 는 감사관과 같은 /proc·~/.claude·.env* + Edit .github/web/academy/app/금지 파일. **Bash 없음**(아래 Brief 와 다른 점 1). 검토자는 Read/Grep/Glob 만. 둘 다 envDrop 로 DB·GH·LLM 키가 빠진다
  - :237 되돌리기(sha, branch) — fetch → revert --no-edit → 충돌이면 abort 하고 실패 → 스크립트가 토큰 주소로 푸시
  - :248 멈춤확인 — 7일에 '되돌림' 2건이면 `geo.settings repair_paused=true`
  - :276-317 확인작업·돌려보기 — 바뀐 스크립트를 부르는 워크플로(직접 + 그 스크립트를 부르는 스크립트 한 단계)를 모두 dispatch 하고 같이 기다린다(25분). 안 끝나면 실패로 본다
  - :319 지난수리확인 — '합침' 수리: 재발(수리 뒤 absent_at 이 찍혔다가 seen_at 이 다시 더 늦음) → 되돌림 · 조사가 닫힘 → '확인됨' · 7일 동안 신호 그대로 → '효과 없음' + 사람 대기(되돌리지 않음)
  - :350-512 수리 — 멈춤·킬 스위치·하루 1건 → 수리 대기 조사 1건 → 짚은 파일이 전부 금지 경로면 claude 없이 사람 대기 → 가지 `auto/fix-<id>` → 수리 claude → 가드 → 검토 claude → 가지 커밋·푸시 → (dry 면 끝) → 검토 fail 이면 사람 대기 → 확인할 워크플로가 없으면 합치지 않음 → main 커밋(수리 + BUILD-LOG 「### 자동 수리」) fast-forward 푸시, 거절되면 rebase 1회, 충돌이면 포기 → 조사 `수리 확인` → 확인 실행 → 실패면 같은 실행 안에서 되돌림
  - 지난 --dry 가 검토 pass 이고 원격 가지 머리가 그대로면(3일 안) run 이 claude 를 다시 안 부르고 그 diff 를 다시 가드에 걸어 합친다 — 구독 한도 절약
  - :516 되돌리기시험 — 시험 가지에 무해한 커밋 → 운영과 같은 되돌리기() → base 와 트리 비교 → 가지 지움
- .github/workflows/repair.yml — 06:50 KST + dispatch(mode run|dry|revert-test, task). contents·actions write. persist-credentials false, fetch-depth 0. 입력은 env 로(셸에 끼워 넣지 않음). REPAIR_ENABLED·REPAIR_MAX_PER_DAY·CLAUDE_DAILY_MAX 는 vars
- academy/scripts/claude-code.mjs:32-80 — **모든 호출 기록 + 하루 상한**. `purpose`·`taskId` 옵션. 부르기 전에 오늘(KST) geo.claude_calls 수를 세서 `CLAUDE_DAILY_MAX`(40), 측정 아닌 호출은 `CLAUDE_MEASURE_RESERVE`(20) 를 남기고 멈춘다. 걸리면 `{한도:true, 상한:true}` — 호출자들은 한도를 실패로 안 센다. DB 는 `클로드기록연결(q)` 로 받거나 DATABASE_URL 로 풀 하나(allowExitOnIdle)
- academy/scripts/ai-measure.mjs — `purpose: "measure"` 한 줄 · writer-common.mjs — `purpose: "writer"` 한 줄
- academy/scripts/audit.mjs — claude_calls 를 직접 insert 하지 않고 callId 행을 update · 신호마다 payload.seen_at · `수리 확인` 을 열린·사람손 상태에 넣고, 신호가 안 보이면 absent_at · 조사관 출력에 선택 칸 `재현` · Step 9 Should 2차(칸막이 시험 9·10번, 다시 연 조사 diag 횟수 0, 재사용은 다시 열린 것만)
- academy/scripts/company.mjs:206 — WORKFLOWS 에 `"repair.yml": "ops"` (감사관과 같은 이유 — 수리공이 죽으면 회사 루프가 안다)

## Brief 와 다른 점
1. **수리공 claude 에 Bash(node --check·git diff·git status) 를 안 줬다.** `node --check /proc/self/environ` 은 문법 오류 메시지에 환경변수를 찍는다 — 구독 토큰이 모델 문맥으로 들어간다. 검사는 전부 스크립트가 claude 뒤에 한다. 대신 한 번에 맞춰야 한다(재시도 없음)
2. 재발 판정: 「같은 신호 재발」을 **사라졌다가 다시 뜸**으로 읽었다. 신호가 계속 떠 있는 것은 재발로 안 본다 — 크롤러·인용 같은 지표는 하루에 안 움직여 멀쩡한 수리를 매일 되돌리게 된다. 7일 내내 그대로면 '효과 없음' + 사람 대기(되돌리지 않음). Arch 확인 필요
3. 확인 실행이 실패하면 audit 을 기다리지 않고 **같은 실행 안에서 바로** 되돌린다. 다음 날 재발 판정은 repair.mjs 가 audit 이 남긴 seen_at/absent_at 으로 한다(audit 에 쓰기 권한·푸시를 주지 않으려고)
4. 표 칼럼 추가: head_sha · note · updated_at (additive)
5. 합칠 때 가지 커밋을 그대로 올리지 않고, base 위에 「수리 파일 + BUILD-LOG 항목」 한 커밋을 새로 만들어 main 에 fast-forward 한다. 가지는 기록용
6. company.mjs WORKFLOWS 에 repair.yml 한 줄 (brief 에 없음)

## 시험 결과 (실제 출력)
1. node --check: repair.mjs·claude-code.mjs·audit.mjs·ai-measure.mjs·writer-common.mjs·company.mjs 통과. audit `--dry`·`--no-diag` 정상(신호 1, R1 셋 회복)
2. 하루 상한(claude 안 부름): `CLAUDE_DAILY_MAX=0` → `repair: true 하루 상한 — 오늘 7회 (repair 몫 -20)` · `MAX 40 RESERVE 40` → `audit 몫 0` 으로 거절. 스크립트가 매달리지 않고 끝남
3. **되돌리기 시험** run 35703118038:
   ```
   수리공 · 2026-09-22 17:08 KST · revert-test
     시험 커밋 d345f2e → auto/revert-test-1790064487948
     ↩ 되돌림 52b9683 · base 와 트리 같음 ✓
     시험 가지 지움 됨
   ```
4. **dry — 조사 319.** 첫 시도 run 35703196690 은 `하루 상한 — 오늘 7회 (repair 몫 -20)` 로 멈췄다. Actions 는 설정 안 한 vars 를 `""` 로 넘기고 `Number("")=0` 이다. 9afb63f 에서 빈 값은 기본값으로 고쳤다(REPAIR_MAX_PER_DAY 도 같은 버그 — 합치기가 영영 안 됐을 것). git status 첫 줄 잘림도 같은 커밋에서 고쳤다
   재시도 run 35703293668:
   ```
   수리공 · 2026-09-22 17:10 KST · dry · 조사 319
     가드: 파일 1 · 줄 15 · 통과
     academy/scripts/scout.mjs: select 에 first_seen 추가 + 「1-1. 4대 엔진 밖은 절대 기준」 루프
       (pct < 20 · first_seen 14일 초과 → report(cov-<slug>-<vendor>, "샘", …))
     검토: pass · (notes) company.mjs crawl-push 안내에 microsoft 항목은 빠져 일반 문구로 뜬다 — 동작은 안 깨지고 fail 사유는 아님
     가지 auto/fix-319 efe75d8 푸시 됨
     --dry 끝 (수리 2). main 은 그대로
   ```
   - geo.repairs: 1 revert-test · 2 dry(319, scout.mjs, 15줄, verdict pass, head efe75d8). 조사 319 는 그대로 수리 대기
   - 제 검토: diff 는 scout 의 `report()` 모양·「샘」 등급과 맞고 company.mjs 의 `cov-<slug>-<vendor>` 파싱에 그대로 걸린다. 다만 `pages_total ≥ 10` 조건이 없어 페이지 적은 고객사도 걸릴 수 있다 — 검토자가 못 본 것
   - claude 호출: repair 1 · repair-review 1 (둘 다 ok)
5. **실제 합치기 — 안 됨.** `gh variable set REPAIR_ENABLED --body 1` 이 권한 분류기에서 거절됐다. 우회하지 않았다. 그래서 못 본 것: main fast-forward 푸시(GITHUB_TOKEN 으로 main 에 푸시되는지), BUILD-LOG 자동 항목, 확인 실행 dispatch·대기, 확인 실패 시 즉시 되돌리기, 지난수리확인(재발·확인됨·효과 없음), 7일 2회 멈춤
   - 켜는 방법(원장): `gh variable set REPAIR_ENABLED --body 1 --repo leeledger/geo` → `gh workflow run repair.yml -f mode=run -f task=319`. 지난 dry(수리 2)가 3일 안이고 가지 머리가 efe75d8 그대로면 claude 없이 그 diff 를 다시 가드에 걸어 합치고, scout.yml·company.yml 을 돌려 확인한다
6. Step 9 Should 2차 — 칸막이 시험 run 35702316984: CLI 거절 6건(/proc/self·부모 pid·.env 표지·.env.local·~/.claude·Grep /proc) + `✓ 9 Read handoff/BUILD-LOG.md — 첫 줄 「# Build Log」 일치` · `✓ 10 Glob academy/scripts/*.mjs — 실제 45개 · 보고 「45」`

## 봐 줄 것
- 수리공에게 Bash 를 안 준 판단(위 1)
- 재발 정의(위 2) — Arch 결정 필요
- 확인작업은 스크립트를 부르는 스크립트를 한 단계만 따라간다. writer-common 처럼 여러 곳이 import 하는 파일은 워크플로 여러 개를 한꺼번에 돌린다(write.yml 은 초안을 실제로 쓴다 — 구독을 쓴다)
- 확인 실행 실패 원인이 수리와 무관해도(DB 연결 시간 초과 등) 되돌린다 — 보수적
- claude-code.mjs 가 이제 호출마다 DB 를 두 번 친다(세기·기록). DB 가 안 되면 기록 없이 부른다(상한도 안 걸림)

## Out of Scope (BUILD-LOG Known Gaps)
- 킬 스위치 켜기·첫 실제 합치기 — 원장 결정
- Step 11 (영업)
