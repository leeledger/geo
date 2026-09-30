# Review Request — Step 30 (아이로그를 학원과 같은 수준으로 D34~D37)
Date: 2026-09-30
Ready for Review: YES
Status: DONE_WITH_CONCERNS — 시험 18 통과 · tsc 0(web·academy) · 학원 dry 출력 동일. 아이로그 content 칸(세션 일감) 경로는 승인 질문·측정이 없어 dry 로 끝까지 못 탔다(DB 쓰기 금지 — 가짜 행 시험과 코드로만 확인)

## Files Changed
- academy/clients.mjs:37-53 — 학원 `loop` 설정. Step 30 전 daily-agent 에 박혀 있던 값 그대로(석촌 · address+석촌|송파 · write-draft · 탐침 켬 · offsite 문장 두 개 원문)
- academy/clients.mjs:79-84 — 아이로그 answerRe 를 `(?<!\(주\)\s?)아이로그|ilog\.ai\.kr` 로(D34). seed 가 이 원문을 DB 에 넣는다 — 한 곳
- academy/clients.mjs:90-108 — 아이로그 `loop` 설정(이름 질문 적중 출결|알림톡|수업 피드백 · 홈 SoftwareApplication+ilog.ai.kr · draft=session · 탐침 끔)
- academy/clients.mjs:149-151 — `세션글제목()` — daily-agent 와 company 가 같은 제목
- academy/scripts/daily-agent.mjs:18-22,39,59-64 — 머리말 · HOUSE · keyword 단계(LADDER·DISCOVER_GROUP general·STAGE_ORDER 4)
- academy/scripts/daily-agent.mjs:75-116 — 준비(DDL) 분리 · `세션일감()`: 같은 질문의 question-draft 일감이 있으면 다시 열고(사람 대기) 없으면 새로. dry 는 읽기만
- academy/scripts/daily-agent.mjs:137-141,180 — 홈 JSON-LD 검사·이름 질문 적중을 고객 설정으로(D35)
- academy/scripts/daily-agent.mjs:213-230 — 판정: 세션 글 일감이 run_day 이후 완료면 그날부터 판정 창을 연다
- academy/scripts/daily-agent.mjs:312 — 자기 점검에 `탐침: 설정.probes`
- academy/scripts/daily-agent.mjs:400-402 — 학원 밖 고객 「측정 없음」은 실패로 적되 종료코드 1 을 안 낸다
- academy/scripts/daily-agent.mjs:415-420,427-429,458-459,573 — 대기세션·대기일(학원이면 대기초안 문장 그대로)
- academy/scripts/daily-agent.mjs:493-507 — content 칸: draft=session 이면 write-draft 를 안 부르고 세션 일감 + 사람 대기 행(한 번에 하나)
- academy/scripts/daily-agent.mjs:563 — offsite 문장을 고객 설정에서
- academy/scripts/daily-agent.mjs:578-608 — main: --client 하나 · --complete 는 학원(또는 --client) · 기본은 학원 먼저 + 승인 질문 있는 고객. loop 설정 없는 고객은 적고 건너뜀. 고객별 실패 격리
- academy/scripts/loop-review.mjs:40-41,115,118,181,207-208 — keyword → 일반 질문 묶음 · `탐침` 인자(false 면 widen·씨앗 없음) · skipContent 는 있는 단계만(학원 출력 불변을 위해)
- academy/scripts/company.mjs:33,427-444,539 — D37 `세션글열기()`: 세션 고객의 관찰 question-draft 를 사람 대기 + 세션 제목으로(매시, 관찰인 것만)
- academy/scripts/company.mjs:657-662 — who-wins 가 세션 고객 일감을 처음부터 세션 제목·사람 대기로
- academy/scripts/company.mjs:710-713 — question-draft 실행: 세션 고객은 관찰(30일) 대신 사람 대기
- academy/scripts/pm-report.mjs:203-251,339 — D36 `고객줄읽기()`: 학원 밖 고객 한 줄(곳별 「n번 중 k번 이름 나옴」 · 방문자(기록 시작 전은 0 이라 안 씀) · 열린 일감/원장 몫). 학원 숫자·문장 불변
- web/lib/pm-report.ts:28-29 · web/app/admin/ops/PmReport.tsx:91 — 고객별 줄 타입·표시
- web/lib/todo-text.ts:197-206 — 「세션에서 …」 question-draft 를 원장 할 일 문장으로. 버튼은 「했어요」(닫으면 루프가 판정 창을 연다)
- academy/scripts/seed-ilog-panel.mjs (새) — 0원 리허설 파일럿 + 질문 20개 approved=false + answer_pattern + measure_active. 기본 dry, `--apply` 는 Arch
- academy/scripts/test-ilog-loop.mjs (새) — 18개: 패널 모양·출처, 이름 말 오탐((주)아이로그·IBM ILOG·ilog.co.kr), 학원 설정 원값, 홈 검사 교차, 탐침 끄기, keyword 묶음, 제목

## 확인한 것
- `node academy/scripts/test-ilog-loop.mjs` → 18 통과 · 0 실패
- `node ./node_modules/typescript/bin/tsc --noEmit` → web 0 · academy 0
- 학원 불변: 변경 전 `daily-agent.mjs --dry` 출력을 떠 두고 변경 후와 diff → **동일**(처음엔 「건너뛰는 단계」에 keyword 가 붙어 한 줄 달랐다 → skipContent 를 있는 단계만으로 고쳐 동일). `--dry --review` 종료 0
- pm-report `--dry`: 변경 전후 `body` 에서 기간·고객별을 빼고 비교 → **같음**. 출력은 한 줄만 늘었다: `아이로그: AI 답변 측정 없음 — 승인된 질문 0개 · 방문 기록 없음 · 열린 일감 7건`
- `daily-agent.mjs --dry --client ilog`: 측정 0건이라 「최근 7일 자동 AI 측정이 없습니다 · 실패」 기록 줄까지(종료 0). 기본 실행(고객 지정 없음)에서는 승인 질문이 없어 아이로그를 돌지 않는다
- 7건: DB 를 읽어 보니 question-draft(client 2) 는 관찰 6(#28·30·32·33·417·757) + 완료 1(#29 「원장이 완료 표시」). D37 은 관찰 6건을 올린다. #29 질문도 패널 q2 에 넣었다

## seed --dry 출력 원문 (Arch·원장 검토용)
```
아이로그 (client 2) · dry — DB 안 씀
  파일럿: 새로 — 0원 리허설, 오늘부터 30일
  이름 판별: ilog\.ai\.kr → (?<!\(주\)\s?)아이로그|ilog\.ai\.kr
  측정 대상 고정(measure_active): false → true  (리허설 30+7일이 지나도 계속 잰다)
  질문 20개 (approved=false · 원장이 /admin/pilots 에서 승인)
  q1  consider 학원 관리 프로그램 뭐가 좋은가요?   ← 겨냥 초안 일감 #28
  q2  consider 학원 관리 프로그램 추천 순위나 후기 알려줘   ← 겨냥 초안 일감 #29
  q3  consider 무료로 쓸 수 있는 학원 관리 프로그램 있나요?   ← 겨냥 초안 일감 #30
  q4  consider 학원에서 카톡 알림 보내는 프로그램 뭐 써요?   ← 겨냥 초안 일감 #32
  q5  consider 학원 수업 리포트 보내는 앱 어떤 게 좋아요?   ← 겨냥 초안 일감 #33
  q6  consider 학원관리프로그램 추천 좀 해주세요   ← 겨냥 초안 일감 #417
  q7  consider 학원 출결 관리 앱 뭐가 있어요?   ← 겨냥 초안 일감 #757
  q8  problem  학원 관리 프로그램, 무엇을 보고 골라야 하나요?   ← guides.ts how-to-choose-academy-management-program 제목
  q9  problem  무료 학원 관리 프로그램, 어디까지 무료인가요?   ← guides.ts free-academy-management-program 제목
  q10 problem  학원 출결을 학부모 카카오톡으로 자동으로 알리려면 무엇이 필요한가요?   ← guides.ts academy-attendance-kakao-notification 제목
  q11 problem  학원 수업 리포트, AI가 대신 쓰면 선생님은 무엇을 하나요?   ← guides.ts ai-class-report 제목
  q12 problem  학교별 기출로 영어 내신 예상 문제를 만들 수 있나요?   ← guides.ts english-exam-generator 제목
  q13 keyword  학원 관리 프로그램 추천   ← guides.ts query · 설계서 예시
  q14 keyword  무료 학원 관리 프로그램   ← guides.ts query · clients.mjs c3
  q15 keyword  학원 출결 관리 앱   ← clients.mjs c4
  q16 keyword  학원 카톡 알림 프로그램   ← clients.mjs c5
  q17 keyword  학원 수업 리포트 앱   ← guides.ts query · clients.mjs c6
  q18 brand    아이로그 학원 관리 프로그램 어떤 거야?   ← 이름 질문 — 학원 패널 「어떤 곳이야?」 꼴
  q19 brand    ilog.ai.kr 이 사이트 뭐 하는 곳이야?   ← 이름 질문 — 학원 패널 「robotncoding.com 이 사이트 무슨 학원이야?」 꼴
  q20 brand    아이로그는 정말 무료인가요?   ← guides.ts how-to-choose FAQ 원문
  단계: consider 7 · problem 5 · keyword 5 · brand 3
```

## Open Questions
- 이름 말: 「아이로그」를 세고 「(주)아이로그」만 뺐다. 설계서의 `i-log` 는 아이로그 코드·가이드 어디에도 없는 표기라 넣지 않았다. `ilog` 단독은 IBM ILOG 와 겹쳐 안 셌다. 이대로 좋은지
- 아이로그 이름 질문 적중 말(출결|알림톡|수업 피드백)은 학원의 「석촌」과 같은 역할로 Bob 이 골랐다. 답이 이름을 따라 말하는 것과 제품을 아는 것을 가르는 말로 적당한지
- q19 는 질문에 도메인이 들어 있어 「이름 나옴」은 늘 참이다(학원 q 의 robotncoding.com 질문과 같다). 판정은 위 적중 말로만 한다
- 파일럿 업무 19개·정합성 20칸은 안 넣었다(교육청 공개정보·네이버 플레이스가 소프트웨어에 안 맞는다). 리허설은 회사 루프가 업무 일감을 안 올리니 영향은 /admin/pilots 화면이 비는 것뿐
- measure_active=true 로 고정한다 — 리허설 30+7일 뒤에도 잰다. 측정 예산은 KG-30-3
- D37 이 돌면 pm-report 「원장 할 일」(전 고객 합)이 6 늘어난다(KG-30-4). 학원 줄 숫자 계산식은 안 바꿨다
- 세션 일감을 원장이 「했어요」로 닫으면 who-wins 가 다음 주 같은 검색어로 지면 24시간 쿨다운 뒤 다시 연다(기존 일감() 동작 그대로)

## Out of Scope (logged in BUILD-LOG)
- KG-30-1 loop 설정 없는 외부 고객은 개선 루프를 건너뜀
- KG-30-2 아이로그 content 칸이 이미 있는 가이드(lib/guides.ts)와의 겹침을 안 봄
- KG-30-3 측정 예산(유료 없는 날 22 — 학원 20 뒤 아이로그 20은 밀림)
- KG-30-4 pm-report 원장 할 일 수는 전 고객 합
- KG-30-5 아이로그 case-report
