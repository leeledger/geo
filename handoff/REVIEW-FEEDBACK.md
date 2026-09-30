# Review Feedback — Step 30 (아이로그를 학원과 같은 수준으로 D34~D37 + Arch 결정)
Date: 2026-09-30
Ready for Builder: YES

검토 범위: da1295d · 198530f (코드 22 파일). DB 는 읽기만 했다.

## 직접 돌린 것
- `node scripts/test-ilog-loop.mjs` → 23 통과 · 0 실패
- tsc --noEmit → web 0 · academy 0
- 학원 불변: 1e5c85a 의 daily-agent·loop-review 를 임시 파일로 꺼내 `--dry` 출력과 지금 `--dry` 출력을 diff → **글자까지 같음**(20줄). 임시 파일은 지웠다
- `daily-agent --dry --client ilog` → 「측정 없음 · 실패」 기록 줄, 종료 0
- `pm-report --dry` → 학원 줄 그대로, 한 줄 추가 「아이로그: AI 답변 측정 없음 — 승인된 질문 0개 · 방문 기록 없음 · 열린 일감 7건」
- `seed-ilog-panel.mjs` (dry) → REVIEW-REQUEST 원문과 같음
- DB 읽기: 학원·아이로그 둘 다 relation='자사'(학원은 slug 로 먼저 걸러져 「학원」 묶음 — 시험 118행이 덮음). `pilots UNIQUE(client_id)`·`pilot_questions UNIQUE(pilot_id, position)` 운영 DB 에 있음 → seed `--apply` 두 번 돌려도 파일럿·질문 중복 없음. stage 에 CHECK 제약 없음 → `keyword` 가 거부되지 않는다. 오늘 아이로그 파일럿 없음 → `고객측정일` false → 40·22·60

## Must Fix
없음.

## Should Fix
- academy/scripts/company.mjs:660 + :219,227 (confidence: 7) — 세션 글 일감이 세션에서 끝난(완료) 뒤 24시간 쿨다운만 지나면 who-wins(주 1회)가 같은 키로 `일감()` 을 불러 「세션 대기」로 다시 연다(`when geo.agent_tasks.status = '완료' and geo.agent_tasks.done_at < now() - make_interval(hours => $11) then $9`, `t.cooldownH ?? 24`). 7일 판정 창이 끝나기 전에 같은 가이드를 다시 쓰라는 일감이 선다. 무한 루프는 아니나(주 1회) 세션 몫이 계속 불어난다 — session 분기에서 `cooldownH: 24 * 30` 정도를 넘길 것. Bob 이 Open Questions 에 적은 것과 같은 건
- academy/scripts/daily-agent.mjs:106 (confidence: 6) — 새 일감 키가 `qdraft-sha1(질문)` 인데 회사 루프는 `qdraft-sha1(it.query)`(company.mjs:652). daily-agent 가 먼저 만든 질문을 who-wins 가 나중에 다른 검색어로 잡으면 키가 달라 같은 질문 세션 일감이 둘 선다. 판정은 질문 글자로 찾으니 틀리진 않지만 「세션 몫 n건」이 부푼다 — company.mjs 쪽도 세션 고객이면 먼저 질문 글자로 기존 일감을 찾게 하거나 키를 질문으로 맞출 것. verify this
- academy/scripts/daily-agent.mjs:246 (confidence: 7) — 14일 닫기는 `agent_runs` 행만 「미처리」로 두고 짝 `agent_tasks` 는 「세션 대기」로 남는다(sticky 라 회사 루프도 안 닫는다). 현황판 「세션에서 할 일 n건」에 죽은 일감이 쌓인다. 닫을 때 같은 질문의 세션 대기 일감에 evidence 한 줄을 남기거나 닫을 것
- academy/scripts/daily-agent.mjs:589 (confidence: 8) — `--session-done` 이 DRY 확인 전에 돈다. `--dry --session-done 28 x` 도 DB 를 쓴다. `if (DRY)` 이면 찍기만 하게 한 줄
- academy/clients.mjs:84 (confidence: 6) — 「(주)아이로그」만 뺀다. 한국어 답은 「㈜아이로그」(한 글자)·「주식회사 아이로그」도 흔히 쓴다 → 동명 SI 회사를 우리로 센다. `(?<!(?:\(주\)|㈜|주식회사)\s?)아이로그` 로 넓히고 시험 두 줄 추가. seed 가 이 원문을 DB 에 넣으니 `--apply` 전에 고치면 한 번에 끝난다
- academy/scripts/test-ilog-loop.mjs (confidence: 7) — 「세션 대기」 생명주기(세션일감 재사용·판정 창 열기·14일 닫기·--session-done 거부)는 시험이 없다. DB 경로라 가짜 q 로 `세션일감`·판정 분기만 떼어 시험할 것. 이번 단계 새 상태의 핵심 경로다
- academy/scripts/ai-measure.mjs:228 (confidence: 5, 참고) — seed `--apply` 뒤 승인 전 날에는 아이로그가 대상에 들어가 `나눔` 이 참이 된다 → 학원 줄 앞에 「로봇&코딩학원 · 」 머리가 붙고 탐침 요약 순서가 바뀐다. 상한(22)·측정 문항은 같다. 학원 출력 비교할 때 헛짚지 않게만 알아 둘 것

## Escalate to Architect
- q8~q12 는 아이로그 가이드 5편 제목을 그대로 옮겼다. 답하는 페이지가 이미 있는 질문을 그 제목 글자 그대로 물으면 검색이 그 페이지를 집기 쉽다 — 20문항 중 5문항이 우리 쪽으로 기운 채 기준선이 잡힌다. 영업 숫자로 쓸 때 「자기 글 제목 질문」을 따로 떼어 보이거나, 원장이 학원장 말투로 바꿔 승인하는 편이 정직하다. 문장도 제목체다 — 「학원 관리 프로그램, 무엇을 보고 골라야 하나요?」처럼 쉼표로 끊는 꼴은 사람이 채팅창에 안 친다. q11 「AI가 대신 쓰면 선생님은 무엇을 하나요?」는 학원장이 물을 말이 아니다. q12(영어 내신 예상 문제)는 「학원 관리 프로그램」 축에서 벗어난다. 막는 항목 아님 — 원장 판단
- q1~q7·q13~q17 은 실제 일감·검색어 원문이라 괜찮다. q20 은 자사 FAQ 원문이라 brand 로는 무난
- Open Question 「i-log 표기 제외」「ilog 단독 제외」는 Arch 결정(i-log 제외)과 맞다. 동의

## Cleared
학원 동작(daily-agent dry 출력 글자 단위 동일·측정 순서 유료→학원→자사→탐침·학원만 있는 날 40·22·60·pm-report 학원 줄), 「세션 대기」가 회사 루프 실행기(대기만 집음)·신호 사라짐 닫기(목록 밖+sticky)·원장 할 일 집계(사람 대기만)·감사 R3·web 할 일에서 잘못 다뤄지지 않음, seed 의 dry 기본·`--apply` 멱등·measure_active, 아이로그 content 칸이 write-draft 에 닿지 않음(daily-agent.mjs:496 `draft === "session"` 분기가 :515 write-draft 호출 앞에서 return·continue, company.mjs:710 도 세션이면 posts 경로 전에 return)을 확인했다.
