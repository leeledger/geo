# Architect Brief — Step 50

## Goal
홈페이지가 없는 사장님도 진단을 받는다. 입력 하나에 길 셋: 홈페이지(지금 그대로) · 블로그·SNS·플레이스 주소(그 플랫폼의 봇 규칙을 그 자리에서 읽어 사람 말로) · 주소 없음(질문 3개 + 「사이티드가 물어봐 드림」 접수 → /admin). 블로그 주소를 넣으면 네이버 점수(21 위험)가 나오던 오진을 없앤다.

원장 지시(2026-10-15): 「홈페이지가 없어도 진단을 받을 수 있게 … 블로그 주소를 받거나, 아무튼 없는 사람도.」
결정 D152~D160 · KG-50-1~6 BUILD-LOG. Step 49 브리프는 handoff/research/ARCHITECT-BRIEF-step49.md.

## 지금 코드가 하는 일 (확인함)
- `web/lib/scan.ts:147 normalizeTarget` 가 무엇이든 `u.origin` 으로 줄인다 → `blog.naver.com/robotncoding` = `https://blog.naver.com` 진단. 사용자가 아니라 네이버를 채점한다.
- `botAllowed`(scan.ts:105)는 `Disallow: /` 전면 차단만 센다. 경로 규칙·`Allow`·`*`·`$`·같은 UA 그룹 합치기를 안 본다. 플랫폼에선 틀린 답을 낸다(아래 실측).
- `saveLead`(leads.ts:135) source 는 scanId 유무로만 `free_scan`/`contact`. 새 종류를 넣을 자리가 없다.
- /admin 카드(admin/page.tsx:47)는 source 를 안 보인다.

## 실측 (2026-10-15, UA = scan.ts 의 siteband-scan, curl)
| 호스트 | robots.txt | 우리 봇 목록 기준 핵심 |
|---|---|---|
| blog.naver.com | 200 · 1623B | Yeti·GPTBot·OAI-SearchBot·PerplexityBot·Google-Extended·ClaudeBot·CCBot 은 `Disallow: /`. ChatGPT-User·Perplexity-User·Googlebot·Bingbot 은 `*` 그룹(경로 몇 개만 막음) |
| m.blog.naver.com | 200 · 12267B | 같은 AI 봇 묶음 차단 + 다른 `*` 경로 목록. **PC·모바일 파일이 다르다** |
| *.tistory.com | 200 · 185B | `*` 는 /manage·/admin 등만. bingbot Crawl-delay |
| www.instagram.com | 200 · 7336B | **`User-agent: *` → `Disallow: /`**. ClaudeBot·GPTBot·PerplexityBot·Googlebot·Bingbot 은 명시 그룹(경로 몇 개만) → 프로필 허용. OAI-SearchBot·ChatGPT-User·Perplexity-User 는 명시 그룹 없음 → `*` 로 막힘. Yeti `Disallow: /` |
| pf.kakao.com | 200 · 23B | `*` Allow / |
| place.map.kakao.com | 200 · 374B | `User-agent: *` 그룹이 **둘**(Allow / 와 Disallow / + Allow /$) + AI 봇 묶음 차단 → 그룹 합치기·`$` 필요 |
| map.naver.com | 200 · 539B | AI 봇 묶음 차단, `*` Allow / |
| m.place.naver.com · pcmap.place.naver.com | **429** (HTML 본문) | 우리 UA 에 429 → 「확인하지 못했습니다」 길. 429 HTML 을 robots 로 파싱하면 안 된다 |
| naver.me | 200 · 24B | 짧은 주소. 실제 대상은 리다이렉트 끝 |
| brunch.co.kr · smartstore.naver.com · www.youtube.com | 200 | 허용 목록에 넣는다 |
| blog.naver.com/robotncoding (페이지) | 200 · 2836B | 본문 없음 · `<iframe id="mainFrame">` — 측정 가능한 사실 |
| www.instagram.com/instagram/ (페이지) | 200 · 697KB | `<title>` 있음 |

결론: 플랫폼마다 다르고 바뀐다. 표를 코드에 박지 말고 매번 받아서 읽는다(D153). 위 표는 테스트 기대값이 아니다.

## 흐름

```
입력칸 하나 (ScanForm)                         「주소가 없어요」 버튼
  │ POST /api/scan {domain}                         │ (네트워크 없음)
  ▼                                                 ▼
rateLimited(5/분) ─429→ 오류                  상호·지역·업종 입력
  ▼                                                 ▼
classifyTarget(raw)  [lib/platform-check.ts]   askQuestions() 3개 + 복사 버튼
  ├ error  → 400 사람 말 (빈칸·점 없음·플랫폼 뿌리·스마트플레이스 관리주소·포트)
  ├ site   → normalizeTarget → scanSite (지금 그대로, kind:"site")
  └ platform(id, url)                               │ 이메일(필수)·전화(선택)
       ▼                                            ▼
     safeFetch: https·허용 호스트·포트 없음·      POST /api/lead {source:"no_site",
     redirect manual ≤3홉(홉마다 허용 확인)·8초     company, area, industry, email…}
       ├ naver.me → 끝 호스트로 플랫폼 재판정        ▼
       ▼                                         서버가 askQuestions 다시 만들어
     robots(호스트별: 네이버 블로그는 PC+모바일)      concerns 에 저장 · source=no_site
       2xx → parse(합치기·최장일치·Allow 우선·*·$)     ▼
       4xx → 「규칙 파일 없음 = 모두 들임」(RFC 9309) /admin 카드 「주소 없음 · AI 답 확인 요청」
       429·5xx·시간초과 → 「확인하지 못했습니다」      + lead-alert 메일(지금 그대로)
     page(그 주소): 제목·설명·글자 수·iframe
       ▼
     kind:"platform" (total·grade 없음) → 결과 패널 B
       └ 연락처 → /api/lead {source:"platform_check", site:url}
```

## Build Order

### 0. 준비
- `git pull` 후 작업. 새 의존성 없음(D159).
- `handoff/research/step50/` 를 만들고 step49/verify.mjs 를 복사해 `step50/verify.mjs`(OUT 기본값 step50).

### 1. `web/lib/robots.ts` (새 파일 · 순수 함수 · 이번 단계의 기초)
- `parseRobots(txt)` — 같은 UA 를 가진 그룹을 **합친다**(RFC 9309 2.2.1). UA 비교는 소문자.
- `verdict(groups, botId, pathAndQuery): { allowed: boolean; group: "own" | "*" | "none"; rule: string | null }` — 봇 이름 그룹이 있으면 그것만, 없으면 `*`, 둘 다 없으면 허용. 규칙은 **가장 긴 일치**가 이기고, 같은 길이면 Allow. `*` 는 아무 글자, 끝의 `$` 는 끝. 빈 `Disallow:` 는 무시. 경로는 `new URL().pathname + search`.
- scan.ts 의 `botAllowed`·`parseRobots` 는 **건드리지 않는다**. 1번 길 점수가 바뀌면 안 된다(D154). 1번 길을 새 매처로 옮기는 건 KG-50-2.
- `BOTS` 를 scan.ts 에서 `export` 만 한다(목록·가중치 그대로). 사람 말 이름표는 새 상수 `BOT_PLAIN` (id → 이름):
  OAI-SearchBot 「ChatGPT 검색」 · ChatGPT-User 「ChatGPT(손님이 주소를 줄 때)」 · PerplexityBot 「Perplexity 검색」 · Perplexity-User 「Perplexity(손님이 주소를 줄 때)」 · ClaudeBot 「Claude」 · Googlebot 「구글 검색」 · Bingbot 「빙·Copilot 검색」 · Yeti 「네이버 검색」 · GPTBot 「ChatGPT 학습」 · Google-Extended 「Gemini 학습」 · CCBot 「공개 웹 수집(Common Crawl)」.

### 2. `web/lib/platform-check.ts` (새 파일)
- `PLATFORMS` — **호스트 → 이름 매핑만**. 봇 정책을 적지 않는다(D153).

  | id | 이름 | 호스트 (정확히 일치, tistory 만 정규식) | robots 볼 호스트 | 자기 봇 |
  |---|---|---|---|---|
  | naver_blog | 네이버 블로그 | blog.naver.com · m.blog.naver.com | 둘 다(D155) | Yeti |
  | naver_place | 네이버 플레이스 | m.place.naver.com · pcmap.place.naver.com · map.naver.com | 그 주소의 호스트 | Yeti |
  | naver_store | 네이버 스마트스토어 | smartstore.naver.com · m.smartstore.naver.com | 〃 | Yeti |
  | tistory | 티스토리 | `^[a-z0-9-]+\.tistory\.com$` | 〃 | — |
  | instagram | 인스타그램 | instagram.com · www.instagram.com | 〃 | — |
  | kakao_channel | 카카오톡 채널 | pf.kakao.com | 〃 | — |
  | kakao_place | 카카오맵 장소 | place.map.kakao.com | 〃 | — |
  | brunch | 브런치 | brunch.co.kr | 〃 | — |
  | youtube | 유튜브 | youtube.com · www.youtube.com · m.youtube.com | 〃 | — |
  | (짧은 주소) | — | naver.me | 리다이렉트 끝으로 재판정 | — |

- `classifyTarget(raw)`:
  - 빈칸·`.` 없음·http(s) 아님 → `{kind:"error", msg:"주소를 다시 확인해 주세요. (예: blog.naver.com/아이디)"}`
  - smartplace.naver.com · new.smartplace.naver.com → error 「스마트플레이스 관리 화면 주소입니다. 네이버 지도에서 우리 가게를 열고 공유 주소를 넣어 주세요.」
  - 허용 호스트인데 사용자 몫 경로가 없음(경로 `/` 이고 tistory·naver.me 아님) → error 「블로그·계정 주소 전체를 넣어 주세요. (예: blog.naver.com/아이디)」
  - 허용 호스트에 포트가 붙음 → error(첫 문구)
  - 허용 호스트 → `{kind:"platform", id, url}`
  - 나머지 → `{kind:"site"}` (1번 길, normalizeTarget·기존 가드 그대로)
  - `blog.naver.com.evil.com` 은 정확 일치가 아니므로 site. `https://x@blog.naver.com/a` 는 URL 파서 hostname 기준.
- `safeFetch(url)` — https 만, `redirect:"manual"`, 3홉까지, **홉마다** Location 의 호스트가 허용 목록인지 확인(아니면 멈추고 실패). 8초 제한, 쿠키·인증 없음, 본문 2MB 에서 자른다. UA 는 scan.ts 와 같은 정직한 UA(브라우저 흉내 금지 — 429 를 우회하지 않는다, D157).
- `checkPlatform(id, url)` 결과:
  ```
  { kind:"platform", platform:{id,name}, url, checkedAt,
    hosts:[{ host, label:"PC 주소"|"모바일 주소"|null, robots:"ok"|"none"|"fail", status,
             bots:[{ id, plain, allowed:boolean|null, self:boolean, group, rule }] }],
    page:{ fetched:boolean, status, title:string|null, description:string|null,
           textLen:number|null, iframe:boolean },
    lines:string[] }   // 화면에 그대로 찍을 문장. total·grade 필드 없음
  ```
  - robots 2xx → verdict. 4xx(429 제외) → `robots:"none"`, 모든 봇 allowed=true(RFC 9309 2.3.1.3). 429·5xx·0 → `robots:"fail"`, allowed=null.
  - 「자기 봇」(네이버 호스트의 Yeti) → `self:true`, allowed 는 계산하되 문장·집계에서 뺀다. 네이버 블로그 robots 가 Yeti 를 막는데 네이버 검색엔 블로그가 나온다 — 그대로 찍으면 거짓 경보다(D156).
  - page: 그 주소를 safeFetch. 제목 `<title>`, 설명 `meta name=description` 또는 `og:description`, 글자 수 = scan.ts `stripTags` 길이(export 해서 재사용), iframe = `<iframe` 이 있고 글자 수 < 600.
- `lines` 규칙(이 글자 그대로, {} 만 채움 · D158):
  - 막힌 봇(self 제외) ≥1: 「{이름}은(는) {막힌 봇 plain 을 · 로 이음} 봇을 막아 두었습니다. 이 봇들은 이 주소의 글을 읽어 가지 않습니다.」 — 은/는 은 받침 보고 함수로.
  - 막힌 봇 0, 확인 성공: 「{이름}은(는) 확인한 AI·검색 봇 {n}개를 막지 않습니다.」
  - PC·모바일 판정이 다르면: 「PC 주소와 모바일 주소의 규칙이 다릅니다.」 한 줄 추가.
  - robots fail: 「{호스트}의 봇 규칙을 확인하지 못했습니다. 잠시 뒤 다시 눌러 주세요.」
  - robots none: 「{호스트}에는 봇 규칙 파일이 없습니다. 모든 봇이 들어올 수 있습니다.」
  - page iframe: 「글 본문이 안쪽 틀(iframe)로 따로 열립니다. 이 주소의 첫 화면에는 글자가 {textLen}자뿐입니다.」
  - page 성공·iframe 아님: 「사이티드가 받아 본 첫 화면에 글자가 {textLen}자 있습니다.」 + 없으면 「제목이 없습니다.」·「소개 문구(description)가 없습니다.」
  - page fail: 「이 주소를 열어 보지 못했습니다. (응답 {status, 0 이면 「없음」})」
  - 마지막 줄(항상): 「이 규칙은 {이름}이(가) 정합니다. 사장님이 바꿀 수 있는 설정이 아닙니다.」
  - Flag: 위 밖의 주장(「AI 에 안 나옵니다」「노출이 안 됩니다」 등) 금지. 실측에서 나온 것만.

### 3. `web/app/api/scan/route.ts`
- 레이트리밋 그대로(5/분, 세 길 공용).
- `classifyTarget` 먼저. error → 400 {error: msg}. platform → `checkPlatform` → 200 (saveScan 안 함 — scans.total 이 not null 이고 점수가 없다, D160). site → 지금 코드 그대로, 응답에 `kind:"site"` 만 추가.

### 4. 리드 — `web/lib/leads.ts` · `web/app/api/lead/route.ts` · `web/lib/no-site.ts`
- `saveLead` 에 `source?: "platform_check" | "no_site"` 선택 인자. 없으면 지금 규칙(scanId 유무). 열 추가 없음(DDL 없음, D152).
- `/api/lead`: `body.source` 가 위 둘 중 하나일 때만 넘긴다(그 밖 값은 무시, 옛 규칙).
  - `no_site`: company(상호 ≤40)·area(≤20)·industry(≤20) 셋 다 있어야 함, 없으면 400 「상호·지역·업종을 적어 주세요.」. 서버가 `askQuestions` 로 질문을 **다시** 만들어 `concerns = 질문 3개를 " / " 로 이음`, `wants = "AI 답 확인 요청"`, `site=null`, `scanId=null`. 클라이언트가 보낸 concerns 는 버린다.
  - `platform_check`: `site = body.site`(≤200), `wants = "블로그·SNS 할 일"`.
  - 이메일 필수(지금 그대로), 전화 선택, 허니팟·레이트리밋 8/분·lead-alert 그대로.
- `web/lib/no-site.ts` (새, 순수): `askQuestions(name, area, industry)` → 정확히
  1. 「{지역} {업종} 추천」 (검색어형)
  2. 「{지역}에서 {업종} 찾는데 어디가 좋아?」 (대화체)
  3. 「{상호} 어떤 곳이야?」 (이름 확인 — 성과 숫자가 아니라 확인용)
  입력은 trim·연속 공백 하나로·길이 자르기. 템플릿만, LLM 없음.

### 5. `web/app/admin/page.tsx`
- Lead 타입에 `source`. 카드 `.d` 둘째 줄 앞에 이름표: free_scan 「홈페이지 진단 뒤」 · contact 「상담 신청」 · platform_check 「블로그·SNS 진단 뒤」 · no_site 「주소 없음 · AI 답 확인 요청」. no_site 질문 3개는 `said`(concerns)로 이미 보인다 — 원장이 그대로 복사해 묻는다.

### 6. `web/app/ScanForm.tsx` — 세 길 + KG-49-1 쉬운 말
- placeholder 기본값 「홈페이지·블로그·인스타그램 주소」, aria-label 「주소」.
- formnote(히어로 안): 「블로그·인스타그램·플레이스 주소도 됩니다. 가입·결제 없음.」 바로 뒤 링크 모양 버튼 「주소가 없어요」. **Flag: 히어로에 「봇」「구조화 데이터」「파일럿」 낱말 금지** — 단정 6(풀이 첫 자리)이 깨진다. 히어로 글자 ≤400(지금 377).
- busy 문구: 「주소를 읽어 보고 있습니다. 창을 닫지 말고 기다려 주세요.」
- 결과 A (kind:"site") 쉬운 말:
  - plat-caps: 「루트 파일(robots·llms.txt)」→「사이트에 파일 올리기」 · 「구조화 데이터」→「AI가 읽는 이름표 넣기」 · 「콘텐츠 발행」→「글 올리기」 · 「작업 주체」→「손댈 사람」. CAP_LABEL 가능/제한적/불가 → 「됨」/「일부만」/「안 됨」 (platform.ts 값만; 다른 사용처 grep 해서 함께 확인).
  - 행 이름(SITE_LABELS): crawler 「AI 봇이 들어오는지」 · ssr 「AI 에게 글이 보이는지」 · schema 「AI가 읽는 이름표」 · chunk 「떼어 쓰기 좋은 문단」 · patterns 「질문형 제목·숫자」 · sitemap 「페이지 목록 파일」. **weight 0(llms.txt) 행은 화면에서 뺀다**(Step 49 용어표). 응답 JSON 은 그대로.
  - PRIO 치명/중요/권장 → 「먼저」/「다음」/「여유 있을 때」.
  - scan.ts notes 문장 사람 말로(로직·pri 무변경, 문자열만): robots.txt→「봇 규칙 파일」, SSR·자바스크립트→「글이 화면을 연 뒤에야 그려집니다」, JSON-LD→「AI가 읽는 이름표」, sitemap.xml→「페이지 목록 파일」, User-agent·`*` 규칙 설명은 지움. 봇 고유명(GPTBot 등)은 둔다. 목표: 결과 A 패널에 robots·llms·JSON-LD·SSR·User-agent·sitemap·크롤러 0회.
  - 하단 문구·19점/80점 문장 그대로.
- 결과 B (kind:"platform"): 점수·등급·/100 없음. 머리 「{플랫폼 이름}」 + 주소(프로토콜 뺌). `lines` 를 순서대로. 그 아래 봇 목록: plain · 「들어옴」/「막힘」/「확인 못 함」, self 는 「{플랫폼} 자체 검색 — 이 규칙으로 판단 못 함」. 호스트 둘의 판정이 다르면 그 줄에 「PC 막힘 · 모바일 들어옴」식. 확인 시각 KST(`timeZone:"Asia/Seoul"`) 「10/15 21:04 확인」.
  - 연락처 폼: h4 「블로그·SNS 만 있을 때 할 일을 받으세요」 · sub 「진단한 주소와 결과가 함께 접수됩니다. 이메일 한 번으로 정리해 드립니다.」 · 버튼 「할 일 받기」 · `source:"platform_check"`.
- 길 C (「주소가 없어요」): 상호·지역(예: 송파구)·업종(예: 코딩학원) 세 칸 + 「질문 만들기」(네트워크 없음). 결과: 질문 3개 각각 「복사」 버튼(navigator.clipboard, 실패 시 글자 선택). 문구 「ChatGPT 에 그대로 붙여 넣어 보세요. 1·2번 답에 {상호}가 나오는지 보면 됩니다. 3번은 AI 가 우리 가게를 아는지 보는 질문입니다.」 그 아래 「사이티드가 물어봐 드릴까요?」 · 「같은 질문을 ChatGPT·Perplexity·Gemini·Claude 에 물어 답 원문을 메일로 보내 드립니다.」 · 이메일(필수)·전화(선택)·허니팟 · 버튼 「물어봐 주세요」 · 완료 「접수됐습니다. {email} 로 보내 드립니다.」 **기한 약속 금지**(저장소에 SLA 없음 — grep 확인, D160).
- 입력이 바뀌면 이전 결과·오류를 지운다(지금 동작 유지).

### 7. `web/app/page.tsx`
- #start h2 「가진 주소부터<br /><span className="hl">넣어 보세요</span>」.
- #start lp-sub: 「홈페이지 주소를 넣으면 AI 가 우리 사이트를 읽을 수 있는지 점수가 나옵니다. 블로그·인스타그램 주소를 넣으면 그 플랫폼이 AI 봇을 들이는지 봅니다. 답에 이름이 나오는지는 ChatGPT 에 손님 말투 그대로 물어보면 압니다. 「○○구 치과 추천해줘」. 날짜별로 세어 보고 싶으면 상담을 남겨 주세요.」
- #start .ps 「연락처는 결과를 본 뒤에 남기셔도 됩니다.」 (「주소만 넣으면」 삭제 — Richard should-fix).
- #start ScanForm placeholder prop 삭제(기본값 사용).
- FAQ 2 「무료 진단은 무엇을 보나요?」 답 첫 문장을 「홈페이지는 AI 가 읽을 수 있는 상태인지 7개 항목으로 봅니다.」 식으로 홈페이지 몫임을 밝히고 나머지 유지. FAQ 3 자리에 새 문답(같은 배열 → JSON-LD 1:1 자동):
  「홈페이지가 없어도 진단받을 수 있나요?」 → 「됩니다. 네이버 블로그·인스타그램·플레이스 주소를 넣으면 그 플랫폼이 AI 봇을 들이는지 그 자리에서 읽어 알려 드립니다. 점수는 매기지 않습니다. 플랫폼 규칙이라 사장님 점수가 아니기 때문입니다. 주소가 하나도 없으면 상호·지역·업종으로 ChatGPT 에 물어볼 질문 세 개를 만들어 드립니다. 원하시면 사이티드가 같은 질문을 AI 네 곳에 물어 답 원문을 메일로 보내 드립니다.」 (특정 플랫폼이 막는다는 말은 넣지 않는다 — 고정 문장은 바뀐 robots 를 못 따라간다)
- D149: 「아래에」「위에서」 등 메타 문구 넣지 않는다.

### 8. verify (`handoff/research/step50/verify.mjs`)
- step49 의 104 단정 전부 유지. 기대값이 바뀌는 것(FAQ 10→11, #start 문구 등)은 REVIEW-REQUEST 에 「옛 단정 → 새 단정 · 까닭」 표로.
- 빌드: `NEXT_PUBLIC_ALLOW_INDEX=true` 로 `next build` → `next start -p 3047`. tsc 는 `node ./node_modules/typescript/bin/tsc`(npx 금지 — `&` 함정).
- 새 단정(최소):
  - [50-R] robots.ts 단위: 최장 일치 · 같은 길이 Allow 우선 · `*` · `$`(`Disallow: /` + `Allow: /$` 에서 `/` 허용, `/a` 차단) · 같은 UA 그룹 합치기 · UA 대소문자 · 빈 Disallow · 명시 그룹 있으면 `*` 무시.
  - [50-C] classifyTarget: `blog.naver.com/robotncoding`·`m.blog.naver.com/robotncoding`·`robotncoding.tistory.com`·`instagram.com/cited.kr`·`pf.kakao.com/_x`·`naver.me/abc` → platform · `blog.naver.com`(뿌리) → error · `new.smartplace.naver.com/x` → error · `blog.naver.com.evil.com` → site · `https://blog.naver.com:8080/a` → error.
  - [50-A1] POST /api/scan `blog.naver.com/robotncoding` → 200, kind platform, `total`·`grade` 필드 없음, hosts 2개(PC·모바일). **봇 판정 대조**: verify 가 그 자리에서 두 호스트 robots 를 받아 robots.ts 로 계산한 값 = 응답 bots 값(하드코딩 기대값 금지). lines[0] 이 응답의 막힌 봇(self 제외) plain 을 빠짐없이 담음. Yeti 는 self. 화면 결과 B 에 「/ 100」·「위험」 없음.
  - [50-A2] `www.instagram.com/instagram/` → kind platform, 같은 방식 대조, page.title 있음.
  - [50-A3] 잡주소(`asdf`, `http://`, `blog.naver.com`, `localhost`, `127.0.0.1`) → 400 + 사람 말 오류. 홈페이지 회귀: `cited.kr` → kind site, total 숫자.
  - [50-A4] robots 해석 함수를 status 429/503/0 로 단위 테스트 → `fail`·allowed null·「확인하지 못했습니다」 문장. 404 → `none`·모두 허용.
  - [50-S] SSRF: safeFetch 에 허용 밖으로 가는 리다이렉트(로컬 테스트 서버 또는 fetch 주입) → 따라가지 않음. http:// 대상 거절.
  - [50-L1] POST /api/lead no_site (표식 상호 `STEP50-VERIFY-{시각}`, 가짜 concerns 동봉) → 200, DB 행 source=no_site, concerns = askQuestions 결과와 글자 일치(가짜 무시). 셋 중 하나 빈칸 → 400.
  - [50-L2] /admin(쿠키: `/admin/enter?key=` + .env.local 관리자 키)에 그 카드 · 이름표 「주소 없음 · AI 답 확인 요청」 · 질문 3개 보임. **끝나면 그 행을 id 로 지운다**(운영 DB 에 시험 리드 남기지 않음).
  - [50-L3] platform_check 리드 1건 같은 방식(source·site 확인 후 삭제). 이상한 source(`"admin"`) → 옛 규칙 source, 확인 후 삭제.
  - [50-U] 결과 A 패널 innerText 에 robots·llms·JSON-LD·SSR·User-agent·sitemap·크롤러·치명 0회. 히어로 ≤400(49-1 단정이 새 formnote 포함해 잼). 새 블록 word-break keep-all. 「주소만 넣으면」 화면 0회. 길 C: 질문 3개 = askQuestions, 복사 버튼 3개.
  - [50-K] #case 카드 1 DB 대조(Richard should-fix 복구): .env.local DATABASE_URL 로 `lib/ops.ts` rivalTally 와 같은 뜻의 SQL 을 verify 안에서 따로 짜 rivalWon·rivalTotal 을 구하고, 애니메이션 끝난 뒤 카드 1 `<b>` = `0 → {won} / {total}`. ops.ts 를 import 하지 않는다(같은 코드로 자기 검사 금지).
  - 콘솔 오류 0 — 일부러 낸 400 들만 제외.
- 스크린샷 1440·390 각각: hero · start · A(홈페이지 결과) · B-naver(블로그) · B-instagram · error(잡주소) · C-questions · C-done. `step50/{w}-{state}.png`. 「확인하지 못했습니다」 화면은 실측에서 나오면 찍고, 안 나오면 REVIEW-REQUEST 에 「안 나옴」.
- assertions.txt 저장, ALL PASS.

### 9. 배포
- Richard PASS → `gh auth switch --user leeledger` → main 푸시(web 은 push 배포) → `https://cited.kr/` 에서 블로그 주소 1회·주소 없음 질문 화면 1회 확인 → BUILD-LOG. (상시 승인, CLAUDE.md)

## Out of Scope (→ Known Gaps)
- KG-50-1 BOTS 에 Claude-SearchBot·Claude-User 없음 — 넣으면 1번 길 가중치가 바뀐다.
- KG-50-2 1번 길 점수 엔진을 새 robots 매처로 옮기기 — 점수가 바뀌니 따로.
- KG-50-3 normalizeTarget SSRF 구멍(0.0.0.0·10진 IP·DNS 재바인딩) — 「기존 가드 유지」 지시대로.
- KG-50-4 2·3번 길 사용 횟수 기록 없음(scans 에 안 남음).
- KG-50-5 site.ts:26 「홈페이지 주소만 넣으면 무료 진단」·guides.ts:241.
- KG-50-6 no_site 요청 「답 보냄」 상태·AI 자동 질의. 지금은 원장이 손으로 묻는다.

## 실패 모드
| 새 길 | 실제로 날 일 | 처리 | 사용자에게 |
|---|---|---|---|
| 플랫폼 robots | 네이버 플레이스 429(실측) | fail → allowed null · 50-A4 | 「확인하지 못했습니다」 |
| 플랫폼 robots | robots 가 바뀜 | 매번 실측, 표 없음 · 50-A1 대조가 실측 기준 | 새 규칙 그대로 |
| 짧은 주소 | naver.me 가 허용 밖으로 리다이렉트 | 홉마다 허용 확인, 멈춤 · 50-S | 「확인하지 못했습니다」 |
| 페이지 받기 | 인스타 로그인 벽·큰 본문·느림 | 2MB 자름·8초 · page fail 문장 | 「열어 보지 못했습니다(응답 n)」 |
| 오진 | 블로그 주소가 홈페이지 길로 | 정확 일치 분류 · 50-C·A1 | — |
| 거짓 경보 | 네이버 Yeti 차단을 「네이버에 안 나옴」으로 | self 표시·집계 제외 · 50-A1 | 「자체 검색 — 판단 못 함」 |
| no_site 리드 | DB 저장 실패 | 지금처럼 500 | 「저장에 실패했습니다」 |
| no_site 리드 | 클라이언트가 concerns 조작 | 서버 재생성 · 50-L1 | — |
| 남용 | 플랫폼 길로 외부 요청 | 5/분 공용 리밋 · 요청당 robots ≤2 + 페이지 ≤3홉 | 429 문장 |
| 회귀 | 홈페이지 점수 바뀜 | scan.ts 로직 무변경 · 50-A3 | — |
| 시험 리드 | 운영 /admin 에 남음 | verify 가 id 로 삭제 · 50-L2·L3 | — |

치명 공백(시험·처리 없음 + 조용한 실패): 없음.

## Test map
| 가지 | 상태 |
|---|---|
| robots 매처 규칙 | [GAP] → 50-R |
| classifyTarget 가지 | [GAP] → 50-C |
| 플랫폼 결과(네이버 PC·모바일, 인스타) | [GAP] → 50-A1·A2 |
| robots fail·none | [GAP] → 50-A4 |
| 리다이렉트 허용 밖·http | [GAP] → 50-S |
| 잡주소 400 | [GAP] → 50-A3 |
| 홈페이지 길 회귀 | [TESTED] step49 ScanForm 400·결과 + 50-A3 |
| no_site·platform_check 리드 저장·/admin | [GAP] → 50-L1~L3 |
| 결과 패널 쉬운 말 · 길 C | [GAP] → 50-U |
| 히어로 ≤400 · FAQ↔JSON-LD 1:1 | [TESTED] 49-1·FAQ 단정(기대값 11) |
| #case 카드 1 DB | [GAP] → 50-K |

## Acceptance
- step50/verify.mjs ALL PASS (104 + 새 단정), 스크린샷 16장(8 상태 × 2폭).
- `blog.naver.com/robotncoding` 결과에 점수·등급 없음, 봇 판정이 그 순간의 실측 robots 와 일치.
- 주소 없음 접수가 /admin 에 「주소 없음 · AI 답 확인 요청」 카드로 질문 3개와 함께 보임(시험 행은 지워짐).
- tsc 0, 새 의존성 0, scan.ts diff 는 문자열·export 만.
- REVIEW-REQUEST 에 바뀐 옛 단정 표, Deviation 은 따로.
