# Review Request — Step 29 (고객사 사이트 사람 방문 추이 D29~D33)
Date: 2026-09-30
Ready for Review: YES
Status: DONE_WITH_CONCERNS — 코드·시험·tsc 는 통과. 화면은 실제 브라우저로 못 봤다(운영 DB 에 표가 없어 빈 상태만 나온다 · 배포 금지)

## 커밋 (푸시·배포·운영 DB 쓰기 없음)
- AGO&GEO `e8873b0` — Step 29 — 고객사 사이트 사람 방문 추이 (13 파일) + 이 문서·BUILD-LOG 는 뒤 커밋
- 자동피드백생성기 `d30c9c0` — 사람 방문을 사이티드로 보낸다 (2 파일)

## 리뷰 반영 (Richard 29 Should Fix + Arch) — 커밋은 아래 BUILD-LOG 끝 줄
- academy/app/api/visit/route.ts — CRAWL_KEY 없거나 다르면 401(fail closed) · DDL 은 to_regclass 로 표 없을 때만, insert 와 다른 try
- web/lib/visits.ts saveVisit — 같은 준비 규칙
- lib/visit.ts 세 사본 — SNS utm 접두어만
- 자동피드백생성기 lib/cited-landing.ts(새) · proxy.ts — 공개 랜딩 + 세션 쿠키 없음일 때만
- 시험 94 통과 0 실패 · tsc 0 (세 곳) · 아이로그 eslint 0
- 배포 추가 조건: 학원 Vercel 에 CRAWL_KEY 가 있어야 한다(없으면 사람 기록 401)

## Files Changed
공통 분류 (세 저장소 같은 글자 — test-visit.mjs 가 대조)
- academy/lib/visit.ts:1-151 — classifyRef(utm 우선 · AI→SNS→검색 순, blog/cafe.naver 는 SNS, 같은 도메인은 internal) · isHumanDocument(D30) · deviceOf · kstDay · readVisit(보내는 쪽: 해시·경로만, IP 안 보냄, 물음표 뒤 버림) · cleanVisit(받는 쪽: 모양·길이·글자)
- web/lib/visit.ts — 위와 같은 파일
- C:\dev\자동피드백생성기\lib\cited-visit.ts — 위와 같은 파일

학원 (academy/)
- academy/proxy.ts:15 — matcher 에서 api/visit 제외 / :20-24 봇이 아니면 waitUntil(sendVisit) / :45-58 sendVisit. **봇 분기(:26-42)는 한 글자도 안 바뀜**
- academy/app/api/visit/route.ts:1-70 — x-crawl-key 확인 · 2KB 상한 · cleanVisit · 표 한 번 준비 · 1분 중복 무시 insert. client_id 1 고정
- academy/db/schema.sql:176-191 — geo.site_visits + 인덱스 + RLS
- academy/scripts/test-visit.mjs:1-192 — 단위 시험(아래)

사이티드 (web/)
- web/app/api/visit/route.ts:1-49 — /api/crawl 과 같은 clientForKey 인증 · 2KB · cleanVisit · saveVisit
- web/lib/visits.ts:17-48 — VISITS_DDL · 1분 중복 무시 INSERT · saveVisit(인스턴스마다 표 한 번 준비)
- web/lib/visits.ts:69-130 — readVisits: 기록 시작일, 30일(시작 전은 안 그림), 어제까지 7일 vs 그 전 7일(기록 안 찬 칸은 null), 들어온 곳 5칸(internal 뺌), AI 곳별, 많이 본 5. 표 없으면(42P01) 빈 상태
- web/app/admin/ops/Visits.tsx:1-129 — 「사람 방문 — 고객명」 카드
- web/app/admin/ops/CoverageChart.tsx — 계열별 unit·aria `what`·`table` 인자만 추가(기본값 = 예전 동작)
- web/app/admin/ops/Growth.tsx:76 — Word 를 export (Visits 가 같은 변화 단어를 쓴다)
- web/app/admin/ops/page.tsx:9,17,154-158,191 — readVisits 병렬로 읽고 Growth 아래에 카드
- web/db/schema.sql:179-194 — geo.site_visits + 인덱스 + RLS

아이로그 (C:\dev\자동피드백생성기)
- proxy.ts:50-51 — 봇이 아니고 공개 랜딩이면 waitUntil(sendVisit) / :56-60 LANDING / :63-75 sendVisit → https://geo-rose-nine.vercel.app/api/visit (x-cited-client: ilog · CITED_CRAWL_KEY). 봇 분기 그대로

## 결정 (BUILD-LOG 에도)
- **D31 학원은 자기 /api/visit → DB 직접.** 사이티드로 보내려면 학원 geo.clients 에 crawl_key 를 새로 넣고(DB 쓰기) 학원 서버에도 둬야 한다. 학원 /api/crawl 과 같은 모양이라 더 단순
- **visitor 해시는 보내는 쪽(proxy)에서.** IP 가 고객사 서버 밖으로 안 나간다. 그래서 VISIT_SALT 는 학원·아이로그 두 곳에만 필요, 사이티드 web 에는 필요 없다
- **표는 받는 라우트가 if not exists 로 준비**(인스턴스마다 한 번). company.mjs 가 돌기 전에 배포되면 첫날 기록이 날아가서
- **(설계 밖, Arch 확인)** 아이로그는 공개 랜딩(/ · /features · /guide · /terms · /privacy — sitemap.ts 목록)만 센다. 대시보드·출결 키패드는 학원 사람들이 하루 수십 번 연다
- 페이지뷰는 문서 요청만(D30) — 사이트 안 링크 이동(Next RSC)은 대부분 안 잡힌다. 카드 설명에 그대로 적었다

## 시험 출력
```
$ node --experimental-strip-types academy/scripts/test-visit.mjs
72 통과 · 0 실패
  (들어온 곳 32 · 문서 요청 24 · 기기 · KST 경계 · readVisit 5 · cleanVisit 3 · 사본 2(web·아이로그) · DDL/인덱스/RLS/insert 대조 4)
$ academy: node ./node_modules/typescript/bin/tsc --noEmit            → exit 0
$ web:     node ./node_modules/typescript/bin/tsc --noEmit            → exit 0
$ 자동피드백생성기: node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json → exit 0
$ 자동피드백생성기: eslint proxy.ts lib/cited-visit.ts                 → 0
```

## 배포 때 (Arch)
- env `VISIT_SALT` — 학원 Vercel(academy) · 아이로그 Vercel 각각. 아무 긴 임의 문자열, 두 곳 달라도 된다. **파일로 넣고 env pull 로 길이 확인**(CLAUDE.md BOM 함정). 없으면 사람 기록만 조용히 꺼져 있다
- 기존 env 그대로 씀: 학원 `CRAWL_KEY` · 아이로그 `CITED_CRAWL_KEY` · web `DATABASE_URL`
- 순서: web(git push, /api/visit 먼저 살아야 함) → 학원 `academy/` 에서 `npx vercel --prod --yes` → 아이로그 `C:\dev\자동피드백생성기` 에서 `npx vercel --prod --yes`
- 확인: 각 사이트를 브라우저로 한 번 열고 `/admin/ops?c=robotncoding` · `?c=ilog` 카드에 「9/30 부터 셈」과 오늘 1명이 뜨는지. 봇 기록은 크롤러 표가 계속 느는지

## Open Questions
- 아이로그 랜딩만 세는 것(설계 밖) 괜찮은가
- utm 이 referer 보다 먼저라서 utm_source=chatgpt.com 인데 referer 가 구글이면 AI 로 센다(설계서 문구대로). 반대로 utm 이 엉뚱한 값(newsletter)이면 other
- CoverageChart 를 넓힌 방식(값 칸 이름이 여전히 `pages`) — 이름 바꾸는 게 낫다면 Coverage 쪽까지 손대야 해서 안 했다

## Out of Scope (BUILD-LOG KG-29-1~3)
- 사이트 안 이동 페이지뷰(브라우저 비컨이 필요)
- 학원 CRAWL_KEY 비었을 때 /api/visit 무인증(/api/crawl 과 같은 약점)
- 화면 눈 확인(배포 뒤)
