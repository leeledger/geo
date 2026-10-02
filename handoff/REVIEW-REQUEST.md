# Review Request — Step 34 (D49 · D50 · D51)
Date: 2026-10-02
Ready for Review: YES
Status: DONE — tsc 0 · academy 시험 32+33+37 통과 · 운영 DB 읽기로 세 탭 확인 · 학원 탭 「자동으로 도는 일」 줄 = 바꾸기 전 코드와 같음. DB 쓰기·푸시·배포 없음

## 확인한 것
- web `node ./node_modules/typescript/bin/tsc --noEmit` 0
- academy `node scripts/test-docttak.mjs` 32/0 · `test-ilog-loop.mjs` 33/0 · `test-grow-loop.mjs` 37/0
- 학원 줄 불변: HEAD 의 agents.ts 와 새 agents.ts 를 같은 시각(now)으로 운영 DB 에 돌려 rows JSON 비교 → `학원 탭 줄 같음: true · 고객 없음 같음: true · client null` (스크래치 cmp.mjs, 저장소 밖)
- 운영 DB 읽기(2026-10-02, 스크래치 verify.mjs — web/lib 를 typescript 로 옮겨 그대로 부름). 운영·측정 줄 상태가 탭마다 다른 건 읽은 시각 차이(측정이 도는 중)다 — 회사 줄은 고객으로 안 거른다

### 세 탭 「자동으로 도는 일」 줄 (D49)
```
══ 로봇&코딩학원 — 자동으로 도는 일 · 회사 전체
  [정상] 운영 — 매시 일을 나눠 맡기고, 건너뛴 예약과 실패한 작업을 다시 돌립니다
  [꺼짐] 수리공 — 꺼 둠 · 켜는 건 원장님 결정
  [정상] 측정 — 매일 아침 AI 답변과 검색 순위를 잽니다
  [정상] 콘텐츠 — 월요일 아침 초안을 주 1편 씁니다. 쓸 거리가 없으면 그 주는 건너뜁니다
  [쉬는 중] 삽화 — 지금은 할 일이 없습니다
  [실패] 유통 — 빙 주소 제출 실패 — 다음 차례에 다시 해 봅니다
══ 아이로그 — 자동으로 도는 일 · 회사 전체 · 콘텐츠·유통은 아이로그
  [정상] 운영 / [꺼짐] 수리공 / [정상] 측정  (학원과 같은 회사 줄)
  [정상] 콘텐츠 — 자동 초안 없음 · 세션에서 쓸 글 7건 → 아이로그 저장소에 반영
  [정상] 유통 — 매일 새벽 사이트 주소를 빙·네이버에 알립니다. 네이버 블로그 옮기기·구글 색인 요청은 이 고객에 안 돕니다
  (삽화 줄 없음)
══ 문서딱 — 자동으로 도는 일 · 회사 전체 · 콘텐츠·유통은 문서딱
  [일하는 중] 운영 / [꺼짐] 수리공 / [일하는 중] 측정  (읽은 시각 차이)
  [정상] 콘텐츠 — 자동 초안 없음 · 세션에서 쓸 글 1건 → 문서딱 저장소에 반영
  [해당 없음] 유통 — 색인 알림 없음 · 이 고객에는 자동 유통이 안 돕니다   (오른쪽 칸: 「이 고객에는 안 돕니다」)
  (삽화 줄 없음)
```
고객별 판단 근거(코드에서 확인한 것만, agents.ts PIPES 주석):
- 글 길(posts) 학원만 — write.yml 의 write-draft·write-news `CLIENT = 1` 고정, illustrate.mjs 는 academy.posts(글이 있는 곳은 학원뿐, clients.mjs `publishes` 학원만 true), local-agent.mjs 네이버 옮기기 `client_id = 1`, `submit-gsc --all` 기본 학원
- 색인 알림 — snapshot.yml 03:23 → indexnow.mjs 가 clients.mjs 에서 키 있는 곳만: 학원(키 파일)·아이로그(`indexnowKey`, https://ilog.ai.kr/<key>.txt 200 오늘 확인). 문서딱은 키 없음 → 건너뜀. clients.mjs 에 없는 고객은 안 돈다 → PIPES 기본값 둘 다 false
- 「세션에서 쓸 글 n건」 = geo.agent_tasks 그 고객 · agent content · status 「세션 대기」(session-task.mjs 가 여는 question-draft). 아이로그 7건은 실제 값이다 — session-task 는 「한 번에 하나」인데 7건이 열려 있다. 회사 루프 who-wins 도 같은 키로 여는지 Richard 가 한 번 봐 주면 좋겠다(이번 단계 밖, KG)

### 세 탭 새 머리 숫자 (D51 — 이름 질문 빼고, 곳끼리 안 합침)
아침 보고 표(readAnswerTable):
```
로봇&코딩학원  ChatGPT 10/2 17개 중 3개 · 링크 0 · 10/1 4→3 (비슷)
              Claude  10/2 17개 중 9개 · 링크 10 · 10/1 7→9 (비슷)
              Gemini  10/2 17개 중 4개 · 링크 안 보여 줌 · 10/1 4→4 (비슷)
              Perplexity 10/2 17개 중 0개 · 링크 0 · 10/1 0→0 (비슷)
              이름 질문 3개 중 ChatGPT 3 · Claude 3 · Gemini 3 · Perplexity 0 — 확인용(노출 성과 아님)
아이로그      ChatGPT 17개 중 4개 (4→4) · Claude 17개 중 0개 (0→0) · Gemini 17개 중 6개 (5→6) · Perplexity 17개 중 0개 (0→0) · 모두 「비슷」
              이름 질문 3개 중 ChatGPT 3 · Claude 3 · Gemini 3 · Perplexity 0
문서딱        ChatGPT 17개 중 0개 (0→0) · Claude 2개 중 0개 (일부만 물음, 첫 측정) · Gemini 17개 중 0개 (0→0) · Perplexity 17개 중 0개 (0→0)
              이름 질문 ChatGPT 3개 중 2개 · Gemini 3개 중 2개 · Perplexity 3개 중 0개 (Claude 는 이름 질문을 안 잼)
```
성과 카드(Growth, 대표 쌍 ChatGPT 화면): 학원 17개 중 3개 · 지난번 4→3 / 아이로그 17개 중 4개 · 4→4 / 문서딱 17개 중 0개 · 0→0. 이름 질문 줄: 3개 중 3 · 3 · 2.
AI 질문 기록(10/2 곳별): 학원 Claude 17 중 9 · ChatGPT 3 · Gemini 4 · Perplexity 0 / 아이로그 0 · 4 · 6 · 0 / 문서딱 Claude 2 중 0 · 나머지 17 중 0.
문서딱 이름 나온 답은 전부 이름 질문(ChatGPT·Gemini 각 2)이다 — 원장 지적 그대로.

## Files Changed
- web/lib/agents.ts:11,18-23 — AgentState 에 「none」(해당 없음), Act·OpenTask 에 clientId(고객별 줄 가를 때만)
- web/lib/agents.ts:45-64 — Agents.client · PIPES/pipeOf: 고객마다 실제로 도는 글·색인 알림(근거 주석)
- web/lib/agents.ts:431-466 — clientRows: 글 길 없는 고객의 콘텐츠(세션 대기 n건, 학원 write 옮긴 줄 안 봄)·삽화(뺌)·유통(snapshot 만 또는 해당 없음)
- web/lib/agents.ts:468-531 — readAgents(now, client): client_id 같이 읽음. 학원·고객 없음은 예전 경로 그대로(위 비교 true)
- web/app/api/admin/agents/route.ts — ?c=슬러그 로 같은 고객 고르기(현황판과 같은 규칙, 없으면 첫 고객)
- web/app/admin/ops/AgentStrip.tsx:16,93-94,111,144,151,174-180 — slug 로 다시 읽기, 머리글 「· 콘텐츠·유통은 {이름}」(학원은 그대로), 해당 없음 줄은 오른쪽 칸 하나
- web/app/admin/ops/page.tsx:153,194-196,258 — readAgents 에 client, AgentStrip key=slug(탭 바꾸면 state 새로), Growth name, AgentBoard clientId
- web/app/admin/ops/AgentBoard.tsx:2,13,78-96 — 글 길 없는 고객의 콘텐츠·유통 카드 문구(주간 초안·도해·네이버 이관 → 세션 글·색인 알림/없음)
- web/lib/growth.ts:31-32,156-200 — AI 카드 머리 숫자 이름 질문 빼고, brand(최근 이름 질문 회차) 따로. 이름 질문만 잰 쌍은 뺌
- web/app/admin/ops/Growth.tsx:85-90,135-136,176-181,296 — Card note 칸, 「{이름} 이름이 나왔습니다 · 이름 질문 빼고」, 이름 질문 한 줄, 「지역·업종 검색 (이름 없이)」
- web/lib/asks.ts:29-38,75,96,103-104 — AskPlace.brand, BRAND 조건, 7일 곳 합계 이름 질문 빼고
- web/lib/asks.ts:175-186 — readAskDays n·named·cited 이름 질문 빼고 + brand 칸
- web/lib/asks.ts:204-263 — readAnswerTable: 이름 질문 빼고 셈, BrandRow 곳별, 「일부만 물음」 = 그날 최대 수의 90%(pm-report 20 중 18 규칙을 17 에 그대로)
- web/app/admin/ops/PmReport.tsx:3,49-57,68,80 — 머리 칸 「이름 질문 빼고」, 표 아래 이름 질문 한 줄
- web/app/admin/ops/AskLog.tsx:47-49 — 「{고객} 이름」, 이름 질문 빼고 + 이름 질문 확인용 꼬리
- web/app/admin/asks/page.tsx:84,140-141,165,201-202,273,287 — 「사람들이 AI 에…」·「{고객} 이름」, 이름 질문 빼는 설명, 곳별 합계 표시
- academy/clients.mjs:172-176 — 문서딱 probeVariants.seeds ["pdf 병합"] (원장 2026-10-02)
- academy/scripts/loop-review.mjs:109,306-314,336 — 변형 씨앗: 하루 한도와 따로 한 번, 이미 있으면 안 만듦, 증거 글 「씨앗 「…」」
- academy/scripts/test-docttak.mjs:115-128 — 씨앗 포함 기대값 + 씨앗 중복·한도 0 시험

## Open Questions
- D51 로 학원 탭 아침 보고 표가 저장된 아침 보고(pm-report.mjs, 이름 질문 포함 20개)와 숫자가 달라졌다. Step 33 의 「학원 탭 = 저장된 보고」 확인은 이제 성립하지 않는다(의도). 저장 셈은 안 건드렸다
- 「일부만 물음」 기준을 「그날 곳들 중 최대 수의 90%」로 옮겼다. 학원·아이로그는 17 전부라 영향 없음, 문서딱 Claude 2개만 표시됨
- 유통 「해당 없음」은 상태 하나를 새로 만들었다(회색 점, 라벨 「해당 없음」). 숨기는 쪽보다 「키가 없어 안 돈다」가 보이는 게 낫다고 판단
- 콘텐츠 줄(글 길 없는 고객)은 그 고객 content 활동·일감으로만 판정한다. 학원 write.yml 늦음이 아이로그 탭에 안 뜬다

## 화면에 남은 「학원」 (D50 grep, web/app/admin, 주석 제외)
- web/app/admin/ops/Growth.tsx:222 「학원 문의 — 확인 못함」 · :228 「최근 30일 학원 문의」 · :286 「학원 문의」(dt) — 문의 기록(/admin/inquiry)이 학원 것뿐이라 지금은 사실. 고객 탭과 안 맞으면 Arch 판단
- web/app/admin/ops/Growth.tsx:277 「AI 에게 학원을 물었을 때 이름이 나오는가」 — 자세히 안 정의 글. 이번 지정 목록 밖이라 그대로
- web/app/admin/asks/page.tsx:300 넓혀 본 질문 설명 「송파」「서울」「송파구 코딩학원 추천」 — widen 탐침(학원만) 설명. 아이로그·문서딱 탭의 변형 탐침에도 이 글이 뜬다. :298 「승인 20문항」도 고객마다 다를 수 있음
- web/app/admin/outreach/page.tsx:107 영업 전화 대본(학원 대상) — 영업판, 고객 탭 아님
- web/app/admin/pilots/page.tsx:49·52·70 등록 양식 예시(○○수학학원)·내부 고객 안내 — 고객 탭 아님
- web/app/admin/ops/page.tsx:243 주석(화면 아님)

## Out of Scope (BUILD-LOG Known Gaps)
- 아이로그 세션 대기 content 일감 7건 — 「한 번에 하나」 규칙과 안 맞음, 여는 곳 점검 필요
- 위 남은 「학원」 문구
