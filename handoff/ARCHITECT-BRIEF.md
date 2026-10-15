# Architect Brief — Step 47 · 사이티드 랜딩 문구 다시 쓰기 + cited.kr 온페이지 GEO

## Goal
처음 온 사람이 10초 안에 「사이티드(Cited)는 AI 답에 우리 회사 이름이 나오게 만드는 대행사, 39만원 30일로 시작」을 알고, AI 가 그 문장을 그대로 인용할 수 있게 된다. 모든 주소는 https://cited.kr 로 모이고 옛 주소는 308 으로 넘어간다.

원장 말(2026-10-15): 「직관적으로 이해할 수 있게 … 임팩트 있으면서 꼭 해야 하는 구매욕구를 자극」 + 「사이티드도 GEO 최적화를 해놔야지」.

---

## 0. 긴장을 어떻게 푸는가 (구매욕 vs 지어내기·불안 금지)

불안·가짜 증거 없이 쓸 수 있는 지렛대만 쓴다. 근거를 옆에 둔다.

| 지렛대 | 참인 이유 | 쓰는 자리 |
|---|---|---|
| 안 보이던 문제를 보이게 | AI 답은 손님 화면에만 뜬다. 사장님은 빠진 걸 모른다 — 사실 진술, 위협 아님 | 히어로 h1·시연(HeroDemo 그대로) |
| 30초 자가 확인 | 「ChatGPT 에 손님 말투로 쳐 보세요」 — 돈·코드 안 드는 행동. 결과는 본인이 본다 | 히어로 폼 아래 한 줄 |
| 구체적 작동 원리 | 19점 회사 8/15 vs 80점 회사 3/15, 비교 글 9/14 vs 0/14 (probe/data, page.tsx:31 주석) | #data 를 2번째로 올림 |
| 일차 붙은 자기 실증 | 대표 학원: 0/8 기준선, 지역 검색어 0→W/T(DB 실시간), 188→933자, 첫 봇 방문 | #case 를 3번째로 올림 |
| 낮은 문턱 | 39만원 선결제 · 착수 전 전액 · 기준선 보고 전 50% 환불 (lib/services.ts PILOT) | 히어로 링크·요금 sub·FAQ |
| 현상 유지 비용 = 사실 | 「학원 이름이 나온 답 2개의 출처는 학원 목록 사이트」 — 빠지면 남이 그 자리를 채운다는 걸 기록으로만 | #case 카드 |
| 안 맞는 곳을 먼저 말함 | 「이름으로 찾아오는 브랜드엔 필요 없다」 | #who 그대로 |

**쓰지 않는 것**: 외부 시장 통계(Pew·구글 발표 — research/business-validation 에 있지만 CLAUDE.md 「저장소·측정 숫자만」·가이드 절 약속과 어긋남), 학원 AI 언급률 25→29%(기준선이 착수 17일 뒤라 약함, 메모리 results-check-2026-10-13), 「~안 하면 늦습니다」류, 이름 질문 결과. 달력 날짜 대신 「N일차」(page.tsx:27 기존 결정 유지).

---

## 1. 지금 문구 진단 (절별)

| 절 | 10초 안에 아는 것 | 막히는 곳 |
|---|---|---|
| 히어로 (HeroDemo.tsx:81-86, page.tsx:197-235) | 「AI 에 물었을 때 이름이 나오나」라는 질문은 잘 박힌다 | **누가 무엇을 파는지 문장이 없다.** 「사이티드는 ~」 0회. lede 가 시연 질문 `{s.q}` 에 묶여 길다. CTA 「무료 진단」은 노출 여부를 볼 것처럼 보이지만 실제로는 사이트 기술 점수만 본다 → 기대 어긋남. 무료 진단 38회·리드 0 (research/business-validation-2026-09-17.md:47). 증거 줄은 「크롤러 누적 방문」 — 사는 사람에겐 허영 숫자, 「크롤러」는 은어. 가격 신호 없음 |
| #geo GEO 가 뭔가요 | SEO/GEO 대비표는 좋다 | 약어부터 꺼낸다. 끝 문단이 앞 문단 반복(「반대로 홈페이지는 허술한데…」) |
| #proof 말 대신 기록 | — | **가장 큰 은어 덩어리.** 게이지 92점·「채점 기준 바뀜 llms.txt」·robots.txt 코드. 기술 점수는 성과가 아니다(business-validation:23,37). 원장에게 의미 없음. 방문 로그는 #case 에 또 있다(중복) |
| #why 리포트 세 장 | 실물 보고서 | 무엇을 사는지 모르는 상태에서 나온다 — 순서 문제 |
| #who | 맞는 곳/안 맞는 곳 명확 | 문제없음. 제목만 질문형으로 |
| #data 34곳 | **작동 원리의 핵심 증거** | 6번째에 묻혀 있다 |
| #services·#price·#how | 정확함 | 증거(#case)보다 돈 얘기가 먼저 |
| #case | 가장 강한 자기 실증 | 10번째. **「도입 사례」라 유료 고객처럼 읽힌다 — 실제는 대표가 운영하는 학원. 유료 고객 0(메모리 results-check). 지어내기 규칙 위반 소지** |
| #diff·#nots | 신뢰 지렛대 | #diff 는 #why·FAQ 「숫자를 어떻게 믿나요」와 겹치지만 짧아서 둔다 |
| #guides | 내부 링크 | FAQ 앞에서 흐름을 끊는다 |
| 전체 | — | 주체 이름이 「Cited 사이티드」「저희」「우리」로 흩어짐. 질문형 소제목 거의 없음. 인용할 정의문 없음 |

---

## 2. 새 순서 (JSX 블록 이동만, 컴포넌트 로직 그대로)

```
hero ─▶ #geo(하는 일) ─▶ #data(왜 비교 글인가) ─▶ #case(첫 적용 기록) ─▶ #who
     ─▶ #services ─▶ #how ─▶ #why(보고서 실물) ─▶ #price ─▶ #diff ─▶ #nots
     ─▶ #faq ─▶ #guides ─▶ #start ─▶ footer
삭제: #proof 절 통째 (page.tsx:298-354). SCAN·Gauge·R·RING 도 같이 지운다(안 쓰면 lint).
      FIRST_VISITS 는 #case 로그에서 계속 쓴다 — 남긴다.
```
- 묻는 순서: 뭐 하는 회사? → 왜 먹히나? → 해 봤나? → 우리도 해당? → 뭘 해 주나 → 어떻게 → 뭘 받나 → 얼마 → 믿을 만한가 → 질문 → 시작.
- SiteNav.tsx 라벨: 「GEO란」→「하는 일」, 「도입 사례」→「첫 적용 기록」. href 그대로.
- landing.css 의 #proof 전용 규칙(.lp-gauge·.lp-code 등)은 지우지 않는다 — KG-47-4.

---

## 3. 최종 문구 (그대로 붙인다)

표기: 「사이티드(Cited)」는 각 절 첫 정의문·FAQ 1·메타·JSON-LD·푸터에서 이 꼴 그대로. 본문 반복은 「사이티드」. 「저희」는 새 문구에 쓰지 않는다.
`[출처]` 표시는 브리프용이다. 화면에 내지 않는다.

### 3-1. 메타 (page.tsx 에 `export const metadata` 신설 · layout.tsx 기본값도 같은 title/description)
- title: `사이티드(Cited) — AI 답변에 우리 회사 이름이 나오게 하는 GEO 대행사`
- description: `사이티드(Cited)는 손님이 ChatGPT·Perplexity·Gemini·Claude 에 물었을 때 답에 회사 이름이 나오게 만드는 대행사입니다. 30일 파일럿 39만원. 홈페이지 주소만 넣으면 무료 진단.` [39만원: PILOT.price]
- openGraph: title·description 같음, url `/`, siteName `사이티드(Cited)`, locale `ko_KR`, type website
- alternates.canonical: `/` (metadataBase 가 cited.kr 로 푼다 — 4절)
- layout.tsx 의 `robots`(NEXT_PUBLIC_ALLOW_INDEX) 줄은 손대지 않는다

### 3-2. 히어로 (HeroDemo.tsx:81-86 · page.tsx:197-235)
- 배지: `AI 답변 노출 대행 · 사이티드(Cited)`
- h1: `손님은 AI가 꼽아 준<br /><span>몇 곳만 봅니다</span>`
- lede (정적. `{s.q}` 빼기):
  `사이티드(Cited)는 그 몇 곳에 우리 회사 이름이 들어가게 만드는 대행사입니다. 손님이 칠 질문을 AI 네 곳에 날짜별로 묻고, 몇 번 중 몇 번 나오는지 셉니다. 빠졌으면 AI 가 참고하는 글을 고칩니다.` (「들어가게 만드는」 「몇 번 중 몇 번」 「AI 가 참고하는 글」은 `<b>`) [AI 네 곳·날짜별: PILOT.gives[0]]
- 업종 바꿔 보기·채팅 시연·「같은 질문 다시 묻기」: **그대로** (안 보이던 문제를 보이게 하는 자리)
- 폼 아래 새 한 줄 (page.tsx children, ScanForm 다음, `<p className="lp-herohint">`):
  `무료 진단은 홈페이지를 AI 가 읽을 수 있는지 봅니다. 답에 이름이 나오는지는 지금 직접 확인해 보세요. ChatGPT 에 손님 말투 그대로 「○○구 치과 추천해줘」.`
- lp-herolinks: `30일 파일럿 39만원 보기 →` (href `#price`) · `대표 학원에 먼저 해 본 기록 →` (href `#case`)
- 증거 줄 머리: `첫 적용 · 사이티드 대표가 운영하는 학원 · 서버·검색 기록 · 매일 갱신`
- 증거 칸 4개 (null 이면 숨김 규칙 그대로):
  1. `{caseDay}일차` / `착수일부터 센 날`
  2. **새 칸** `webTotal !== null` 일 때: 값 `0 → <Count to={webWins}/>` 단위 `/ {webTotal}` / 라벨 `학원 이름 없이 친 검색어에 노출` [DB serp · lib/ops.ts rivalTally]
  3. `<Count to={vendors}/>곳` / `다녀간 AI·검색 봇` (「크롤러」→「봇」)
  4. `<Count to={posts}/>편` / `AI 가 읽을 수 있게 된 글`
  - 「크롤러 누적 방문 hits」 칸은 히어로에서 뺀다(#case 카드엔 남음)

### 3-3. #geo
- lab: `사이티드가 하는 일`
- h2: `AI는 추천할 이름을<br /><span className="hl">어디서 고르나요?</span>`
- define:
  `AI 는 우리 홈페이지만 보고 고르지 않습니다. 비교 글, 후기, 업체 목록을 같이 읽고 거기 자주 나오는 이름을 꼽습니다. 사이티드(Cited)는 두 가지를 합니다. 우리 사이트를 AI 가 <b>읽을 수 있게</b> 고치고, AI 가 참고하는 글에 우리 이름이 <b>들어가게</b> 합니다. 이 일을 <b>GEO(생성형 엔진 최적화)</b>라고 부릅니다.`
- 대비표(lp-vs): 그대로
- note: `그래서 홈페이지를 잘 만들어도 비교 글에 이름이 없으면 답에서 빠집니다. 바로 아래가 사이티드가 직접 잰 기록입니다. SEO 를 이미 맡긴 곳이 있다면 그대로 두셔도 됩니다.`

### 3-4. #data (#geo 바로 다음으로 이동)
- lab: `직접 잰 것 · 소프트웨어 회사 34곳`
- h2: `홈페이지 점수가 높으면<br /><span className="hl">AI 에 더 나오나요?</span>`
- sub: `아니었습니다. 사이티드가 국내 소프트웨어 회사 34곳 홈페이지를 진단했고, 그중 한 업계는 AI 에 같은 질문을 회사당 15번 물었습니다. <b>표본이 작아</b> 방향으로만 봐 주세요.` [probe/data — page.tsx:31 주석]
- 막대 두 개: 그대로 (19점·8/15·9/14 · 80점·3/15·0/14)
- split-foot: `19점 회사가 80점 회사보다 AI 답에 더 자주 나왔습니다. 차이는 비교 글이었습니다. 그래서 일이 둘입니다. 사이트를 AI 가 <b>읽을 수 있게</b> 만드는 일, AI 가 참고하는 비교 글·목록에 이름을 <b>넣는</b> 일.`
- stat 7/34: 그대로

### 3-5. #case (3번째로 이동)
- lab: `첫 적용 · 사이티드 대표가 운영하는 수도권 코딩·로봇 학원 · {caseDay}일차`
- h2: `홈페이지 없이 블로그만 있던 학원은<br />어떻게 됐나요?`
- sub: `사이티드는 남에게 팔기 전에 대표가 운영하는 학원에 먼저 했습니다. 학원 이름과 지역은 가렸습니다. 숫자는 <b>서버와 검색 기록에서 매일 다시 가져오고</b>, 안 오른 숫자도 같은 크기로 싣습니다.`
- 카드 1 (경쟁 검색어) 머리 그대로. 본문:
  `「○○구 코딩학원」처럼 학부모가 <b>학원 이름 없이</b> 치는 검색 {webTotal}개입니다. 검색엔진 한 곳 이상에서 학원 사이트가 나오면 셉니다. 착수 때 위쪽은 전부 학원 목록 사이트였고 학원 홈페이지는 한 곳도 없었습니다.`
- 카드 2 (플레이스): 그대로
- 카드 3 (봇): 머리 `다녀간 AI·검색 봇 · {caseDay}일차`. 본문 그대로
- 카드 4 머리: `AI 답변 · 착수 때 기준선` `0 / 8`. 본문:
  `검색을 켠 AI 한 곳에 학부모 질문 8개를 한 번씩 물었습니다. 이 학원 사이트를 출처로 단 답은 <b>0개</b>였습니다. 학원 이름이 나온 답 2개의 출처는 <b>학원 목록 사이트</b>였습니다. 같은 8개를 같은 방법으로 다시 물은 결과는 아직 싣지 않았습니다. 다른 방법으로 잰 값과 섞지 않습니다.`
- 타임라인·방문 로그·「전체 기록 보기」: 그대로

### 3-6. #who
- lab: `맞는 곳 · 안 맞는 곳`
- h2: `우리 업종도<br />해당되나요?`
- sub: `손님이 고르기 전에 「어디가 괜찮아?」를 한 번은 묻는 업종이면 해당됩니다. 학원, 병원·치과, 세무·법무 사무소, 인테리어, 소프트웨어 회사가 그렇습니다. 그 질문을 AI 에게 하는 손님도 있습니다.`
- 두 목록: 그대로

### 3-7. #services
- h2: `사이티드에 맡기면<br /><span className="hl">무엇을 하나요?</span>`
- sub: `모든 곳은 30일 파일럿 하나로 시작합니다. 홈페이지가 없거나 AI 가 못 읽는 곳만 구축·기술 세팅을 한 번 더합니다. 쓸 만한 홈페이지가 있으면 새로 만들지 않습니다. 월 구독은 파일럿을 끝낸 곳에만 안내합니다.`

### 3-8. #how
- h2: `30일 동안<br />무엇을 하나요?`
- sub: `첫 7일에 지금 숫자를 남기고, 30일 차에 같은 질문으로 다시 셉니다. 그 사이에 틀린 정보를 맞추고 글을 씁니다.`
- flownote: 그대로

### 3-9. #why (#how 다음으로 이동)
- lab: `받는 보고서`
- h2: `보고서에는<br /><span className="hl">무엇이 들어가나요?</span>`
- sub: `아래 세 장은 실제로 남긴 기록입니다. 앞의 두 장은 소프트웨어 회사 한 곳을 진단한 보고서, 마지막 장은 대표 학원의 작업 기록입니다. 회사 이름은 가렸습니다.`

### 3-10. #price
- h2: `30일 파일럿은<br /><span className="hl">얼마인가요?</span>`
- sub: `사이티드는 30일 파일럿 39만원으로 시작합니다. 선결제입니다. 착수 전에 그만두시면 전액, 기준선 보고 전이면 절반을 돌려드립니다. 홈페이지 구축·기술 세팅은 필요한 곳만 한 번 냅니다. 월 구독은 파일럿 뒤에 정합니다.` [PILOT.price·pay·refund[0..1]] — PILOT 과 어긋나지 않게 verify 에 대조 단정 하나(PILOT.price 가 390,000원이고 refund[1] 에 50% 가 있는지)
- pcompare:
  `공개 가격이 있는 국내 GEO 대행사 한 곳은 월 500만원입니다(<a …>출처</a>). 사이티드는 <b>학원·병원·사무소 한 곳 규모</b>에 맞췄습니다. 더 싼 해외 측정 도구도 있습니다. 질문을 직접 짜고, 결과를 직접 읽고, 직접 고칠 수 있다면 <b>그 도구가 낫습니다.</b> 「○○구 코딩학원」 같은 한국어 지역 질문은 직접 넣으셔야 합니다.` [500만원: 기존 maily 링크 · research/georank-dossier.md:124]

### 3-11. #diff · #nots
- #diff: 그대로
- #nots sub: `몇 달은 효과가 나고 그 뒤에 손해가 되는 방법이 있습니다. 사이티드는 쓰지 않습니다.` 나머지 그대로

### 3-12. FAQ (FAQ 배열 하나 — 화면과 JSON-LD 가 같은 배열. 이 순서)
1. 새 `사이티드(Cited)는 무슨 회사인가요?` — `사이티드(Cited)는 손님이 ChatGPT·Perplexity·Gemini·Claude 에 물었을 때 답에 회사 이름이 나오게 만드는 마케팅 대행사입니다. 같은 질문을 날짜별로 물어 몇 번 중 몇 번 나오는지 세고, AI 가 참고하는 사이트와 비교 글을 고칩니다. 학원·병원·사무소 한 곳 규모에 맞췄습니다.`
2. 새 `무료 진단은 무엇을 보나요?` — `홈페이지를 AI 가 읽을 수 있는 상태인지 봅니다. AI 봇 허용, 구조화 데이터, 문단 길이 같은 7개 항목입니다. 답에 이름이 나오는지는 무료 진단으로 알 수 없습니다. 같은 질문을 여러 날 물어야 해서 30일 파일럿에서 셉니다.` [7개: 기존 #start 문구 page.tsx:696. Bob 이 진단기 항목 수를 grep 으로 확인, 다르면 숫자를 빼고 「~같은 항목」]
3. 새 `비용은 얼마인가요?` — `30일 파일럿 39만원으로 시작합니다. 선결제입니다. 홈페이지가 없으면 구축 250만원(기술 세팅 포함), AI 가 못 읽는 사이트면 기술 세팅 80만원을 한 번 냅니다.` + 끝에 `PILOT.after` 보간 [lib/services.ts:169·269]
4. `직접 하면 안 되나요?` — 그대로
5. `얼마나 걸리나요?` — `사이티드 대표가 운영하는 학원은 착수 넷째 날 네이버 검색에 사이트가 처음 잡혔고, 여섯째 날 학원 이름 없이 친 지역 검색어에 나오기 시작했습니다. AI 답변에 이름이 붙기까지 얼마나 걸리는지는 아직 모릅니다. 같은 조건으로 다시 재면 사례 기록에 그대로 적습니다.` [TIMELINE 4·6일차]
6. `성과를 보장하나요?` — 그대로
7. `중간에 그만두면 돌려받나요?` — 그대로 (PILOT 보간)
8. `숫자를 어떻게 믿나요?` — 그대로
9. `SEO 대행사와 뭐가 다른가요?` — 그대로
10. `그만두면 뭐가 남나요?` — 그대로

### 3-13. #guides (FAQ 뒤로) · #start · 푸터
- #guides: 문구 그대로, 위치만
- #start sub: `AI 가 우리 사이트를 읽을 수 있는지 점수가 바로 나옵니다. 답에 이름이 나오는지까지 세고 싶으면 아래에 상담을 남겨 주세요. 홈페이지가 없어도 됩니다.`
- 패널·버튼 라벨(「무료 진단 받기」「상담 신청」): 그대로 — 짧고 정확하다
- 푸터 desc: `사이티드(Cited)는 손님이 AI 에게 물었을 때 답에 회사 이름이 나오게 만드는 마케팅 대행사입니다.`
- 푸터 「기록」 링크: `도입 사례 리포트` → `첫 적용 기록(대표 학원)`
- 푸터 wm 둘째 문장: `사례의 방문 기록은 서버에 남은 원본이고, 대표가 운영하는 학원이라 이름과 지역만 가렸습니다.`
- 푸터 `© 2026 Cited 사이티드` → `© 2026 사이티드(Cited)`
- 파일 머리 주석(page.tsx:19-24) 순서 설명을 새 순서로, 「도입 사례」→「첫 적용」 결정(D122) 한 줄

### 3-14. JSON-LD (page.tsx SCHEMA)
- Organization: name `사이티드(Cited)`, alternateName `["사이티드", "Cited"]`, url = SITE_URL, description = FAQ 1 답의 첫 문장, areaServed KR, knowsAbout 그대로. **sameAs 넣지 않는다** — 사이티드 자체 계정 근거 없음(grep sameAs·youtube·instagram → web/lib/visit.ts 유입 분류 목록뿐. 유튜브 채널은 학원 것)
- Service: name `AI 답변 노출 대행(GEO)`, provider·OfferCatalog 그대로, **추가** offers = Offer { name: PILOT.name, price: "390000", priceCurrency: "KRW", url: SITE_URL + "/#price" } — price 는 PILOT.price 에서 숫자만 뽑는다(하드코딩 금지)
- FAQPage: 그대로 FAQ.map — 10문항이 화면과 1:1

---

## 4. 47a — 도메인·온페이지 GEO (문구보다 먼저, 커밋 따로)

```
요청 ─▶ host == geo-rose-nine.vercel.app ? ─ no ─▶ 평소대로
                       │ yes
                       ├─ /api 또는 /api/* ─▶ 평소대로 (스크립트·Actions·웹훅 보호)
                       └─ 나머지 ─▶ 308 https://cited.kr/<같은 경로>?<같은 쿼리>
SITE_URL = clean(NEXT_PUBLIC_SITE_URL) || "https://cited.kr"
  └─▶ metadataBase · canonical · OG · JSON-LD · sitemap · robots · llms.txt
```

1. **새 `web/lib/site.ts`** — `SITE_URL`: env 를 trim, 앞의 BOM(U+FEFF) 제거, 끝 `/` 제거, `new URL()` 로 검증(https·http 만). 실패하거나 비면 `https://cited.kr`. 정리 함수도 export(시험용). 머리 주석에 PowerShell BOM 함정 한 줄(CLAUDE.md).
2. 옛 fallback 6곳을 SITE_URL import 로: `app/page.tsx:37`, `app/sitemap.ts:11`, `app/robots.ts:32`, `app/geo/page.tsx:19`, `app/geo/[slug]/page.tsx:35`, `app/services/[slug]/page.tsx:29`. **robots.ts 의 BOTS 목록·규칙은 한 글자도 안 바꾼다.**
3. `app/layout.tsx`: `metadataBase: new URL(SITE_URL)`. layout 에 canonical 은 **넣지 않는다**(모든 하위 페이지가 `/` 를 물려받는다).
4. canonical — 각 페이지 metadata 에 상대 경로: `/` (page.tsx), `/services` (services/page.tsx), `/services/<slug>`, `/geo`, `/geo/<slug>`. 없는 slug 분기에는 안 단다.
5. **llms.txt 생성** — `web/public/llms.txt` 삭제, `web/app/llms.txt/route.ts` 신설(GET → `text/plain; charset=utf-8`, `dynamic = "force-static"`). 본문은 지금 llms.txt 를 바탕으로:
   - 머리 `# 사이티드(Cited)` + 정의문 = FAQ 1 답
   - 「가격」 절의 파일럿 가격·환불·월 구독 줄은 PILOT 상수에서 보간(지금 파일은 손으로 옮긴 사본)
   - 「도입 사례」 → 「첫 적용 — 대표가 운영하는 학원」, 첫 줄을 3-5 sub 와 같은 사실로
   - 「연락」 = SITE_URL · SITE_URL/#start, 「전체 기록」 = SITE_URL/case/academy.html
   - `geo-rose-nine` 문자열 0개
6. **옛 도메인 308** — `web/next.config.mjs` 에 `async redirects()` 두 규칙:
   - source `/`, has host `geo-rose-nine.vercel.app`, destination `https://cited.kr/`, permanent true
   - source `/:path((?!api(?:/|$)).+)`, 같은 has, destination `https://cited.kr/:path`, permanent true
   - Flag: destination 은 SITE_URL 이 아니라 리터럴 `https://cited.kr` — 옛 호스트 하나만 다루고, env 가 잘못 들어가도 루프가 안 생긴다. 미리보기 배포(`geo-*.vercel.app`)는 host 가 달라 안 걸린다.
   - Flag: Next 버전이 학습 데이터와 다르다(web/AGENTS.md). `node_modules/next/dist/docs/` 에서 redirects·has·쿼리 보존을 먼저 읽는다. 정규식이 안 먹으면 proxy(구 middleware)로 갈아타지 말고 멈추고 Arch 에게.
7. 옛 도메인 절대 주소(스크립트·lib)는 **고치지 않는다** — KG-47-3.

## 5. 47b — 문구 (3절 그대로)
- 고치는 파일: `web/app/page.tsx`, `web/app/HeroDemo.tsx`(81-86 만), `web/app/layout.tsx`(메타 기본값), `web/app/SiteNav.tsx`(라벨 2개), `web/app/landing.css`(`.lp-herohint` 한 규칙 — `.lp-herolinks` 근처, 색 `var(--lp-on2)`, 15px, margin-top 14px, `word-break:keep-all`)
- 안 고치는 파일: FlowSteps·RecordTabs·PriceCalc·ScanForm·ContactForm·Faq·ChatDemo 내부 문구, lib/services.ts, lib/ops.ts
- Flag: 출처를 못 대는 숫자는 한 개도 더하지 않는다. 출처 있는 숫자도 브리프 밖이면 넣지 않는다
- Flag: h2 의 `<br />` 는 1440 에서 두 줄로 끊기게. 390 에서 한 단어가 줄에 혼자 남으면 `<br />` 만 옮기고 문구는 안 바꾼다
- Flag: 히어로 lede 에서 `s.q` 를 빼도 `s` 는 채팅에서 계속 쓴다 — 변수 지우지 말 것

## Out of Scope
- 바깥 등록(GSC·빙·네이버·IndexNow·Brave) — 원장 몫
- FlowSteps·RecordTabs·PriceCalc·/services·/geo 본문 문구 → KG-47-1
- 무료 진단을 「AI 답 노출 확인」으로 키우는 기능 → KG-47-2
- 스크립트·DB 의 옛 도메인 절대 주소 → KG-47-3
- #proof 전용 CSS 청소 → KG-47-4
- academy/ 는 일절 손대지 않는다

## 실패 모드

| 새 경로 | 현실적 실패 | 처리 | 사용자에게 |
|---|---|---|---|
| 308 | /api 까지 넘어가 Actions 의 LLM_PROXY_URL(`…/api/llm`)·lead POST 가 깨짐 | 정규식 제외 + curl 단정 | 조용한 실패였을 것 → 시험으로 막음 |
| 308 | cited.kr 이 Vercel 에 안 붙어 있음 → 옛 주소 방문자 전부 죽은 곳으로 | 배포 **전** `curl -sI https://cited.kr/` 200·`server: Vercel` 확인. 아니면 redirects 만 빼고 배포 | 시험으로 막음 |
| 308 | 관리 화면 쿠키는 호스트별 → 옛 북마크로 들어가면 cited.kr 에서 다시 로그인 | 받아들임. 보고에 한 줄 | 로그인 화면(명확) |
| SITE_URL | 원장이 PowerShell 로 env 를 넣어 BOM·줄바꿈·끝 `/` 가 붙음 | clean() + URL 검증 + fallback | canonical 틀릴 일 없음 |
| SITE_URL | env 를 배포 뒤에 넣음(NEXT_PUBLIC 은 빌드 때 박힘) | fallback 이 이미 cited.kr | 없음 |
| llms.txt | public/llms.txt 를 안 지워 충돌·옛 파일이 이김 | 삭제 + 단정(옛 도메인 0) | 시험으로 막음 |
| FAQ JSON-LD | 화면 10문항과 어긋남 | 같은 배열 + 파싱 대조 단정 | 시험으로 막음 |
| 증거 칸 | ops 못 읽음 → null | 기존 null 숨김. 새 칸도 `webTotal !== null` | 칸이 안 보임(지어낸 0 없음) |
| 증거 칸 | rivalWon 이 빙 가짜 결과로 부풀음(메모리 bing-fetch-returns-junk) | Bob 이 REVIEW-REQUEST 에 오늘 값과 엔진별 이긴 검색어를 DB 에서 뽑아 붙인다. 빙만으로 이긴 줄이 있으면 Arch 판단 | 라벨이 「한 곳 이상」이라 정직 |
| 「대표가 운영하는 학원」 | 원장이 관계 공개를 원치 않음 | D122 — 거부 시 「대표가 운영하는」만 빼고 「첫 적용」은 남긴다. 「도입 사례」로는 되돌리지 않는다(유료 고객처럼 읽힘) | — |
| 긴 한국어 줄 | 390 에서 단어 중간 줄바꿈·넘침 | keep-all·가로 스크롤 단정·스크린샷 | 시험으로 막음 |

## 시험 지도

`handoff/research/step47/verify.mjs`(Playwright, step46/verify.mjs 를 본뜸)를 `next build && next start` 위에서. 결과 `handoff/research/step47/assertions.txt`.

| 대상 | 상태 |
|---|---|
| `/` HTML 에 `<link rel="canonical" href="https://cited.kr/">` — env 없이 빌드해도 | [GAP] → 새 단정 |
| `/` 의 모든 `application/ld+json` 이 JSON.parse 됨. Organization.url = `https://cited.kr`, name = `사이티드(Cited)`, sameAs 없음, Offer.price = "390000" | [GAP] → 새 단정 |
| FAQPage.mainEntity 10개, 각 name/text 가 화면 `<Faq>` 질문/답 글자와 같음 | [GAP] → 새 단정 |
| `og:url` = `https://cited.kr/`, title 이 3-1 과 같음, ALLOW_INDEX=true 빌드에서 noindex 없음 | [GAP] → 새 단정 |
| `/services`, `/services/<첫 slug>`, `/geo`, `/geo/<첫 slug>` canonical 이 각자 경로 | [GAP] → 새 단정 |
| `/sitemap.xml`·`/robots.txt`·`/llms.txt` 에 `cited.kr` 있고 `geo-rose-nine` 0 | [GAP] → 새 단정 |
| robots.txt 봇 규칙이 바꾸기 전과 같음 (전·후 diff 는 Sitemap 줄만) | [GAP] → 회귀 단정 |
| Host 헤더 `geo-rose-nine.vercel.app` 로 curl: `/` 308→`https://cited.kr/` · `/case/academy.html` 308 같은 경로 · `/admin/ops?key=x` 308 쿼리 보존 · `POST /api/lead` 308 아님 · `/api` 308 아님 · `/apifoo` 308 | [GAP] → 새 단정 |
| Host localhost → 리다이렉트 없음 | [GAP] → 회귀 단정 |
| clean(): BOM+`https://cited.kr/`+줄바꿈 → `https://cited.kr`, `nope`·빈 값 → fallback | [GAP] → node 단정 |
| 「사이티드(Cited)」 가 hero lede·#geo define·FAQ 1·footer·title·JSON-LD 에 있음 | [GAP] → 새 단정 |
| 화면에 `geo-rose-nine`·「도입 사례」·「크롤러 누적 방문」·「채점 기준 바뀜」 0 | [GAP] → 새 단정 |
| 절 id 순서 = 2절 다이어그램, `#proof` 없음 | [GAP] → 새 단정 |
| PILOT 대조: 화면 「39만원」·「절반」 문구와 PILOT.price·refund[1] 가 같은 사실 | [GAP] → 새 단정 |
| 시연: 업종 버튼·엔진 탭·「같은 질문 다시 묻기」 동작 | [GAP — 기존 시험 없음] → 회귀 단정 |
| ScanForm(dom-hero) 제출 → 결과 또는 오류 문구 표시 | [GAP] → 회귀 단정 |
| ops null 일 때 증거 칸 숨김 | [GAP] → DATABASE_URL 없이 한 번 띄워 확인, 못 하면 사유 |
| 스크린샷 1440·390: hero, #data, #case, #price, #faq, #start — scrollWidth <= innerWidth | [GAP] → 새 단정 + PNG |
| 바뀐 한국어 블록 계산 스타일 `word-break: keep-all` | [GAP] → 새 단정 |

## Acceptance
- 위 단정 전부 PASS, `assertions.txt`·스크린샷 `handoff/research/step47/*.png`
- `cd web && node ./node_modules/typescript/bin/tsc --noEmit` 0 (npx tsc 금지 — 경로 `&` 함정)
- `cd web && npm run build` 성공
- 커밋 2개: `Step 47a: cited.kr 기준 주소·canonical·llms.txt 생성·옛 도메인 308` / `Step 47b: 랜딩 문구 — 사이티드 정의문·질문형 소제목·순서·첫 적용 기록`
- REVIEW-REQUEST: 바뀐 파일·줄 범위, 오늘 rival 값과 엔진별 이긴 검색어(DB), 3절과 다르게 쓴 곳과 이유

## 배포 (Arch 메모)
- **web 은 `git push` 로 배포된다** — Vercel 프로젝트 `geo`(web/.vercel/project.json)가 main 에 붙어 자동 배포(BUILD-LOG:1430 「web 자동 배포 Ready」). `npx vercel --prod` 는 academy 만.
- 푸시 전 `gh auth switch --user leeledger`.
- 배포 전: `curl -sI https://cited.kr/` 200 확인(실패 모드 2). NEXT_PUBLIC_SITE_URL 은 있으면 좋고 없어도 fallback 이 같다.
- 배포 후: `curl -sI https://geo-rose-nine.vercel.app/` → 308 `location: https://cited.kr/` · 옛 주소 `POST /api/lead` 상태가 308 아님 · `https://cited.kr/` view-source 에 canonical·JSON-LD(파싱) · `/llms.txt` 200.
- 게이트: CLAUDE.md 상시 승인(Richard 통과 + 운영 주소 확인).

---

## 핵심 메시지 (모션 영상용)

```
훅      손님은 AI가 꼽아 준 몇 곳만 봅니다.
문제    그 답은 손님 화면에만 뜹니다. 우리 이름이 빠졌는지 사장님은 모릅니다.
원리    AI는 홈페이지보다 비교 글·후기·목록을 보고 이름을 고릅니다. 홈페이지 19점 회사가 80점 회사보다 더 자주 나왔습니다(15번 중 8번 대 3번).
증거    사이티드는 대표가 운영하는 학원에 먼저 했습니다. 착수 때 안 나오던 지역 검색어에서 지금 네이버 웹 1위입니다(2026-10-13 측정).
제안    30일 파일럿 39만원. 기준선 보고 전에 그만두시면 절반을 돌려드립니다.
선 긋기 이름을 알고 찾아오는 브랜드라면 필요 없습니다.
행동    cited.kr 에 홈페이지 주소를 넣으세요. AI가 읽을 수 있는지 무료로 봐 드립니다.
```
출처: 19/80·8/15·3/15 = probe/data(page.tsx:31) · 네이버 웹 1위 = DB serp 10/13(메모리 results-check-2026-10-13) — 영상 공개 전 최신 측정으로 다시 확인 · 39만원·50% = lib/services.ts PILOT.
