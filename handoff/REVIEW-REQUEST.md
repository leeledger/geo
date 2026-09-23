# Review Request — Step 16 · 현황판 문구와 무인 운영 틈
Date: 2026-09-24
Ready for Review: YES

원장(9/24): 「대시보드 문구가 AI 슬롭이 강해 무슨 말인지 모르겠고, 업무를 알아서 처리해야 하는데 그렇지 못해」.
Arch 브리프 없이 세션이 바로 짓고 Richard 검토 → 배포(상시 승인 게이트).

## 원인
1. **문구** — 직원 줄·할 일이 기계 로그(`시험: 주간 초안 · 대기 · 모드=없음 · material-need 일감 참고`, `대기 0 · 관찰 3 · 사람 대기 11 · 로컬 대기 1`)를
   `plain()` 정규식으로 깎아 그대로 보여 줬다. 깎아도 로그다.
2. **무인 운영** — 9/24 아침 감사 06:35·정찰 06:37·측정 07:05 가 08:45 까지 한 건도 안 떴다(GitHub 예약 건너뜀).
   현황판은 「지연」만 칠하고 아무도 다시 안 돌렸다. heartbeat.mjs 는 company.yml 만 깨운다.
3. 원장 몫이 아닌 일감이 「오늘 하실 일」을 채웠다 — 아이로그 주제 4건(원장이 완료 표시한 뒤에도 다시 열림),
   조사 끝난 코드 문제 2건(439 덕덕고·319 빙, 수리공 꺼짐이라 사람에게 옴).

## 바꾼 것
- `academy/scripts/company.mjs` `밀린예약()` — 정해진 시각에서 2시간 지났는데 그 뒤 시작된 실행이 없으면 workflow_dispatch.
  대상: snapshot·audit·scout·optimize·serp·write(월). **repair·sales 는 뺐다**(봇이 띄우면 사람 실행으로 읽힘 — heartbeat 주석).
  실행 기록을 못 읽은 작업은 짐작으로 안 띄운다. 대기·진행 중 실행도 「시작됨」으로 친다(created_at). `main()` 에서 `--plan` 이면 안 돈다.
- `company.mjs` question-draft — 1번 아닌 고객사 주제는 「사람 대기」 대신 「관찰」 30일 + 근거 한 줄.
- `academy/scripts/scout.mjs` — 커버리지 비교군에 microsoft 추가. 감사 R5 와 같은 보호(10쪽 미만·14일 이내 제외). 할 일 문구 빙용.
- `academy/scripts/audit.mjs` R5 — duckduckgo 는 신호 대신 `풀림`(덕덕고 결과는 빙 색인). 열린 439 는 다음 감사에서 닫힌다.
- `web/lib/agents.ts` — 역할마다 손으로 쓴 `does` 한 줄. 정상이면 로그 대신 그걸 보인다.
  새 상태 `wait`(원장님 차례): 역할의 열린 일감 중 「사람 대기」가 있으면. 늦음·실패 문장을 다시 씀.
  실패 문장의 「매시 점검이 한 번 다시 돌립니다」는 GitHub 작업 실패(수리·영업 제외)일 때만 — company.mjs workflow-failed 와 같은 조건.
  「늦음」의 「대신 돌립니다」는 `catchup: true` 작업만(company.mjs 예약 표와 같은 목록).
- `web/app/admin/ops/AgentStrip.tsx` — 제목 「자동으로 도는 일」, 라벨(실패·늦음·원장님 차례), 「마지막 n시간 전」, 실패 0 은 안 씀.
- `web/lib/todo-text.ts` · `Todo.tsx` — 상담·영업 전화·등재·글감·조사 문장을 할 일로 다시 씀.
- `web/app/admin/ops/Growth.tsx` — 「크고 있나」→「성과」, 차트 제목·설명.

## 확인한 것
- `tsc --noEmit` 통과. `node --check` audit·scout·company 통과.
- 운영 DB 로 `readAgents()`·`todoText()` 를 돌려 실제 문장을 찍었다(아래). 백슬래시가 heredoc 에서 먹혀 정규식 3곳이 깨졌던 것을 이 출력으로 잡고 고쳤다.
  ```
  late 운영   | 06:35 감사가 안 돌았습니다 — GitHub 이 예약을 건너뛰어 매시 점검이 대신 돌립니다
  off  수리공 | 꺼 두었습니다. 켜면 코드 문제를 스스로 고칩니다 — 켜는 건 원장님
  late 측정   | 07:05 AI 답변 측정이 안 돌았습니다 — GitHub 이 예약을 건너뛰어 매시 점검이 대신 돌립니다
  ok   삽화   | 초안이 생기면 도해를 그립니다
  wait 영업   | 원장님 확인 2건을 기다립니다
  TODO 이번 주 글감 한 줄 적기 // 상담·수업에서 들은 말 한 줄이면 됩니다. 남은 글감이 없어 이번 주 초안이 멈춰 있습니다
  ```

## 봐 주셨으면 하는 것
1. `밀린예약()` 이 GitHub 예약과 겹쳐 두 번 도는 경우 — 예약이 2시간 넘게 늦게 뜨면 둘 다 돈다. optimize(측정)는 MEASURE_EVERY_DAYS·하루 상한이 있어 괜찮다고 봤다. audit·scout 이중 실행이 해로운가?
2. company.yml 의 GITHUB_TOKEN(actions: write)으로 띄운 workflow_dispatch 는 GitHub 이 허용한다(재귀 금지의 예외). 맞는지.
3. 데이터: 417·28·32·33(아이로그 주제) → 관찰, 31(앱 등록, 원장이 완료 표시했던 것) → 닫힘, 439·319 → 닫힘(코드로 고침), 258 detail 을 한 문장으로.

## Files
academy/scripts/company.mjs · academy/scripts/scout.mjs · academy/scripts/audit.mjs ·
web/lib/agents.ts · web/lib/todo-text.ts · web/app/admin/ops/AgentStrip.tsx · web/app/admin/ops/Todo.tsx · web/app/admin/ops/Growth.tsx
