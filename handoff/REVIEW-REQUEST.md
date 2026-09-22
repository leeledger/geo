# Review Request — Step 13 · Richard 1차 반영 + Arch 결정(완전한 날만 비교)
Date: 2026-09-22
Ready for Review: YES

## Files Changed
- web/app/admin/ops/Growth.tsx:113-137 — **Must** Change: 중립은 기호 없이 「−110회 · 그 전 7일 673회 · 중립」. flat 은 「– 그대로 · 9/15 4개」(뒤 「그대로」 글자 뺌)
- web/app/admin/ops/Growth.tsx:140-178 — Spark `live`: 마지막 값(오늘)은 선·강조 점에서 빼고 흐린 속 빈 점. aria-label 끝에 「오늘 9/22 41회(진행 중, 비교에 안 씀)」
- web/app/admin/ops/Growth.tsx:199-230 — 비교 창 끝 = 어제. 커버리지 변화 = 어제 대 그 7일 전(「+4쪽 · 9/14 1쪽 → 9/21 5쪽」), 값은 지금 누적. 크롤러 합에 기타 포함
- web/app/admin/ops/Growth.tsx:276 부근 — sub 「어제까지 7일을 그 전 7일과 … 오늘은 진행 중이라 비교에서 뺐습니다」, 판정 줄 이름 「어제까지 7일」, 값 꼬리표 「어제까지 7일/30일」. 주별 표 크롤러 칸 검색/AI/기타
- web/lib/growth.ts:111 — `Y = 오늘-1`. 크롤 236 · 발행 259 · 문의 294 · 사이티드 309 · 에이전트 324 가 전부 Y 로 끝나는 창(7일 = Y-6..Y, 그 전 = Y-13..Y-7, 30일 = Y-29..Y, 그 전 = Y-59..Y-30). 발행 sinceDays·주별 막대는 오늘 기준 그대로(이번 주는 부분 주)
- web/lib/growth.ts:236-257, 336-346 — **Should** 크롤러 분류를 vendor 대신 `bot` 이름으로: crawler-class 의 SEARCH_BOTS/AI_BOTS, 어느 쪽도 아니면(또는 bot null) 기타. 주별 요약 크롤 수에 `seen_at >= startedOn(KST 자정)`
- web/lib/crawler-class.ts — 새 파일. academy/lib/bots.ts 두 칸의 봇 이름 사본(web 은 Vercel 에 web/ 만 올라가 academy 를 못 읽는다). Applebot = 검색
- web/scripts/check-crawler-class.mjs — 새 파일. bots.ts 를 case-report.mjs 와 같은 정규식으로 읽어 두 목록이 같은지 본다. 지금 「AI_BOTS 같음 (20) · SEARCH_BOTS 같음 (5)」

## 숫자 (2026-09-22 KST, 창 끝 9/21)
- 크롤러(봇 이름 분류): 검색 232 · 그 전 272 / AI 331 · 그 전 401 / 기타 0 — 따로 SQL 로 같은 값 확인
- 에이전트 실패 24 · 그 전 3 (따로 SQL 확인), 활동 154
- 발행 어제까지 7일 1편 · 그 전 12편 (9/08~9/14 에 12편)
- 커버리지 빙 9/14 1 → 9/21 5 (+4), 값 5/47
- 경쟁 4/6(9/22) vs 9/15 4 그대로 · AI 는 이전과 같음 · 문의 2 · 리드 0
- 주별 표 첫 주 43/128/0 (전에는 vendor 분류로 42/129 — Applebot 1회가 검색으로 옮김)

## 판단이 들어간 곳 (Arch 확인 바람)
- **경쟁 검색어·AI 측정은 오늘 값을 쓴다.** 둘은 7일 창이 아니라 하루 한 번 재는 스냅샷이고, 경쟁은 이미 「엔진이 다 돈 날」 규칙이 불완전한 날을 거른다. 어제까지로 자르면 9/22 네이버 웹문서 1위 첫 등장이 칸에서 사라지고 9/20 값이 뜬다. sub 에 이 예외를 적었다. Arch 결정 「any comparison」 을 글자 그대로 따르라면 rival 의 latest 를 `day <= 어제` 로 거르는 한 줄이다
- 오늘 점을 흐리게 그리는 추세선은 누적/합계 두 개(커버리지·크롤러). 경쟁 추세선은 위 이유로 오늘 점이 보통 점

## 화면 (스크린샷: C:\Users\force\AppData\Local\Temp\claude\)
- growth-robotncoding-1280.png · growth-robotncoding-390.png · growth-ilog-1280.png · growth-ilog-390.png
- growth-hover-1280/390.png · growth-hover-right-1280/390.png · growth-keyboard-1280/390.png · growth-table-1280/390.png
- growth-tile-crawl.png · growth-tile-coverage.png (2배 확대 — 중립 줄, 속 빈 오늘 점)
- 1280·390 × robotncoding·ilog: 가로 스크롤 없음, 콘솔 오류 0. tsc 0

## Out of Scope (BUILD-LOG)
- case-report.mjs 는 손대지 않았다 — 이미 bots.ts 두 칸으로 가른다. web 사본과 원본이 어긋나면 check 스크립트로만 잡힌다(자동 실행은 아직 없음)
