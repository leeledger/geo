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
