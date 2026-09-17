# Review Feedback — Step 7 매일 AI 추천 개선 루프 (재검토)
Date: 2026-09-17
Ready for Builder: YES
Verdict: PASS

## Must Fix
없음. 1차 검토의 1~5 모두 반영 확인. `node --check` 두 파일 통과.

1. IndexNow 거짓 완료 — daily-agent.mjs:97-101 `색인알림()` 이 종료코드 0 과 「접수됨」 출력을 함께 본다. 발행 확인(141)·기존 글 재알림(302) 두 경로 모두 사용. 해결.
2. 사다리 건너뜀 — daily-agent.mjs:267 `질문:` 라벨, 315 `continue 질문`. 대기 초안이 있으면 offsite 로 안 넘어가고 다음 질문으로. 해결.
3. 미발행 초안 영구 잠금 — daily-agent.mjs:148-153 14일 지나면 verdict='미처리'('초안 14일 미발행'), 글은 유지. 같은 실행의 `r.verdict` 도 바꿔 `열림`·`대기초안` 계산에서 빠진다. 해결.
4. 홈 fetch 실패를 사람 일로 기록 — daily-agent.mjs:275-283 `fetched=false` 면 status 실패 + exitCode 1. 실패 행은 `열림` 에서 빠진다. 해결. 판정 단계의 entity 재확인(157-167)도 fetched·ok 둘 다 요구 — 맞다.
5. groq 본문 URL 인용 — ai-measure.mjs:80-91 cited 는 executed_tools 에서만, 본문 URL 은 raw.answer_urls(170). 해결.

## Should Fix
- daily-agent.mjs:87 — `--id` 뒤 값이 숫자가 아니면 NaN 이 거짓으로 읽혀 조용히 오늘 행을 닫는다. `--id` 가 있는데 숫자가 아니면 오류로 끝내는 편이 안전하다. 막지 않는다.

## Escalate to Architect
없음. offsite 14일 반복, 겹침 0.4 기준, 발행 경로 알림 실패 시 완료 유지, --dry DDL 은 Arch 결정으로 수용.

## Cleared
Step 7 전체(ai-measure·daily-agent·write-draft·optimize.yml·ops.ts·AgentBoard·schema.sql)와 Must Fix 1~5 반영분을 검토했고 통과.
