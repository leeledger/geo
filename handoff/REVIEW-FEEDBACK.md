# Review Feedback — Step 17 (2차)
Date: 2026-09-24
Ready for Builder: YES

## Must Fix
(없음)

1차 Must 해소 확인 — company.mjs:434-436 sales.yml 은 다시 띄우지 않고 `관찰`, nextTry `다음월요일("08:40")`. 월요일 08:10 예약이 성공하면 wf-sales.yml 은 「신호 사라짐」으로 닫히고, 또 실패하면 08:40 이후 한 번 집혀 다음 주로 넘어간다. 입력 분기(`inputs.mode`) 삭제됨 — 나머지 작업은 `{ ref: "main" }` 만 보낸다.

## Should Fix
- web/app/page.tsx:50 (FAQ) — 「두 회사를 본 것이라 법칙으로 말하진 않습니다. 그래서 손볼 곳이 다릅니다.」 순서 탓에 「그래서」가 단서 문장에 걸려 말이 안 이어진다. 「그래서 손볼 곳이 다릅니다」를 단서 앞으로 옮기거나 단서를 맨 끝으로. 1분 일.
- academy/scripts/write-news.mjs:202 — 주석 「재료를 달라고 한다」가 남았다(1차 목록에서 빠뜨린 줄). 「그 주는 건너뛴다」로.

## Escalate to Architect
(없음 — 영업 자동 재시도 제외, 무한 재시도 비용 수용은 Arch 가 결정해 BUILD-LOG 에 적힌 것으로 본다)

## Cleared
2차 반영 전부 확인: 다음월요일(hm) 월요일 그 시각 전이면 오늘(계산 검증), 죽은 사람 대기 분기 삭제(첫 실패 블록 무조건화, 도달 불가 코드 없음), company·write-news·write-draft 낡은 주석 정리, write-draft 게이트 2회 호출부 `{detail}`, agents.ts 수리 「다음 06:50 예약」·영업 「다음 월요일 08:10 예약」이 실제 동작(repair 관찰 24h, sales 관찰 다음 월요일)과 맞음, services.ts 화장실 사례 제거, node --check 5개 통과 — Step 17 통과.
