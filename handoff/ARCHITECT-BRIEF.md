# Architect Brief — Step 44

## Goal
학원 사이트 제목·설명·스키마·홈 FAQ·llms.txt 에 「AI학원」이 있는 사실로 들어가, 「송파/석촌동/잠실/초등 AI학원」 검색어가 걸릴 낱말이 생긴다. 새 사실·새 페이지 없음.

## 배경 (측정 2026-10-13, 진짜 브라우저)
- 네이버: 플레이스 목록 4번째쯤만. 웹문서·블로그 없음. 빙: 「송파 AI학원」 3위, 나머지 셋 없음. 구글 못 잼
- 「AI학원」 낱말이 title·description·h1·h2·스키마 어디에도 없다. 있는 건 「코딩·로봇·AI 교육」「AI 학원」(띄어 씀)

## Flow
```
content/meta.json ──> app/layout.tsx (title.default / description) ──> <title>, <meta description>
content/schema.json ─> app/page.tsx (ld+json: #org description, #faq FAQPage)
content/home.html ──> app/page.tsx 그대로 심음 (#faq <details>)          ← 손으로 JSX 로 옮기지 않는다
public/llms.txt ────> /llms.txt 정적
            배포: academy/ 에서 npx vercel --prod --yes  (git push 로 안 나감)
            → 운영 curl 확인 → indexnow.mjs 로 / · /llms.txt 알림 → 커밋
```

## Build Order

### 1. content/meta.json (title·description 만. ogTitle·ogDescription 손대지 않음)
- title → `로봇&코딩학원 — 송파구 석촌동 코딩·로봇·AI학원 | 초등부터 영재고 준비까지`
- description 첫 문장의 `코딩·로봇·AI 교육 전문 학원입니다` → `코딩·로봇·AI학원입니다`. 나머지 그대로

### 2. content/schema.json
- `#org` description 의 `코딩·로봇·AI 교육 전문 학원입니다` → `코딩·로봇·AI학원입니다`. 나머지 그대로
- **name·alternateName 손대지 않는다** (검색어 끼워넣기 금지)
- FAQPage mainEntity: 「석촌호수 근처에서 아이가 다닐 코딩학원을 찾고 있어요.」 **바로 뒤**에 Question 하나 추가. name·text 는 아래 「잠긴 문답」 그대로

### 3. content/home.html #faq
- 같은 자리(석촌호수 문답 바로 뒤)에 `<details>` 하나. 이웃 문답과 같은 마크업(`<summary>` + `<div class="ans"><p>…</p></div>`). 문단 2개(「하지 않는 것도」부터 둘째 `<p>`)
- `&` 는 `&amp;` (이웃 문답과 같게). 다른 줄은 건드리지 않는다

### 4. public/llms.txt
- 1행 `# 로봇&코딩학원 — 서울 송파구 석촌동 코딩·로봇·AI 교육 학원` → `… 코딩·로봇·AI학원`
- 「브랜드 설명문 짧은 버전」의 `코딩·로봇·AI 학원` → `코딩·로봇·AI학원` (띄어쓰기만)
- `## AI 리터러시와 자연어 코딩` 절 끝, `## 자주 묻는 질문 (FAQ)` **앞**에 아래 「잠긴 llms 절」 그대로 삽입
- FAQ 절에서 석촌호수 문답 뒤(없으면 FAQ 절 끝)에 잠긴 문답을 기존 꼴(`**질문**` + 답)로 추가

### 5. 회귀 테스트 새로: academy/scripts/test-faq-sync.mjs
- home.html `#faq` 안 `<summary>` 텍스트 목록 == schema.json FAQPage `mainEntity[].name` 목록 (순서까지, trim, `&amp;`→`&`)
- 잠긴 질문 문자열이 home.html·schema.json·llms.txt 세 곳에 다 있다
- meta.json title·description, schema #org description 에 「AI학원」 정확히 1번씩
- schema.json name/alternateName 에 「AI학원」 없음
- 새 텍스트(잠긴 문답 + 잠긴 llms 절)를 `scripts/slop-rules.mjs` MARKS 로 돌려 0건 (re 는 match, seq 는 min 종류 이상 등장 — 해석은 slop-rules 기존 사용처를 따른다)
- 다른 test-*.mjs 와 같은 꼴(PASS/FAIL 출력, 실패 시 exit 1)
- 먼저 지금 13문답이 이미 순서 일치하는지 확인 — 어긋나면 **고치지 말고** REVIEW-REQUEST 에 적는다(Known Gap). 이번 단계는 새 문답만

### 6. 배포·확인 (Richard PASS 뒤, 상시 승인)
- `cd academy && npx vercel --prod --yes`
- 운영 확인: `curl -s https://robotncoding.com/ | grep -o "<title>[^<]*"` 에 AI학원 · 홈 HTML 과 ld+json 에 잠긴 질문 · `curl -s https://robotncoding.com/llms.txt | grep -n "AI학원을 찾는 분께"`
- `node scripts/indexnow.mjs https://robotncoding.com/ https://robotncoding.com/llms.txt` (`/` 로 시작하는 인자를 쓰면 `MSYS_NO_PATHCONV=1`)
- 커밋 (Arch)

### Flag — Bob 이 추측하지 말 것
- 잠긴 문구의 단어를 바꾸지 않는다. 고칠 이유(사실 불일치·마크업 깨짐)가 보이면 멈추고 REVIEW-REQUEST 에 적는다
- 「AI학원」을 지정 자리 외에 더 넣지 않는다. h1·h2·#ai 절 슬로건은 그대로
- 학년·주수는 llms.txt 기존 줄과 글자 그대로 (1단계 초등 1~4, 2단계 초등 3~6, 3단계 초등 5 이상, AI 시대 코딩 초5~중3 24주)
- tsc 는 `node ./node_modules/typescript/bin/tsc` 로 (npx tsc 는 `&` 경로 함정)

## 잠긴 문답 (home.html · schema.json · llms.txt 같은 글)

**질문:** `송파에서 초등학생 AI학원을 찾고 있어요. AI는 어떻게 가르치나요?`

**답 (1문단):**
로봇&코딩학원은 송파구 석촌동에 있는 코딩·로봇·AI학원입니다. AI는 따로 떼어 낸 특강이 아닙니다. 5단계 전부에 들어 있습니다. 초등 3~6학년은 얼굴 인식·감정 분류를 직접 만들어 보며 학습 데이터가 결과를 바꾸는 것을 확인합니다. 초등 5학년부터는 만들고 싶은 것을 우리말로 설명해 코드를 얻고, 그 코드를 읽고 고칩니다. 초등 5학년~중학교 3학년 대상 「AI 시대 코딩」(24주)은 AI에게 정확히 요청하는 법을 다룹니다.

**답 (2문단):**
하지 않는 것도 있습니다. AI가 준 답을 그대로 내게 하지 않습니다. 학원 AI 튜터도 정답 코드는 주지 않고 어긋난 곳과 채울 칸만 보여 줍니다. AI학원을 고를 때는 아이가 AI 답을 직접 돌려 보고 틀린 곳을 찾는 시간이 수업에 있는지 보세요.

(schema text 는 두 문단을 공백 하나로 이어 붙인다)

## 잠긴 llms 절

```
## AI학원을 찾는 분께 (AI Classes)

이름에 AI가 들어간 학원은 아닙니다. 코딩·로봇 학원이고, AI는 5단계 전부에 들어 있습니다.

- 초등 1~4학년 (1단계): 그림·음성 AI를 직접 써 보며 AI가 어떤 도구인지 감을 잡습니다.
- 초등 3~6학년 (2단계): 얼굴 인식·감정 분류를 만들어 보며 학습 데이터가 결과를 바꾸는 것을 확인합니다.
- 초등 5학년 이상 (3단계): 자연어 코딩. 만들고 싶은 것을 우리말로 설명해 코드를 얻고, 그 코드를 읽고 고치고 설명합니다.
- 초등 5학년~중학교 3학년: 「AI 시대 코딩」 24주. 프롬프트 한 줄에서 완성작까지 갑니다.
- 5단계: AI API를 붙인 챗봇·이미지 분류 같은 서비스를 완성해 포트폴리오로 정리합니다.
- 성인: AI 업무자동화반 https://robotncoding.com/ai-work

하지 않는 것도 있습니다. AI가 준 답을 그대로 내게 하지 않습니다. 학원 AI 튜터도 정답 코드는 주지 않고 어긋난 곳과 채울 칸만 보여 줍니다.
AI학원을 고를 때는 아이가 AI 답을 직접 돌려 보고 틀린 곳을 찾는 시간이 수업에 있는지 보세요.
```

근거(llms.txt 기존 줄, Richard 대조용): 1단계 154행, 2단계 158행, 3단계 163–164행, AI 시대 코딩 225행, 5단계 172–173행, AI 튜터 195–196행, AI 리터러시 전 단계 258행, 성인반 353–354행.

## Failure Modes
| 경로 | 실제로 날 일 | 처리 | 사용자에게 |
|---|---|---|---|
| home FAQ ↔ schema FAQ | 한쪽만 고쳐 문답 어긋남(FAQ 리치결과 불일치) | test-faq-sync 순서·문자열 비교 | 조용함 → 테스트로 막음 |
| schema.json 편집 | 쉼표 하나로 JSON 깨짐 | page.tsx import 라 빌드 실패 + 테스트 JSON.parse | 배포 안 됨, 보임 |
| home.html `&` | 날 `&` 로 엔티티 깨짐 | 이웃과 같게 `&amp;`, 운영 HTML 에서 잠긴 질문 grep | 보임 |
| 배포 | git push 만 하고 끝 → 운영 그대로 | 6번 vercel --prod + 운영 curl 확인이 Acceptance | 조용함 → 확인 단계로 막음 |
| 문구 | AI 티·키워드 반복으로 광고 판정 | MARKS 검사 + AI학원 횟수 검사 | 조용함 → 테스트로 막음 |
| 사실 | 학년·주수 오기 | Flag + Richard 가 근거 행과 대조 | 조용함 → 리뷰로 막음 |

## Test Map
- 새 FAQ 문답 3곳 존재 — [GAP] → test-faq-sync
- home/schema FAQ 순서 일치(기존 13 + 새 1) — [GAP] → test-faq-sync (기존 동작 회귀 가드)
- title/description/#org description 의 AI학원 1회 — [GAP] → test-faq-sync
- alternateName 오염 없음 — [GAP] → test-faq-sync
- 새 문구 AI 티 0 — [GAP] → test-faq-sync (MARKS 재사용)
- 운영 반영 — 수동 curl (Acceptance)
- 빌드 — next build 또는 tsc 통과

## Out of Scope (→ BUILD-LOG Known Gaps)
- 어린이·청소년 AI 전용 페이지(/ai). 지금 사실은 홈 #ai 절·FAQ·llms 절과 겹쳐 얇은 복제 페이지가 된다. p14~p18 측정 2~3주 보고 다시 판단
- 네이버 스마트플레이스 대표키워드에 「AI학원」 추가 — 원장 몫(로그인). 네이버 플레이스 순위엔 이게 사이트 수정보다 크다
- 홈 h1·h2·#ai 슬로건 문구 변경
- 측정 탐침 p14~p18, naver-place-check 검색어 — 오케스트레이터가 이미 처리
- 기존 13문답 home/schema 어긋남이 있으면 그 수정

## Acceptance
- `node academy/scripts/test-faq-sync.mjs` PASS
- 빌드 통과
- 운영 robotncoding.com: `<title>` 에 「코딩·로봇·AI학원」, 홈 HTML·ld+json 에 잠긴 질문, /llms.txt 에 「AI학원을 찾는 분께」
- indexnow 로 / · /llms.txt 알림 성공 출력
- 「AI학원」 등장 자리: meta title · meta description · #org description · FAQ 질문·답(2) 3곳 · llms 1행 · 짧은 버전 · llms 절 제목·끝. 그 밖 0
