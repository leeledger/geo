# Architect Brief — Step 51

## Goal
cited.kr 도 거래처처럼 잰다. ① AI 크롤러·사람 방문이 academy.crawl_hits·geo.site_visits 에 client 15(cited)로 쌓이고 ② 검색어형 20문항 패널이 geo.pilot_questions 에 들어가 원장 승인 뒤 ai-measure 가 cited 를 잰다.

결정 D164~D173 · KG-51-1~5 는 BUILD-LOG. Step 50 브리프는 handoff/research/ARCHITECT-BRIEF-step50.md.

## 사실 (Arch 실측 2026-10-16 — 다시 재지 말 것)
- geo.clients id 15 cited: answer_pattern `사\s?이\s?티\s?드|cited\.kr` · measure_active false · crawl_key NULL · geo.pilots 없음 · crawl_hits 0행
- crawl_key 없는 고객: docttak, cited. 운영 DB 의 academy.coverage_by_vendor 정의 = setup-multiclient.mjs 의 정의(pg_get_viewdef 대조) → 스크립트를 돌려도 뷰가 되돌아가지 않는다
- web(Vercel 프로젝트 geo) Production env: NEXT_PUBLIC_SITE_URL · IP_HASH_SALT · DATABASE_URL. **CITED_CRAWL_KEY·VISIT_SALT 없음**
- web/app/api/crawl·visit 인증 = 헤더 `x-cited-client` + `x-cited-key`(clientForKey). academy/proxy.ts 의 `x-crawl-key` 는 학원 자체 라우트용 — 쓰지 않는다
- 본보기 = 아이로그 `C:\dev\자동피드백생성기\proxy.ts` (named `proxy(req, event)`, `event.waitUntil`, 키 없으면 no-op). academy/proxy.ts 는 @vercel/functions 를 쓰는데 web 엔 없다
- web/lib/visit.ts 는 이미 academy 사본(readVisit·isHumanDocument 가 /_next·/api·/admin 을 뺀다). web/lib/bots.ts 는 없다. academy/lib/bots.ts 는 import 없음
- 네이버 자동완성 `https://ac.search.naver.com/nx/ac?q=<q>&st=100&r_format=json&q_enc=UTF-8&r_enc=UTF-8` 동작함(예: 「geo 마케팅」→ geo 마케팅 대행사 · geo 마케팅 회사 · geo 마케팅 비용 …). 「GEO 대행사」「챗gpt 노출」「ai 검색 노출」은 빈 목록
- ai-measure 는 DB 고객을 answer_pattern 으로 이미 잰다(측정대상·측정설정). 승인 문항이 없으면 「승인 대기」. 집계(case-report·pm-report)는 stage brand 를 이미 뺀다
- 측정상한(k): env 고정값이 없으면 고객 하나에 측정 몫 +20, 순서 유료 → 학원 → 자사 (academy/measure-targets.mjs:112-125)

## Flow
```
요청 → cited.kr
  │  next.config redirects (옛 호스트만 308) ── 옛 호스트면 여기서 끝, proxy 안 돎
  ▼
web/proxy.ts  matcher: _next/static|_next/image|api/|admin|favicon|그림·영상 파일 제외
  │  CITED_CRAWL_KEY 없음 → NextResponse.next() (no-op)
  ├─ identify(UA) = 봇 ─→ event.waitUntil(fetch origin/api/crawl {bot,vendor,path,ua,ip}) ──→ academy.crawl_hits(client 15)
  ├─ 사람 · cited_admin 쿠키 없음 ─→ event.waitUntil(readVisit → fetch origin/api/visit) ──→ geo.site_visits(client 15)
  └─ 그 밖 → 아무것도 안 함
  ▼
NextResponse.next()  (fetch 를 기다리지 않는다 · 실패는 삼킨다)

패널: 자동완성 실측 → step51/autocomplete.json → seed-cited-panel.mjs(17 keyword + 3 brand)
      → seed-panel --client cited (dry: Bob / --apply: Arch) → geo.pilots + pilot_questions(approved=false), measure_active=true
      → 원장 /admin/pilots 승인 → ai-measure 가 잼
```

## Build Order

### 51a 크롤러·방문 기록
1. `web/lib/bots.ts` — `academy/lib/bots.ts` 를 바이트 그대로 복사(줄바꿈만 무시). 고치지 않는다
2. `web/scripts/check-crawler-class.mjs` — 맨 끝에 대조 추가: `web/lib/bots.ts` 가 `academy/lib/bots.ts` 와 같다(CRLF→LF 정규화). 다르면 exit 1
3. `web/lib/cited-proxy.ts`(새, **import 없음** — node --experimental-strip-types 로 시험) — 순수 함수 하나:
   `decide({ pathname, cookie, hasKey, isBot }): "crawl" | "visit" | null`
   - !hasKey → null · 경로가 `/api`·`/admin`(및 하위) → null (matcher 가 놓쳐도 막힌다) · isBot → "crawl" · 쿠키에 `cited_admin=` 있으면 null · 아니면 "visit"(readVisit 가 문서 요청인지 다시 거른다)
   - 쿠키 이름은 리터럴 `cited_admin`(lib/admin-auth.ts COOKIE 와 같은 글자 — admin-auth 는 next/headers 를 import 해 proxy 에서 못 부른다). check-proxy 가 admin-auth.ts 글자를 읽어 같은지 단정
4. `web/proxy.ts`(새) — 아이로그 proxy 모양 그대로. 다른 점만:
   - `x-cited-client: cited`, `x-cited-key: process.env.CITED_CRAWL_KEY`
   - 보내는 곳 `new URL("/api/crawl", req.nextUrl.origin)` · `/api/visit` 도 같게(리터럴 호스트 쓰지 않는다 — 미리보기는 키가 없어 no-op)
   - ip = x-forwarded-for 첫 값. visit 은 `readVisit(req, process.env.VISIT_SALT)` (web/lib/visit.ts) — VISIT_SALT 없으면 null
   - matcher: `"/((?!_next/static|_next/image|api/|admin|favicon.ico|.*\.(?:png|jpg|jpeg|svg|webp|ico|mp4|webm)$).*)"` (정규식 뜻. TS 문자열 리터럴로는 점 앞 백슬래시 두 개 — 아이로그 proxy.ts matcher 와 같은 글자) — llms.txt·robots.txt·sitemap.xml 은 크롤러가 읽는 곳이라 남긴다(txt·xml 빼지 말 것)
   - 새 의존성 금지(@vercel/functions 넣지 않는다)
5. `web/scripts/check-proxy.mjs`(새) — `node --experimental-strip-types` 로 `lib/cited-proxy.ts`·`lib/bots.ts` 를 불러 단정(Test map). package.json 스크립트 추가 안 함
6. `next.config.mjs` **건드리지 않는다**
7. env (Production 만, CLAUDE.md 함정대로):
   - `cd academy && node scripts/setup-multiclient.mjs` → cited·docttak 키 생성(뷰는 같은 정의라 무해 — 위 사실). `--show-key cited` 값을 **파일**에 써서 web 에서 `npx vercel env add CITED_CRAWL_KEY production < 파일`
   - VISIT_SALT = crypto randomBytes(32) hex 를 파일로 → 같은 방법
   - `npx vercel env pull` 로 받아 두 값 길이 확인(키 36자, 소금 64자, BOM·줄바꿈 없음). 받은 파일·임시 파일은 지운다. 값을 REVIEW-REQUEST·로그에 적지 않는다

### 51b AI 답 측정 패널
8. `academy/scripts/seed-panel.mjs` — DB 고객 길:
   - `패널파일` 에 `cited: () => import("./seed-cited-panel.mjs")`
   - `패널점검(m, 이름원문)` 으로 바꾼다: 이름원문 = 코드덩어리 있으면 `answerRe.source`, 없으면 DB `answer_pattern`. 덩어리 없음 자체는 더 이상 오류 아님. 이름원문이 null·빈 글자면 `이름 판별 말 없음 — /admin/clients 에서 넣는다`
   - 코드덩어리 없고 DB 행도 없으면 `${SLUG} 고객사 없음 — /admin/clients 에서 먼저 등록` 으로 멈춤(새고객 삽입은 코드 고객만)
   - id 대조(`DB id ≠ clients.mjs id`)는 코드 고객일 때만
   - ilog·docttak 동작은 한 글자도 안 바뀌어야 한다
9. `academy/scripts/seed-cited-panel.mjs`(새) — docttak 파일 꼴. SLUG cited, `새고객` 없음, `이름말` = DB answer_pattern 과 같은 글자(위 사실 — 패널점검이 대조), `파일럿` = 문서딱 값 그대로(0원·자사 실증·원장·이메일 null·「자사」·해당 없음·대표자 본인 운영·리허설) + competitors `지오랭크, 서치폴라리스, 제스트컴퍼니, 넥스트티, 비즈스프링`(probe/prompts/geo-kr.json brand_universe 앞 5곳 name 그대로)
10. 패널 20 = **keyword 17 + brand 3.** 대화체 질문 넣지 않는다
   - 실측: 씨앗 `geo 마케팅 · geo 대행사 · geo 최적화 · aeo · aeo 마케팅 · ai 검색 최적화 · ai 검색 노출 · 생성형 엔진 최적화 · 챗gpt 노출 · 챗gpt 마케팅 · 챗gpt 검색 노출 · ai 마케팅 대행 · llmo · 퍼플렉시티 노출` 을 네이버 자동완성에 넣어 원응답을 `handoff/research/step51/autocomplete.json` 에 날짜·씨앗별로 저장
   - 고르기: 씨앗 순서 → 자동완성 순위대로, 뜻이 GEO/AEO/AI 검색 마케팅인 것만. 뺀다: 다른 뜻(geography·aeon·AEO 인증 등) · 남의 회사 이름이 든 것 · 띄어쓰기·대소문자만 다른 중복. **글자는 자동완성 원문 그대로**
   - 17개가 안 되면 geo.clients 에 등록된 경쟁 검색어 6개(GEO 대행사 · GEO 마케팅 업체 · AEO 대행사 · AI 검색 노출 대행 · 챗GPT 회사 노출 방법 · GEO 비용)로 채운다(출처 「등록 경쟁 검색어(guides.ts 겨냥)」)
   - 그래도 모자라면 **멈추고 몇 개인지 보고**. 지어내서 채우지 않는다
   - brand 3: `사이티드 어떤 회사야?` · `cited.kr 뭐 하는 곳이야?` · `사이티드 GEO`(등록 브랜드 검색어)
   - 각 줄 출처 칸에 씨앗·순위(예 「네이버 자동완성 · 씨앗 geo 마케팅 · 3위」)
11. `node scripts/seed-panel.mjs --client cited` (dry) 출력 전체를 `handoff/research/step51/seed-dry.txt` 에. **--apply 는 Arch** 가 리뷰 뒤 돌린다
12. `academy/scripts/test-seed-panel.mjs`(새) — 패널점검 단정(Test map)

Flag: 질문 승인(approved=true)은 원장 몫. 어떤 스크립트도 approved 를 켜지 않는다.

## Failure modes
| 길 | 실제로 날 실패 | 처리 | 사용자에게 |
|---|---|---|---|
| proxy → /api/crawl | 키 오타·BOM → 401, 기록 0 | env pull 길이 확인 + 배포 뒤 라이브 확인(Acceptance) | 조용함 → 라이브 확인이 잡는다 |
| proxy → fetch 실패·느림 | DB 느림 | waitUntil + catch, 응답은 먼저 나감 | 페이지 정상 |
| proxy 예외 | 페이지 500 | decide 는 순수·시험, fetch 는 try/catch. 배포 뒤 `/`·`/geo`·`/admin` 200 확인 | 500 이면 바로 보임 → 롤백 |
| 옛 도메인 | proxy 가 308 앞에 끼어 깨짐 | Next 실행 순서상 next.config redirects 가 proxy 보다 먼저 + 라이브 회귀 확인 | — |
| 원장 자기 방문 | 랜딩 방문 부풀림 | cited_admin 쿠키면 안 셈. 쿠키 없는 기기는 못 거름 → KG-51-3 | 숫자 오차, 알려 둠 |
| 시험 요청 | 검증 행이 실적에 섞임(지어낸 숫자) | 경로 `/step51-verify-*` 로만 시험, 확인 뒤 DELETE | — |
| 자동완성 | 결과 17 미만 | 등록 검색어로 채움, 그래도 모자라면 멈춤 | Bob 보고 |
| 측정 몫 | GitHub vars 에 CLAUDE_MEASURE_RESERVE 고정 → cited 몫 없음 | 기존 예산 일감(measure-budget-cited-*)이 열린다. Bob 이 `gh variable list` 로 값 유무 보고 | 사람 일감으로 보임 |
| seed-panel 변경 | ilog·docttak 회귀 | test-seed-panel 에서 둘 다 기존과 같은 결과 | — |

롤백: `web/proxy.ts` 지우는 커밋 하나(next.config 무변경이라 딴 것은 안 따라온다). env 는 남겨도 무해.

## Test map
| 갈래 | 상태 |
|---|---|
| decide: 키 없음 → null | [GAP→check-proxy] |
| decide: GPTBot·ClaudeBot·PerplexityBot UA(identify 거쳐) → crawl | [GAP→check-proxy] |
| decide: 사람 → visit · cited_admin 쿠키 → null · admin-auth.ts 쿠키 이름 글자 대조 | [GAP→check-proxy] |
| decide: /api/x · /admin · /admin/ops → null | [GAP→check-proxy] |
| matcher: proxy.ts 의 문자열을 읽어 정규식으로 — /, /geo, /llms.txt, /robots.txt, /sitemap.xml 걸림 · /api/crawl, /admin/ops, /_next/static/x.js, /a.png 안 걸림 | [GAP→check-proxy] |
| web/lib/bots.ts 사본 = academy | [GAP→check-crawler-class] |
| readVisit·cleanVisit | [TESTED academy/scripts/test-visit.mjs] — 다시 돌려 통과 |
| 패널점검: cited 파일 20개·중복 없음·이름말 = DB answer_pattern 글자 | [GAP→test-seed-panel] |
| 패널점검: 이름원문 null → 오류 글자 | [GAP→test-seed-panel] |
| 패널점검: ilog·docttak → null (회귀) | [GAP→test-seed-panel] |
| cited 패널: keyword 17 · brand 3 · 모든 keyword 글자가 autocomplete.json 에 있거나 등록 검색어 6개 중 하나 | [GAP→test-seed-panel] |
| test-docttak.mjs | [TESTED] — 다시 돌려 통과 |
| 옛 도메인 308 · /api 안 넘김 | [GAP→라이브 회귀, Acceptance] |
| 봇·사람 기록이 운영 DB 에 들어감 | [GAP→라이브, Acceptance] |

## Out of Scope
- next.config.mjs · web/app/api/crawl·visit 라우트 수정
- /admin/ops·/admin/clients 화면에 cited 기록이 보이는지 손보기 → KG-51-4
- ai-web-measure(화면 측정)·daily-agent 개선 루프의 cited 동작 확인 → KG-51-5
- 경쟁 검색어 원장 확인 · GSC cited.kr 권한(사람 몫, 열린 일감)
- 질문 승인, 측정 몫 vars 변경

## Acceptance
Bob(배포 전):
- `node --experimental-strip-types web/scripts/check-proxy.mjs` · `node web/scripts/check-crawler-class.mjs` · `node academy/scripts/test-visit.mjs` · `node academy/scripts/test-seed-panel.mjs` · `node academy/scripts/test-docttak.mjs` 전부 통과
- web 에서 `node ./node_modules/typescript/bin/tsc --noEmit` · `npm run build` 통과(npx tsc 금지 — & 함정)
- env 두 개 Production 에 있고 pull 길이 36·64
- step51/autocomplete.json · seed-dry.txt · REVIEW-REQUEST 에 고른 17개와 버린 것·까닭, `gh variable list` 의 CLAUDE_MEASURE_RESERVE·CLAUDE_DAILY_MAX 유무

Arch(Richard 통과 뒤, main push = web 배포):
- 라이브 봇: GPTBot UA(`Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot`)로 `https://cited.kr/step51-verify-bot` → 30초 안에 academy.crawl_hits 에 client_id 15 · bot GPTBot · path /step51-verify-bot 한 줄
- 같은 UA 로 `https://cited.kr/llms.txt` → 기록됨(경로 /llms.txt, 시각으로 특정해 지움)
- 라이브 사람: 브라우저 UA + `sec-fetch-dest: document` 로 `https://cited.kr/step51-verify-visit` → geo.site_visits client 15 · 그 path 한 줄
- 같은 사람 요청에 쿠키 `cited_admin=x` (path /step51-verify-admin) → 행 없음
- 옛 도메인: GPTBot UA 로 `curl -sI https://geo-rose-nine.vercel.app/step51-verify-old` → 308 · location `https://cited.kr/step51-verify-old`, curl 이 따라가지 않았으니 그 path 행 없음 · `https://geo-rose-nine.vercel.app/api/crawl` GET → 308 아님
- `https://cited.kr/` · `/geo` · `/admin`(로그인 화면) 200
- 확인 뒤 시험 행 전부 DELETE (crawl_hits·site_visits) — 지운 행 수 BUILD-LOG 에
- `node scripts/seed-panel.mjs --client cited --apply` → 파일럿 1 · 질문 20(승인 0) · measure_active true. 원장에게 /admin/pilots 승인 요청
