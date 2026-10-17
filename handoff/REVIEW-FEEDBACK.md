# Review Feedback — Step 52 (네이버 자동 재로그인) · 2차
Date: 2026-10-17
Ready for Builder: YES

## Must Fix
없음.
- 1차 Must Fix(dead 「로그인 창 열기」 버튼) — 해결. D185 로 키를 `naver-session-soon` 으로 바꿨다(tools/auto-login.mjs:117,123).
  - 이제 `todo-text.ts:225` 의 `/^login-/` 분기에 안 걸린다. 창요청의 `like 'login-%'` 조건에도 안 걸린다.
  - `^naver-` 접두로 일감을 따로 처리하는 곳은 grep 으로 찾아도 없었다. company.mjs 는 sticky 일감을 건너뛴다.
  - 시험 test-auto-login.mjs:116-133 은 세션경고가 실제로 넣는 키를 SQL 에서 뽑는다. 그 키를 실제 todo-text.ts 에 넣어 action ≠ login 을 확인하고, login-naver 와 대조도 한다.

## Should Fix
없음(1차 항목 모두 반영).
- 비번틀림을 캡차보다 먼저 본다 — auto-login.mjs:156-160. `비번먼저` 는 클릭 뒤 판정(249행)에서만 켠다. 클릭 전 판정(201행)은 그대로다. 「비번틀림+캡차 → bad」 시나리오를 더했다.
- 비번 칸 선택자 — auto-login.mjs:134 `input#pw[type="password"], input[name="pw"][type="password"]`. 「글자칸이면 모르는화면·입력 0·제출 0」 시나리오를 더했다.

## Escalate to Architect
없음. Acceptance 5 는 D186 으로 정했다(원장의 첫 save-login 이 실측).

## test-login-live 를 안 돌린 결정 — 확인함
`git status` 와 `git diff` 로 확인했다.
- web/ 전체와 tools/login-poll.mjs·open-session.mjs·login-rules.mjs 는 변경이 없다.
- 바뀐 추적 코드는 tools/local-agent.mjs 와 tools/naver-blog-post.mjs 둘뿐이다.
- local-agent 의 `사람로그인` 은 login-naver 행의 evidence·detail 만 바꾼다. test-login-live 는 자기 일감 행을 직접 넣고 login-poll 을 돌리는 시험이라 이 함수를 거치지 않는다.
- 그래서 이 단계는 live 시험이 덮는 경로를 건드리지 않는다. 결정에 동의한다.

## Cleared
1차 Must Fix 와 Should Fix 반영을 확인했다. 시험 결과는 test-auto-login 138 통과·0 실패, test-login 56 통과·0 실패다(--live·실제 네이버는 안 돌림). 1차에서 통과한 보안 항목(argv·오류 경로·.secrets 무시·20h·bad·학원 프로필 한정·stealth 없음·login-naver 경로)은 이번 변경으로 달라지지 않았다.
