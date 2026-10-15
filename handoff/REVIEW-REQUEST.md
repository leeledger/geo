# Review Request — Step 47
Date: 2026-10-15
Ready for Review: YES
Status: DONE — 재제출(D131–D133 반영) · verify 74 PASS · 0 FAIL · nullops 2 PASS · tsc 0 · build 성공

## 47a — 주소·canonical·llms.txt·308 (따로 커밋할 diff: handoff/research/step47/47a.patch)
- web/lib/site.ts (새 파일) — `cleanSiteUrl()`(BOM·trim·끝 / 제거, URL 검증, http·https 만, 실패 시 https://cited.kr) · `SITE_URL`. 47b 에서 `SITE_TITLE`·`SITE_DESCRIPTION`·`CITED_ABOUT`(정의문 3문장) 추가
- web/app/llms.txt/route.ts (새 파일) — GET text/plain, force-static. 머리 = `# 사이티드(Cited)` + CITED_ABOUT, 파일럿 가격·환불·월 구독·보장 안 함은 PILOT 보간, 「첫 적용 — 대표가 운영하는 학원」, 연락 = SITE_URL · SITE_URL/#start
- web/public/llms.txt — 삭제
- web/next.config.mjs:6-18 — `redirects()` 두 규칙, host has `geo-rose-nine.vercel.app`, `/:path((?!api(?:/|$)).+)`, 목적지 리터럴 https://cited.kr, permanent
- web/app/layout.tsx:1-18 — `metadataBase: new URL(SITE_URL)`(canonical 은 안 둠). 47b: title/description/OG 기본값을 3-1 로
- web/app/page.tsx:114-128 — metadata(canonical "/", 47b 에서 title·description·openGraph 추가) · :39 BASE = SITE_URL
- web/app/sitemap.ts:1,12 · robots.ts:1,33 (BOTS·규칙 불변, 운영 robots.txt 와 비교해 Sitemap 줄만 다름) · geo/page.tsx:1,18,20 · geo/[slug]/page.tsx:1,26,36 · services/page.tsx:9 · services/[slug]/page.tsx:1,18,30 — SITE_URL import + 페이지별 canonical(없는 slug 분기엔 안 담)

## 47b — 문구·순서
- web/app/HeroDemo.tsx:80-86 — 배지·h1·정적 lede(`s.q` 빠짐, `s` 는 채팅에서 계속 씀)
- web/app/page.tsx:19-25 — 머리 주석 새 순서 + D122 한 줄
- web/app/page.tsx:45-64 — FAQ 10문항(새 1·2·3, 5번 고침). FAQ 1 = CITED_ABOUT
- web/app/page.tsx:67-110 — JSON-LD: Organization 사이티드(Cited)·alternateName·sameAs 없음 · Service 「AI 답변 노출 대행(GEO)」+ Offer(PILOT.price 에서 숫자만 뽑음)
- web/app/page.tsx:196-238 — 히어로 자가 확인 한 줄(.lp-herohint)·링크 둘·증거 머리·칸(새 경쟁 검색어 칸, 「크롤러 누적 방문」 뺌, 「봇」)
- web/app/page.tsx:243-660 — 절 순서 geo›data›case›who›services›how›why›price›diff›nots›faq›guides›start, #proof 와 SCAN·Gauge·R·RING·Fragment 삭제, 3절 문구 그대로
- web/app/page.tsx:665-700 — 푸터 desc·「첫 적용 기록(대표 학원)」·wm·©
- web/app/SiteNav.tsx:14,19 — 「하는 일」·「첫 적용 기록」
- web/app/landing.css:117 — `.lp-herohint` 한 규칙

## 시험
- `node handoff/research/step47/verify.mjs` (next build && next start :3047, NEXT_PUBLIC_ALLOW_INDEX=true, NEXT_PUBLIC_SITE_URL 없음 → fallback) → assertions.txt 69 PASS · 1 FAIL
- 같은 스크립트 `nullops` 모드(DATABASE_URL 을 닿지 않는 주소로 빌드·기동) → assertions-nullops.txt 2 PASS: 히어로 칸이 「일차」 하나만 남음
- `node ./node_modules/typescript/bin/tsc --noEmit` 0 · `npm run build` 성공(마지막 빌드는 env 기본값으로 되돌림)
- 스크린샷 handoff/research/step47/: 1440·390 × hero, hero-proof, geo, data, case, price, faq, start (+ nullops-1440-hero.png). 절 사진은 붙박이 네비를 숨기고 찍음. scrollWidth 넘침 없음

## 오늘 경쟁 검색어 (DB serp_checks, 학원, kind=경쟁) — 실패 모드 「빙 가짜 결과」 확인
랜딩 값 오늘: **0 → 3 / 6**. 오늘(10/15) 줄은 **bing 뿐**(19:20 KST 측정, 네이버 미측정). 지역명은 가림.

| 검색어 | 10/14 bing | 10/14 naver | 10/15 bing |
|---|---|---|---|
| Q1 ○○ 초등 코딩학원 추천 | - | 1위 | 3위 |
| Q2 ○○구 로봇교실 | - | - | - |
| Q3 ○○구 ○○동 코딩학원 | 1위 | 1위 | 1위 |
| Q4 ○○구 코딩학원 | 2위 | 1위 | 2위 |
| Q5 ○○ 초등 코딩학원 | - | 4위 | - |
| Q6 ○○(단지명) 코딩학원 | - | - | - |

이긴 3개는 전부 빙만으로 셌지만, 셋 다 전날 네이버에서도 1위였다. 빙만 이긴 줄은 없다. 단 10/14 처럼 네이버까지 재는 날엔 Q5 가 더해져 4/6 이 된다 — 표시값이 그날 어느 엔진을 쟀는지에 따라 흔들린다(KG-47-7).

## 3절과 다르게 한 곳
- B47-2 루트 canonical·og:url 이 `https://cited.kr`(끝 / 없음). Next 16 `resolve-url.js:109` 가 경로가 「/」면 origin 만 낸다. 같은 URL 이라 단정은 정규화해 비교. 하위 페이지는 정확히 일치
- B47-3 title·description·정의문을 lib/site.ts 상수로. page.tsx 는 임의 export 를 못 해 llms.txt route 가 FAQ 배열을 못 읽기 때문. 글자는 3절 그대로
- B47-4 #data sub 의 `<b>` 앞에 `{" "}`(JSX 줄바꿈이 공백을 먹어 「물었습니다.표본이」로 붙었음). pcompare 의 `<b>그 도구가 낫습니다.</b>` 뒤도 같은 이유로 `{" "}`
- 3-11 #price 의 lab 「요금」, #services lab 「서비스」, #how lab 「진행」, #faq·#start·#diff·#nots h2 는 브리프에 새 문구가 없어 그대로 뒀다
- llms.txt 의 「착수 때: 학부모가 쓸 질문 6개 전부 미노출」 줄은 원래 파일 그대로(브리프는 첫 줄만 3-5 sub 로 맞추라 함)

## 재제출 — Arch 결정 D131–D133 (2026-10-15)
- web/app/PriceCalc.tsx:112 — D131 알약 「첫 적용 학원과 같은 조건」. 「도입 사례」 0 단정 통과
- web/app/page.tsx 절 class — D132 #how·#guides lp-white→lp-ground, #case 에 lp-deep2. 순서 hero(짙음)›geo(흰)›data(짙음)›case(짙음-2)›who(회)›services(흰)›how(회)›why(흰)›price(회)›diff(흰)›nots(회)›faq(흰)›guides(회)›start(짙음)›footer(더 짙음)
- web/app/landing.css:21-22 — D132 새 규칙 한 줄 `.lp-deep.lp-deep2{background:var(--deep-2)}`. #data·#case 는 어두운 바탕용 카드(lp-glass·lp-cx·lp-tl)라 기존 밝은 class 로는 안 돼서 넣었다. 색은 기존 변수 --deep-2
- web/lib/ops.ts:45-49,147-163,252,295,434 — D133 `serp.rivalLatest`: 측정일 하루치에서 checked_at 이 가장 늦은 경쟁 검색어 줄의 엔진 하나만 rivalTally 로 센다. 조회에 checked_at 추가. 기존 rivalWon/rivalTotal(관리 화면·#case 카드)은 그대로
- web/app/page.tsx:153-154,186-190,227-232 — D133 히어로 칸이 rivalLatest 를 쓰고 라벨에 「· 빙 · 10/15 측정」. 엔진 이름은 Growth.tsx 와 같다. rivalLatest 가 null 이거나 분모 0 이면 칸을 숨긴다
- verify.mjs 추가 단정: DB 에서 그날 마지막 경쟁 줄의 엔진을 직접 읽어 히어로 라벨·분모(/ 6)·분자(0 → 3) 대조, 히어로~푸터 붙은 배경 모두 다름
- 스크린샷 1440·390 다시 찍음(같은 파일 이름)
- 남은 것: #case 카드 1 은 여전히 엔진 합계(「검색엔진 한 곳 이상」 정의를 카드에 적어 둠). 엔진이 섞인 숫자가 랜딩에 남은 곳은 여기 하나 — 바꿀지 Arch 판단

## Open Questions
- **B47-1 (FAIL 1건)** `web/app/PriceCalc.tsx:112` 알약 「도입 사례 학원과 같은 조건」이 #price 에 남아 「도입 사례」 0 단정이 실패. 브리프 5절이 PriceCalc 를 「안 고치는 파일」로 묶어 손대지 않았다. 한 줄로 「첫 적용 학원과 같은 조건」이면 D122 와 맞는다 — Arch 결정 필요
- KG-47-6 절 배경 겹침: #data·#case 둘 다 어두운 띠, #services·#how·#why 셋 다 흰 띠, #faq·#guides 둘 다 흰 띠. 「블록 이동만」이라 class 를 안 바꿨다. 1440 스크린샷으로 보고 판단 바람
- 히어로 칸 「0 → 3 / 6」 의 엔진 섞임(위 표). 라벨은 「검색엔진 한 곳 이상」 정의를 #case 카드에 적어 정직하지만, 날마다 값이 바뀔 수 있다
- FAQ 2 「7개 항목」 유지: lib/scan.ts 점수 6개 + 참고 1개(llms.txt) = 진단 결과 7줄, ScanForm 안내 「7가지」와 같음
- 배포 메모: 308 은 cited.kr 이 Vercel 에 붙어 TLS 가 난 뒤에만 켜야 한다. 오늘 https://cited.kr 은 인증서 전파 중일 수 있음 — 배포 전 `curl -sI https://cited.kr/` 200 확인(실패 모드 2). 옛 북마크로 관리 화면에 들어가면 쿠키가 호스트별이라 cited.kr 에서 다시 로그인

## Out of Scope (logged in BUILD-LOG)
- KG-47-1~5 (Arch 기록) · KG-47-6 배경 겹침 · KG-47-7 경쟁 검색어 칸 엔진 섞임
- /services·/geo 의 title 「Cited 사이티드」 표기와 JSON-LD 의 「Cited 사이티드」 이름(KG-47-1 범위)
