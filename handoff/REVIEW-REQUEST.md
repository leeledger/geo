# Review Request — Step 23 · 24 · 첫 고객 전 9가지 (역량 검토 반영)
Date: 2026-09-29
Ready for Review: YES

- Step 23: main 커밋 `8051c3e` — 푸시·배포 안 함. 상태 **DONE**
- Step 24: 브랜치 `step24-copy` 커밋 `5dacf06` — 병합·푸시 안 함, 작업트리는 main 으로 돌려 둠. 상태 **DONE_WITH_CONCERNS** (tsc 만 돌렸고 화면은 안 봤다 — 미리보기 필요)
- DB 쓰기 실행 없음(읽기 select 만: 상태 확인·case-report 표준출력). 실측정(ai-measure·ai-web-measure) 안 돌림. 새 표는 코드의 `create table if not exists` 로만

---

## Step 23 (main)

### Files Changed
- academy/clients.mjs:29-31, 60-61, 104-112 — 고객마다 `answerRe`(AI 답 언급 정의) 한 곳. 학원은 「똑똑한」 제외 정규식, 아이로그는 도메인만. `measureConf(slug)` 없으면 null
- tools/ai-web-measure.mjs:10-19, 31, 59-61 — 머리 주석(고객·상한), `--client`(기본 robotncoding), `하루상한 = 60`
- tools/ai-web-measure.mjs:184-224 — `멈추고알림()`: 설정 없음 → `measure-conf-<slug>`, 승인 질문 없음 → `measure-questions-<slug>` 사람 대기(sticky) + exitCode 1. 질문을 읽으면 두 일감을 완료로 닫음. 오늘 로그아웃 화면 적재 수(모든 고객)를 읽음
- tools/ai-web-measure.mjs:239-242, 276-279 — 시도마다 상한 확인(막힌 시도도 셈). 상한에 닿으면 멈춤이지만 실패로 안 적음. agent_activity client_id 를 고객 id 로(전엔 1 고정)
- academy/scripts/ai-measure.mjs:22, 229-232 — 이름 정규식을 clients.mjs 에서. 없으면 「측정 설정 없음」 throw
- academy/scripts/ai-measure.mjs:370-382, 403 — D4 탐침 전 오늘 `purpose='measure'` 호출 수 ≥ `CLAUDE_MEASURE_RESERVE`(기본 20)면 건너뜀, 아니면 남은 몫까지만. 못 세면 안 부름
- tools/heartbeat.mjs:14, 46-69 — 매시 geo.settings `pc_heartbeat`(값=호스트명, updated_at) upsert. 실패해도 GitHub 깨우기는 그대로
- academy/scripts/pc-silent.mjs (새 파일) — 순수 판정 `PC무소식(흔적, now)` · `PC무소식글()`
- academy/scripts/company.mjs:37, 330-353, 447-448 — `PC살핌()`: 흔적 셋(심장박동·로그아웃 측정 imported_at·로컬 에이전트 출근) 중 가장 최근이 24시간 넘으면 `pc-silent` 사람 대기(sticky, 우선 5, agent deliver), 돌아오면 닫고 활동 한 줄. 못 읽으면 판정 안 함. 계획() 끝, 신호 닫기 앞에서 부름
- web/lib/agents.ts:327-330 — 열린 `pc-silent` 일감이 있으면 그 줄(유통) 「늦음」 + 일감 제목
- academy/scripts/case-report.mjs:122-142 — 곳별 방법·기간·표본·원문 보관 수, 질문×곳 최근 7일 쿼리
- academy/scripts/case-report.mjs:225-242 — `방법글()`·곳이름·7일 표 계산
- academy/scripts/case-report.mjs:441-453 — 06절에 「곳마다 잰 방법」 + 원문 보관 한 줄, 그 아래 7일 「n번 중 k번」 표(곳별 합계). 공개본은 질문 번호·단계만, `--private` 만 질문 원문. 기존 aiRounds 줄은 그대로
- web/lib/asks.ts:53-119 — `howOf()`(case-report 와 같은 말) · `readWeekRates()`
- web/app/admin/asks/page.tsx:6, 111, 118, 122, 155-175, 268-293 — 「곳마다 잰 방법」 요약과 「질문별 최근 7일 — 몇 번 중 몇 번」 표
- web/lib/hours.ts (새 파일) — `geo.client_hours` DDL(day 기본값 KST), 읽기(표 없으면 42P01 → 빈 목록), 분→시간 표기
- web/lib/hours-actions.ts (새 파일) — `addHours` 서버 동작(guard, 분 1~1440, 한 일 필수, 날짜 없으면 KST 오늘). 첫 입력 때 표 생성
- web/app/admin/pilots/page.tsx:7-9, 30-44, 55-66, 96-133 — 고객 칩 · 날짜/분/한 일 입력칸 · 고객별 누적 · 선택 고객 최근 10줄. keep-all
- research/paid-pilot-order-form.md — 전면 개정: 제공 6줄(=Step 24 랜딩 문구 원본), llms.txt 무료 부수, 보장 줄, 환불 세 줄(서면), 파일럿 뒤 선택
- research/pilot-measurement-sop.md — 전면 개정: 곳·방법 표, 반복 비율, 막히면(우회 없음·3회 멈춤·원장 손 확인), 「소량으로 알고 받아들인 위험」(OpenAI 약관 조항 인용·하루 60·캡차 3회), Claude Max 몫, 회차·성공 판정

### 결정별로 한 일
- **D1** 위 clients.mjs·ai-web-measure·ai-measure. 아이로그는 설정은 들어 있지만 DB 에 승인 질문이 0개라(읽기 확인) 돌리면 「승인 질문 없음」으로 멈추고 일감이 뜬다. pc-runner 일정엔 안 넣었다 — 넣으면 하루 60 상한(3곳×20)을 학원 혼자 다 쓴다
- **D2** heartbeat.mjs 는 전까지 로컬 로그(heartbeat.log)에만 남겼다 — 서버에서 볼 수 없었다. geo.settings 한 줄로 남기게 했다(새 표 없이, repair.mjs 와 같은 DDL). 판정은 흔적 셋 중 **가장 최근** 기준(하나라도 돌면 PC 는 켜져 있다)
- **D3** 영업 숫자 식은 안 건드림. case-report 의 aiRounds·기존 문장 그대로, 표시만 더함
- **D4** 확인 결과: 측정은 「오늘 전체 호출 < 40」만 본다. 측정이 몫 20 을 넘겨 쓰면 다른 일은 자기 몫 20 을 그대로 쓰니 하루 합이 40 을 넘을 수 있다(측정이 먼저 도는 07:05 기준 20+2+20). 그래서 탐침은 measure 호출 수가 몫 안일 때만. 새 상한 없음(env 값을 그대로 읽음)
- **D5** /admin/pilots 에 넣었다(/admin/ops 는 이미 무겁다). 인증은 기존 isAdmin 그대로(화면·동작 둘 다)
- **D6** research/ 는 web/ 밖 — Vercel 루트가 web/ 이고 웹 코드에서 research 경로 참조 0건. 공개 경로로 안 나감

### 확인 출력
- `node ./node_modules/typescript/bin/tsc --noEmit` (web/) → exit 0
- `node --check` ai-web-measure.mjs · ai-measure.mjs · company.mjs · heartbeat.mjs · clients.mjs → OK
- measureConf / 정규식:
  ```
  robotncoding → id 1 · robotncoding.com · /(?<!똑똑한\s?)(로봇\s?(&|&amp;|앤|and)\s?코딩)|robotncoding/i
  ilog → id 2 · ilog.ai.kr · /ilog\.ai\.kr/i        nope → null
  "석촌동 로봇앤코딩학원" true · "똑똑한 로봇&코딩학원 잠실점" false · "robotncoding.com 참고" true · "코딩학원 목록" false
  "아이로그 학원관리" false · "https://ilog.ai.kr/" true
  ```
- PC 판정(가짜 시각, now=2026-09-29 12:00 KST):
  ```
  모두 최근 → 조용함 false 1h · 심장만 최근(측정 끊김) → false 1h · 25시간 무소식 → true 25h
  정확히 24시간 → false · 심장박동 없음·나머지 100~120h → true 100h · 셋 다 없음 → null(판정 안 함) · Date 객체 → true 30h
  ```
- case-report 표준출력(파일 안 씀): 곳 6줄(OpenRouter API · ChatGPT 로그아웃 13~25일차 표본 42 · Claude Code 18~25일차 140 · Claude 손 8 · Gemini 40 · 퍼플렉시티 40), 7일 합계 ChatGPT 40번 중 12번 · Claude 120번 중 58번 · Gemini 40번 중 13번 · 퍼플렉시티 40번 중 13번
- DB 읽기: ai_measurements 301행 전부 raw 있음 · geo.client_hours 아직 없음 · 최근 3일 claude_calls measure 80

### 판단이 필요했던 곳
1. **하루 60질의 상한을 코드로 넣었다(D1 부수).** SOP 에 「하루 60」을 쓰라고 했는데, `--client` 가 생기면 고객마다 60 이 되어 문서가 거짓이 된다. 모든 고객 합계로 셈
2. **D4 결과로 탐침이 기본값에서 늘 건너뛰어진다.** 승인 20문항 = 몫 20. 탐침을 살리려면 `CLAUDE_MEASURE_RESERVE` 를 22 로(있는 손잡이). Arch 결정
3. **기준선 보고 = 착수 뒤 첫 7일**로 정의했다(신청서·SOP). 환불 경계가 이 사건에 걸려서 정의가 필요했다. 7일은 「최근 7일 비율」과 맞춘 값
4. **성공 판정**을 「같은 곳·같은 방법의 7일 비율이 기준선보다 늘면」으로 옮겼다. 옛 문구(언급·인용이 기준선보다 늘면)의 뜻을 반복 비율에 맞춘 것
5. case-report·asks 의 「하루 1회」는 방법 설명이고, 실제로 빠진 날이 있어 옆에 「잰 날 n일」을 같이 적었다(ChatGPT 13일 기간에 3일)
6. PC 경보 일감 agent 를 deliver 로 — 현황판에서 「원장 PC 작업」이 있는 유통 줄에 늦음이 뜨게

---

## Step 24 (브랜치 step24-copy)

### Files Changed
- web/lib/services.ts:40-70 — `PILOT`(이름·390,000원·선결제·기간·제공 6줄·llms·보장·환불 3줄·환불 주석·파일럿 뒤) + `AFTER`
- web/lib/services.ts:82-164 — 측정: 「약 4분의 1」→ 28% + 표본 작음, 30개→20개, 「4곳에 여러 번」→ 제공 1줄, 7일 비율, 구글·네이버 사람 확인 항목, 비용 → 파일럿/파일럿 뒤
- web/lib/services.ts:164-176 — 기술 세팅: llms.txt 항목 삭제 → 한계에 무료·근거 약함 줄, 크롤러 「검색용·학습용 구분」, 색인 구글·Bing·네이버, 비용 → 파일럿 뒤
- web/lib/services.ts:186, 219-224, 248, 272 — 외부 문서: 「다섯에 하나」에 표본(답 15개·표본 작음), 「효과 확인 2~3개월」 → 수정안 4줄, 구축·이관 가격 삭제
- web/app/PriceCalc.tsx (다시 씀) — 계산기 → 파일럿 카드(PILOT 그대로). 상담 폼에 「30일 파일럿 · 390,000원」 넘김
- web/app/FlowSteps.tsx:7-45 — 두 달 네 단계 → 30일(첫 7일 · 2~3주 · 30일 차 · 파일럿 뒤), llms.txt 칩 삭제
- web/app/page.tsx — FAQ(여러 번→날마다·파일럿, 보장 수정안, **환불 FAQ 추가**, 약정), 사례 게이지 「채점 기준 바뀜(2026-09-29)」, 34곳 「회사당 15회 표본」, 28% 카드 라벨, 서비스·요금·진행 절 문구, 500만원 수정안+출처 링크, 「1위」 → 「가장 높은」, Interval 제거, 발끝 문구
- web/app/Interval.tsx (삭제) · web/app/landing.css — 계산기·신뢰구간 위젯 규칙 88줄 삭제, `.lp-pilot*` 3줄(keep-all)
- web/lib/scan.ts:131-146, 232, 258, 352-360 — WEIGHTS 에서 llmstxt 삭제, 합(93)으로 나눔, 결과엔 「llms.txt (참고 · 점수 제외)」 가중치 0 줄. llms 안내는 pri 3 「참고 · 점수 제외」
- web/app/ScanForm.tsx:92, 96 · web/lib/platform.ts:127 — 「llms.txt 는 참고, 점수 제외」, 플랫폼 안내에서 llms 뺌
- web/lib/guides.ts — 가이드 다섯 편의 28%·「약 4분의 1」·「질문 12개 × 15회」(틀린 설명)·요금(250/80/39/79)·500만원·「30개·월 2회」·「1위」·7개 항목 문구
- web/app/RecordTabs.tsx:13, 62-63, 106 · HeroDemo.tsx:85 · layout.tsx:11 · geo/page.tsx:58 — 「여러 번」→「날마다」, 회사당 15회 표본, 「1위」
- web/public/llms.txt — 하는 일·직접 측정한 것·가격 절
- research/paid-pilot-order-form.md — 환불 세 줄을 랜딩과 같은 글자로(「모두 돌려드립니다」)

### 결정별로 한 일
- **D7** 파는 것은 PILOT 하나. 서비스 네 장은 남기되 비용 칸은 「파일럿 뒤 선택 — 파일럿을 끝낸 곳에만 안내」, 가격 숫자(39·79·80·250만원) 공개면에서 전부 내림
- **D8** 수정안 1·2줄을 PILOT·서비스·FlowSteps·가이드·llms.txt 에. 「여러 번」 → 「날마다 / 하루 1회」
- **D9** 가중치 비례 재분배 = 남은 가중치(합 93)로 나누기. 사례 학원 게이지(옛 진단 83→92)에 「채점 기준 바뀜(2026-09-29)」. 수정안 3줄은 서비스 기술 세팅·llms.txt
- **D10** 아래 근거 표. 34곳 수치엔 「회사당 15회 표본」, 500만원은 수정안 6줄 + 출처 링크(확인함)
- **D11** 「효과 확인 2~3개월」 수정안, 보장 수정안(FAQ·PILOT·llms.txt), 환불 서면 줄. grep 결과는 아래

### 공개 문구 전/후 대조표 (주요)
| 곳 | 전 | 후 |
|---|---|---|
| 요금 절 | 구축 250 · 세팅 80 · 이관 +80 · 월 39/79 계산기 | 30일 파일럿 390,000원 하나 · 제공 6줄 · 보장 줄 · 환불 3줄 · 「파일럿 뒤 선택」 |
| 측정 약속 | 질문 30개를 AI 4곳에 여러 번 · 월 2회 | 승인한 질문 20개를 ChatGPT·Perplexity·Gemini·Claude에 날짜별로 묻고, 답 원문과 출처를 보관합니다. 수집 방법과 횟수는 보고서마다 적습니다 |
| 구글·네이버 | (파일럿 문서) ChatGPT Search·Google AI 개요·네이버 AI × 기준선 2회 | 자동 측정 도구가 없어 담당자가 직접 확인합니다(시작·30일 차 각 1회, 화면 캡처 첨부). 표본이 작아 방향 참고용입니다 |
| 기술 세팅 | robots.txt · llms.txt · 구조화 데이터 적용 / 「llms.txt 를 씁니다」 | AI 검색 봇 접근 허용(검색용·학습용 구분) · 색인 등록(구글·Bing·네이버) · 구조화 데이터 정리 / llms.txt 는 요청하면 무료, 효과 근거 약함 |
| 진행 | 두 달을 이렇게 씁니다 · 1주차~8주차 · 첫 리포트 착수 후 2주 | 30일을 이렇게 씁니다 · 첫 7일~파일럿 뒤 · 기준선 보고 착수 뒤 7일 안 |
| 외부 문서 기간 | 월 단위 · 효과 확인까지 2~3개월 | 두세 달마다 같은 방법으로 다시 재서 보고 (+한계: 변화가 없거나 나빠져도 그대로 적습니다) |
| 28% | 같은 질문을 한 번 더 했을 때 바뀐 추천 목록 / 가이드: 질문 12개 × 15회 | + 자체 측정 3문항 · 표본 작음 · 방향 신호 |
| 약 4분의 1 | 추천 목록의 약 4분의 1이 바뀝니다 | 자체 측정 3문항을 두 번씩 물었더니 28%가 바뀌었습니다. 표본이 작아 방향 신호로만 봅니다 |
| 다섯에 하나 | 직접 물어봤을 때 홈페이지는 다섯에 하나가 안 됐습니다 | 한 업계 질문으로 AI 답 15개를 받아 출처를 세어 보니 … 표본이 작아 방향 신호로만 봅니다 |
| P_HAT 62% 위젯 | 「같은 62%라도 몇 번 물었느냐에 따라」 | 삭제 |
| 34곳 | 회사마다 15번씩이라 | 회사당 15회 표본이라 |
| 500만원 | 국내 GEO 대행사 한 곳의 공개 가격이 월 500만원 | 공개 가격이 있는 국내 GEO 대행사 1곳 기준 월 500만원입니다(출처 링크) |
| 보장 FAQ | 안 합니다. 대신 … 두 달 뒤 | 노출·순위·문의를 보장하지 않습니다. 우리가 보장하는 것은 약속한 작업의 수행과 같은 조건의 재측정 보고입니다 … 30일 차 |
| 환불 | (없음) | 새 FAQ 「중간에 그만두면 돌려받나요?」 + 요금 카드: 착수 전 390,000원 모두 / 기준선 보고 전 195,000원(50%) / 뒤 없음 · 입금 전 서면 |
| 약정 | 최소 약정 없음 · 한 달 단위로 멈춤 | 파일럿은 30일로 끝나고, 이어갈지는 그 뒤에 정합니다 |
| 1위 | 사이트 점수 1위 회사 / 「1위」라 적는 건 | 사이트 점수가 가장 높은 회사 / 「몇 위」라 적는 건 |
| 무료 진단 | 7가지를 봅니다 · 가중치 llms.txt 7 | 7가지를 봅니다(llms.txt 는 참고, 점수 제외) · 점수 6항목 |

### 찾은 숫자 근거 (D10)
| 숫자 | 근거 | 표본 | 처리 |
|---|---|---|---|
| 28% · 약 4분의 1 | `probe/data/report.websearch.txt:26` 반복 간 브랜드 집합 일치도(Jaccard) 72.2% → 1−0.722 = 27.8%. `probe/src/analyze.js:109-120` 식. `mentions.websearch.jsonl` 로 다시 셈: 두 번 물은 문항 p11·p17·p30 세 쌍, Jaccard 0.7222 | 3문항 × 2회 (쌍 3개) | 보고서 수정안 문구 「자체 측정 3문항, 표본 작음, 방향 신호」로 남김. 가이드의 「질문 12개 × 15회」는 **틀린 설명**이라 고침 |
| 다섯에 하나가 안 됨 | 같은 리포트 `:47` 자사 도메인 인용 비중 18.3% (나머지 81.7% 제3자) | ERP 한 업계, 답 15개 | 「답 15개 · 표본 작음」 붙여 남김. 공개 링크는 없다(probe/ 는 배포 안 됨) |
| P_HAT 0.62 | 못 찾음. 가장 가까운 값은 `sample-b2b-joined.json` 더존 presence 62.5 (8회 중 5) — 출처라는 기록 없음 | — | 위젯 삭제 |
| 회사당 15회 | `report.websearch.txt:3` 「실행 15회 · 프롬프트 12개」, 노출률 분모 15 | 답 15개 | 라벨 붙임 |
| 월 500만원 | https://maily.so/georank/posts/32z8d2l1rn4 (지오랭크 뉴스레터, 「단일 언어 월 500만원, 한·영 월 900만원」 — curl 로 200·문구 확인) · research/georank-dossier.md:124 | — | 수정안 6줄 + 링크 |

### 확인 출력
- `node ./node_modules/typescript/bin/tsc --noEmit` (web/, 브랜치) → exit 0
- 신청서 대조(services.ts PILOT 문자열 20자 이상 12개가 research/paid-pilot-order-form.md 에 그대로 있나) → `문장 12 · 어긋남 0` (짧은 「상담 유입 기록표를 드립니다.」도 같은 글자)
- D11 grep `보장|1위|전액|환불` (web/app·lib·public, admin 제외) — 남은 것은 전부 부정·정해진 수정안 문구: page.tsx FAQ 「성과를 보장하나요?」·수정안, PriceCalc 「보장하지 않는 것」, RecordTabs 「「몇 위 보장」은 없습니다」, guides 보장 경계 설명 3곳, services 「게재를 보장하지 않습니다」·환불 주석, llms.txt 환불·보장 줄, public/case/academy.html 「1위」 4곳(검색 순위 측정값 — 생성물이라 안 건드림), lib/ops.ts 주석. 「전액」 0건

### 판단이 필요했던 곳
1. **환불 줄에서 「전액 환불」을 안 썼다.** D11 은 「전액 환불」 표현을 web/ 에서 없애라, 원장 ④ 는 착수 전 전액. 「390,000원 모두 돌려드립니다」로 둘 다 맞춤. 신청서도 같은 글자로 바꿈(브랜치에서만 — main 신청서는 병합 때 맞춰짐, KG-23-5)
2. **P_HAT 위젯을 통째로 뺐다.** 근거가 없어 「삭제」를 따랐다. 「예시 50%」로 라벨을 달아 살리는 길도 있다 — 원장·Arch 선택
3. **28%·「다섯에 하나」는 근거를 찾아 남겼다.** 다만 공개 링크가 없다(probe/ 비공개). 링크가 꼭 있어야 한다고 보면 지워야 한다
4. **진단 가중치**: 정수로 다시 나누면 20·20 동점에서 한쪽을 골라야 해서, 비율 그대로 두고 합(93)으로 나눴다. 화면은 가중치 숫자를 안 보여 준다
5. **probe/src/scan.js(내부 재진단)는 안 고쳤다** — 설계서가 web/lib/scan.ts 만 짚었다. 공개 진단과 내부 점수 기준이 갈린다(KG-23-2)
6. 서비스 네 장을 지우지 않고 「파일럿 뒤 선택」으로 둔 것 — 서비스 상세 페이지·구조화 데이터·가이드 링크가 걸려 있어서
7. **「부가세 별도」「세금계산서 발행」을 요금 카드에서 뺐다** — 신청서에 없는 약속이라

## Open Questions
- 탐침을 살릴지(CLAUDE_MEASURE_RESERVE 22) — Step 23 판단 2
- 공개 case/academy.html 을 새 절(방법·7일 비율)로 다시 구울지 — 원장 결정(KG-23-4)

## Out of Scope (logged in BUILD-LOG)
- KG-23-1 createPilot 업무 목록이 옛 약속 · KG-23-2 probe scan.js llms 가중치 · KG-23-3 /admin/outreach 옛 상품 문구 · KG-23-4 공개 케이스 리포트 재생성 · KG-23-5 main/브랜치 신청서 환불 줄 차이

---

## Arch 반영 (2026-09-29, 리뷰 전)

- **main `be97bd1`** — 측정 몫 기본값 20 → 22. `academy/scripts/claude-code.mjs:36`(주석)·`:79`(기본값), `academy/scripts/ai-measure.mjs:375`(탐침 몫 판정 기본값), `research/pilot-measurement-sop.md:42`. 하루 상한 40 그대로. 승인 20문항 뒤 탐침 2개가 몫 안에 들어간다. 대신 측정 아닌 일(초안·도해·감사·수리)의 몫은 40−22 = 18 로 준다. 워크플로·env 에 `CLAUDE_MEASURE_RESERVE` 를 따로 준 곳은 없다(grep 0건). `node --check` 두 파일 OK
- **step24-copy `77fcbe6`** — 28%·「다섯에 하나」(와 같은 근거인 llms.txt 「다섯 중 넷」)를 공개 문구에서 삭제. page.tsx 28% 카드(lp-stats 에 7/34 카드 하나만 남음), guides.ts 본문 2곳 + 사실 카드 3장, services.ts 본문 2곳, public/llms.txt 2줄. 문장은 숫자 없이 「물을 때마다 달라집니다」, 「출처에는 홈페이지 말고도 비교 기사·목록·커뮤니티 글이 섞여 있습니다」로 이었다. 숫자는 주석(page.tsx:32, guides.ts:17)에 내린 이유와 함께만 남음. tsc exit 0, grep `28%|다섯에 하나|다섯 중 넷|3문항` → 주석 2줄뿐
- 승인됨(변경 없음): P_HAT 위젯 삭제 · 가이드 12×15 정정 · 60질의 모든 고객 합계 · 「390,000원 모두 돌려드립니다」 · 기준선 = 착수 뒤 첫 7일
- 위 Step 24 대조표·D10 근거표의 28%·「다섯에 하나」 줄은 「남김」에서 「삭제」로 바뀐 것으로 읽어 주세요

---

## Step 24 리뷰 반영 (REVIEW-FEEDBACK 2026-09-29)

- 브랜치를 main 위로 rebase 함(충돌 없음). 이제 step24-copy = be97bd1(몫 22) · d6ec9e4 위 `bee561d` → `ed691f8` → **`de2129c`**. claude-code.mjs 기본값 22 확인
- **Must Fix 1** web/lib/guides.ts:91 「약 4분의 1」 → 「AI 답은 물을 때마다 달라지기 때문에, 횟수가 빠진 한 번의 값은 근거가 되지 않습니다.」 다시 grep `4분의|다섯에|28%|%가 바뀌|다섯 중|흔들리는|3문항` (web/app·lib·public, admin 제외) → 주석 2줄(page.tsx:32, guides.ts:17 — 내린 이유)만 남음
- **Must Fix 2** web/lib/services.ts 측정 gives 「질문별 노출률과 흔들리는 범위」 → 「질문·AI별 최근 7일 n번 중 k번」. 신청서 「제공」 아래에 같은 표현 한 줄 추가(「보고서의 비율은 질문·AI별 최근 7일 n번 중 k번으로 적습니다…」)
- **Should Fix** guides.ts:92 「계약서에 적고」 → 「어떤 방법으로 묻는지 시작 전에 적고」(page.tsx FAQ 와 같은 말)
- **Arch 결정 — 방문 기록**: 신청서에 크롤러 방문 기록이 없다 → 측정 카드 gives 「AI 방문 기록」 줄과 does 「AI가 실제로 읽었는지 확인합니다」(같은 약속) 삭제. 신청서에 「AI 크롤러 방문 기록(고객 서버 장치)은 파일럿에 들지 않습니다」 한 줄. 기술 세팅·구축 카드(파일럿 뒤 선택)의 방문 기록 장치는 그대로
- **Arch 결정 — 케이스 리포트 1위**: academy/scripts/case-report.mjs 검색 노출 표의 순위 칸에 측정일·엔진을 붙임(serp 쿼리에 day 추가). 공개본은 날짜 규칙(달력 날짜 → 일차)대로 「25일차 측정 · 네이버 웹문서」, `--private` 는 「09. 29. 측정 · 네이버 웹문서」(표준출력으로 확인). web/public/case/academy.html 은 다시 굽지 않음 → KG-24-1
- tsc(web/, 브랜치) exit 0
- 안 한 것: Step 23 Should Fix(hours-actions 날짜 검증·ai-web-measure 없는 슬러그 칸)는 이번 지시 범위 밖이라 BUILD-LOG 에만
