# Review Feedback — AI 질문 기록 (/admin/asks) 2차
Date: 2026-09-29
Ready for Builder: NO

## Must Fix
- web/app/admin/asks/page.tsx:34-35,155 — 「그 전 날짜」 details(.ak-old)가 1차 5번과 같은 누수를 그대로 받는다: globals.css:451-457 의 테두리·배경·radius, summary padding 19px 22px, ::after 「+」. 지금은 측정일이 10일이라 안 보이지만 14일을 넘는 순간(며칠 안) 나타난다. — `.ak-old{border:0;border-radius:0;background:none;overflow:visible;box-shadow:none}` `.ak-old>summary{padding:0;font-weight:inherit}` `.ak-old>summary::after{content:none}` 추가.

## Should Fix
- web/lib/asks.ts:115,120 — 자동 곳끼리 n 이 같으면(Claude 20 · ChatGPT 화면 20) 순서가 쿼리 반환 순서에 달려 mainMethod 가 날마다 바뀔 수 있다. 격자·현황판 목록의 기준 곳이 흔들린다. — 마지막 비교에 `|| a.method.localeCompare(b.method)` 또는 claude-code-headless-websearch 우선.
- web/app/admin/ops/AskLog.tsx:47-53 — 요약은 곳 여러 줄인데 목록은 한 곳만이다. 목록 위에 「아래는 {곳} 질문만 · 다른 곳은 기록에서」 한 줄.

## Cleared
1차 Must 5건(whereOf 자동 판정, 곳별 분리, 격자 한 곳, AskLog 어디에, .ak-list 초기화)과 Should(safeUrl, 칩 14개, Growth 공통 질문, 「어제부터 한 일」, engineName) 반영 확인.
