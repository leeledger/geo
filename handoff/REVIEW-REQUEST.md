# Review Request — Step 33 (D47·D48)
Date: 2026-10-01
Ready for Review: YES
Status: DONE — tsc 0 · 운영 DB 읽기로 세 탭 확인 · 학원 탭 = 저장된 보고 표. DB 쓰기·푸시·배포 없음

## 확인한 것
- web `node ./node_modules/typescript/bin/tsc --noEmit -p .` 0
- 운영 DB 읽기(2026-10-01 14:21 KST). web/lib 의 ops·agents·asks·pm-report 를 typescript 로 옮겨 그대로 부름(스크래치 verify33.mjs, 저장소 밖)

```
[robotncoding] 로봇&코딩학원 (client_id 1) — 물어본 곳 | 로봇&코딩학원 이름이 나온 답 | 우리 링크가 붙은 답 | 지난번과
   ChatGPT 9/30 측정 | 20개 중 7개 | 20개 중 0개 | 9/29 6개 → 7개 (비슷)
   Claude 9/30 측정 | 20개 중 7개 | 20개 중 8개 | 9/29 10개 → 7개 (비슷)
   Gemini 9/30 측정 | 20개 중 5개 | 링크를 안 보여 줌 | 9/29 8개 → 5개 (비슷)
   Perplexity 9/30 측정 | 20개 중 0개 | 20개 중 0개 | 9/29 8개 → 0개 (줄었음)
[ilog] 아이로그 (client_id 2)
   아직 잰 날이 없습니다 — 질문 승인 9/30 뒤 07:05 측정 기록이 아직 없습니다. 다음 측정 내일 07:05
[docttak] 문서딱 (client_id 3)
   아직 잰 날이 없습니다 — 질문 승인 10/1, 첫 측정 예정 내일 07:05
[저장된 아침 보고] 2026-10-01 (저장 2026-10-01 00:00:07 UTC = 09:00 KST)
   (학원 탭 네 줄과 글자까지 같음)
학원 탭 = 저장된 보고 AI답변 ? 같음(키 정렬 후 모든 값 일치 — 비교 안 공통·전인용·지금인용까지)
```
아이로그 문구는 사실이다. 9/30 승인 뒤 10/1 07:05 측정이 Claude 한도로 실패해 아이로그 기록이 0줄이다(BUILD-LOG 10/1).

## Files Changed
- web/lib/asks.ts:3,189-268 — readAnswerTable(client): pm-report.mjs AI답변읽기 셈을 client_id 만 바꿔 옮김 + 표가 빌 때 이유 한 줄(지어낸 0 없음)
- web/lib/pm-report.ts:15-31 — 곳 한 줄 타입을 AnswerRow 로 꺼냄(저장 형식 그대로)
- web/app/admin/ops/PmReport.tsx:1-3,42-44,47-79 — ClientAnswers: 「{고객} 이름이 나온 답」 표, 질문 기록 링크에 ?c=
- web/app/admin/ops/PmReport.tsx:81-134 — 저장된 보고는 「· 회사 전체」 묶음(상태·결론·확인 필요·한 일·고객별·확장·담당별). 저장된 AI답변 표는 더 안 그림
- web/app/admin/ops/page.tsx:10,145-163,191-192 — readAnswerTable 배선, Todo 에 고객 이름
- web/app/admin/ops/page.tsx:241-247 — 최근 글 링크: 도메인 없는 고객에 robotncoding.com 을 붙이지 않고 제목만
- web/app/admin/ops/Todo.tsx:51-57,90 — 「오늘 원장님이 하실 일 · {고객}」(일감은 readOps 가 고객별로 읽는다)
- web/app/admin/ops/AgentStrip.tsx:150 · Brief.tsx:125 — 제목에 「회사 전체」

## D48 — page.tsx 전체를 훑은 목록
| 자리 | 읽는 곳 | 탭 따라 | 처리 |
|---|---|---|---|
| 아침 보고 상단(상태·결론·확인 필요·한 일·고객별·담당별) | readPmReport (저장 한 장) | 아니오 | 「회사 전체」 표시 |
| 아침 보고 측정 표 | readAnswerTable(client) | 예 | 새로 |
| 오늘 원장님이 하실 일 | readOps(client).company — agent_tasks client_id | 예 | 제목에 고객 이름 |
| 자동으로 도는 일 | readAgents() — 고객 조건 없음 | 아니오 | 「회사 전체」 표시 |
| 성과·검색 엔진이 읽어 간 글·자세히 성과 | readGrowth(client) | 예 | 그대로 |
| 사람 방문 | readVisits(client.id) | 예 | 그대로(제목에 이름 이미 있음) |
| AI 에게 물어본 질문 | AskLog client | 예 | 그대로 |
| 크롤러 표·최근 글 | readOps(client) | 예 | 최근 글 링크 도메인 대체값 제거 |
| 직원별 업무 현황 | readOps(client) | 반쯤 | KG-33-1 |
| 오늘의 운영 기록 | readBrief() — 전 고객 | 아니오 | 「회사 전체」 표시 |
| 상단 링크 | AI 질문 기록만 ?c= | 일부 | KG-33-2 |

## Open Questions
- 셈을 readAskDays 가 아니라 pm-report.mjs 그대로 옮겼다. readAskDays 는 attempt 를 안 걸러서 학원 숫자가 저장된 보고와 어긋날 수 있다. 셈이 두 곳(mjs·ts)에 있게 됐다 — 한쪽만 고치면 학원 탭과 보고가 갈린다. 주석에 서로 적어 둠
- 표는 지금 센다. 08시 보고 뒤에 측정이 더 들어오면(다시 돌리기 등) 학원 탭이 저장된 보고보다 새 숫자를 보인다. 의도로 봤다
- 저장된 보고의 「고객별」「확장」 줄은 회사 전체 묶음에 남겼다(모든 고객 한 줄씩이라)

## Out of Scope (logged in BUILD-LOG)
- KG-33-1 AgentBoard 활동에 client_id null(회사 공통) 줄이 고객 이름 아래 섞임
- KG-33-2 영업판·파일럿·상담 기록 링크는 탭을 안 넘김
- KG-33-3 「07:05」 글자 고정 — optimize.yml cron 과 같이 바꿔야 함
