# Architect Brief — Step 45

## Goal
robotncoding.com/ai 페이지가 생기고(「초등 AI 교육」「AI 수업」「AI 교육 기관」「AI 강의」가 있는 사실 자리에만), 네이버 웹 검색·AI 탐침이 그 검색어를 오늘부터 잰다. 새 검색어가 첫날 걸려도 「처음 노출」로 세지 않는다.

## 배경
- 원장 지시(10/13): 「AI 강의하는 곳」「초등 AI 교육」「AI 교육 기관」에서도 노출. KG-44-1(D103 /ai 보류)을 원장이 풀었다 → D105
- 기존 사실은 llms.txt·home.html·/ai-work 에 다 있다. 새 사실 0. 문구는 아래에 잠근다. 괄호 숫자 = `academy/public/llms.txt` 행번호(Richard 대조용). `h:` = `content/home.html` 행, `aw:` = `app/ai-work/page.tsx` 행

## Flow
```
content/ai.json ──> app/ai/page.tsx ── metadata(title·description·canonical /ai)
                                    ├─ 본문 렌더 (aw-* CSS 복사)
                                    └─ ld+json: Course(#course) + FAQPage  ← 같은 ai.json.faq 배열
Nav.tsx LINKS  ┐  「AI 리터러시 /#ai」 → 「AI 교육 /ai」 (두 곳 같게, 테스트로 묶음)
home.html nav  ┘
home.html #ai 절 ── 링크 1줄 → /ai
app/sitemap.ts ── /ai 추가
public/llms.txt ── 주요 페이지 1줄 + 끝 절 1개

측정
academy/clients.mjs 학원 queries ── kind "AI교육" a1~a4 ── check-index(네이버 웹문서·통합) → serp_checks
                                                           (경쟁 머리 숫자·growth.ts 에 안 섞임: kind='경쟁' 만 셈)
seed-probes-step45.mjs ── ai_probe_questions p19~ (form keyword) ── ai-measure → ai_probe_measurements (승인 20문항 표 아님)
처음 노출 판정: 엔진 첫 측정일 → (엔진,검색어) 첫 측정일   [case-report.mjs · web/lib/brief-core.mjs]

배포: academy/ npx vercel --prod --yes → 운영 curl → indexnow → submit-gsc → 커밋 → push(web brief-core·Actions 가 clients.mjs 를 읽음)
```

## Build Order

### 1. content/ai.json (새 파일) — 아래 「잠긴 문구」 글자 그대로
구조(키 이름은 Bob 이 정해도 됨, 내용은 못 바꿈): title, description, lab, h1(두 줄), lead[2], stages{h2,intro,rows[{step,grade,text}]}, course{h2,paras[2]}, roles{h2,intro,items[{k,text}],after,afterLink}, no{h2,cards[{title,text,link?}]}, made{h2,paras[3],link}, adult{h2,text,link}, tuition{h2,rows,note}, faq[[q,a]×3], posts[{href,label}×4]

### 2. app/ai/page.tsx (새 파일) — /ai-work 와 같은 꼴
- `import data from "@/content/ai.json"`. metadata: title·description 은 ai.json, `alternates: { canonical: "/ai" }`. layout 템플릿이 「 | 로봇&코딩학원」을 붙인다 — 손으로 붙이지 않는다
- Nav 컴포넌트. CSS 는 /ai-work 의 `aw*` 규칙 중 쓰는 것만 복사(공용 파일로 빼지 않는다). `word-break: keep-all` 유지
- 단계표는 `.aw-tw table`, 하지 않는 것은 `.aw-card.no`, 감독 4가지는 `.aw-steps`, FAQ 는 `.aw-faq details`
- CTA 두 곳(맨 위·맨 아래): 전화 02-422-0525, 카카오 http://pf.kakao.com/_Bxhxbxjxb/chat — /ai-work 와 같은 주소 (aw:259-260)
- SCHEMA `@graph`:
  - Course: `@id` https://robotncoding.com/ai#course · name 「AI 시대 코딩」 · url https://robotncoding.com/ai · inLanguage ko · educationalLevel 「초등 5학년~중학교 3학년」 · description = 아래 잠긴 「스키마 설명」 · teaches ["AI 리터러시","자연어 코딩","프롬프트 작성","AI 결과 검증"] · provider `{ "@type": "EducationalOrganization", "@id": "https://robotncoding.com/#org", "name": "로봇&코딩학원" }` · hasCourseInstance Onsite, Place 「로봇&코딩학원」 address 「서울 송파구 석촌동 274-8 2층」(aw:157-166 꼴. courseSchedule·offers 는 넣지 않는다 — AI 시대 코딩 시간표·값은 사이트에 없다)
  - FAQPage: ai.json.faq 그대로 map (aw:174-181 꼴)

### 3. 내부 링크
- `components/Nav.tsx` LINKS: `{ href: "/#ai", label: "AI 리터러시" }` → `{ href: "/ai", label: "AI 교육" }` (같은 자리)
- `content/home.html` 1~19행 nav: `<a href="/#ai">AI 리터러시</a>` → `<a href="/ai">AI 교육</a>`. 푸터의 `#ai` AI 리터러시 링크(h:1127)는 그대로
- `content/home.html` #ai 절(h:391~)의 「감독의 네 가지 일을 단계마다 나눠서 훈련합니다.」 lead 문단(h:~429-434) **바로 뒤**에 한 줄:
  `<p class="lead"><a href="/ai" style="color:var(--amber);text-decoration:underline;text-underline-offset:4px;font-weight:700">단계별 AI 수업 자세히 보기 →</a></p>` (h:1004 꼴). 그 밖 home.html 손대지 않음 — #faq 는 test-faq-sync 가 잠갔다
- `app/sitemap.ts`: `/ai-work` 줄 앞에 `{ url: `${BASE}/ai`, changeFrequency: "monthly", priority: 0.9 }`
- `public/llms.txt`:
  - 「주요 페이지」 목록에서 `- AI 오케스트레이션·자연어 코딩: https://robotncoding.com/#ai` 바로 뒤에 `- 초등·중등 AI 교육(단계별 AI 수업·「AI 시대 코딩」): https://robotncoding.com/ai`
  - 파일 끝 「## 성인 AI 업무자동화반」 절 **앞**에 아래 「잠긴 llms 절」
  - 「AI학원을 찾는 분께」 절·FAQ 절은 손대지 않는다(test-faq-sync 가 글자 대조)

### 4. 측정
- `academy/clients.mjs` 학원 queries, b2 뒤에 (kind 는 「경쟁」이 아니라 새 「AI교육」):
  ```
  // 10/13 원장 — AI 교육 기관으로도 찾히게. 경쟁 머리 숫자와 섞지 않는다(분모가 바뀐다, D107)
  { id: "a1", q: "송파 초등 AI 교육", kind: "AI교육" },
  { id: "a2", q: "송파 AI 교육 기관", kind: "AI교육" },
  { id: "a3", q: "송파 AI 강의하는 곳", kind: "AI교육" },
  { id: "a4", q: "송파 AI학원", kind: "AI교육" },
  ```
- `case-report.mjs` KIND 표에 `AI교육: "AI 교육 검색어"`. kind 를 읽는 곳(briefing.mjs:102·117, check-index.mjs:165-183, scout.mjs, company.mjs, web/lib/growth.ts)을 grep 해 새 kind 에서 터지거나 경쟁으로 세는 곳이 없는지 확인하고 REVIEW-REQUEST 에 적는다. 고칠 게 있으면 멈추고 적는다
- 새 `academy/scripts/seed-probes-step45.mjs` (멱등): 학원(client_id 1)에 아래 4개. 같은 글(trim)이 이미 있으면 건너뜀. 번호는 daily-agent.mjs:368 과 같은 max+1. form 'keyword', source_prompt null, active true, created_on = 오늘 KST(`toLocaleDateString("sv-SE",{timeZone:"Asia/Seoul"})`). 표가 없으면 daily-agent.mjs:365 DDL 로 만든다

  | text | radius |
  |---|---|
  | 송파 초등 AI 교육 | 송파구 |
  | 송파 AI 교육 기관 | 송파구 |
  | 송파 AI 강의하는 곳 | 송파구 |
  | 석촌동 초등 AI 수업 | 동네 |
- 탐침은 ai_probe_measurements 로만 간다(승인 20문항 ai_measurements 에 넣지 않는다 — 영업 숫자 오염, 메모리 규칙)

### 5. 「처음 노출」 판정을 검색어 단위로
- `academy/scripts/case-report.mjs:196` at_start: 비교 대상 `a.engine=h.engine` → `a.engine=h.engine and a.query=h.query`
- `web/lib/brief-core.mjs:84-88` firsts: 창 함수 `min(min(checked_at)) over (partition by client_id, engine)` → 같은 group by 안의 `min(checked_at)` (= 그 엔진·검색어를 처음 잰 때). 주석 한 줄 갱신
- 바꾸기 전·후 쿼리를 운영 DB 에서 각각 돌려, 결과가 달라지는 줄을 전부 REVIEW-REQUEST 에 붙인다. 케이스 리포트에서 사라지는 「처음 노출」이 있으면 Arch 가 원장에게 보고한다

### 6. 회귀 테스트 새로: `academy/scripts/test-ai-page.mjs` (test-faq-sync 꼴, PASS/FAIL, 실패 시 exit 1)
- ai.json 파싱. 모든 문자열 값을 이어 붙인 글에서 정확 횟수: 「초등 AI 교육」 2 · 「AI 수업」 2 · 「AI 교육 기관」 1 · 「AI 강의」 1 · 「AI학원」 0 · 「AI 교육」 ≤ 5. **잠긴 글로 셌는데 이 숫자가 안 나오면 글을 고치지 말고 멈추고 적는다**(Arch 셈 오류)
- ai.json title 에 「초등 AI 교육」·「AI 수업」 각 1, h1 에 「초등 AI 교육」 1
- ai.json faq 질문이 home.html #faq `<summary>`·schema.json FAQPage 질문 어디에도 없다(같은 FAQ 를 두 쪽에 표시하지 않는다)
- 숫자 출처: ai.json 의 숫자 덩어리(정규식 `\d[\d,]*`)가 전부 llms.txt 또는 home.html 에 글자 그대로 있다
- slop-rules MARKS 0건(test-faq-sync.mjs:83-95 와 같은 해석) + 금지어 정규식 `다양한|여러 가지|정말|매우|필수적|혁신적|놀라운|알아보겠습니다|먼저,|마지막으로` 0건
- Nav.tsx LINKS href 순서 == home.html `.navlinks` 안 `<a>` href 순서(mtel 제외), 둘 다 `/ai` 포함
- home.html 에 `href="/ai"` 1개 이상, sitemap.ts 에 `/ai` 줄, llms.txt 에 `https://robotncoding.com/ai` 로 끝나는 줄, page.tsx 에 `canonical: "/ai"`
- clients.mjs 학원 queries 에 a1~a4 kind 「AI교육」, 「경쟁」 개수 6 그대로
- posts 4개 href 의 실제 존재는 DB 없이 못 보니 테스트 밖 — 7번 운영 curl 로 확인

### 7. 배포·측정·확인 (Richard PASS 뒤, 상시 승인)
- 시험 전부: test-ai-page · test-faq-sync · clients.mjs 를 읽는 기존 test-*.mjs · tsc academy·web (`node ./node_modules/typescript/bin/tsc --noEmit`)
- `cd academy && npx vercel --prod --yes`
- 운영: `curl -s https://robotncoding.com/ai` 에 title(「송파 석촌동 초등 AI 교육 — 단계별 AI 수업 | 로봇&코딩학원」, 엔티티 꼴은 실제대로)·canonical /ai·ld+json Course·FAQPage·h1 · sitemap.xml 에 `/ai<` · llms.txt 에 `robotncoding.com/ai$` · 홈 nav 에 `/ai` · 블로그 글 4개 200
- `node scripts/indexnow.mjs https://robotncoding.com/ai https://robotncoding.com/ https://robotncoding.com/llms.txt https://robotncoding.com/sitemap.xml`
- 구글: `tools/submit-gsc.mjs` 사용법을 먼저 읽고 /ai 1건. 로그인이 필요하면 원장 몫으로 적고 넘어간다(`/` 인자는 `MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*"`)
- 탐침: `node scripts/seed-probes-step45.mjs` → 넣은 prompt_id 출력. 한 번 더 돌려 「0개 넣음」 확인
- 네이버 기준선: check-index.mjs 를 학원만 돌리는 인자(고객고르기 사용법 확인)로 오늘 실행 → a1~a4 줄이 serp_checks 에 오늘 날짜로 들어간 것 확인
- AI 탐침 기준선: ai-measure.mjs 를 읽어 오늘 이미 잰 승인 20문항이 다시 돌지 않는지 확인. 안 돈다면 `MEASURE_PROBES_PER_DAY=<오늘 잰 탐침 수 + 4> node scripts/ai-measure.mjs --client <학원>` 로 새 탐침만 잰다. 다시 돈다면 돌리지 않고 「첫 측정 = 다음 자동 실행일」로 적는다. 어느 쪽이든 실제로 잰 곳(collection_method)과 결과를 그대로 적는다
- 커밋·push 는 Arch (web brief-core 와 Actions 의 clients.mjs 는 push 로 반영된다. 푸시 전 `gh auth switch --user leeledger`)

### Flag — Bob 이 추측하지 말 것
- 잠긴 문구의 단어를 바꾸지 않는다. 사실이 근거 행과 다르거나 마크업이 깨지면 멈추고 REVIEW-REQUEST 에 적는다
- 「AI학원」을 /ai 에 넣지 않는다(D99 자리 밖). 「초등 AI 교육」 등을 지정 자리 밖에 더 넣지 않는다 — alt·aria·title 속성 포함
- 「AI 시대 코딩」의 주차별 목차·시간표·수강료를 지어 넣지 않는다. 수강료 표는 학년별 기존 표(h:1023-1025) 그대로이고 과정과 엮지 않는다
- 홈 #faq·schema.json·meta.json 은 건드리지 않는다
- tsc 는 `node ./node_modules/typescript/bin/tsc` (npx tsc 는 `&` 경로 함정)

## 잠긴 문구 (content/ai.json)

**title** `송파 석촌동 초등 AI 교육 — 단계별 AI 수업`

**description** `초등 1~4학년은 그림·음성 AI를 직접 써 보고, 5학년부터는 우리말로 설명해 얻은 코드를 읽고 고칩니다. AI가 준 답을 그대로 내지 않게 가르칩니다. 초5~중3 「AI 시대 코딩」 24주. 서울 송파구 석촌동 로봇&코딩학원, 02-422-0525.` (154, 163-164, 280, 225, 39)

**lab** `AI Education · 초등~중등`

**h1** `초등 AI 교육,` / `무엇부터 배워야 할까요?`

**lead**
1. `AI 도구 이름부터 외우지 않습니다. 문제를 작게 나누고, 원하는 결과를 정확히 말하고, AI가 낸 답을 직접 돌려 봅니다. 그 순서로 가르칩니다.` (286-287)
2. `AI는 따로 떼어 낸 특강이 아닙니다. 5단계 커리큘럼 전부에 들어 있습니다. 서울 송파구 석촌동 학원에서 개발자 출신 원장이 직접 지도합니다.` (258, 271, 39)

**stages.h2** `AI는 5단계 어디에 들어 있나요?`

**stages.intro** `학년마다 AI를 대하는 자리가 다릅니다. 1단계는 써 보고, 2단계는 만들어 보고, 3단계부터는 말로 시킨 결과를 읽고 고칩니다.`

| step | grade | text | 근거 |
|---|---|---|---|
| 1단계 | 초등 1~4학년 | 그림·음성 AI를 직접 써 보며 AI가 어떤 도구인지 감을 잡습니다. 코드는 아직 쓰지 않습니다. | 151-154 |
| 2단계 | 초등 3~6학년 | 얼굴 인식·감정 분류를 만들어 보며 학습 데이터가 결과를 바꾼다는 것을 확인합니다. AI에게 원하는 것을 말로 설명하는 연습을 시작합니다. | 156-159 |
| 3단계 | 초등 5학년 이상 | 자연어 코딩을 정식으로 다룹니다. 만들고 싶은 것을 우리말로 설명해 코드를 얻고, 그 코드를 읽고 고치고 왜 그렇게 동작하는지 설명합니다. | 161-164 |
| 4단계 | 초등 5~6학년 및 중등 연계 | AI를 참고 도구로 씁니다. 풀이가 맞다는 것은 스스로 증명합니다. | 166-168 |
| 5단계 | 수시·학생부종합전형 대비 | AI API를 붙인 챗봇·이미지 분류 같은 서비스를 완성하고 포트폴리오로 정리합니다. | 171-173 |

**course.h2** `「AI 시대 코딩」은 어떤 과정인가요?`

**course.paras**
1. `초등 5학년~중학교 3학년 대상, 24주 과정입니다. AI에게 시키는 법을 배웁니다. 프롬프트 한 줄에서 시작해 완성작까지 갑니다.` (225)
2. `주차별 목차는 상담 때 안내합니다.`

**roles.h2** `AI가 하는 일, 아이가 하는 일`

**roles.intro** `AI는 코드를 타이핑하고, 문법을 기억하고, 여러 안을 빠르게 만듭니다. 시킨 것을 시킨 대로 합니다. 잘못 시키면 잘못된 것을 아주 빠르게 만들어 냅니다. 그래서 아이 몫으로 네 가지가 남습니다.` (240, 248)

| k | text | 근거 |
|---|---|---|
| 기획 | 무엇을 만들지 정한다. 만들 것이 정해지지 않으면 AI에게 시킬 말도 없습니다. | 243 |
| 지시 | 정확히 시킨다. 무엇을 입력받고 무엇을 내놓아야 하는지 말할 수 있어야 합니다. | 244 |
| 판단 | 맞는지 판단한다. AI는 그럴듯하게 틀립니다. 돌아온 코드를 직접 실행하고 이상한 입력을 넣어 봅니다. | 245, 264-265 |
| 책임 | 내놓은 것을 책임진다. AI가 지어낸 것과 남의 것을 가려내고, 저작권·개인정보를 함께 다룹니다. | 266-267 |

**roles.after** `이 네 가지를 1단계부터 5단계까지 나눠 훈련합니다.` (250) · afterLink `/#ai` 문구 `홈의 AI 리터러시 절 보기 →`

**no.h2** `하지 않는 것`

| title | text | link | 근거 |
|---|---|---|---|
| AI 답을 그대로 내게 하지 않습니다 | AI가 준 코드를 그대로 제출하는 수업은 하지 않습니다. 원하는 결과를 먼저 설명하고, 직접 실행하고, 틀린 곳을 찾아 고칩니다. | — | 298-300 |
| AI 튜터도 정답 코드는 주지 않습니다 | 아이가 막히면 어디가 어긋났는지 짚고, 채워야 할 칸만 남긴 골격을 보여 줍니다. 채우는 몫은 아이에게 남깁니다. | — | 195-197 |
| 초등학생 혼자 ChatGPT를 쓰게 하지 마세요 | 만 13세 미만은 OpenAI 서비스 대상이 아닙니다. 어른이 질문을 입력하고 답을 함께 보세요. 아이 생각을 먼저 적게 하고, AI 답은 다른 자료와 맞춰 봅니다. | /blog/aiga-sukjereul-haetdamyeon | 291-294 |

**made.h2** `학생들이 AI로 만든 것`

**made.paras**
1. `서울대 의예과에 진학한 학생은 Pima 인디언 당뇨병 데이터로, 건강 지표를 넣으면 발병 가능성을 예측하는 웹 AI 프로그램을 만들었습니다. 데이터 전처리부터 머신러닝 모델, 웹 배포까지 스스로 했습니다.` (138-140)
2. `한 고등학생은 진로 고민을 인터랙티브 진로 분석 서비스로 풀었습니다. 코드를 한 줄씩 치지 않고 전체 로직의 의도를 설계했고, 구현은 AI와 나눠 했습니다. 지시가 정확해서 결과가 나왔습니다.` (252-254)
3. `둘 다 고등학생 때 만든 것입니다. 초등학생에게 같은 결과를 약속하지 않습니다.`

**made.link** `/blog/godeunghaksaengi-aiwa-ssoa-olrin-jinroui-byeol` 문구 `진로 분석 서비스 이야기 →`

**adult.h2** `어른 AI 강의를 찾으신다면`

**adult.text** `직장인·사장님 대상 성인 AI 업무자동화반이 따로 있습니다. 본인의 반복 업무 한 건을 들고 와서, 돌아가는 자동화로 만들어 갑니다. 월 4회, 회당 120분, 200,000원입니다.` (aw:252, aw:409, 372)

**adult.link** `/ai-work` 문구 `성인 AI 업무자동화반 보기 →`

**tuition.h2** `수강료`

**tuition.rows** (h:1023-1025 그대로) 초등 저학년 · 1단계 컴퓨팅 사고력 · 90분 · 160,000원 / 초등 고학년 · 2~3단계 알고리즘·Python · 120분 · 190,000원 / 중학생 이상(성인 포함) · 3~5단계 심화·프로젝트 · 120분 · 200,000원

**tuition.note** `월 4회 기준입니다. 학원 등록 제7629호(서울특별시강동송파교육지원청).` (65, aw:410)

**faq**
1. Q `초등학생 AI 교육은 몇 학년부터 시작하나요?`
   A `1단계(초등 1~4학년)에서 그림·음성 AI를 직접 써 보는 것으로 시작합니다. 이때는 코드를 쓰지 않습니다. 우리말로 설명해 코드를 얻는 자연어 코딩은 3단계, 초등 5학년부터 정식으로 다룹니다. 그 전에 아이 혼자 ChatGPT 계정을 쓰게 하지는 마세요. 만 13세 미만은 OpenAI 서비스 대상이 아닙니다.` (151-154, 163, 291)
2. Q `AI 수업에서 아이가 직접 만드는 건 무엇인가요?`
   A `2단계(초등 3~6학년)는 얼굴 인식·감정 분류를 만들어 보고, 학습 데이터를 바꾸면 결과가 달라지는 것을 확인합니다. 5단계는 AI API를 붙인 챗봇·이미지 분류 같은 서비스를 완성해 포트폴리오로 남깁니다. 무엇을 왜 만들었는지, 어디서 막혔고 어떻게 풀었는지도 글과 코드로 남기게 합니다.` (158, 172-173, 135-136)
3. Q `AI 교육 기관을 고를 때 무엇을 물어보면 되나요?`
   A `AI가 틀린 답을 냈을 때 수업에서 어떻게 하는지 물어보세요. 도구 사용법만 익히면 답을 복사하는 데서 끝나기 쉽습니다. 돌아온 코드를 직접 실행해 보는지, 이상한 입력을 넣어 보는지, 왜 틀렸는지 아이가 설명하게 하는지가 기준입니다.` (264-265, 286-288)

**posts** (h2 `더 읽을 글`, 제목은 DB 글 제목 그대로)
- /blog/koding-gyoyukgwa-ai-gyoyugui-chai — 코딩 교육이랑 AI 교육이 다른 건가요?
- /blog/aiga-sukjereul-haetdamyeon — 초등학생한테 챗GPT 쓰게 해도 될까요?
- /blog/ai-ro-jjatneunde-wae-ne-beon — 바이브 코딩이 뭐야? 아이도 배울 수 있을까요?
- /blog/godeunghaksaengi-aiwa-ssoa-olrin-jinroui-byeol — 고등학생이 AI와 쏘아 올린 진로의 별: 'POLARIS' 프로젝트

**스키마 설명 (Course.description)** `초등 5학년~중학교 3학년 대상 24주 과정. AI에게 시키는 법을 배운다. 프롬프트 한 줄에서 완성작까지 간다. 로봇&코딩학원 5단계 커리큘럼은 1단계부터 AI를 다루며, 3단계(초등 5학년 이상)부터 자연어 코딩을 정식으로 다룬다.` (225, 154, 163)

## 잠긴 llms 절 (「## 성인 AI 업무자동화반」 앞)
```
## 초등·중등 AI 교육
- https://robotncoding.com/ai : 5단계 커리큘럼 안에서 AI를 다루는 자리(1단계 그림·음성 AI, 2단계 얼굴 인식·감정 분류, 3단계부터 자연어 코딩, 5단계 AI API 서비스)와 초등 5학년~중학교 3학년 「AI 시대 코딩」 24주. AI 답을 그대로 제출하게 하지 않고, AI 튜터는 정답 코드를 주지 않는다.
```

## Failure Modes
| 경로 | 실제로 날 일 | 처리 | 사용자에게 |
|---|---|---|---|
| /ai 문구 | 키워드 반복·AI 티로 광고 판정 | test-ai-page 정확 횟수 + MARKS + 금지어 | 조용함 → 테스트로 막음 |
| /ai 사실 | 학년·주수·값 오기, 지어낸 숫자 | 잠긴 문구 + 근거 행 + 숫자 출처 테스트 + Richard 대조 | 조용함 → 테스트·리뷰로 막음 |
| FAQ 중복 | 홈 FAQ 와 같은 문답을 /ai 에도 FAQPage 로 표시 | test-ai-page 질문 교차 검사 | 조용함 → 테스트 |
| 네비 | Nav.tsx 와 home.html nav 가 갈라짐(홈만 옛 링크) | test-ai-page href 순서 비교 | 보임 → 테스트 |
| 블로그 링크 | 글이 내려가 404 | 배포 뒤 운영 curl 4건 200 | 보임 → 확인 단계 |
| 배포 | git push 만 하고 운영 그대로 | vercel --prod + 운영 curl 이 Acceptance | 조용함 → 확인 단계 |
| 측정 분모 | 새 검색어가 「경쟁」에 섞여 머리 숫자 분모가 6→10 으로 바뀌어 주간 비교가 거짓으로 줄어 보임 | kind 「AI교육」 분리, 테스트로 경쟁 6 고정 | 조용함 → 테스트 |
| 처음 노출 | 새 검색어가 첫 측정일에 걸리면 주간 보고·케이스 리포트에 「처음 노출」로 잡힘 = 지어낸 성과 | 5번 검색어 단위 판정 + 운영 DB 전후 비교 | 조용함 → 수정 + 전후 비교 (단위 시험 [GAP] KG-45-3) |
| 탐침 | 같은 글 탐침 두 번 / 번호 충돌 | 멱등(글 비교) + max+1 + unique(client_id,prompt_id) | 보임(오류) |
| 기준선 | 로컬 ai-measure 가 승인 20문항까지 다시 재 비용·중복 | 코드 읽고 판단, 아니면 안 돌리고 날짜만 적음 | 조용함 → 절차로 막음 |
| GSC | 로그인 만료 | 원장 몫으로 적음 | 보임 |

## Test Map
- /ai 키워드 정확 횟수·AI학원 0 — [GAP] → test-ai-page
- /ai 숫자 출처 — [GAP] → test-ai-page
- /ai AI 티 0 — [GAP] → test-ai-page
- /ai FAQ 가 홈·스키마 FAQ 와 안 겹침 — [GAP] → test-ai-page
- Nav.tsx ↔ home.html nav 일치 — [GAP] → test-ai-page (기존 동작 회귀 가드)
- sitemap·llms·canonical·홈 링크 — [GAP] → test-ai-page
- 학원 queries 경쟁 6 그대로, AI교육 4 — [GAP] → test-ai-page (경쟁 머리 숫자 회귀 가드)
- 홈 FAQ·스키마·llms AI학원 절 그대로 — [TESTED] test-faq-sync (회귀)
- 기존 고객 설정 — [TESTED] 기존 test-*.mjs 재실행
- 처음 노출 검색어 단위 — [GAP] SQL 이라 단위 시험 없음 → 운영 DB 전·후 diff 를 REVIEW-REQUEST 에 첨부(Richard 확인). KG-45-3
- 탐침 시드 멱등 — 두 번 돌린 출력 첨부
- 빌드 — tsc academy·web, 배포 빌드
- 운영 반영 — 수동 curl (Acceptance)

## Out of Scope (→ BUILD-LOG Known Gaps)
- KG-45-1 「AI 시대 코딩」 24주 주차별 목차·도구·결과물 — 원장 몫(사이트에 없다). 받으면 /ai course 절을 커리큘럼으로 채운다
- KG-45-2 check-index.mjs:247-256 콘솔 「처음 노출된 날」은 엔진·검색어 첫 측정일을 구분 안 함(콘솔 전용, 영업 자료엔 안 감)
- KG-45-3 처음 노출 판정 SQL 회귀 시험(fixture DB) 없음
- KG-45-4 /ai-work·블로그 글 본문에서 /ai 로 가는 링크
- KG-45-5 AI교육 검색어를 경쟁 머리 숫자에 합칠지 — 2~3주 기준선 뒤 원장 결정
- KG-45-6 빙 측정(tools/bing-serp.mjs)에 새 검색어 추가 — PC local-agent 몫
- 스마트플레이스 대표키워드(KG-44-2, 원장 몫) · 도해·이미지

## Acceptance
- test-ai-page PASS · test-faq-sync 23 PASS 그대로 · 기존 test-*.mjs 회귀 0 · tsc academy·web 0
- 운영 robotncoding.com/ai 200: title·h1·canonical·Course·FAQPage, 홈 nav·#ai 절에 /ai 링크, sitemap.xml·llms.txt 에 /ai, 블로그 링크 4개 200
- indexnow 성공 출력, GSC 요청 결과(또는 원장 몫 기록)
- serp_checks 에 오늘(KST) 학원 a1~a4 네이버 2엔진 줄 · ai_probe_questions 에 새 탐침 4개(오늘 날짜) · 탐침 첫 측정일·결과 기록
- 처음 노출 판정 전후 diff 첨부
- 「초등 AI 교육」 자리: /ai title·h1 뿐. 「AI학원」 새 자리 0(clients.mjs a4 검색어 제외)
