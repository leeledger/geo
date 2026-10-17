# Architect Brief — Step 55

원장 원문(2026-10-17): 「온보딩 화면에서 고객사 이름하고 홈페이지 정도만 적을수 있는 칸을 만들고 나머지는 모두 자동 세팅 해」.
원장 추가(같은 날, 블로그만 있는 실제 외부 고객 id 18 을 등록한 뒤): 「이렇게 보내도 뭔소린지 몰라 이런 질문 자체도 보내는것이 의미가 없어」 — 세팅 점검이 blog.naver.com 에 robots·사이트맵·llms.txt·IndexNow 키를 올리라는 글을 만들었다.
결정 D221~D236 · KG-55-1~8 (BUILD-LOG). Step 54 브리프: handoff/research/ARCHITECT-BRIEF-step54.md

## Goal
새 고객은 이름과 홈페이지(비워도 됨) 두 칸으로 등록된다. 나머지(관리명·이름 판별 말·브랜드·업종·지역·경쟁 검색어·질문 20·사이트 상태·크롤 키·리허설 파일럿)는 근거가 있는 것만 자동으로 채운다. 근거가 없으면 「모름」으로 멈추고 원장 몫으로 올린다. 고객에게 가는 글에는 기술 말이 없고, 고객이 할 일이 없으면 보낼 글도 없다.

## 실측 (10-17, 읽기만)
- geo.clients 5곳: 코드 3 · cited(자사) · **id 18 외부(블로그만)**. id 18: `domain = blog.naver.com`(도메인정리가 경로를 떼어 블로그 주소를 잃었다) · crawl_key NULL · indexnow 「우리」 키 · wantGsc true · 판별 말 3개가 전부 흔한 말(지역+과목+학원 꼴 — 남의 학원 답에도 걸린다) · 경쟁 검색어 한 낱말 3개 · 파일럿 없음 · derived.home = 302 → section.blog.naver.com(따라가지 않음)
- geo.pilots NOT NULL: client_id · price(기본 390000) · started_on · ends_on · status(기본 준비) · needs_build(기본 none) · competitors(기본 빈 글자)
- 네이버 자동완성 `https://ac.search.naver.com/nx/ac?q=<씨앗>&st=100&r_format=json&q_enc=UTF-8&r_enc=UTF-8` — 원장 PC 에서 「송파 치과」 200, 4개(치과의원·치과병원·치과 추천·송파치과). Vercel(sin1)·GitHub 러너에서는 **아직 안 재봤다** — 55h 에서 잰다
- web/vercel.json regions ["sin1"] · /admin/clients·[slug] 페이지 maxDuration 60
- createPilot 은 파일럿이 있으면 「pilot-exists」로 막고, 질문을 makeQuestions 틀로 `on conflict do update` 해 덮어쓴다 — 자동 리허설 파일럿과 부딪힌다(55f 에서 고침)
- 고객 글 복사 칸: `[slug]/page.tsx` 109~116(x.할일) · onboard 페이지 99~102(x.보낼글). setup-send 일감 detail = 체크리스트 send 할일

## 이미 있는 것 (다시 만들지 않는다, D221)
| 무엇 | 어디 | 이번에 |
|---|---|---|
| 등록 tx(줄 세움 잠금·slug·도메인 중복·alias·indexnow 키) | client-core.mjs 등록() | 두 칸 등록이 이것을 부른다(칸만 자동으로 채워 넘김) |
| 이름 판별 정규식 | client-core.mjs answerPattern() | 그대로. 말만 자동으로 고른다 |
| 사이트 점검(robots·사이트맵·llms·홈 JSON-LD·키 파일 · DNS 내부주소 차단 · 같은 호스트만 따라감 · 8초/20초) | client-core.mjs 세팅점검·점검저장·열기 | 사이트 단계가 이것을 부른다. **/api/scan scanSite 는 안 쓴다**(호스트 글자만 보고 DNS 를 안 봄 — KG-55-1) |
| 플랫폼 목록·안전한 열기(허용 호스트·https·3홉·8초·2MB)·로봇 판정 | platform-check.ts PLATFORMS·classifyTarget·safeFetch·checkPlatform | 목록을 .mjs 로 옮겨 client-core·academy 도 같은 목록을 쓴다 |
| 사이트 빌더 판별(카페24·아임웹·Wix…) | platform.ts detectPlatform | 홈 HTML 로 한 번 부른다(내부 표시용) |
| 사람 일감 열고 닫기 | client-core.mjs 체크리스트 → 일감계획 → 사람일감맞추기(setup-<칸>) | 자동 세팅 멈춤·흔한 판별 말도 체크리스트 줄로 → 같은 길 |
| 크롤 키 | setup-multiclient.mjs randomBytes(18).hex | 함수를 client-core 로 옮겨 등록 때 넣는다 |
| 패널 모양 검사 | seed-panel.mjs 패널점검 | 자동 패널이 이 검사를 통과해야 한다(시험) |
| 계약 뒤 순서 | onboard-core.mjs 착수순서 · config.onboard | 채널은 자동으로 config.onboard.channels 에 넣는다 |
| 로그인 프로필 | auto-login.mjs 계정이름(.browser-profile-<slug> → naver-<slug>) | slug 가 그 정규식을 통과해야 한다(시험) |
| 매시 고리 | company.mjs → 세팅재점검 | 바로 뒤에 자동이어하기 한 줄 |

## 흐름
```
[두 칸 폼] 이름 + 홈페이지(빈칸 가능)
   │ registerAuto (서버 동작 · 바깥 요청 0 · 2초 안)
   ▼
 입력나누기(homepage) ─┬─ 빈칸 ............ 갈래 없음
                       ├─ 플랫폼 호스트 ... 갈래 플랫폼 (domain null · 채널 = 그 주소)
                       ├─ 빌더 하위도메인 . 갈래 빌더  (domain = 그 호스트)
                       └─ 그 밖 .......... 갈래 사이트 (domain = 호스트)
 중복: slug · 도메인 · 채널 주소 → 거부 / 이름(띄어쓰기 무시) → 「그래도 등록」 확인 한 번 더
 등록() tx: slug · 판별 말 · 브랜드 · alias 「고객 X」 · crawl_key · indexnow(사이트·빌더만 「우리」) · config.auto(단계 전부 대기)
   │ redirect /admin/clients/<slug>  ← 자동 세팅 판이 맨 위
   ▼
 [판(브라우저)] autoStep(slug) 를 차례로 — 한 번에 한 단계, 단계마다 60초 안
   사이트 ──▶ 업종지역 ──▶ 검색어 ──▶ 파일럿 ──▶ 질문
     │           │            │          │         │
     │           │ 모름 → 원장(두 칸 입력)  │         └ keyword 후보 < 17 → 원장
     │           └────────────┘          │
     └ 못 엶 → 실패(시도+1) · 3번째 → 원장  └ 사이트 상태가 정해져야 시작
 단계 상태: 대기 → 도는중(90초 임대) → 됨 | 실패 | 원장
   ▲
 [매시 company.mjs] 자동이어하기: 대기·실패(시도<3)·임대 지난 도는중을 한 걸음씩, 최대 3곳 — 창을 닫아도 이어진다
 원장 몫 → 체크리스트 「자동 세팅」 줄(사람) → 사람일감맞추기 → /admin/ops 할 일
```

## 칸마다 어디서 오나 (D222~D229)
| 칸 | 출처 | 파생/추정 | 못 정하면 |
|---|---|---|---|
| slug | 사이트·빌더: 호스트 첫 마디(www 뗌, `miso-dental.co.kr` → `miso-dental`). 플랫폼: 블로그 아이디·인스타 계정(소문자, `_`·`.` → `-`). 플레이스·없음: 이름 로마자(국어의 로마자 표기법 글자 대응만, 동화 규칙 없음) | 파생 | 쓰이면 `-2`,`-3`… · 코드 slug·`new` 피함 · `^[a-z0-9-]{1,40}$` · 비면 `client` |
| 이름 판별 말 | [이름] + 사이트·빌더면 [도메인]. 맨 영어 낱말(점 없는 라틴 글자 말)은 안 넣는다(cited 판별 말과 같은 기준) | 파생 | 이름이 흔하면(D224) 이름을 빼고 도메인만. 도메인도 없으면 판별 말 없음 → 원장 |
| 세지 않을 앞말 | 비움 | — | 원장이 「자세히」에서 |
| 브랜드 검색어 | [이름] (입력검사 기본값과 같다) | 파생 | — |
| alias · relation | 「고객 X」 nextAlias · 외부(자사는 「자세히」에서) | 파생 | — |
| 업종 | ① 홈 JSON-LD @type 이 업종표에 있으면 ② 이름에 업종표 말이 있으면 ③ 홈 title 에 업종표 말이 **딱 하나** 있으면. 업종표 = 코드에 둔 고정 표, 손님이 검색창에 치는 말로(예: 과목+학원·교습소·공부방 → 「<과목>학원」, Dentist·치과 → 「치과」) | 파생(표 대조) | 「모름」 → 원장 두 칸 입력 |
| 지역 | ① 홈 JSON-LD address(addressLocality·addressRegion)의 시군구 ② 홈 본문 「<시도> <시군구>」 꼴이 **서로 다른 것 하나**일 때 | 파생 | 둘 이상·없음 → 「모름」 → 원장. 지점 여러 곳을 하나로 찍지 않는다 |
| 경쟁 검색어 | 네이버 자동완성 원문 — 1차 씨앗 결과 앞에서 3~8개 | 파생(원문) | 3개 미만 → 비움 + 원장 |
| 질문 20 | keyword 17 = 자동완성 원문(1차 씨앗 → 2차: 1차 결과를 씨앗으로) · brand 3 = 「<이름> 어떤 곳이야?」 · 「<도메인> 뭐 하는 곳이야?」(도메인 없으면 「<이름> 어디에 있어?」) · 「<이름>」 | keyword 원문 · brand 는 기존 패널과 같은 꼴(D171) | keyword 17 미만 → 질문 안 넣음 + 원장(후보 수·씨앗·원응답). 채우지 않는다 |
| 사이트 상태(제안 needs_build) | 갈래 사이트: 세팅점검 — robots·사이트맵·llms·JSON-LD 다 됨 → none, 하나라도 빠짐 → setup. 빌더 → setup. 플랫폼·없음 → build(D226) | 파생 | 홈을 못 엶 → 정하지 않음(실패·재시도). none 을 지어내지 않는다 |
| 채널 | 갈래 플랫폼이면 그 주소를 config.onboard.channels 의 blog(네이버 블로그·티스토리·브런치) · place(네이버·카카오 장소) · sns(인스타·유튜브·카카오 채널·naver.me) | 파생 | — |
| 플랫폼 로봇 판정 | checkPlatform(id, url) → derived.platform | 실측 | 못 열면 「못 엶」 그대로 |
| crawl_key | randomBytes(18).hex — 등록 때 | 파생 | — |
| IndexNow · wantGsc | 사이트·빌더: 「우리」+새 키 · true. 플랫폼·없음: mode 「없음」 · false | 파생 | — |
| 파일럿 | geo.pilots 한 줄: status 리허설 · needs_build = 사이트 상태 · started_on 오늘(KST) · ends_on +29 · price 기본값 · 입금·환불·계산서·담당자·약관 칸은 비움(원장 몫) | 파생 | 사이트 상태가 정해질 때까지 안 만든다 |
| measure_active | 질문을 넣을 때 true(seed-panel 과 같다). 질문은 approved=false — 승인은 원장 /admin/pilots | — | — |

자동이 쓴 칸은 config.auto.출처 에 「자동: <근거>」. 원장이 「자세히」에서 저장하면 그 칸들은 「원장」 — 이후 자동 단계·재시도가 덮어쓰지 않는다(D229).

## Build Order
순서대로. 55a 는 동작을 바꾸지 않는 옮기기다 — 시험을 통과시킨 뒤 다음으로.

### 55a 플랫폼 목록을 한 곳으로 (옮기기만)
- 새 `web/lib/platform-hosts.mjs`(+ `.d.mts`): PLATFORMS·platformOf·SMARTPLACE 를 platform-check.ts 에서 그대로 옮긴다. platform-check.ts 는 import 해 다시 내보낸다(바깥 모양 그대로)
- 같은 파일에 `BUILDER_HOSTS`: `*.modoo.at`(네이버 모두) · `*.wixsite.com`(Wix) · `*.imweb.me`(아임웹) — 하위도메인이 고객 몫인 빌더. `호스트갈래(host)` → "플랫폼" | "빌더" | "사이트"
- Flag: 네이버 모두가 아직 열리는지 모른다. 55h 에서 *.modoo.at 하나를 열어 응답(상태·넘어간 주소)을 그대로 BUILD-LOG 에. 안 열리면 「사이트를 못 엶」 길 — 따로 가지치지 않는다
- 시험: 기존 step50 단정 그대로 통과 · platformOf 결과가 옮기기 전과 같다(목록 전 호스트)

### 55b 플랫폼은 고객 사이트가 아니다 + 고객에게 기술 말 금지 (client-core.mjs · onboard-core.mjs · 두 페이지)
- `체크리스트(row, derived)`: domain 이 null 이거나 호스트갈래 가 「플랫폼」이면 site·robots·sitemap·llms·jsonld·keyfile·send·gsc 줄 전부 **해당없음**, 사람말 「홈페이지가 없습니다 — <플랫폼 이름> 채널만 봅니다」. 일감계획이 해당없음을 닫힘으로 닫으므로 id 18 의 setup-send·setup-gsc 일감도 다음 점검에 닫힌다
- send 줄을 둘로 나눈다(D232):
  - `고칠것` — 지금의 기술 목록. **원장·Claude 세션만 본다.** 복사 단추 없음
  - `보낼글` — 고객이 한 문장으로 할 수 있는 것만. 빠진 것이 있고 config.onboard.dns 가 「우리」가 아닐 때만:
    - 갈래 사이트: 「안녕하세요, <이름> 담당자님. 홈페이지에서 손볼 곳이 있어 저희가 직접 고치려고 합니다. 홈페이지 관리자 아이디를 알려 주시거나, 홈페이지를 만든 업체 연락처를 알려 주세요.」
    - 갈래 빌더(호스트 또는 detectPlatform kind 빌더): 「안녕하세요, <이름> 담당자님. <빌더 이름> 관리자 아이디로 저희가 들어갈 수 있게 해 주세요. 설정은 저희가 합니다.」 — 빌더 설정 화면에 무엇이 있는지는 고객 글에 안 쓴다(문서 줄로 확인한 것이 없다, D234)
  - 빠진 것이 없으면 보낼글 없음, send 줄 됨. dns 「우리」면 보낼글 없음, 「우리가 고칩니다: <고칠것 요약>」(기다림, 일감 없음)
- 일감계획: setup-send 는 보낼글이 있을 때만 열고 detail = 보낼글. 고칠것은 detail 에 안 넣는다
- gsc 줄 할일(원장 몫): 「고객에게 따로 묻지 않습니다. 홈페이지 관리자 아이디를 받으면 저희가 구글 서치콘솔에 직접 등록합니다. 끝나면 「권한 받음」을 누릅니다.」
- measure 줄: 리허설 파일럿에 질문이 이미 있으면 할일 「계약이 되면 「파일럿 시작」에 담당자·입금·약관 칸을 넣습니다. 질문 20개는 자동으로 만들어 두었습니다.」
- `[slug]/page.tsx` 109~116: 복사 칸은 `x.보낼글` 만. `x.할일` 은 글로만
- onboard-core.mjs:
  - `dns물음` → 「안녕하세요, <이름> 담당자님. 홈페이지 관리자 아이디를 알려 주시거나, 홈페이지를 만든 업체 연락처를 알려 주세요. 손볼 곳은 저희가 직접 고칩니다.」
  - send 줄(219~228)은 세팅줄의 보낼글만 쓴다. `send.할일` 을 보낼글로 쓰지 않는다. dns 「우리」 줄의 근거는 고칠것. 플랫폼·없음이면 사이트 단계 send 줄은 해당없음
  - intake 재촉 「…사이트 관리자 권한을」 → 갈래 사이트·빌더면 「…홈페이지 관리자 아이디를」, 플랫폼·없음이면 그 부분을 뺀다
  - 블로그 줄: 채널에 블로그 주소가 있고 ob.blog 가 비었으면 원장 몫 + 보낼글 「안녕하세요, <이름> 담당자님. 네이버 블로그 아이디로 저희가 들어갈 수 있게 해 주세요. 글은 저희가 올리고 미리 보여 드립니다.」
  - 채널 줄: config.onboard.channels 가 자동으로 차 있으면 됨(묻지 않는다)
- **금지어(D233)** — 고객에게 가는 글(보낼글 · setup-send detail · 재촉 글)에 하나라도 있으면 시험 실패: robots · sitemap · 사이트맵 · llms · indexnow · json-ld · jsonld · 스키마 · 서치콘솔 · search console · 서치어드바이저 · 웹마스터 · 키 파일 · 확인 파일 · 크롤러 · 호스팅 · dns · html · 메타 (대소문자 무시). 목록은 client-core.mjs `고객금지말` 하나 — 시험이 같은 목록을 쓴다

### 55c 등록 칸을 비워도 되게 + 크롤 키 (client-core.mjs · setup-multiclient.mjs)
- `새크롤키()` export(randomBytes(18).hex). setup-multiclient.mjs 는 이것을 import
- `등록(q, 칸)`: 칸.domain null 허용 · crawl_key 를 insert 에 · 칸.auto → config.auto · 칸.channels → config.onboard.channels · domain null 이면 indexnow mode 「없음」 · wantGsc false. 중복: 도메인(null 끼리는 안 견줌) · 채널 주소(정리한 https 주소가 다른 고객 config.onboard.channels 값과 같으면 `channel-taken`) — 같은 잠금 안에서
- `입력검사`(「자세히」 고치기): domain 빈칸 허용 · 플랫폼 호스트면 「블로그·SNS·플레이스 주소는 홈페이지 칸에 넣지 않습니다 — 「계약 뒤 순서」 상황 바꾸기의 채널 칸에」 · 경쟁 검색어 0개 또는 3~8개
- `재점검고르기`: domain null·플랫폼 호스트 행은 뺀다(열 사이트가 없다)
- academy/clients.mjs 고객설정: domain null 은 이미 빠짐 「domain 없음」. 경쟁 검색어 0개·domain null 을 쓰는 곳(측정·check-index·who-wins·indexnow·submit-gsc)을 grep 해 표를 REVIEW-REQUEST 에. 죽는 곳은 그 일만 건너뛰게
- 오류말: `channel-taken` 「같은 블로그·SNS·플레이스 주소로 등록한 고객이 이미 있습니다」 · `name-dup` 「같은 이름의 고객이 있습니다(<slug>). 다른 지점이면 「그래도 등록」에 표시하고 다시 누릅니다」

### 55d 자동 세팅 본체 (새 `web/lib/auto-setup-core.mjs` + `.d.mts`)
순수 함수 + q·fetch·lookup 주입. Vercel 은 web/ 만 올라간다 — academy 를 import 하지 않는다.
- `입력나누기(name, homepage)` → { 갈래, domain, 채널?:{칸, id, url}, 오류? }. classifyTarget·호스트() 재사용, 오류 말 그대로. 경로가 있는 사이트 주소는 domain=호스트 + auto.입력.homepage 에 원문
- `slug고르기` · `로마자(이름)` — 표는 코드에
- `판별말(name, domain, 업종표)` → { terms, 흔함, 까닭 }. 흔함 = 이름에서 업종표 말·시도·시군구·「점」「본점」「지점」을 지운 나머지 한글이 2자 미만, 또는 이름이 2자 이하(D224)
- `사실뽑기(html, name)` → { 업종:{값|null, 출처}, 지역:{값|null, 출처} }. 홈 본문은 저장하지 않는다(값과 출처 글자만)
- `업종표` · `지역짧게("송파구") → "송파"`(구·시·군을 떼고 2자 이상 남을 때만)
- `씨앗(업종, 지역)` → 1차 「<지역짧게> <업종>」「<지역> <업종>」「<지역짧게> <업종> 추천」(중복 제거). 2차: 1차 결과 앞 8개
- `자동완성(씨앗들, {fetch})` — 위 실측 주소만(호스트 고정, 사용자 입력은 q 값에만). 정직한 UA `cited-setup/1.0 (+https://cited.kr)` · 요청당 3초 · 전체 25초 · 요청 사이 200ms · 최대 16번 · 403/429/5xx 는 그 씨앗만 실패로 적고 다시 두드리지 않는다(D228). 원응답은 auto.자동완성 {fetched_at, 씨앗:[{q, status, items}]}
- `거르기(items, {판별말, 업종})` — 업종 말(띄어쓰기 무시)이 든 것만 · 고객 이름·판별 말 든 것 뺌 · 「뜻」「영어로」「채용」「구인」「알바」「면접」「연봉」「월급」 든 것 뺌(손님 의도 아님) · 띄어쓰기 무시 중복 제거 · 원응답 순서
- `패널만들기(keyword17, name, domain)` → [[stage, text, 출처]] 20 — seed-panel 패널점검 을 통과하는 모양
- 단계 기계 `자동한걸음(q, slug, deps)`: 대기·실패(시도<3)·임대 지난 도는중 중 의존이 풀린 첫 단계 하나를 임대 → 실행 → 저장 → 체크리스트 + 사람일감맞추기 → { 단계, 상태, 말 }
  - 임대는 update 한 문장: 그 단계 상태가 대기·실패이거나, 도는중인데 at 이 90초 지났을 때만 jsonb_set 으로 도는중·at·시도+1 을 쓰고 returning id. 0행이면 아무것도 안 한다(브라우저·매시 고리가 겹쳐도 한 번)
  - 쓰기는 언제나 그 칸만 jsonb_set(경로 auto.… · onboard.channels · queries.compete) — D209 와 같은 까닭
  - 사이트: 사이트·빌더 → 점검저장(세팅점검) + 같은 마감 안에서 새 export `홈열기`(열기 그대로)로 홈 한 번 → detectPlatform · 사실뽑기. 홈 못 엶 → 실패. 플랫폼 → checkPlatform → derived.platform, build. 없음 → build(바깥 요청 없음)
  - 업종지역: 사실 + 이름. 둘 다 있으면 됨, 하나라도 「모름」이면 원장
  - 검색어: 자동완성 → 거르기 → compete(출처 「원장」이면 안 씀) · 후보 저장. keyword < 17 이면 원장(질문 안 만듦). compete 는 3개 이상이면 저장
  - 파일럿: insert … on conflict (client_id) do nothing(위 표). 사이트 상태가 없으면 시작 안 함
  - 질문: 파일럿 + keyword ≥ 17 + 판별 말 있음 → insert … on conflict (pilot_id, position) do nothing 20줄 · measure_active true
  - 실패 3번째 → 원장. 오류 원문은 auto.단계.<k>.오류 앞 300자(판은 사람 말 한 줄 + 펼치면 원문)
- `자동이어하기(q, {max:3, admin})` — status active 만(시험 고객은 화면에서만) · auto 가 안 끝난 곳, 오래된 것부터
- 체크리스트 새 줄 2개(일감제목에도):
  - `auto` 「자동 세팅」: 원장 상태 단계가 있으면 사람, 할일 = 그 단계 사람 말(예 「업종·지역을 못 찾았습니다. 고객 화면 자동 세팅 판에 두 칸을 넣으면 이어서 합니다」 · 「질문 후보가 11개뿐입니다(17개 필요). 「자세히」에서 경쟁 검색어를 넣고 다시 시도합니다」). 다 됨 → 됨. auto 없음(옛 고객) → 해당없음
  - `name` 「이름 판별 말」: config.answerTerms 중 하나라도 흔함이면 사람, 할일 「<말> 은(는) 남의 답에도 걸립니다. 「자세히」에서 고객만의 이름·도메인으로 바꿉니다」. id 18 이 걸린다
- 원장 두 칸(업종·지역) 저장 → auto.사실 출처 「원장 입력 <KST 날짜>」, 업종지역 됨, 검색어 대기

### 55e 화면 (web)
- 새 `web/lib/auto-setup-actions.ts`("use server", 같은 guard): `registerAuto(prev, form)` · `autoStep(slug)` · `retryAutoStep(form)`(그 단계 시도 0·대기) · `saveAutoFacts(form)`
- 새 `web/app/admin/clients/NewClientForm.tsx`: 「이름」 · 「홈페이지(없으면 비움 · 블로그·플레이스·인스타 주소도 됨)」 두 칸 + 접힌 details 「시험용」 안 시험 고객 체크 + 이름이 겹칠 때만 「그래도 등록」 체크. useActionState, 오류에 친 값 남김
- `clients/page.tsx`: 새 등록 = NewClientForm. ClientForm 은 고치기 전용(mode new·registerClient 를 지운다 — 같은 일을 하는 길을 둘 두지 않는다)
- `[slug]/page.tsx`: 맨 위 `AutoSetupPanel`(client component) — 단계 5줄(상태·한 줄 말·시각 KST·시도) · 대기가 있으면 차례로 autoStep → 끝날 때마다 router.refresh · 실패·원장 단계마다 「다시 시도」 · 업종지역 원장이면 두 칸 폼 · 도는 동안 「도는 중… (최대 30초)」. 기존 고치기 폼은 details 「자세히」 안으로
- onboard 페이지: 맨 위 자동 세팅 요약 한 줄(안 끝났으면 「자동 세팅 n/5 — 고객 화면에서」 링크). 판을 복제하지 않는다
- 시각은 timeZone Asia/Seoul(CLAUDE.md 함정)

### 55f 리허설 파일럿을 계약으로 올리기 (pilot-actions.ts createPilot)
- 파일럿이 있고 status 리허설 · paid_on null · relation 외부면 「pilot-exists」 대신 그 행을 **update**: 계약 칸 · status 진행 · started_on/ends_on 지금 식 그대로 · needs_build = 폼 값(기본 선택 = 자동 제안)
- 질문: 그 파일럿에 질문이 있으면 makeQuestions 를 넣지 않는다(자동 패널·원장 승인을 덮지 않는다). 없을 때만 지금처럼
- pilot_tasks·local_audits·content_approvals 는 지금처럼(on conflict do nothing)
- 폼 기본값: district·category 를 auto.사실 에서 채워 보인다(원장이 고칠 수 있다)

### 55g 매시 고리 · 이행
- company.mjs: 세팅재점검 바로 뒤 자동이어하기 한 줄(같은 꼴 · catch 로 경고만)
- 새 `academy/scripts/migrate-platform-domain.mjs` — 기본 dry, `--apply` 는 Arch. domain 이 플랫폼 호스트인 고객: domain null · indexnow 없음 · wantGsc false · derived 비움 · config.auto 를 「등록 됨 · 나머지 대기」로 · 채널 주소는 잃었으므로 사이트 단계 = 원장 「블로그 주소 전체를 「계약 뒤 순서」 상황 바꾸기 채널 칸에 넣어 주세요」. 원장이 넣은 판별 말·경쟁 검색어는 출처 「원장」, 안 바꾼다. 출력은 id·별칭만
- Flag: 이행 대상은 id 18 한 곳. 고객 이름을 로그·BUILD-LOG 에 쓰지 않는다

### 55h 시험 · 실측
- `academy/scripts/test-auto-setup-core.mjs` — Test map 의 순수 단정
- `academy/scripts/test-client-copy.mjs` — 착수순서·체크리스트를 갈래(사이트·빌더·플랫폼·없음) × dns(고객·우리·모름·없음) × needs_build × 밀린 날(0·3·10) × 빠진 것(없음·전부) 전 조합으로 돌려 보낼글·setup-send detail 을 모아 금지어 0. blog.naver.com 고객은 robots·sitemap·llms·IndexNow 를 말하는 고객 글 0 · 사이트가 다 된 고객은 사이트·받을 것 단계 보낼글 0
- 기존 시험 전부: test-client-core · test-clients · test-client-status · test-onboard-core · test-seed-panel · test-login · step50 verify · tsc(`node ./node_modules/typescript/bin/tsc`) · next build
- `academy/scripts/test-auto-setup-live.mjs --live` — test-onboard-screen 과 같은 틀(로컬 next dev + 운영 DB + 빈 headless chromium + /admin/enter?key=):
  1. 두 칸 폼으로 시험 고객 A: 이름은 지어낸 상호 「시험치과 송파점」(실제 업체 이름 금지), 홈페이지 **cited.kr**(우리 사이트 — 남의 사이트를 두드리지 않는다), 시험 체크
  2. 판이 다섯 단계를 끝낼 때까지(최대 3분). 단언: slug cited-2(cited 가 쓰임) · 판별 말에 이름(흔함이면 빠짐 — 나온 대로 단언)·cited.kr · 맨 영어 낱말 없음 · crawl_key 36자 hex · alias 「고객 X」 · 사이트 상태 none|setup 이 세팅점검 결과와 맞음 · 업종 「치과」 출처 이름 · 지역은 cited.kr 에서 못 찾으면 「모름」 → 원장 → 판 두 칸에 「치과」「송파구」 → 이어짐 · 자동완성 원응답 저장 · compete 3~8 원문 · 파일럿 리허설·paid_on null·payment_ref null · 질문 20(keyword 17 원문·brand 3·approved false) 또는 keyword<17 이면 원장·질문 0(나온 쪽을 적는다) · send 보낼글 금지어 0
  3. onboard 페이지: 자동 세팅 요약·사이트 줄 단언, 1440·390 스크린샷(--out)
  4. 시험 고객 B: 이름만, 홈페이지 빈칸 → 갈래 없음 · domain null · build · 사이트 줄 해당없음 · 보낼글 금지어 0
  5. 시험 고객 C: https://blog.naver.com/naver_diary (네이버 공식 블로그 — 고객 블로그를 두드리지 않는다) → 갈래 플랫폼 · 채널 blog · derived.platform 실측 · site·send·gsc 해당없음 · 기술 말 고객 글 0
  6. 같은 홈페이지로 다시 → 거부 · 같은 이름 → name-dup 확인 문구
  7. A·B·C 지우기() · client_id·pilot_id 칸 표 전부 남은 행 0(agent_tasks·agent_activity 포함)
- 실측 기록(BUILD-LOG, 상태 코드 원문): 운영(sin1)에서 Arch 가 시험 고객 하나로 자동완성 1회(지우기까지) · 다음 매시 company 로그의 GitHub 러너 자동완성 · *.modoo.at 한 곳 응답

## Failure modes
| 새 길 | 실제로 날 일 | 처리 | 원장이 보나 |
|---|---|---|---|
| 자동완성(Vercel sin1·GH 러너) | 403/429·빈 목록 | 씨앗별 상태 저장 · 단계 실패 · 시도 3 → 원장 일감 「자동완성이 막혔습니다(상태 403)」 · 시험: 가짜 fetch 403 | 보인다 |
| 자동완성 결과 적음(좁은 업종·작은 동네) | keyword < 17 | 질문 안 넣음 · 원장 일감에 후보 수·씨앗 · 시험 | 보인다 |
| 홈 못 엶(DNS 없음·시간 초과·내부 주소) | 사이트 단계 실패 | needs_build 안 정함 · 파일럿·질문 대기 · 3번째 원장 · 시험: 가짜 lookup 실패·내부주소 | 보인다 |
| 다른 호스트로 넘김 | 세팅점검 「다른 주소로 넘어가」 | 실패와 같음 · 원장 말 「홈페이지 주소가 다른 곳으로 넘어갑니다: <주소>. 「자세히」에서 맞는 주소로」 | 보인다 |
| 판 창을 닫음 · 60초 넘김 | 도는중으로 남음 | 90초 임대가 풀리면 매시 고리·다음 판이 이어감 · 시험: 지난 임대 잡힘·임대 중 안 잡힘 | 판에 「도는 중(n분 전)」 |
| 브라우저와 매시 고리가 같이 | 한 단계 두 번 | 임대 0행이면 안 함 · 쓰기 on conflict do nothing · 시험: 같은 단계 두 번 | 무해 |
| 같은 이름 두 지점 | 막으면 지점 등록 불가 · 두면 판별 말이 같아 측정 섞임 | name-dup 확인 한 번 · name 줄 사람 일감 | 보인다 |
| 흔한 이름 | 남의 답이 우리 적중으로 셈 — 레퍼런스 숫자 오염 | 이름을 판별 말에서 빼고 도메인만 · 도메인도 없으면 질문 단계 원장 · name 줄 · 시험 | 보인다 |
| 홈에 지점 주소 여럿 | 지역을 하나로 찍음 | 서로 다른 시군구 둘 이상이면 「모름」 · 시험 | 보인다 |
| JSON-LD 깨짐 | 업종·지역 못 읽음 | 깨진 블록 건너뜀 → 이름·본문 · 시험 | — |
| 「자세히」 저장 뒤 자동 재시도 | 원장 값 덮어씀 | 출처 「원장」 칸은 안 씀 · 시험 | — |
| 고치기·바깥글고치기 config 통째 쓰기 | config.auto·onboard.channels 유실 | 옛 config 를 펼쳐 쓴다 — 보존 단언 추가 | — |
| createPilot 업그레이드 | 자동 질문을 makeQuestions 가 덮음 | 질문 있으면 안 넣음 · 시험 | — |
| domain null 고객이 매시 고리에 | 세팅점검이 빈 호스트를 엶 | 재점검고르기에서 뺌 · 시험 | — |
| 플랫폼 도메인 고객(id 18) | 계속 기술 글·GSC 요청 | 55b 해당없음 + 55g 이행 · 열린 setup-send·gsc 일감 닫힘 | 보인다 |

비어 있는 칸(시험 없음 + 처리 없음 + 조용함): 없음.

## Test map
| 새 갈래·길 | 시험 |
|---|---|
| 입력나누기 4갈래 + 스마트플레이스 관리 주소·IP·localhost·점 없음·경로 있는 주소 | [GAP] → test-auto-setup-core |
| slug: 도메인·블로그 아이디(밑줄)·인스타(점)·플레이스(로마자)·없음·충돌 -2/-3·코드 slug·new·40자·계정이름() 통과 | [GAP] |
| 로마자 10개 이름(겹받침·ㅇ초성·ㄹ) | [GAP] |
| 판별말: 흔한 이름·맨 영어·도메인만·띄어쓰기(answerPattern 이 한글 사이를 이미 잡는지) | [GAP] |
| 사실뽑기: JSON-LD @graph·배열·깨짐 · 지역 하나/둘/없음 · title 업종 하나/둘 · 이름 업종 | [GAP] |
| 거르기: 업종 없는 말·이름 든 말·채용·뜻·띄어쓰기 중복·순서 | [GAP] |
| 패널만들기 → seed-panel 패널점검(m, pattern) === null | [GAP] |
| 단계 기계: 의존 순서 · 임대 잡힘/안 잡힘/지난 임대 · 실패 3 → 원장 · 재시도 초기화 · 원장 출처 안 덮음 · 사실 저장 뒤 이어감 | [GAP] |
| 등록: domain null · crawl_key · channel-taken · name-dup · indexnow 없음 | [GAP] → test-client-core 에 |
| 체크리스트 플랫폼·null → 해당없음 8줄 · send 보낼글/고칠것 · gsc 할일 · auto·name 줄 · 일감계획 열고 닫기 | 기존 사이트 줄 [TESTED] · 새 갈래 [GAP] |
| 금지어 전수 | [GAP] → test-client-copy |
| 착수순서 dns물음·intake·blog·send 새 글 | test-onboard-core 18 [TESTED] — 바뀌는 글 단언은 고치고 바뀐 개수를 REVIEW-REQUEST 에 |
| 고치기·바깥글고치기가 config.auto·onboard.channels 보존 | [GAP] 회귀 |
| 입력검사: domain 빈칸·플랫폼 거부·compete 0 | [GAP] · 기존 3~8 [TESTED] |
| 재점검고르기 null·플랫폼 빼기 | [GAP] |
| createPilot 업그레이드(리허설 → 진행, 질문 보존) · 리허설 아닌 파일럿은 여전히 pilot-exists | [GAP] · 기존 생성 길 [TESTED] |
| 이행 스크립트 dry · 두 번 돌려도 같음 | [GAP] |
| 끝에서 끝 A·B·C | [GAP] → test-auto-setup-live |
| test-client-screen·test-onboard-screen 이 지운 new 폼을 쓰면 두 칸 폼으로 | 회귀 |

## Out of Scope (BUILD-LOG Known Gaps)
- KG-55-1 /api/scan scanSite 의 SSRF 막기가 호스트 글자만 본다(DNS 안 봄) — 공개 진단 길이라 따로
- KG-55-2 makeQuestions 질문 stage 「브랜드」 — 보고서는 brand 만 뺀다. 계약 파일럿 이름 질문이 머리 숫자에 섞일 수 있다
- KG-55-3 라틴·한글 경계 띄어쓰기 변형(「A영어」 vs 「A 영어」)은 answerPattern 이 안 잡는다
- KG-55-4 빌더별 설정 화면에서 고객이 직접 켤 수 있는 것 — 문서로 확인한 뒤 고객 글에. 지금은 로그인 요청만
- KG-55-5 플레이스·인스타 페이지에서 업종·지역 읽기 — 지금은 이름·원장 입력
- KG-55-6 자동완성 2차 씨앗 깊이·개수 — 첫 외부 고객 몇 곳 결과를 보고
- KG-55-7 고칠것(기술 목록)을 Claude 세션 일감으로 올리기 — 지금은 화면 줄
- KG-55-8 경쟁사 상호(pilots.competitors) 자동 — 남의 상호를 추정하지 않는다. 원장 몫

## Acceptance
- /admin/clients 새 등록은 두 칸(+ 접힌 시험용)뿐이다. 「자세히」는 고객 화면 안에서 연다
- 시험 고객 A·B·C 가 두 칸 등록만으로 위 표의 칸이 채워지거나 「모름」+원장 일감으로 멈춘다. 지어낸 값 0(업종·지역·질문·needs_build)
- 실패 단계가 판에 사람 말로 보이고 「다시 시도」로 이어진다. 창을 닫아도 매시 고리가 잇는다
- blog.naver.com 고객: site·robots·sitemap·llms·jsonld·keyfile·send·gsc 해당없음 · 고객 글 금지어 0. 고객이 할 일이 없으면 보낼 글 0
- id 18: 이행 뒤 domain null · setup-send·setup-gsc 일감 닫힘 · name 줄이 흔한 판별 말을 원장 일감으로 · 블로그 주소 다시 받기 원장 일감
- 기존 시험 전부 통과 · tsc 0 · next build 성공 · test-auto-setup-core·test-client-copy 실패 0 · --live A·B·C 통과 뒤 남은 행 0
- 배포: web 은 main 푸시. 운영 /admin/clients 200 · 운영에서 시험 고객 하나 두 칸 등록 → 자동완성 상태 원문 기록 → 지우기 남은 행 0 · 이행 --apply · 다음 매시 로그에 자동이어하기 줄
