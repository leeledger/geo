# Review Feedback — Step 11 (영업 담당) 2차
Date: 2026-09-22
Ready for Builder: YES
Commits reviewed: 5600aef · 7f46a15 (공개본, 배포됨) · 2db0c72

## 라이브 공개본 대조 (https://geo-rose-nine.vercel.app/case/academy.html)
- 라이브 본문은 저장소 7f46a15 와 같다(공백만 다름).
- **머리 숫자**: AI 895 = OAI-SearchBot 28 + GPTBot 63 + Applebot 7 + meta-externalagent 319 + ClaudeBot 338 + Amazonbot 136 + Claude-User 4. 검색 591 = Bingbot 61 + Googlebot 321 + Yeti 208 + DuckDuckBot 1. 두 숫자 모두 크롤러 표의 합과 맞는다. 정의는 하나다 — case-report.mjs `AI인가`/`검색봇`.
- **일별 기록**: 이 고객사의 crawl_hits 를 그날 KST 자정까지 누적한다. 17일차는 AI 893 · 검색 566 으로 머리 숫자(18일차 895·591)보다 작고, 1일차는 0 이다(첫 방문 2일차와 맞다). 줄어드는 날이 없다. 전에 1822 > 1486 으로 어긋나던 원인(snapshots.crawl_total 이 여러 고객사를 합침)이 풀렸다.
- **허용 수**: 타임라인과 진단표가 같은 값(robots.txt 에서 센 AI 13·검색 4)을 쓴다. 「17종/11종」 불일치와 「스키마 19종」은 없어졌다.
- 나머지 숫자(진단 92/83, 45편, 55,382자, 경로 횟수, 측정 5회차 줄, 검색 노출 표)도 각각 case-report.mjs 의 쿼리나 스캔 파일 하나에서 나온다. 식별 정보는 없다.

## Must Fix
없음. 공개본을 되돌릴 일도 없다.

## Should Fix
- **case-report.mjs 분류 — Applebot 은 AI 가 아니라 검색으로 둔다. 그리고 분류표를 하나로 만든다.**
  - Apple 은 Applebot(검색: Siri·Spotlight·Safari)과 Applebot-Extended(AI 학습 허용 토큰)를 나눈다. 이 사이트의 robots.txt 도 둘을 따로 적는다. 그러니 Applebot 방문 7회를 AI 로 세면 우리 robots.txt 가 스스로 반박한다. 검색으로 옮기면 AI 888 · 검색 598 이다.
  - meta-externalagent(Meta 가 AI 학습용이라고 밝힘)·Amazonbot(Alexa 답변과 AI 모델에 쓴다고 밝힘)·OAI-SearchBot·Claude-User 를 AI 로 두는 것은 근거가 있다.
  - 분류 정의가 두 벌이다. `AI인가` 는 「검색봇이 아니면 AI」(기본값이 AI), `검색색인` 은 Daum 을 검색에 넣는다. 그래서 Daum 이나 새로 판별표에 들어온 봇이 오면 AI 로 부풀려진다. bots.ts 의 두 칸을 그대로 읽어 한 표로 쓰고, 어느 칸에도 없는 봇은 「기타」로 따로 둔다 — 과장되지 않는 쪽이 기본이어야 한다.
  - robots.txt 의 「AI 13」에는 Google-Extended·Applebot-Extended 처럼 방문하지 않는 제어 토큰이 들어 있다. 문구를 「User-agent 13개 명시 허용」으로 바꾸거나 크롤러와 토큰을 나눠 적는다.
- **case-report.mjs 07 「다음에 할 일」 — 같은 페이지의 데이터와 맞지 않는 문장.** 「엔진별 인용률 측정 — 지금 세면 전 엔진 0% 가 나올 것이 뻔하다」는 문장이 있다. 그런데 06 에는 이미 측정 5회차가 있고, ChatGPT 부분 측정 1/2 인용이 적혀 있다. 이 문장을 지우거나 「같은 방법으로 반복 측정」으로 바꾼다. 06 의 「AI 가 인용하는 문서의 대부분이 제3자 지면」도 숫자 없는 「대부분」이다. 측정 행에서 센 비율을 쓰거나 「첫 기준선에서는」으로 좁힌다.
- **sales.mjs:183 `올리기`(--push) — 커밋 직전에 가림 검사를 한 번 더 한다.** 지금은 앞 단계가 검사를 통과해야만 파일을 쓰고, 앞 단계가 실패하면 푸시 단계가 안 돈다(`if:` 에 success() 가 암묵으로 붙는다). 그러니 지금 새는 길은 없다. 다만 푸시 단계는 워킹 트리에 있는 무엇이든 올린다. 푸시 직전에 `가림검사(파일, await 가릴말())` 를 한 번 더 걸어 두는 게 맞다. 5분이면 된다.

## Escalate to Architect
없음. (묶음 일감 하나에 상위 3곳, 같은 지역에는 링크·실증 언급 없음 — Arch 결정대로 반영됐다.)

## Cleared
- **초안 숫자 검사**: 재료의 숫자 토큰 집합에 통째로 있어야 통과한다. 「30%」「세 배」「두 달」처럼 단위가 붙은 구절은 재료에 그대로 있어야 한다. 틀 구절만 허용 목록에 있다. --draft-test 11/11 이다(부분 숫자 속임 포함). 참인 숫자를 엉뚱한 주장에 붙이는 것은 코드로 막을 수 없다. 발송 전에 원장이 확인한다.
- **가림 검사**: masks.mjs 한 목록을 가림과 검사 양쪽이 같이 쓴다. 원문·URL 푼 원문·태그와 엔티티를 푼 글·정규화본을 본다. 두 글자 지역어는 앞 글자 경계로 오탐을 막는다. 영업 후보 이름을 못 읽으면 멈춘다(fail-closed). --leak-test 20/20.
- **같은 지역**: 송파·강동 후보에게는 링크·「http」·실증·리포트·운영 언급을 검사로 막는다. 틀 문장도 그 경우 말로만 설명한다.
- **sales.yml**: persist-credentials false. GH_TOKEN 은 푸시 단계에만 있고, 시험 모드에서는 푸시가 안 돈다. 초안 claude 는 envDrop(DATABASE_URL·GH_TOKEN·GITHUB_TOKEN), 도구 없음, 임시 폴더다.
- **푸시 실패**: rebase 충돌이면 abort 하고 사람 대기로 올린다. 토큰은 오류 문구에서 가린다.
- **일감**: 주간 묶음 키 하나에 통화문 3곳, 나머지는 이름만 적는다. 낱개 call-* 와 지난주 묶음은 닫는다. 「완료 표시했지만 연락일이 그대로인 후보」를 센다. 발송 경로는 여전히 없다.
