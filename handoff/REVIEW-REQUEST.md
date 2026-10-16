# Review Request — Step 51
Date: 2026-10-16
Ready for Review: YES
Status: DONE (배포 전 범위. 커밋·푸시·배포·seed-panel --apply 안 함)

## Files Changed
- web/lib/bots.ts (새) — academy/lib/bots.ts 바이트 그대로 사본(cmp 같음)
- web/lib/cited-proxy.ts (새, import 없음) — `decide({pathname, cookie, hasKey, isBot})`: 키 없음·/api·/admin(하위) → null, 봇 → crawl, cited_admin 쿠키 → null, 그 밖 → visit
- web/proxy.ts (새) — 아이로그 proxy 꼴. `new URL("/api/crawl"|"/api/visit", req.nextUrl.origin)` 로 x-cited-client cited + x-cited-key 를 waitUntil 로 보냄, fetch 는 try/catch 로 삼킴. visit 은 readVisit(req, VISIT_SALT). matcher 는 브리프 글자 그대로
- web/scripts/check-proxy.mjs (새) — decide·identify 단정 + admin-auth.ts COOKIE 글자 대조 + proxy.ts matcher 문자열을 정규식으로 걸림/안 걸림
- web/scripts/check-crawler-class.mjs:27-32 — 끝에 web/lib/bots.ts = academy/lib/bots.ts(CRLF→LF) 대조, 다르면 exit 1
- academy/scripts/seed-panel.mjs:8-10, 20, 23-35, 60-64 — 패널파일에 cited · `패널점검(m, 이름원문 = 코드덩어리?.answerRe.source ?? null)` · 덩어리·DB 행 둘 다 없으면 「고객사 없음 — /admin/clients 에서 먼저 등록」 · id 대조는 코드 고객만. 1인자 호출(test-docttak)은 기본값으로 전과 같다
- academy/scripts/seed-cited-panel.mjs (새) — docttak 꼴. 새고객 없음, 이름말 = DB answer_pattern 글자, 파일럿 0원 리허설 + 경쟁사 brand_universe 앞 5곳
- academy/scripts/test-seed-panel.mjs (새) — 10 단정(아래)
- handoff/research/step51/autocomplete.json (새) — 14씨앗 원응답(raw 포함), 2026-10-16 KST
- handoff/research/step51/seed-dry.txt (새) — `seed-panel --client cited` dry 출력

## Env (geo Production)
- setup-multiclient.mjs 실행 → cited·docttak crawl_key 생성(뷰는 같은 정의)
- CITED_CRAWL_KEY · VISIT_SALT 를 파일로 `vercel env add ... production <` 넣음
- env pull 대조: CITED_CRAWL_KEY 36자 · DB 키와 같음 · hex 만 / VISIT_SALT 64자 · hex 만. BOM·줄바꿈 없음. 받은 파일·임시 파일 지움, 값은 어디에도 안 적음

## 패널 (keyword 17 + brand 3)
자동완성 원문 12개(씨앗 순 → 순위 순):
geo 마케팅(1) · AEO GEO 마케팅(2) · geo 마케팅 대행사(3) · geo 마케팅 뜻(4) · geo 마케팅 회사(5) · geo 마케팅 방법(6) · geo 마케팅 비용(7) — 씨앗 geo 마케팅
geo 최적화(1) · geo 최적화 뜻(2) — 씨앗 geo 최적화
AEO마케팅(4) — 씨앗 aeo · ai 검색 최적화(1) · 생성형엔진최적화(1)
등록 경쟁 검색어로 채운 5개: GEO 대행사 · GEO 마케팅 업체 · AEO 대행사 · AI 검색 노출 대행 · 챗GPT 회사 노출 방법
brand: 사이티드 어떤 회사야? · cited.kr 뭐 하는 곳이야? · 사이티드 GEO

빈 목록 씨앗 8개: geo 대행사 · ai 검색 노출 · 챗gpt 노출 · 챗gpt 마케팅 · 챗gpt 검색 노출 · ai 마케팅 대행 · 퍼플렉시티 노출 (+ llmo 는 결과가 다른 뜻뿐)
버린 것·까닭:
- 「aeo」(aeo 3위)·「AEO 뜻」(aeo 2위) — 같은 목록에 AEO 인증·aeon 이 섞여 있어 뜻이 갈린다
- 「geo 최적화 영어로」(geo 최적화 3위) — 용어 풀이 질문이라 회사 이름이 나올 일이 드물다(D174, Arch)
- 「AEO GEO 마케팅」(aeo 1위) — q2 와 같은 글자
- 「aeo 마케팅」(씨앗 aeo 마케팅 1위) — AEO마케팅 과 띄어쓰기·대소문자만 다름(먼저 나온 쪽을 남김)
- aeon mall · AEO 인증 · aeon · aeonian · aeon atm · aeon atm 찾는법 — 다른 뜻
- LLMops 뜻 · ll mondo 뜻 — 다른 뜻
- 남의 회사 이름이 든 결과는 없었다

## 측정 몫 (D173)
`gh variable list` (leeledger/geo): CLAUDE_MEASURE_RESERVE 없음 · CLAUDE_DAILY_MAX 없음 (secret 에도 없음). 있는 vars: MEASURE_ENGINES · MEASURE_EVERY_DAYS · REPAIR_ENABLED · WRITER_PROVIDER. → 고정값 없음, cited 몫 +20 이 자동으로 붙는다

## Verification
- `node --experimental-strip-types web/scripts/check-proxy.mjs` — 전부 통과(키 없음 2 · GPTBot·ClaudeBot·PerplexityBot identify·/·/llms.txt · 봇+admin쿠키 → crawl · 사람 visit/null 5 · /api·/admin 경로 8 · 쿠키 글자 대조 · matcher 걸림 6 / 안 걸림 8)
- `node web/scripts/check-crawler-class.mjs` — AI_BOTS 같음(20) · SEARCH_BOTS 같음(5) · 사본 같음
- `node --experimental-strip-types academy/scripts/test-visit.mjs` — 94 통과 · 0 실패
- `node academy/scripts/test-seed-panel.mjs` — 10/10
- `node academy/scripts/test-docttak.mjs` — 35 통과 · 0 실패
- web `node ./node_modules/typescript/bin/tsc --noEmit` — 0 · `npm run build` — 통과, 「ƒ Proxy (Middleware)」 잡힘
- seed-panel dry: cited(이름 판별 DB 값 = 파일 값 · 파일럿 새로 · 질문 20 · keyword 17 · brand 3), ilog·docttak dry 도 전처럼 돎

## Open Questions
- (닫힘, D174) 「aeo」·「AEO 뜻」 뺀 채 유지 · 「geo 최적화 영어로」 → 「챗GPT 회사 노출 방법」
- test-visit 은 맨 `node` 로는 .ts import 에서 멈춘다. 브리프 Acceptance 의 명령 대신 파일 머리 주석대로 `--experimental-strip-types` 로 돌렸다
- matcher 시험은 문자열을 `^…$` 정규식으로 본다. Next 의 path-to-regexp 변환과 같다고 보장하지 않는다 — 라이브 확인(Acceptance)이 최종

## Out of Scope (logged in BUILD-LOG)
- KG-51-1~5 그대로. 새로 고친 것 없음
