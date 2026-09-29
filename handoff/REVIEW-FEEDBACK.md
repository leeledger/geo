# Review Feedback — Step 22 (2차)
Date: 2026-09-29
Ready for Builder: YES

판정: PASS — 막는 항목 없음. 1차 치명·중요 둘 다 풀렸다.

확인: `node academy/scripts/daily-agent.mjs --review` 종료 0 (58/120 · 오늘 claude-code-web 10/20 · 점검 4건 — 1차와 같음). web `tsc --noEmit` 종료 0.

## 1차 Must Fix 확인
- [치명 → 풀림] p* 가 ai_measurements 로 가는 길: 없다.
  - ai-measure `적재()` 는 `x.form` 이 있을 때만 ai_probe_measurements 로 간다. 승인 문항 쿼리(ai-measure.mjs:233-236)는 form 을 안 고르고, 탐침 쿼리는 `p.form`(열이 `not null default 'sentence'`)을 고르니 탐침은 늘 새 표로 간다.
  - 저장소 전체 grep: ai_probe_* 에 쓰는 곳은 ai-measure(측정)·daily-agent(질문)뿐. tools/ai-web-measure.mjs 는 탐침을 안 읽는다. case-report·ops·growth·pilots·pm-report·verdict·audit·asks 기존 함수는 ai_measurements 만 읽고 손대지 않았다.
  - daily-agent 판정용 `rows`·`엔진별`·facts.engines 는 ai_measurements 만. 탐침 행은 점검rows(union)로만 loop-review widen 에 간다.
- [중요 → 풀림] stalled: 기준 오늘-14, 원인 문장 삭제, 판정rows 로 엔진별 `전 n건 · 후 n건`. DB 숫자만 쓴다.
- /admin/asks: `readProbeGrid()` 는 새 함수이고 따로 표만 읽는다. readAskDays·readAsks·readAskGrid 는 안 바뀌었다 → 기존 격자·날별 숫자 그대로. 제목에 「승인 20문항과 따로 셉니다」, 설명에 「위의 숫자·효과 판정에는 넣지 않습니다」. 사람 말, keep-all 은 페이지 전체에 걸려 있다.

## Must Fix
(없음)

## Should Fix
- [중요] tools/local-agent.mjs 「확인 불가」 길 — attempts 를 안 올리고 상한도 없다. Brave 가 원장 PC IP 에 계속 캡차를 주면 local-agent 가 돌 때마다 브라우저를 열어 같은 캡차를 두드리고, 사람에게는 끝내 안 간다. evidence 에 한 줄씩 쌓인다. 또 brave-index-check 의 「결과 없음」 문구 목록에 ko-KR 화면의 실제 문구가 맞는지 확인되지 않았다. 안 맞으면 진짜 없는 글도 영원히 「확인 불가」가 된다.
  권장: 확인 불가가 3번 연속이면 출력 모자람과 같이 `사람 대기` + 「Brave 확인이 캡차·빈 화면으로 3번 막혔습니다. 원장 PC 에서 node tools/brave-index-check.mjs <slug…> 로 직접 확인해 주세요」. 5분 넘으면 BUILD-LOG Known Gap 으로.
- [사소] web/app/admin/asks/page.tsx — `readProbeGrid` 가 기존 두 읽기와 한 `Promise.all`·한 try 안에 있다. 탐침 쪽이 던지면 그날 질문 목록·격자까지 빈다. `readProbeGrid(client, 14).catch(() => null)` 로 떼어 둔다.
- [사소] ai-measure.mjs `적재()` — 표를 `x.form` 있음으로 고른다. 지금은 맞지만, 나중에 승인 문항 쿼리에 form 같은 열이 붙으면 승인 문항이 탐침 표로 샌다. `/^p\d+$/.test(x.prompt_id)` 로 고르거나 인자로 표를 넘기면 더 단단하다.

## Escalate to Architect
(없음. agent `deliver` 는 Arch 승인 확인)

## Cleared
탐침 별도 표, stalled 14일·곳별 건수, Brave 확인 불가, 35분 문항별 확인, 3회 실패 상한, narrow·repeat 표본 조건, right() 로 바꾼 것까지 봤다. 영업 숫자로 가는 길에 탐침이 섞일 자리는 없다. Step 22 is clear.
