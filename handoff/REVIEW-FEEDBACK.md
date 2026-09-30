# Review Feedback — Step 31 (성과가 개수로 늘어나는 고리 D38~D43)
Date: 2026-09-30
Ready for Builder: YES

검토 범위: ce9b5ae (코드 13 파일). DB 는 읽기 전용 트랜잭션으로만 봤다(탐침 줄 union SQL 이 실제 스키마에서 돈다 — ai_probe_measurements 는 아직 없어 빈 자리로 바꿔 확인, geo.pilots.competitors 칸 있음, agent_tasks.evidence NOT NULL default '').
실행: test-grow-loop 34/0 · test-ilog-loop 33/0 · web tsc 0 · daily-agent --dry(학원·아이로그) 정상.

## Must Fix
없음.

## Should Fix
- academy/scripts/daily-agent.mjs:187-203 (confidence: 8/10) — `전파중` 을 후퇴 분기보다 먼저 정한다(`전파중 = 원 ? {...} : null` → 그 뒤 `if (x.후퇴) { ... await 저장({ ... action_kind: "content" ... }) }`). 같은 단계의 「효과 있음」 처방이 content 면 후퇴 재색인 행 근거에 「전파: 행 #id … 「효과 있음」」이 붙는다. 전파가 아닌 행동을 전파로 기록한다 — 나중에 전파 성과를 셀 때 섞인다. 후퇴 분기 안에서 저장 전에 `전파중 = null`.
- academy/scripts/loop-review.mjs:459-467 (confidence: 7/10) — 「비교 못 함」(regressUnknown)은 후퇴가 하나라도 있을 때만 finding 에 붙는다(`if (후퇴.length) { ... (모름.length ? ...) }`). 불리던 질문이 최근 표본 모자람·엔진 바뀜이면 아무 데도 안 나온다. 설계서 「표본 모자라면 「모른다」」. 모름만 있을 때도 한 줄(finding 또는 콘솔) 남기기.
- academy/scripts/daily-agent.mjs:193-206 (confidence: 6/10, verify this) — 후퇴 재색인은 `점검.skipContent`(repeat: 이 단계는 글 고쳐도 못 읽음)를 안 본다. 지금 학원 problem·consider 가 skipContent 라 그 단계 질문이 후퇴하면 효과 없다고 판정된 처방을 또 한다. 사다리 칸(:211)과 같게 skip 이면 사다리로 넘기기.
- academy/clients.mjs:110 · loop-review.mjs:392-399 (confidence: 5/10, verify this) — 변형 「{기능} 앱」은 원 승인 질문에서 「추천」만 뺀 문장과 같을 수 있다(dry: q13 → 「학원 관리 앱」). 사실상 승인 질문과 같은 검색어가 확장 질문으로 올라가면 「확장 질문 k개 불림」이 20문항 밖에서 늘어난 것처럼 보인다. 원 질문 문장에서 틀 말만 뺀 것과 같은 변형은 건너뛰기 검토.

## Escalate to Architect
- D40 문턱(한 곳 7일 4번 이상)과 탐침 측정 몫(고객당 하루 2, 탐침마다 하루 1번, 가장 오래 안 잰 것부터)이 서로 맞지 않는다 — 학원은 활성 탐침이 이미 7개(p1~p7, dry 사슬)라 돌려 재면 탐침 하나가 7일에 약 2번 잰다. 활성 탐침이 3개를 넘으면 승격 일감은 영영 안 선다. 확장 질문이 늘면 같은 몫을 나눠 「덜 잼」도 늘어난다(확장줄은 7일 2번 필요). 문턱을 낮출지(예: 14일), 탐침 몫을 늘릴지, 불린 탐침을 몰아 잴지는 측정 예산·기준 판단이라 코드에서 못 정한다.
- D41 은 학원만 탄다(gaps 는 widen 분기에서만 계산, KG-31-4). 아이로그는 「안 불린 변형」이 세션 글로 안 이어진다 — 의도인지 확인.

## Cleared
영업 숫자 격리(확장 질문 approved=false → ai-measure·ai-web-measure·daily-agent·pilot-report·pm-report 승인 집계·measure-targets approved_n 전부 `approved` 로 걸러 안 섞임, 측정은 form 'extend' 로 ai_probe_measurements 에만, 승인 버튼·패널은 extend 제외, 케이스 리포트는 ai_measurements 만 읽음), 확장줄은 고객별·곳별로만 세고 곳 안 합침, 전파는 하루 1건·열린 초안 규칙·원래 판정 그대로이고 전파 칸이 열림 처리돼 반복 루프 없음, 후퇴 조건(앞 14일 ≥50% · 최근 7일 ≤25% · 양쪽 5건 · 같은 곳·같은 엔진)과 50% 필터 우회, 승격 30일 쿨다운·완료 재개 안 함·「했어요」→확장넣기(글자 중복·payload.extend 한 번만·탐침 끔), 세션 글 1편·재료 필요, 경쟁사 없는 날 정렬 불변, 탐침은 승인 20문항을 다 잰 뒤 남은 몫에서만 돌아 승인 측정을 밀지 않음 — 확인했다.
