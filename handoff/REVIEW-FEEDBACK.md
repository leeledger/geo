# Review Feedback — Step 13 (현황판 「성장 — 늘고 있나」) 2차
Date: 2026-09-22
Ready for Builder: YES
Commit reviewed: 7ae4e90 (배포됨)

## Must Fix
없음.

## Should Fix
없음.

## Escalate to Architect
없음. (ADMIN_TOKEN 교체 권고는 1차 그대로 — 원장이 정한다.)

## Cleared
- **중립·그대로 줄**: 중립은 기호 없이 「−110회 · 그 전 7일 673회 · 중립」으로 나온다. 그대로는 「그대로」가 한 번만 나온다(VERDICT_WORD same="").
- **비교 창(Arch 결정)**: 모두 어제(Y)에서 끝나고, 창 경계를 하나씩 대조했다.
  - 크롤러: Y-6~Y 대 Y-13~Y-7(range 14일을 slice 0-7 / 7-14 로 나눔). 쿼리 하한 `>= Y-13` 가 추세선 첫날(T-13)도 덮는다.
  - 발행: Y-6~Y 대 Y-13~Y-7.
  - 에이전트 실패·활동: 발행과 같은 창.
  - 문의: `day > Y-30 and <= Y` 대 `> Y-60 and <= Y-30`.
  - 리드·진단: `Y-29..Y` 대 `> Y-60 and <= Y-30`.
  - 커버리지: Y 대 Y-7 로 비교한다. 머리 값은 오늘까지 누적한 현재 상태로 둔다.
  모두 30일·7일 경계가 맞고 겹치거나 빠지는 날이 없다.
- **오늘 표시**: 오늘은 추세선에서 빠지고, 흐린 속 빈 점으로 따로 그려진다(y 축 최대값에는 넣어 잘리지 않는다). aria-label 에 「진행 중, 비교에 안 씀」이 붙고, sub 문장도 이를 밝힌다.
- **경쟁 검색어·AI 측정**: 하루 한 번 재는 값이라 엔진이 다 돈 날이면 오늘도 쓴다(Arch 승인 예외). 비교 창이 아니라 회차 비교라 맞다.
- **크롤러 분류**: 봇 이름으로 가른다. `web/lib/crawler-class.ts` 는 bots.ts 의 두 칸을 옮긴 것이다(Applebot=검색, Applebot-Extended=AI). 어느 칸에도 없거나 bot 이 null 이면 「기타」로 따로 센다 — AI 로 부풀리지 않는다. `node web/scripts/check-crawler-class.mjs` → AI_BOTS 20 · SEARCH_BOTS 5 같음(종료 0)을 직접 돌려 확인했다. case-report.mjs(c1bd826)도 같은 bots.ts 경계로 가르니, 원장 화면과 공개본의 「AI 방문」이 한 정의다.
- **주별 크롤 수**: 착수일(KST 자정)부터 세고, 검색·AI·기타 세 칸이다.
- **1차 Cleared 항목**: 파라미터 쿼리, 스키마 검사, 고객사 필터, 증감률 없음, 빈 상태 문구, 차트는 그대로다.
