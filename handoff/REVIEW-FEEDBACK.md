# Review Feedback — 성인 AI 업무자동화반 글 2편·랜딩 커리큘럼 재작성
Date: 2026-09-28
Ready for Builder: YES (2차 확인 통과)

## Must Fix
- academy/app/ai-work/page.tsx:339-341 (CSS 202-204) — 준비물·대상·방식 .aw-card 가 paper 섹션 안에 들어갔는데 paper 덮어쓰기가 없다. 본문 p 가 var(--fg-2)=#AFBACB 로 #FAFAF8 위에서 대비 약 1.9:1, 테두리 rgba(255,255,255,.1) 는 안 보이고, .k 는 cyan. — 233-234 줄처럼 `.paper .aw-card{border-color:var(--paper-line);background:var(--paper-card)}` `.paper .aw-card p{color:var(--paper-ink-2)}` `.paper .aw-card .k{color:#B5760A}` 추가.
- academy/app/ai-work/page.tsx:215 — .aw-cur .n (01회~08회) 색이 var(--amber)=#F5A623, paper 위 대비 약 1.9:1. — section.paper .lab 처럼 #B5760A 로.
- academy/scripts/seed-post-ai-work-owner.mjs:86-90 (+ shop.svg 마지막 줄) — 「블로그 여러 곳에 올리기 · 과정에서 배운 도구 조합 · 6~8회」는 CURRICULUM 어느 회차에도 없다. 학원이 쓰는 tools/naver-blog-post.mjs 는 사람이 로그인한 브라우저를 Playwright 로 모는 코드다. n8n·Make·Apps Script 로 네이버 블로그에 서식째 올리는 건 이 과정 도구로 약속할 수 없다. 수강생이 8회에 이걸 골랐다가 못 만들면 사과할 일이 된다. — 8번을 「과정에서 만드는 것」에서 빼고 「학원에서 실제로 쓰는 자동화」 절에만 두거나, 7가지로 줄이고 제목·요약·도해를 같이 고친다. 8가지를 지키려면 CURRICULUM 에 실제로 있는 실습으로 채운다(예: 6회 「매일 아침 요약 리포트」).

## Should Fix
- seed-post-ai-work-gap.mjs:142-143, owner.mjs:113-114 — 「과정: 8회」 바로 아래 「수강료: 월 4회 200,000원」. 읽는 사람은 과정 전체가 20만 원이라고 읽는다. 8회=두 달이면 총액이 달라진다. — 「8회(월 4회 × 2개월)」로 적는다. 총액을 적을지는 원장 결정(아래 Escalate).
- gap.mjs:129 — 「목차를 여러 개 살펴봤습니다」. 금지어(숫자 피하기)다. research §8 기준 강의 8곳 — 「8곳」으로.
- owner.mjs:38 — 「사장님들이 가장 많이 고를 만한」은 잰 적 없는 추정. — 「업무자동화 강의 실습에 자주 나오는 것 가운데 가게 일에 맞는 것」처럼 근거대로.
- gap.mjs:148, owner.mjs:119 — [..](/ai-work) 상대 주소. naver-blog-post.mjs:328 이 「글자 + 주소」로 풀어서 네이버에는 「/ai-work」만 남는다. — https://robotncoding.com/ai-work 로.
- owner.mjs:44·50·56… — 「**1. 예약·문의 답장 초안**」은 에디터에 「1. 」로 타이핑된다(toBlocks 는 ** 로 시작하는 줄을 일반 문단으로 넘김, typeRich 가 굵게 처리). 스마트에디터 ONE 이 줄 첫머리 「1. 」+공백을 번호 목록으로 자동 변환하면 뒤따르는 「· 지금:」 줄까지 번호가 이어진다. 확인 안 된 위험이다. — 네이버 이관 후 화면을 다시 읽어 확인하거나, 처음부터 「1) 」 대신 번호 없는 소제목+(n회)로 쓴다. 본문 「8번은」 참조도 같이.
- owner.mjs:108 — 「구글 과정이 9월 29일부터 11월 3일까지」. 내일 시작이라 발행 며칠 뒤면 신청이 닫혔을 수 있다. — 날짜를 빼고 「2026년 하반기 과정(참가비 없음)」+ 기사 출처로, 또는 「9월 기사 기준」을 붙인다.
- page.tsx CURRICULUM 6회 tools 「텔레그램」, 2회 tools 「NotebookLM」 — 글 A 의 같은 회차에는 없다. 모순은 아니나 한쪽을 고치면 둘 다 고치라는 주석이 있으니 맞춰 둔다.

## Escalate to Architect
- 8회 과정의 총 수강료(월 20만 원 × 2개월 = 40만 원)를 글·랜딩에 적을지 — 가격 표기는 원장 결정. 지금 표기는 틀리진 않았지만 오해를 부른다.

## Cleared
slop(단정문 연타·「~가 아니라 ~입니다」 반복) 은 빠졌고 모집 글 구성(research §8 (c))을 따른다. 커리큘럼 순서는 §8 (a) 공통 뼈대와 맞다. 글 A·랜딩·글 B 회차 번호 1~7 일치, 수강료·주소·전화·부가세 표기 일치, 후기·정원·개강일 약속 없음, 원장 이력은 기존 랜딩 근거, SVG 날 & 0건, 빌드 문제 없음.

## 2차 확인 (2026-09-28)
Must 1~3, Should 7건 전부 반영 확인. 남은 것: owner.mjs:8-9 머리 주석 예시 목록에 「블로그 발행」이 남아 있으면 지운다(본문 영향 없음).
