# Review Request — Step 45 (/ai 초등 AI 교육 페이지 · AI 교육 검색어 측정)
Date: 2026-10-13
Ready for Review: YES
Status: DONE_WITH_CONCERNS — 빌드·시험 다 통과. 단, kind 점검에서 경쟁으로 세는 곳 1개 발견(아래 Escalate). 배포·7번은 안 함

## Files Changed
- academy/content/ai.json (새) — 브리프 잠긴 문구 글자 그대로. 키: title·description·lab·h1[2]·lead[2]·stages·course·roles(afterLink)·no.cards(3번째만 link)·made(link)·adult(link)·tuition(rows·note)·faq[3]·postsH2·posts[4]·schemaDescription
- academy/app/ai/page.tsx (새) — /ai-work 꼴. metadata(title·description=ai.json, canonical "/ai"), aw* CSS 중 쓰는 것만 복사(+ `.more` 링크, `.aw-posts`, paper 표 선 2줄), CTA 위·아래(전화·카카오, aw:259-260 주소). SCHEMA @graph: Course(#course, 브리프 필드 그대로, offers·courseSchedule 없음) + FAQPage(ai.json.faq map)
- academy/components/Nav.tsx:7 — `/#ai AI 리터러시` → `/ai AI 교육`
- academy/content/home.html:8 — nav 같은 교체 · :437 — #ai 절 lead 문단 바로 뒤 「단계별 AI 수업 자세히 보기 →」 1줄. 푸터 #ai·#faq 손 안 댐
- academy/app/sitemap.ts:11 — /ai (monthly, 0.9), /ai-work 앞
- academy/public/llms.txt:363 — 주요 페이지 1줄 · :372-374 — 잠긴 「## 초등·중등 AI 교육」 절(성인반 절 앞)
- academy/clients.mjs:70-74 — 학원 queries a1~a4 kind 「AI교육」 + 주석
- academy/scripts/case-report.mjs:191,196 — at_start 를 (엔진·검색어) 첫 측정일과 비교 · :266 KIND 에 `AI교육: "AI 교육 검색어"`
- web/lib/brief-core.mjs:84,87 — firsts 의 s 를 창 함수 → 같은 group by 의 `min(checked_at)`, 주석 갱신
- academy/scripts/seed-probes-step45.mjs (새) — 잠깐DB, DDL(daily-agent.mjs:365 그대로), trim 글 비교로 멱등, max+1 번호, form keyword·source_prompt null·active true·created_on KST 오늘. **아직 안 돌렸다(7번 몫)**
- academy/scripts/test-ai-page.mjs (새) — 브리프 6번 항목 전부. 30 PASS

## 시험
- test-ai-page 30 PASS · 0 FAIL — 잠긴 글로 센 횟수가 브리프 숫자와 그대로 맞음(초등 AI 교육 2 · AI 수업 2 · AI 교육 기관 1 · AI 강의 1 · AI학원 0 · AI 교육 5). 숫자 덩어리 17개 전부 llms/home 에 있음
- test-faq-sync 23 PASS · 0 FAIL (그대로)
- 기존 test-*.mjs: 회귀 0. test-visit 은 고치기 전 트리(git stash)에서도 같은 오류(lib/visit.ts 로더 없음, 단계 밖). test-client-screen·test-login-live·test-new-client 는 --live 없으면 사용법만 찍고 1
- tsc academy 0 · tsc web 0
- next build: /ai ○ 정적. 렌더 HTML 확인 — `<title>송파 석촌동 초등 AI 교육 — 단계별 AI 수업 | 로봇&amp;코딩학원</title>`, canonical https://robotncoding.com/ai, h1, ld+json Course 1·FAQPage 1

## D108 처음 노출 — 운영 DB 전·후 비교 (10/13, 고치기 전에 돌림)
읽기 전용 스크립트(scratchpad)로 같은 DB 에서 옛 SQL·새 SQL 을 나란히 돌렸다.
- case-report serpFirst(학원): 20줄 → 20줄, **at_start 가 달라지는 줄 0**. 「처음 노출」(at_start=false) 5줄 그대로:
  - 09-18 naver 로봇앤코딩학원 석촌동 · 09-22 naver 송파구 석촌동 코딩학원 · 09-22 naver 송파구 코딩학원 · 09-26 naver_all 잠실 초등 코딩학원 · 09-26 naver 잠실 초등 코딩학원
- brief-core firsts(기간 없이 전체, 전 고객): 18줄 → 18줄, **빠짐 0 · 새로 듦 0**
  - 학원(1): 09-18 naver 로봇앤코딩학원 석촌동 · 09-22 naver 송파구 코딩학원 · 09-22 naver 송파구 석촌동 코딩학원 · 09-26 naver·naver_all 잠실 초등 코딩학원
  - 아이로그(2): 09-20 naver site:ilog.ai.kr · 09-20 naver·naver_all 아이로그 학원 · 09-20 naver·naver_all 아이로그 학원관리 · 09-23 naver 무료 학원 관리 프로그램 · 09-23 naver_all 아이로그 · 09-28 naver_all 무료 학원 관리 프로그램 · 10-02 naver 아이로그 · 10-08 naver·naver_all 학원 수업 리포트 앱
  - 문서딱(3): 10-05 naver_all 문서딱 · 10-07 naver 문서딱
- 결론: 지금 케이스 리포트·주간 보고에서 사라지는 「처음 노출」 없음. 지금까지는 검색어가 모두 엔진 첫 측정일부터 같이 재졌기 때문. 고친 효과는 a1~a4 를 재기 시작하는 오늘부터 난다

## kind 「AI교육」 점검 (브리프 4번)
- briefing.mjs:102·117 — 경쟁·브랜드만 집어 씀. AI교육은 무시. 문제 없음
- check-index.mjs:157 padEnd(5) 문제 없음 · :176-183 tally·rivalHit·brand 는 kind 정확 일치 — 문제 없음 · :166-167 콘솔 「질의 노출 x/y」 분모에 AI교육이 들어감(브랜드도 원래 들어감, 콘솔 전용) → KG-45-8
- scout.mjs:87-90 — `kind in ('브랜드','경쟁')`, `kind='경쟁'` — 안 섞임
- company.mjs — serp kind 를 읽는 곳 없음(일감 kind 뿐)
- web/lib/growth.ts:220·241 — `kind='경쟁'` 만 — 안 섞임
- case-report.mjs:262·284·286 — `kind === "경쟁"` — 안 섞임. 표에 「AI 교육 검색어」로 찍힘
- web/lib/post-auto-core.mjs:102 — `kind='경쟁'` — 안 섞임
- web/lib/brief-core.mjs:81 — 주간 보고 「검색어 몇 개」가 학원 10 → 14 로 는다(참인 숫자, 분모 아님)
- **web/lib/ops.ts:130 rivalTally — 경쟁으로 섞인다. 아래 Escalate**

## Escalate to Architect
- **KG-45-7 web/lib/ops.ts:123-138 rivalTally** — `const isBrand = r.kind ? r.kind === "브랜드" : isBrandQuery(r.query)` 라 「색인」「브랜드」가 아닌 kind 는 전부 rival 로 센다. AI교육 4개가 /admin/ops 「노출된 경쟁 검색어 N / 6」(AgentBoard.tsx:49-51)과 **공개 사이티드 랜딩 web/app/page.tsx:180-181·523-530 「0 → N / 6 … 「○○구 코딩학원」처럼 학원 이름 없이 친 검색 6개」** 를 10 으로 바꾼다. 브리프 Failure Mode 「측정 분모」 그대로다. 7번에서 check-index 기준선을 돌리는 순간(학원 최신 측정일 줄에 a1~a4 가 들어가는 순간) 랜딩 숫자가 바뀐다. 브리프대로 고치지 않고 멈췄다. 후보 수정(1줄): kind 가 있으면 `경쟁` 만 rival, `브랜드` 만 brand, 그 밖 kind 는 continue. **7번 네이버 기준선 전에 결정 필요**

## Open Questions
- /ai 에 잠기지 않은 UI 글자를 붙였다: 표 머리 「단계 · 대상 · AI를 다루는 자리」, 수강료 표 머리(h:1021 꼴), 3번째 「하지 않는 것」 카드 링크 문구 「관련 글 →」, FAQ 제목 「자주 묻는 것」(/ai-work 와 같음), lab 영문(Stages·Course·Roles·What we don't do·Student work·For adults·Tuition·FAQ·Read more). 키워드·숫자 없음 — 봐 달라
- ai.json 에 브리프 구조 밖 키 2개: `postsH2`(「더 읽을 글」)·`schemaDescription`(잠긴 스키마 설명). test-ai-page 의 횟수 셈에 둘 다 들어간다(키워드 없음)
- 수강료 3행 「중학생 이상(성인 포함)」 — 홈은 `<span class="sub">성인 포함</span>`, 브리프 표기대로 괄호로 합침
- 사실 대조(근거 행번호)는 Richard 몫으로 남김 — 글자는 브리프에서 그대로 옮겼다

## Out of Scope (logged in BUILD-LOG)
- KG-45-7 ops.ts rivalTally (위 Escalate)
- KG-45-8 check-index.mjs:166-167·bing-check.mjs 콘솔 분모에 AI교육 포함(콘솔 전용)
- test-visit.mjs 가 lib/visit.ts 를 못 불러 실패(고치기 전부터)
- KG-45-1~6 브리프 그대로

## 오케스트레이터 추가 (KG-45-7 처리)
- `web/lib/ops.ts` rivalTally: kind 가 있고 「브랜드」·「경쟁」이 아니면 건너뜀(D107 따름). 공개 랜딩 「/6」 분모 유지 목적. tsc web 0. 리뷰 범위에 포함해 달라.
