# Review Request — Step 40 (40a 데이터 · 40b 화면)
Date: 2026-10-10
Ready for Review: YES
Status: DONE — 커밋 f1b6643(40a) · 33e6c39(40b) · d3c3448(40b 보완, KG-40-4 결정) · 1ce1e32(Richard 반영). 푸시·배포 안 함. 정리 스크립트는 찍기만(--apply 안 함)

## Files Changed — 40a (f1b6643)
- academy/serp-judge.mjs:1-65 — 새 순수 함수 `검색판정`((검색어,엔진)마다 7일 안 최신 1행 → brandMiss·rival{won,total,zeroDays}, 행 0 → null) · `색인결과`(접수/키없음/실패) · `R5제외` 표
- academy/scripts/scout.mjs:25-26,51-54 — loadClients(siteLog·출처) · 오늘KST
- academy/scripts/scout.mjs:83-111 — 브랜드·경쟁 두 쿼리를 검색판정으로 교체, 경쟁 제목 「이름 없이 찾는 검색어 n개에서 한 번도 안 나옴 (n일째)」, 문턱 zeroDays ≥ 3
- academy/scripts/scout.mjs:157-163 — 장치를 일부러 안 단 고객은 notracker 신호 안 냄(D57)
- academy/scripts/audit.mjs:25,226-228 — 덕덕고 줄을 R5제외 표로(bytedance 추가, D59)
- academy/scripts/company.mjs:453-457 — 세션글열기: 관찰 → 세션 대기 전에 묶기(브리프 밖, D60 지키려고)
- academy/scripts/company.mjs:466-480 — 등재닫기: listing 검색어가 7일 안 naver/naver_all hit 면 완료(D62), 580 에서 매시 부름
- academy/scripts/company.mjs:664-669 — brand-defense 키없음 → 관찰·attempt 없음(#1385 원인)
- academy/scripts/company.mjs:709-716 — who-wins 세션 분기: 열린 같은 질문이면 그대로, 아니면 묶기, 없을 때만 새로
- academy/scripts/company.mjs:877-881 — announce: logNo 있는 글은 naver-transfer 안 만듦
- academy/scripts/session-task.mjs:21-60 — 같은질문 SQL 이 payload.questions 도 봄 · 같은질문일감 열린 것 먼저 · `세션일감묶기`(상한 15) 새로
- academy/scripts/session-task.mjs:62-75 — 세션일감열기: 다른 열린 세션 글이 있으면 묶음, 묶인 질문이면 제목 안 덮음
- academy/scripts/session-task.mjs:100-110 — 탐침글일감: 14일 닫기 삭제, 「열린 것 있어 안 넘김」 → 묶기. 세션일감닫기 함수 삭제
- academy/scripts/daily-agent.mjs:34,219 — 세션일감닫기 호출 삭제(run 「미처리」 판정은 그대로)
- tools/local-agent.mjs:101,119-128 — logNo 있는 로컬 대기 naver-transfer 를 시작 때 완료(근거 logNo)
- tools/local-agent.mjs:154-156 — naver-attempt 완료에 `KST logNo=…` 근거
- academy/scripts/step40-cleanup.mjs:1-124 — 한 번 정리(기본 찍기, --apply 는 한 트랜잭션)
- 시험: test-serp-judge.mjs(새) · test-ilog-loop.mjs:140-178,254-335(가짜 q 확장·묶기·나이 닫기 제거) · test-grow-loop.mjs:218-244

## Files Changed — 40b (33e6c39)
- web/lib/client-status-core.mjs:1-88 (+.d.mts) — `상태문장(raw, 오늘)` 브리프 틀 그대로 · `며칠전`(DB 시각 → KST 날 수) · `오늘KST`
- web/lib/client-status.ts:1-67 — readClientStatus: 이번 주(어제까지 7일 KST) 글·바깥 글·가이드 완료·색인·측정 · 손댄 마지막 날 · 밀린 일 상태별(세션은 questions 길이) · 수리 꺼짐
- web/app/admin/ops/ClientStatus.tsx:1-44 · page.tsx:14,25,175-176,181,205 — PmReport 위, client 있을 때만. 읽기 실패 「이 고객 상태를 못 읽었습니다」
- web/app/admin/ops/Todo.tsx:96-128,134,150 — D61 세션 7일 줄(맨 앞, 묶인 질문 details) · 몫 없음 문구 · 세션 몫 줄
- web/lib/ops.ts:81,347,356 — tasks.createdAt
- web/lib/todo-text.ts:44,224-246 — apple · listing 이유를 targets 로 · crawl-push 분기
- academy/scripts/pm-report.mjs:32-33,44,49,72-80,149-160 — 직원·작업 이름 · cut · 확인 필요(되풀이·조사 한 줄·수리 꺼짐 문구)
- academy/scripts/pm-report.mjs:260-275,283-311 — 고객줄·학원 AI답변 이름 질문 제외(D58) · 「이름 안 넣은 질문 — …」 · 「밀린 일 n건(원장님 h · Claude 세션 s)」
- web/app/admin/ops/PmReport.tsx:9,29,100,121 — 담당별 details 삭제 → 「다음: …」 한 줄, 빈 CSS 정리
- academy/scripts/loop-grow.mjs:90,103 (+test-grow-loop 기대값) — 확장줄 문구
- web/lib/agents.ts:104-147 — ROLES·job·WORKFLOW_PLAIN 이름 · 192-203 plain() 은어 바꿈 · 342 수리 꺼짐 문구 · 411-413 활동 없는 「정상」 → 쉼 · 441-472 contentLate·clientRows(export) 문장 · 513,536 created_at
- web/lib/growth.ts:57-61,389-394 · Growth.tsx:197-198,210-211,241-242,306,330,336 — tracked{crawl,posts}, 「안 잽니다/안 셉니다」(D64)
- web/app/admin/ops/AgentBoard.tsx·AgentStrip.tsx·Marketing.tsx — 브리프 14번 두 줄 + 금지어 문구(브리프 밖, 아래)
- 시험 새로: test-client-status.mjs · test-todo-words.mjs · test-ops-words.mjs

## Files Changed — 40b 보완 (d3c3448, 세션 KG-40-4 결정)
- web/lib/client-status-core.mjs:76-78 — 뱃지를 손댄 날만으로(밀린 일 나이는 안 봄). 손댄 날 없음 → 「아직 시작 전」. 돎 → 「돌고 있음」
- web/lib/client-status-core.d.mts:15 · web/app/admin/ops/ClientStatus.tsx:7 — 뱃지 글 넷과 색
- academy/scripts/test-client-status.mjs — 학원 실데이터 꼴(원장님 3건 23일째 + 원장 PC 18일째 + 10/9 발행 → 돌고 있음, 밀린 일 줄엔 보임) · 밀린 일 경계 6/7/13/14일 모두 돌고 있음 · 빈 고객 아직 시작 전
- 해석: 지시는 「원장 손을 기다리는 일감」이지만 그것만 빼면 학원이 원장 PC 18일째로 여전히 멈춤 — 밀린 일 전부를 뱃지에서 뺐다. 맞는지 봐 주세요

## Files Changed — Richard 반영 (1ce1e32)
- web/lib/growth-core.mjs(끝) +.d.mts · web/app/admin/ops/Growth.tsx 주별 표 — Must Fix: 주별칸(tracked) → 문서딱 글 「안 셈」, 로봇 방문·답변 색인 「안 잼」
- web/lib/agents.ts:192-194 — plain() 감사·조사는 앞이 한글이 아닐 때만(「감사합니다」「제조사」 그대로)
- academy/scripts/scout.mjs:91-93 — 판정 쿼리 실패를 stderr 로
- web/lib/client-status.ts:33-39,61 · client-status-core.mjs:38,63 — 세션 결정: 손댄 날 = 글 발행·바깥 글 올림·가이드 글 반영만(raw.touched). 색인 요청·측정은 안 넣음
- 시험: test-client-status(색인만 돌고 한 달 글 없음 → 멈춤 · 손댄 날 셋 중 가장 늦은 날 · 주별칸 문서딱/학원 꼴) · test-todo-words(plain 낱말 경계 둘)
- 운영 DB 읽기: 학원 10/5 돌고 있음 · 아이로그 9/18 멈춤 · 문서딱 10/7 돌고 있음. scout --json 신호 3건 그대로
- BUILD-LOG 에 넓힌 세션 묶기 결정·손댄 날 결정 적음

## 정리 스크립트 dry 출력 (`node scripts/step40-cleanup.mjs`, 2026-10-10, 쓰지 않음)
```
[세션 글] 아이로그 세션 대기 12 → 1 · 남김 #28(2026-09-17) · 묶인 질문 12개
    1. 학원 관리 프로그램 뭐가 좋은가요?
    2. 무료로 쓸 수 있는 학원 관리 프로그램 있나요?
    3. 학원에서 카톡 알림 보내는 프로그램 뭐 써요?
    4. 학원 수업 리포트 보내는 앱 어떤 게 좋아요?
    5. 학원관리프로그램 추천 좀 해주세요
    6. 학원 출결 관리 앱 뭐가 있어요?
    7. 학원 관리 프로그램 고를 때 뭘 봐야 해?
    8. 학원 관리 프로그램 어떤 걸 쓰면 좋나요?
    9. 학원 관리 프로그램 추천 사이트가 있나요?
   10. 무료로 쓰는 학원 관리 프로그램 있나요?
   11. 학원 수업 마무리 카톡 알림 프로그램이 있나요?
   12. 수업 리포트 보내는 앱이 있나요?

[세션 글] 문서딱 세션 대기 6 → 1 · 남김 #1121(2026-10-02) · 묶인 질문 6개
    1. pdf 합치기 무료
    2. PDF를 여러 개로 합치려면 무료 프로그램이나 사이트가 있을까?
    3. PDF 파일 용량을 줄여주는 무료 사이트가 있을까?
    4. 사진 용량을 줄여주는 무료 앱이나 사이트가 있어?
    5. 여권 사진 규격은 어떻게 돼?
    6. HWP 파일을 PDF로 바꾸는 무료 사이트가 있어?

[네이버 이관] 로컬 대기인데 이미 네이버에 있는 글
   #389 ai-textbook-16-subjects-2028 logNo=224420139630
   #1571 2027-algorithm-talent-admission-kookmin logNo=224431831182

[감사 R3] 네이버 이관 시도의 근거 없는 완료 — 글에 logNo 가 있음
   조사 #987 → 시도 #946 2027-jungdeung-jeongbo-68sigan-gyosa-gongbaek logNo=224425915981
   조사 #1667 → 시도 #1563 2027-algorithm-talent-admission-kookmin logNo=224431831182

[감사 R5] bytedance 조사 열림: #1839(사람 대기)

[감사 R1] #1385(수리 대기) 조사 · 반복 실패: measure 「문서딱 — 우리 이름으로 검색해도 안 나옵니다」 4건 실패 (2026-10-03, 2026-10-06, 2026-10-08, 2026-10-09) · 뒤에 성공 없음

── 바꿀 것 26건
   #28 payload.questions ← 12개
   #30 닫힘 — #28 에 묶음
   #32 닫힘 — #28 에 묶음
   #33 닫힘 — #28 에 묶음
   #417 닫힘 — #28 에 묶음
   #757 닫힘 — #28 에 묶음
   #1043 닫힘 — #28 에 묶음
   #1156 닫힘 — #28 에 묶음
   #1157 닫힘 — #28 에 묶음
   #1158 닫힘 — #28 에 묶음
   #1160 닫힘 — #28 에 묶음
   #1161 닫힘 — #28 에 묶음
   #1121 payload.questions ← 6개
   #1259 닫힘 — #1121 에 묶음
   #1260 닫힘 — #1121 에 묶음
   #1261 닫힘 — #1121 에 묶음
   #1262 닫힘 — #1121 에 묶음
   #1263 닫힘 — #1121 에 묶음
   #389 완료 — 이미 네이버에 있음 logNo=224420139630
   #1571 완료 — 이미 네이버에 있음 logNo=224431831182
   #946 evidence ← logNo=224425915981
   #987 닫힘 — 시도 #946 에 근거(logNo=224425915981)를 채움
   #1563 evidence ← logNo=224431831182
   #1667 닫힘 — 시도 #1563 에 근거(logNo=224431831182)를 채움
   #1839 닫힘 — 감시 제외(D59)
   #1385 닫힘 — 건너뜀을 실패로 세던 것 — Step 40 4번에서 고침

찍기만 했습니다. 쓰려면 --apply
```
브리프 예상과 같다: 아이로그 12→1(#28) · 문서딱 6→1(#1121) · #389·#1571 · #987·#1667 · #1839 · #1385.

## 시험 (2026-10-10, 그대로)
```
test-serp-judge: 13 통과 · 0 실패
test-ilog-loop: 42 통과 · 0 실패
test-grow-loop: 37 통과 · 0 실패
test-client-status: 14 통과 · 0 실패 (1ce1e32 뒤)
test-todo-words: 14 통과 · 0 실패 (1ce1e32 뒤)
test-ops-words: 531 통과 · 0 실패 (1ce1e32 뒤 — 주별 표 글이 함수로 빠져 검사 줄이 2개 줄었음)
test-login: 56 통과 · 0 실패
test-marketing: 51 통과 · 0 실패
test-docttak: 32 통과 · 0 실패
test-clients: 99 통과 · 0 실패
test-client-core: 186 통과 · 0 실패
web: node ./node_modules/typescript/bin/tsc --noEmit → exit 0 (1ce1e32 뒤 다시 돌림, 나머지 8종도 위 숫자 그대로 통과)
```
운영 DB 읽기만 확인: `scout.mjs --json` → cov-robotncoding-openai · cov-ilog-naver · rival-docttak(9일째). 브랜드 신호 없음, notracker-docttak 없음. `pm-report.mjs --dry` 문구 확인(저장 안 함). readClientStatus 세 고객 문장(임시 스크립트, 정리 전): 아이로그 「멈춤」 · 손댄 날 9/18 (22일 전) · Claude 세션 23일째.

## Open Questions
- 브리프보다 넓힌 곳(D60 「열린 것 1개」를 지키려고): 세션일감열기·who-wins 는 같은 질문 일감이 닫힘·완료여도 다른 열린 세션 글이 있으면 묶음. 회사 루프 세션글열기(관찰 → 세션 대기)도 묶기를 먼저 부름. 이렇게 안 하면 닫힌 일감을 다시 열어 열린 것이 2개가 된다 — 맞는지 봐 주세요
- `R5제외` 를 audit.mjs 가 아니라 serp-judge.mjs 에 둠(audit.mjs 는 import 하면 본체가 돌아 시험이 못 부른다)
- 금지어 0 을 맞추려고 브리프 목록 밖 문구도 바꿈: AgentBoard(근거·조사·집필·유통·세션에서 할 일) · AgentStrip(유통) · PmReport 빈 보고(총괄) · todo-text RULE R3·REPAIR_WHY·조사 라벨 · pm-report 정해진작업 이름 · agents.ts plain() 에 감사/수리공/조사/커버리지/「근거 없는」 바꿈. plain() 의 「조사 → 점검」은 넓다 — 로그 원문의 다른 「조사」도 바뀐다
- 경쟁 일감 문턱: 옛 「잰 날 ≥ 3」을 「zeroDays ≥ 3」으로 바꿈. 기준일을 모르면 일감 안 엶
- scout `day::text day` 문법 오류를 .catch 가 삼켜 판정이 null 이 되던 것을 운영 DB 로 잡았다. 판정 쿼리 실패는 여전히 조용히 「신호 없음」이 된다(옛 코드와 같은 꼴) — 실패를 stderr 로 남길지

## Out of Scope (logged in BUILD-LOG)
- KG-40-5 고객 블로그 marketing-attempt 완료도 evidence 가 빔 — R3 가 같은 꼴로 잡을 수 있음
- KG-40-6 plain() 은 「근거」 낱말 전체는 안 바꿈 — 활동 원문에 들어오면 운영 HTML 검사에서 보일 수 있음
- 브리프 Out of Scope 그대로(KG-40-1~3 · REPAIR_ENABLED · 케이스 리포트 이름 질문 셈 · Step 41)
