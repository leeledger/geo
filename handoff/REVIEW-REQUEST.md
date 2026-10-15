# Review Request — Step 50
Date: 2026-10-15
Ready for Review: YES
Status: DONE — verify ALL PASS 179 (옛 104 + 새 75) · tsc 0 · build 통과 · 새 의존성 0 · 시험 행 삭제됨

## Files Changed
- web/lib/robots.ts:1-79 — 새. parseRobots(같은 UA 합치기·소문자)·verdict(명시 그룹 우선·최장 일치·동률 Allow·`*`·`$`·빈 Disallow 무시)·robotsState(2xx ok · 4xx(429 빼고) none · 나머지 fail).
- web/lib/platform-check.ts:13-58 — BOT_PLAIN · PLATFORMS(호스트→이름만, 정책 없음) · platformOf.
- web/lib/platform-check.ts:61-79 — classifyTarget: error 3종(주소·스마트플레이스·뿌리)·포트 error·정확 일치 platform·나머지 site. 사용자정보·# 버리고 https 로.
- web/lib/platform-check.ts:84-145 — safeFetch: https·허용 호스트·포트/계정 없음·redirect manual 3홉 홉마다 확인·8초·2MB·진단 UA 그대로. fetch 주입 가능(시험용).
- web/lib/platform-check.ts:159-228 — judgeHost(fail→null, none→모두 true, self 표시) · readPage(title·description·textLen·iframe) · buildLines(브리프 문장 틀 그대로).
- web/lib/platform-check.ts:231-266 — checkPlatform: 페이지 1회(짧은 주소는 끝 주소로 재판정) + robots(블로그는 PC·모바일 둘).
- web/lib/no-site.ts:1-24 — askQuestions(템플릿 3개)·clean·josa.
- web/app/api/scan/route.ts:36-50,70 — classifyTarget 먼저 → 400 사람 말 / platform → checkPlatform(saveScan 안 함) / site 는 그대로 + kind:"site".
- web/app/api/lead/route.ts:46-81 — source no_site(세 칸 필수·서버가 질문 재생성·클라 concerns 버림)·platform_check(wants). 그 밖 source 무시.
- web/lib/leads.ts:121-139 — saveLead source 선택 인자.
- web/app/admin/page.tsx:44-61 — Lead.source · SOURCE_LABEL 이름표를 카드 둘째 줄 앞에.
- web/app/ScanForm.tsx:1-373 — 세 길. placeholder·aria·busy·formnote+「주소가 없어요」, 길 C(질문 만들기·복사·물어봐 주세요), 결과 B(점수 없음·lines·봇 줄·PC/모바일 다르면 둘 다·KST 확인 시각), 결과 A 쉬운 말(plat-caps·가중치 0 행 숨김·PRIO 먼저/다음/여유 있을 때). placeholder prop 삭제.
- web/lib/scan.ts — export(UA·stripTags·BOTS) · SITE_LABELS 6개 · notes 문자열 9개. 로직·가중치 무변경.
- web/lib/platform.ts:57,63,127,136 — 문자열만: robots.txt→봇 규칙 파일(2곳 note·advice), CAP_LABEL 됨/일부만/안 됨.
- web/app/page.tsx:47-50,662-672 — FAQ 2 첫 문장 홈페이지 몫 · 새 FAQ 3 · #start h2·lp-sub·.ps · placeholder prop 삭제.
- web/app/globals.css:~555-575 — linkbtn·pres·pbot·ns 스타일.
- handoff/research/step50/verify.mjs — step49 복사 + 50-R·C·A1~A4·S·L0~L3·U·K. 스크린샷 step50/{1440,390}-{hero,start,A,B-naver,B-instagram,error,C-questions,C-done}.png (+1440-B-fail.png).

## 바뀐 옛 단정
| 옛 단정 | 새 단정 | 까닭 |
|---|---|---|
| FAQ 화면 10 · JSON-LD 10 | 11 · 11 | 새 FAQ 3 「홈페이지가 없어도 진단받을 수 있나요?」 |
| FAQ 3 끝 = PILOT.after | FAQ 4(비용) 끝 = PILOT.after | 비용 문답이 한 칸 밀림 |
| [49-10] 펼친 답 10개 · want[2] 에 「홈페이지 제작 250만원」 | 11개 · want[3] | 같은 까닭 |
| OUT 기본값 step49 | step50 | 브리프 |
그 밖 104개는 문자 그대로 유지(req() 가 요청마다 다른 x-forwarded-for 를 붙인 것만 다름 — 5/분 리밋).

## Deviations
1. platform.ts 의 Shopify·Webflow note 와 platformAdvice 의 「robots.txt」도 「봇 규칙 파일」로 바꿈. 브리프는 scan.ts notes·CAP_LABEL 만 짚었지만 이 문장들도 결과 A 패널에 뜬다(50-U 0회 목표).
2. 결과 B 연락처 부제: 「진단한 주소**와 결과가** 함께 접수됩니다」 → 「진단한 주소가 함께 접수됩니다」. platform_check 리드는 site 만 저장하고 결과는 안 남긴다(D152·D160). 「결과도 접수」는 사실이 아님.
3. 짧은 주소(naver.me)가 허용 밖·뿌리 주소로 가거나 못 열리면 결과는 「이 주소를 열어 보지 못했습니다. (응답 n)」 한 줄(hosts 0, 마지막 줄 없음). 브리프에 이 경우 틀이 없었고 「이 규칙은 …이 정합니다」는 정할 플랫폼이 없어 뺌.
4. BOT_PLAIN 은 scan.ts 가 아니라 platform-check.ts 에 둠(scan.ts diff 를 문자열·export 로 묶으려고).
5. 길 C 문구 「{상호}가」를 받침 보고 이/가로(josa, no-site.ts). platform-check 의 은/는·이/가도 같은 함수.
6. 주소 입력이 바뀌면 이전 결과·오류를 지운다. 브리프는 「지금 동작 유지」라 했지만 지금 코드는 제출 때만 지웠다 — 브리프의 뜻(바뀌면 지움)을 따름.
7. #start lp-sub 끝 「홈페이지가 없어도 됩니다.」는 브리프 문장에 없어 빠짐.
8. verify 가 cited.kr 진단(50-A3·화면 A 2회)으로 생긴 geo.scans 3행도 id 로 지움 — 영업 깔때기 숫자(scans30d)를 안 흐리려고.
9. 결과 A 연락처 부제의 「없이30일」 붙음(옛 JSX 줄바꿈 탓)이 고쳐짐 — 문구는 같음.

## Open Questions
- 결과 B 봇 줄의 순서는 BOTS 순서(가중치 표). 사람이 보기엔 「막힘」을 위로 모으는 게 나을 수 있음 — 브리프에 없어 손대지 않음.
- 「확인하지 못했습니다」: 실측에서 나옴 — m.place.naver.com 이 우리 UA 에 429 (1440-B-fail.png). 390 은 안 찍음(브리프 8상태 밖).
- safeFetch 는 robots 리다이렉트도 허용 호스트 안에서만 따른다. 플랫폼 robots 가 CDN 다른 호스트로 넘기면 fail 로 나온다(현재 실측엔 없음).
- 실측 판정(오늘 23시): 네이버 블로그 PC·모바일 같음 — 「PC·모바일 다릅니다」 줄은 단위 시험으로만 확인됨. 인스타는 ChatGPT 검색·ChatGPT-User·Perplexity-User·네이버 검색·Gemini 학습·Common Crawl 막힘.

## Out of Scope (logged in BUILD-LOG)
- KG-50-7 레이트리밋이 x-forwarded-for 첫 값을 믿음(Vercel 밖이면 우회)
- KG-50-8 /admin no_site 카드에 「AI 답 확인 요청」 두 번(이름표 + wants)
- KG-50-1~6 은 브리프 그대로
