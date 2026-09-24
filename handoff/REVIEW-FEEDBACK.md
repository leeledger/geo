# Review Feedback — Step 20
Date: 2026-09-24
Ready for Builder: YES

## Must Fix
없음.

## Should Fix
- academy/scripts/pm-report.mjs:52 — `작업직원` 에 `sales: "sales"` 가 남았다. `직원들` 에서 sales 를 뺐으니 `셈.sales` 는 undefined. 「자동 작업 sales」 줄이 창(어제 09시~) 안에 하나라도 들어오면 line 111 `s.성공++` 에서 TypeError 로 아침 보고 전체가 죽는다. 지금은 sales.yml 이 꺼져 있어 잠복 상태. — `sales` 키를 빼거나 `셈[id] ?? 셈.pm` 로 받는다. 1분짜리.
- academy/scripts/wake.mjs 삽입 summary — `workflow_run · ${conclusion}`. company 출근기록은 `${r.event} · ${r.conclusion}` (예: `schedule · success`). 「같은 모양」이라 했으나 아니다. 지금 이 문자열을 파싱하는 곳은 없어(확인함) 기능 문제는 아니고, 사람이 읽을 때 원 트리거가 사라진다. — yml 에 `WF_EVENT: ${{ github.event.workflow_run.event }}` 를 넘겨 같은 형식으로 적는다.
- wake.mjs / company.mjs 중복 적기 — 둘 다 select 후 insert, `run_url` 에 unique 없음. company 가 완료된 실행을 옮기는 순간과 wake 가 뜨는 순간이 겹치면 한 실행이 두 줄 된다 → pm-report 성공/실패 이중 계산. 창은 몇 초라 드물다. — 부분 unique 인덱스 `create unique index if not exists agent_activity_run_url_uq on geo.agent_activity(run_url) where run_url is not null` + 양쪽 `on conflict do nothing`. 기존 중복 행이 있으면 인덱스 생성이 실패하니 먼저 확인. 5분 넘으면 BUILD-LOG Known Gaps.
- web/lib/agents.ts:332 — 매시 점검 늦음 문구 「다른 작업이 끝나면 깨웁니다」. 깨우기는 목록의 작업이 끝날 때만 돈다. 밤(자동 작업이 거의 없는 시간)에는 깨울 사람이 없으니 약속이 과하다. — 「다른 자동 작업이 끝날 때 깨웁니다」 정도로 조건을 드러내거나, BUILD-LOG 에 한계로 적는다.
- wake.yml concurrency — `cancel-in-progress: false` 여도 GitHub 은 대기 실행을 하나만 남기고 이전 대기분을 취소한다. 여러 작업이 몰려 끝나면 일부 기록이 wake 에서 빠진다. company 가 다음 차례에 옮기므로 손실은 없고 지연만 생긴다. 고칠 것 없음, 알고만 둔다.
- wake.yml 트리거 목록의 `sales`, wake.mjs `담당.sales`, agents.ts:116·320 의 sales 문구 — 꺼진 작업이라 무해. 다시 켤 때 되돌릴 자리 목록에 넣어 두면 된다.

## Escalate to Architect
- Claude 하루 몫 — MEASURE_EVERY_DAYS=1 이면 optimize(07:05)가 매일 claude-code-web 20문항을 부른다. claude-code.mjs:73-75 의 비측정 몫은 「오늘 전체 호출 수 < 40-20」 이라 측정이 20회를 쓰면 그날 남은 시간 writer·illustrate·audit·repair 는 전부 상한에 막힌다. 3일 주기 때는 이틀은 비었는데 이제 매일이다. 특히 이번 단계가 겨냥한 경우 — 06:35 감사가 건너뛰어져 90분 뒤 대신 띄워지면 07:05 측정 뒤라 감사의 Claude 호출이 막힌다. 또 CLAUDE_DAILY_MAX 는 repair.yml·sales.yml 만 넘긴다(optimize·company·audit 는 기본 40) — 레포 변수만 올려서는 측정·집필 쪽에 안 먹는다. 상한을 올릴지, 예약분 계산을 「측정 외 호출 수」로 바꿀지, 매일 측정의 문항 수를 줄일지는 구독 비용·우선순위 결정이라 코드에서 정하지 않는다.
- 깨우기의 한계 — wake 는 목록 작업이 「끝날 때」만 돈다. 9/24 아침처럼 예약 자체가 한꺼번에 건너뛰어지면 끝나는 작업이 없어 깨울 계기도 없다. 53분 두 번째 cron 이 이 경우의 유일한 보험이다. 외부 cron(Vercel cron 등)으로 dispatch 를 한 겹 더 둘지 판단 필요.

## Cleared
확인한 것: workflow_run 이름 10개가 각 yml `name:` 과 일치. 루프 — company 가 트리거 목록에 없고 wake 는 매시 점검이 완료 상태이면서 55분 이상 지났을 때만 dispatch 하므로 폭주 없음(최대 55분에 1회). company 의 대신 띄움은 슬롯당 1회. GITHUB_TOKEN 으로 띄운 실행에 workflow_run 이 안 걸리거나 깊이 제한에 걸려도 결과는 「wake 가 안 뜬다」뿐이고 company 가 옮겨 적으니 안전한 쪽으로 실패. 권한은 contents:read·actions:write 뿐, 비밀은 DATABASE_URL 하나, 이벤트 값은 env 로 넘겨 스크립트에 끼워 넣지 않고 SQL 은 매개변수화. sparse checkout(cone)은 academy/package.json 을 포함하고 wake.mjs 는 pg 만 불러 충분(company.yml 과 같은 설치 방식). 90분 문턱·「대신 돌리는 중」 판정(ok 인 밀린 예약 실행, `${wf} —` 접두, 슬롯 이후)이 company.mjs 적는 모양과 맞다. 대시보드에 sales 역할을 참조해 깨지는 곳 없음(AgentBoard·ops.ts 의 sales 는 리드 지표로 별개). node --check 3파일 통과, web tsc 통과.
