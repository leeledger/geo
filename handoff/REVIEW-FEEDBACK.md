# Review Feedback — Step 23 · Step 24
Date: 2026-09-29

판정
- **Step 23 (main 8051c3e + be97bd1): PASS** — Ready for Builder: YES
- **Step 24 (step24-copy 5dacf06 + 77fcbe6): 수정 필요** — Ready for Builder: NO

확인한 것: `web` 에서 `node ./node_modules/typescript/bin/tsc --noEmit` (main 작업트리) → exit 0. `measureConf`·`PC무소식` 을 node 로 불러 봤다(DB 없음): 학원 정규식이 전과 같은 글자, 「똑똑한 로봇&코딩학원」「똑똑한로봇앤코딩」 false, 흔적이 없으면 null, 24시간 1분 → 조용함. DB 쓰기·실측정은 안 했다. 작업트리는 main 그대로.

---

## Step 23

### Must Fix
없음.

### Should Fix
- web/lib/hours-actions.ts:20,29 (confidence: 8) — 날짜는 `/^\d{4}-\d{2}-\d{2}$/` 로만 거른다. `2026-02-31` 은 정규식은 통과하고 `$2::date` 에서 Postgres 오류가 나 서버 동작이 예외로 끝난다. 잘못된 분·빈 내용일 때는 `return` 만 해서 화면에 아무것도 안 뜬다(원장은 저장된 줄 안다). — `Date.parse` 로 실제 날짜인지 보고, 어긋나면 null(= KST 오늘)로 넣거나 `?err=` 로 되돌린다. 5분 일이다.
- tools/ai-web-measure.mjs:350 (confidence: 6) — `coalesce((select id from geo.clients where slug = $1), 1)`: geo.clients 에 없는 슬러그를 주면 「설정 없음」 일감이 학원(1번) 칸에 붙는다. 오타 난 `--client` 가 학원 일처럼 보인다. 확인하고 BUILD-LOG 에 적거나 HOUSE 임을 제목에 밝힌다.
- tools/ai-web-measure.mjs:379-381 (confidence: 5, 확인 필요) — 하루 60 은 적재된 행 + 이번 실행에서 보낸 수로 센다. 같은 날 앞 실행에서 막혀 적재 안 된 시도는 다음 실행에서 안 세진다. 잠금 파일이 겹침은 막고 pc-runner 는 하루 한 번이라 지금은 넘을 일이 드물다. 넘으면 적재 기준 60 은 지킨다. 막지 않는다.

### 확인만 한 것 (결함 아님)
- 영업 숫자: case-report 의 `aiRounds` 쿼리·기존 문장은 손대지 않았다. 새 절은 곳(collection_method)별로만 묶고 「곳별 합계」도 곳 안에서만 더한다(`곳합(m)`). asks.ts `readWeekRates` 도 같다. 곳끼리 합친 비율은 없다.
- 학원 측정: ai-measure 의 정규식이 clients.mjs `answerRe` 로 옮겨졌는데 전과 같은 글자다. 아이로그는 전 `new RegExp(domain)` 과 같은 `/ilog\.ai\.kr/i`. optimize.yml 은 `--client` 없이 부르니 기본 robotncoding 이다. ai-web-measure 는 전에 상한이 없었다(3곳 × 20 = 60). 지금은 모든 고객 합계 60 이라 전과 같거나 더 엄격하다.
- 탐침 몫: 22 − 오늘 measure 호출 수, 못 세면 0. claude-code.mjs 의 기본값 22 와 같다.
- PC 경보: 흔적 셋 중 가장 최근 것 기준이고, 경계는 `>` 24h. 셋 다 못 읽으면 판정하지 않는다. 일감은 `on conflict (client_id, dedupe_key)` 라 하나만 생긴다. sticky 라 신호 닫기에 안 걸리고 PC살핌 안에서만 닫힌다. 표시는 KST. 닫힌 뒤에 다시 조용해지면 `일감()` 의 `'닫힘' → $9` 로 다시 열린다. 켜는 시각이 날마다 달라도 꺼져 있던 시간이 24시간을 넘을 때만 뜬다. 오탐은 「하루 넘게 꺼져 있던 날」로 좁다.
- client_hours: 서버 동작 첫 줄이 `guard()`(isAdmin)고 화면도 isAdmin 이다. 값은 전부 `$n` 매개변수다. 분 1~1440 은 DB check 로도 막힌다. client_id 는 FK 로 막힌다.
- research/ 는 web/ 밖이라 배포되지 않는다. main 에 들어간 공개 문구 변경은 없다(main diff 에 web/app 공개 페이지·services·llms.txt 없음).

### 브랜치 관계 (Arch 참고)
- step24-copy 는 8051c3e 에서 갈라졌다. be97bd1(몫 22) 위가 아니다. 그래서 `git diff main..step24-copy` 에는 claude-code.mjs·ai-measure.mjs·SOP 가 22 → 20 으로 되돌아가는 것처럼 보인다. 브랜치는 그 세 파일을 건드리지 않았다. 보통 `git merge` 를 하면 22 가 남는다. 병합 때 파일을 통째로 덮어쓰거나 브랜치 쪽을 고르지 말 것.

---

## Step 24

### Must Fix
- web/lib/guides.ts:91 (confidence: 10) — 「약 4분의 1」이 공개 본문에 남아 있다.
  `같은 질문을 다시 던졌을 때 추천 목록의 약 4분의 1이 바뀌기 때문에, 횟수가 빠진 한 번의 값은 근거가 되지 않습니다.`
  Arch 반영(77fcbe6)으로 28%와 같은 근거(3쌍)라 내리기로 한 숫자다. Bob 의 확인 grep(`28%|다섯에 하나|다섯 중 넷|3문항`)에 「4분의」가 없어서 빠졌다. — 숫자 없이 「AI 답은 물을 때마다 달라지기 때문에」로 잇는다. 다시 grep 할 때 `4분의` 를 더한다.
- web/lib/services.ts:109 (confidence: 8) — 측정 카드의 제공 목록에 `"질문별 노출률과 흔들리는 범위"` 가 남아 있다. 같은 카드의 terms 에는 `{ k: "시작", v: "30일 파일럿 390,000원" }` 이 있다. 「흔들리는 범위」(신뢰구간)는 Interval 위젯을 지우면서 어디서도 안 만든다. case-report·/admin/asks 는 「n번 중 k번」만 낸다. 신청서에도 없다. 파일럿을 산 고객이 달라고 할 수 있는 약속이다. — 「질문×곳별 최근 7일 n번 중 k번」으로 바꾸거나 줄을 뺀다.

### Should Fix
- web/lib/guides.ts:92 (confidence: 6) — `어떤 질문을 어느 AI 에 몇 번 묻는지를 계약서에 적고`. 신청서·PILOT 은 「수집 방법과 횟수는 보고서마다 적습니다」이고 page.tsx FAQ 는 「시작 전에 적고」로 고쳤다. 「계약서」는 신청서와 말이 다르다. — FAQ 와 같은 말로 맞춘다.

### Escalate to Architect
- web/lib/services.ts:111 `"AI 방문 기록 — 어느 AI가 몇 쪽을 읽었는지"` — 측정 카드가 파일럿 가격과 한 카드에 있는데, 방문 기록(고객 서버 장치 설치)은 신청서 「제공」 여섯 줄에 없다. 파일럿에 넣을지, 「파일럿 뒤」로 옮길지는 상품 결정이다.
- web/public/case/academy.html 「1위」 4곳 — 생성물이고 잰 검색 순위라 거짓은 아니다. 다만 D11 은 「web/ 어디에도 없게」라고 했다. KG-23-4(케이스 리포트 다시 굽기) 때 같이 정할지 결정해 달라.

### 확인만 한 것 (결함 아님)
- PILOT 의 gives 6줄 · llms · noGuarantee · refund 3줄 · refundNote · after 는 브랜치 research/paid-pilot-order-form.md 와 글자가 같다. 「전액」 0건. 「보장」은 전부 부정문이거나 정해진 수정안 문구다. 「1위」는 공개 코드에서 0건이다(주석 lib/ops.ts 와 생성물 case 는 뺐다).
- 진단 가중치: 25·20·20·15·10·3 을 93 으로 나눈다. 보이는 값은 26.9 + 21.5 + 21.5 + 16.1 + 10.8 + 3.2 = 100.0 이고, llms.txt 는 가중치 0 인 참고 줄이다. 사례 게이지에 「채점 기준 바뀜(2026-09-29)」이 붙어 있다.
- 500만원 → 수정안 문구와 출처 링크. 34곳·15번 → 「회사당 15회 표본」. P_HAT 위젯과 관련 CSS 는 지웠고, 남은 곳에서 그 클래스를 쓰는 데는 없다.
- 번역체·AI 티: 새 문구는 짧게 끊겨 있고 빈 강조나 「~라고 할 수 있습니다」가 없다. 걸리는 것 없음.

## Cleared
Step 23: 고객 설정 한 곳, 60질의 상한, 탐침 몫, PC 경보, 반복 비율 표기, 투입 시간 입력을 diff 전부로 봤다. 영업 숫자 식은 그대로다. PASS.
Step 24: 파일럿 단일화, 측정 약속, llms.txt 점수 제외, 근거 문구는 맞다. 막는 것은 guides.ts:91 「약 4분의 1」과 services.ts:109 「흔들리는 범위」 두 줄이다.

---

# Step 24 2차 리뷰 — de2129c (main 위로 rebase 됨)
Date: 2026-09-29
Ready for Builder: NO — **수정 필요**

`main` 이 step24-copy 의 조상인 것을 확인했다. `git diff main..step24-copy` 에는 이제 Step 24 만 보인다. academy/·tools/ 쪽 변경은 case-report.mjs 한 파일(순위 칸)뿐이다. 몫 22 가 20 으로 돌아가는 문제는 없어졌다. tsc 는 main 작업트리 기준 exit 0 이다. 브랜치 쪽은 Bob 보고로 exit 0 이고, de2129c 는 문자열만 바꿨다.

## 1차 항목 처리
- guides.ts:91 「약 4분의 1」 — 지웠다. 해결.
- services.ts:109 「흔들리는 범위」 — 「질문·AI별 최근 7일 n번 중 k번」으로 바꿨다. 신청서에도 같은 줄이 들어갔다. 해결.
- guides.ts:92 「계약서」 — 「시작 전에 적고」로 FAQ 와 맞췄다. 해결.
- 방문 기록(Arch 결정): 측정 카드의 gives·does 에서 지웠고, 신청서에 「파일럿에 들지 않습니다」를 넣었다. 다만 아래 Must Fix 가 남는다.
- 케이스 리포트 순위(Arch 결정): `day()` 가 공개본은 「n일차」, `--private` 는 날짜로 찍는다. 엔진은 `esc()` 를 거친다. 식은 그대로고 라벨만 더했다. 해결.

## Must Fix
- web/lib/services.ts:84 (confidence: 8) — 측정 카드 본문(prose)에 같은 약속이 남아 있다.
  `"AI 가 실제로 사이트를 읽었는지도 따로 확인합니다. 고객사 서버에 기록 장치를 달면 어느 AI 가 언제 몇 쪽을 읽어 갔는지 남습니다. …"`
  이 카드는 terms 에 「시작 — 30일 파일럿 390,000원」이 있는 파일럿 카드다. 그런데 신청서에는 방금 「AI 크롤러 방문 기록(고객 서버 장치)은 파일럿에 들지 않습니다」를 넣었다. Bob 은 does 의 같은 항목을 「같은 약속」이라며 지웠지만 prose 는 남겼다. — 문단을 지우거나, 「기록 장치는 파일럿 뒤 기술 세팅에서 답니다」처럼 파일럿 밖이라는 말을 붙인다.

## Should Fix
- web/lib/guides.ts:184 (confidence: 6) — 가이드 「AI 인용률은 어떻게 재나요」에도 「AI 가 실제로 사이트를 읽었는지는 따로 확인합니다」가 있다. 가이드는 방법 설명이라 막지는 않는다. 위와 같은 말로 맞추면 된다.

## Cleared
de2129c 는 1차 Must Fix 둘, Should Fix 하나, Arch 결정 둘을 반영했다. 막는 것은 services.ts:84 측정 카드 본문의 방문 기록 약속 한 문단이다.

---

# Step 24 3차 — ec48de8
Date: 2026-09-29
Ready for Builder: YES — **PASS**

services.ts:84 와 guides.ts:184 는 이제 방문 기록이 「30일 파일럿에 들지 않고 파일럿 뒤 기술 세팅에서」라고 적는다. 신청서 줄과 같은 뜻이다. services.ts 155·251·258 의 「방문 기록 장치」는 비용이 「파일럿 뒤 선택」인 세팅·구축 카드라 약속이 어긋나지 않는다. 막는 항목 없음.

---

# Step 24 가격표 — 5a30bfa (D12~D15)
Date: 2026-09-29
Ready for Builder: NO — **수정 필요**

## Must Fix
- web/app/PriceCalc.tsx (가격 카드) · web/lib/guides.ts (GEO 비용 사실 카드) · research/paid-pilot-order-form.md 「비용」 (confidence: 9) — 「부가세 별도」가 빠졌다. 지금 운영판(main)에는 두 곳에 있다.
  `main:web/app/PriceCalc.tsx:141  <p className="fine">최소 약정 없음 · 월 단위 · 세금계산서 발행 · 부가세 별도</p>`
  `main:web/lib/guides.ts:156  … 고치는 일까지 맡기시면 79만원입니다. 부가세 별도.`
  브랜치 web/·신청서에서 `부가세|VAT|세금계산서` 는 0건이다. 같은 250·80·39만원이 이제 부가세 포함으로 읽힌다. 금액은 그대로인데 받을 돈이 10% 준다. Bob 은 「신청서에 없어서」 뺐다고 했다. 하지만 운영 중인 가격 표시의 뜻을 바꾸는 일이라 원장 결정 없이는 못 뺀다.
  — 원래 뜻을 지키려면 요금 카드(lp-total 아래)와 가이드 사실 카드에 「부가세 별도 · 세금계산서 발행」을 되살린다. 신청서 「비용」 줄에도 같은 말을 넣어 둘이 같은 글자가 되게 한다. 부가세 포함가로 바꾸려면 원장 결정이 필요하다 → Arch.

## Should Fix
- web/app/PriceCalc.tsx 「도입 사례 학원과 같은 조건」 알약 (confidence: 5, 확인 필요) — 이제 합계에 파일럿 39만원이 들어간다. 학원은 파일럿을 산 적이 없다. 알약의 뜻은 「사이트 조건이 같다」이니 「같은 사이트 조건」처럼 좁힌다.

## 확인한 것 (통과)
- 금액: 브랜치 공개 파일의 금액은 250·80·0·39·79·369·390,000·195,000·500만원이 전부다. 모두 main 요금표·신청서·설계서 D12~D13 에서 나온 값이고 새 숫자는 없다.
- 합계: `first = S.cost + (migrate ? 80 : 0) + 39`. 250 + 80 + 39 = 369 로 신청서 예와 같다. 80 + 39 = 119, 0 + 39 = 39 도 식대로 나온다. 상담 폼으로 넘기는 조건 문자열도 같은 변수를 쓴다.
- 순서: `PILOT.order` 와 신청서 「## 순서」가 글자까지 같다(기준선 먼저 → 구축·세팅 → 연 날부터 30일 → 30일 차).
- 환불: 랜딩 refundNote 는 「이 환불 기준은 30일 파일럿 390,000원에만 해당합니다」다. 구축·세팅 환불은 신청서에만 「계약서에 따로」로 있고 랜딩에는 없다(D15).
- 월 플랜 항목: 「흔들리는 범위」·「AI 방문 기록」·「30개 × 4곳 · 월 2회」 없음. 리포트는 「질문 20개 × AI 4곳 · 하루 1회 · 최근 7일 n번 중 k번」이다. 방문 기록은 세팅·구축 카드에만 있다.
- 되살린 CSS: `.lp-sr`·`.lp-radio`·`.lp-switch`·`.lp-opts3`·`.lp-total ul/li/.sep` 이 브랜치 landing.css 에 있다.
