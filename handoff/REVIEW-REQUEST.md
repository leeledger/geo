# Review Request — Step 32 (D44·D45, D46 은 토큰 뒤라 안 함)
Date: 2026-10-01
Ready for Review: YES
Status: DONE_WITH_CONCERNS — 시험·dry 는 다 통과. 문서딱 seed 는 dry 만 돌렸다(--apply 는 Arch). 홈 JSON-LD 검사를 설계서와 다르게 했다(아래 질문 1)

## 확인한 것
- `node academy/scripts/test-docttak.mjs` 31 통과 · `test-ilog-loop.mjs` 33 통과 · `test-grow-loop.mjs` 37 통과
- web `node ./node_modules/typescript/bin/tsc --noEmit` 0
- 아이로그 불변: `seed-panel.mjs --client ilog --dry` 출력 = 바꾸기 전 `seed-ilog-panel.mjs` 출력 (diff 0)
- 학원·아이로그 루프 불변: `daily-agent.mjs --dry` 바꾸기 전·후 diff 0 (DB 에 문서딱이 아직 없어 대상도 같음)
- 측정상한 k=0 → 40·22·60, k=1 → 60·42·120 (시험). 오늘 운영 DB 로 k=1 → 60·42·120, 전과 같음
- 공개 사이트(2026-10-01 curl): 홈·robots·llms.txt(text/plain)·sitemap·/pdf-merge/ 모두 200. robots 는 AI 검색 봇 허용. 홈 JSON-LD 는 WebSite·Organization, /pdf-merge/ 는 WebApplication·BreadcrumbList
- 문서딱 저장소(C:\dev\doc-tools-kr)는 안 열었다

## 질문 20개 (seed-docttak-panel.mjs, approved=false)
| # | stage | 질문 | 도구 |
|---|---|---|---|
| q1 | keyword | pdf 합치기 무료 | PDF 합치기 |
| q2 | keyword | 아이폰 pdf 합치기 | PDF 합치기 |
| q3 | keyword | pdf 합치기 방법 | PDF 합치기 |
| q4 | keyword | 안전한 pdf 합치기 | PDF 합치기 |
| q5 | keyword | 파일 안 올리는 pdf 합치기 | PDF 합치기 |
| q6 | keyword | pdf 용량 줄이기 | PDF 용량 |
| q7 | keyword | 정부24 pdf 용량 | PDF 용량 |
| q8 | keyword | 사진 용량 줄이기 | 사진 용량 |
| q9 | keyword | 사진 kb 줄이기 | 사진 용량 |
| q10 | keyword | 증명사진 용량 줄이기 | 사진 용량 |
| q11 | keyword | 여권사진 규격 | 사진 규격 |
| q12 | keyword | 증명사진 사이즈 | 사진 규격 |
| q13 | keyword | 공무원 시험 사진 규격 | 사진 규격 |
| q14 | keyword | 큐넷 사진 규격 | 사진 규격 |
| q15 | keyword | 한글파일 pdf로 변환 | HWP |
| q16 | keyword | hwp pdf 변환 | HWP |
| q17 | keyword | hwpx 열기 | HWP |
| q18 | brand | 문서딱 어떤 사이트야? | — |
| q19 | brand | docttak.com 이 사이트 뭐 하는 곳이야? | — |
| q20 | brand | 문서딱 파일 안 올리고 처리돼? | — |

**고른 기준.** 설계서는 「브리프 22개 중 17개」라고 했다. 그런데 브리프 「측정 요청」에 적힌 자동완성 검색어는 17개다(3+2+3+4+3+2 — 시험이 브리프를 읽어 센다). 그래서 고르지 않고 17개 전부, 글자 그대로 넣었다. 지어낸 검색어는 없다.
도구별로 합치기 5 · PDF 용량 2 · 사진 용량 3 · 사진 규격 4 · HWP 3. 5개 도구에 다 질문이 있지만 고르지는 않다. 고르게 하려면 브리프에 없는 검색어를 지어내야 한다. 「증명사진 용량 줄이기」는 브리프 줄을 따라 사진 용량 쪽에 셌다.
이름 질문 3개는 설계서 꼴 그대로다. 「문서딱 파일 안 올리고 처리돼?」는 브리프의 「파일은 기기 밖으로 나가지 않는다」와 맞다.

## Files Changed
- academy/clients.mjs:131-189 — 문서딱 덩어리(id 3). answerRe `문서딱|docttak(\.com)?` · brandRe 도메인만 · llmsTxt · siteLog 「Cloudflare 통계 연결 전」 · loop(brandHit 도구 이름, homeLd Organization+docttak.com, draft session → deliverables/docttak/guide/, 변형 탐침 「{기능} 무료」「{기능} 사이트」 strip 무료|방법|사이트, offsite 2) · 검색 화면 질의(색인 1, 경쟁 5 = 브리프 원문 도구별 하나, 브랜드 2). IndexNow 키 없음 → indexnow.mjs 가 건너뛴다
- academy/clients.mjs:84 — 주석이 seed-panel.mjs 를 가리키게
- academy/scripts/seed-panel.mjs (새) — 일반형 `--client <ilog|docttak> [--dry|--apply]`. 기본 dry. 고객사 칸이 없으면 clients.mjs id 로 새로 넣고(KST started_on, relation 자사, measure_active), DB id ≠ 덩어리 id 거나 그 id 를 남이 쓰면 멈춘다. 파일럿에 competitors 를 같이 넣는다(아이로그는 ""=기본값, 이미 있는 파일럿은 안 건드림). `패널점검` 은 순수 함수로 export
- academy/scripts/seed-docttak-panel.mjs (새) — 위 20개 + 새고객(자사) + 파일럿(0원 리허설, 경쟁사 「iLovePDF, Smallpdf, 알PDF, allinpdf, 한컴독스」, contact_email null)
- academy/scripts/seed-ilog-panel.mjs:1-56 — 실행부를 seed-panel.mjs 로 옮기고 자료(SLUG·패널·이름말·파일럿)만 남김. 값은 그대로
- academy/measure-targets.mjs:80-115 — `고객있음` → `고객수`(유료 + 승인 질문 있는 자사). `고객측정일` 은 k 를 돌려준다(못 읽으면 0). `측정상한(k)` = 40+20k · 22+20k · 60+60k, env 먼저, reserve ≤ claude 그대로
- academy/scripts/ai-measure.mjs:281,324-326 — 탐침 시간 문턱 35 → 60분 (아래 timeout 근거)
- .github/workflows/optimize.yml:23 — timeout-minutes 50 → 80
- academy/scripts/claude-code.mjs:39,84 · ai-measure.mjs:67,233 · tools/ai-web-measure.mjs:230 — 주석만(옛 「두 배」 숫자 → k 식)
- academy/scripts/briefing.mjs:204-207 — siteLog 가 있는 고객은 「크롤러 기록 장치」 일감을 안 올리고 그 말을 찍는다
- web/app/admin/ops/Visits.tsx:23-30,57-64 · page.tsx:192 — 방문 카드: 문서딱이고 기록이 없으면 「Cloudflare 통계 연결 전 — …」
- academy/scripts/test-ilog-loop.mjs:11,109-125 — 같은 값을 k 꼴로 시험(0·1)
- academy/scripts/test-docttak.mjs (새) — 31개: 패널이 브리프 원문만인지(브리프 파일을 읽어 대조)·이름 판별·홈 LD(curl 원문)·이름 질문 적중·변형 도구 말·seed 점검·k=0/1/2·env·순서

## optimize.yml timeout 근거
- k=2(아이로그+문서딱 승인)면 Claude 측정 몫 62회 = 승인 20×3 + 탐침 2
- 실측(geo.claude_calls purpose=measure, 9/24~9/30): 하루 20회 평균 23~32초, p90 32~40초, 최대 89초
- Actions 「AI 답변 측정」 단계 걸린 시간: 9/29 11분14초(20회 → 회당 33.7초) · 9/30 10분54초(22회 → 29.7초). 「판정·고르기·행동」 7~9초
- 62회 × 33.7초 = 35분. 느린 날(평균 32초 + 쉼·기동 7초 = 39초) × 62 = 40분. 50분 제한이면 남는 몫이 10분이고, 탐침은 35분 문턱에 걸려 k=2 날 못 잰다
- 그래서 timeout 80분, 탐침 문턱 60분(개선 루프에 20분 남김). 한 문항이 3분 막히면 503 으로 그 엔진을 멈추니 끝없이 늘지 않는다

## Open Questions
1. **홈 JSON-LD 검사(설계서와 다름).** 설계서는 「홈 JSON-LD 검사(WebApplication)」. 공개 홈에는 WebApplication 이 없다 — WebSite·Organization 뿐이고 WebApplication 은 도구 페이지에만 있다. 루프는 홈만 읽으니 그대로 하면 첫날부터 매일 「홈에 빠진 것」 헛일감이 선다. `[/"Organization"/, /docttak\.com/]` 로 했다. Arch 가 WebApplication 을 원하면 홈이 아니라 도구 페이지를 읽게 daily-agent 를 바꿔야 한다
2. **id 3 을 명시해 넣는다.** geo.clients 시퀀스 마지막이 5(지운 시험 행)라 그냥 넣으면 6 이 된다. company.mjs 는 id 로 clients.mjs 설정을 찾는다. 시퀀스는 3 을 다시 안 주니 겹치지 않는다
3. **Arch 실행 순서.** `node scripts/seed-panel.mjs --client docttak --apply` 를 푸시보다 먼저. 덩어리가 먼저 올라가면 serp(check-index)·rescan 이 DB 에 없는 client 3 으로 쓴다(KG-32-1)
4. brandHit `/PDF\s?합치|PDF\s?용량|사진\s?용량|증명사진|여권\s?사진|HWP/i` — 「문서딱은 모르지만 PDF 합치기 사이트로는…」 같은 답도 적중으로 셀 수 있다. 이름 질문 3개에는 도구 말이 없어 쓸 만하다고 봤다. 더 좁힐지
5. answer_pattern 의 「문서딱」 은 글자 그대로 센다. 「문서 딱」(띄어 씀)은 안 센다(시험). 동명 서비스가 있는지는 안 봤다 — 검색 화면 brandRe 는 그래서 도메인만
6. contact_email null — 공개 홈·llms.txt 에 문의 주소가 없다. 기준선 메일 같은 곳이 이 칸을 쓰면 원장이 넣어야 한다
7. 경쟁 검색어 5개(check-index)는 도구마다 브리프 원문 하나씩 골랐다(q1·q6·q8·q11·q16)

## Out of Scope (logged in BUILD-LOG)
- KG-32-1 seed --apply 가 푸시보다 먼저
- KG-32-2 현황판 크롤러 표·Growth 카드는 문서딱에 「기록 없음」 류 — D46 때
- KG-32-3 오늘(10/1) optimize 3회 실패, Claude 측정 호출 평균 1초 — 원인 안 봄
- KG-32-4 health.mjs 크롤러 줄 문구
