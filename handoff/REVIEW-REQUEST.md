# Review Request — Step 15 · 초안 재료
Date: 2026-09-23
Ready for Review: YES

자동 초안이 **원장만 쓸 수 있는 말**에서 시작하게 만든다. 재료가 없으면 일반론을 쓰는 대신
아무것도 안 쓰고 재료를 달라고 한다. 게이트가 치명을 잡으면 원장 큐에 안 올린다.

Arch 가 브리프 결정 전부를 확인하고 셋을 더했다:
- **A1** 재료 독촉은 하루 한 번까지 (`일감()` 의 `cooldownH: 24`)
- **A2** 개인정보는 가리고 저장 (되돌려 보내지 않는다) + 무엇을 가렸는지 한 줄
- **A3** 두 주 연속 빈손이면 `material-stopped` 사람 대기(priority 5 · sticky)

---

## Files Changed

### 새 파일
- `academy/scripts/setup-materials.mjs:1-78` — `academy.materials`·`academy.draft_feedback` 생성, `inquiries.said` 뒤채움(이미 옮긴 inquiry_id 는 건너뜀). 날짜 기본값 `(now() at time zone 'Asia/Seoul')::date`
- `academy/scripts/slop-rules.mjs:1-168` — `검사(본문, { 재료들 })` → `{ 치명, 경고 }`. 구체 사전(지역·교구)은 19-27, 장면 표시 정규식 45-52, 겹치나/구체있나 88-110, 본문 검사 118-167. CLI 와 write-draft 가 같은 것을 부른다
- `web/lib/materials.ts:1-105` — `가리기()` 순수 함수(51-74) · 성씨 사전과 제외 낱말(32-46) · `materialCounts`·`listMaterials`
- `web/lib/material-actions.ts:1-46` — `addMaterial`, **`await guard()` 로 연다(25행)**. 가린 뒤 저장하고 `redirect("/admin/material?m=...")`
- `web/app/admin/material/page.tsx:1-156` — 모바일 먼저. 종류 칩 + said + 저장이 첫 화면, 상황·날짜는 `<details>` 안. 받침 판별 `을를()` 44-48
- `academy/scripts/slop-check.mjs:1-123` (전면 교체) — `--strict <슬러그>` 46-88. 인자 없는 기존 동작(89-122)은 어휘 표시만 보도록 그대로 뒀다 — Actions 의 `review` 가 이 출력 형식을 정규식으로 읽는다

### 고친 파일
- `academy/scripts/write-draft.mjs:1-571` (전면 교체)
  - `83-97` 재료일감() — dedupe_key `material-need`, company.mjs 신호와 같은 키
  - `99-135` 빈손()·다시돎() — A3. 두 주 연속이면 `material-stopped`(sticky) 올리고, 초안이 나오면 닫고 카운터 0
  - `137-164` 재료·버린이유·측정 읽기 → `모드=` 를 **첫 줄에** 찍는다
  - `167-187` 모드 사실 — write-news.mjs 를 자식으로 실행하고 종료 코드를 그대로 넘긴다
  - `189-200` 모드 없음 — 아무것도 안 쓰고 일감 + `exitCode 78`
  - `202-271` 주제 고르기 뒤집기. 핵심어 자리에 재료 낱말(`재료점수`), 맞물리는 주제가 없으면 재료에서 제목을 뽑는다
  - `273-391` 프롬프트 — 재료 블록·「첫 문단은 그대로 인용」·kind='숫자' 예외·「원장이 최근에 버린 이유」
  - `440-478` 게이트. 치명이면 재료·주제를 바꿔 한 번만 재시도, 두 번째도 치명이면 **넣지 않는다** + 일감 + 78
  - `521-546` used_in 갱신 · review_notes 에 `모드`·`쓴재료`(uuid)·`재료말`
- `academy/scripts/company.mjs:159-173` — ensure() 에 표 둘 (setup-materials.mjs 와 같은 덩어리)
- `academy/scripts/company.mjs:331-346` — 재료 신호. 안 쓴 재료 3 미만 또는 max(day) 14일 초과 → priority 12 · 사람 대기 · **cooldownH 24 (A1)**
- `academy/scripts/company.mjs:360` — 닫기 규칙에 `material-need` → 신호원 `material`. `material-stopped` 는 sticky 라 자동으로 안 닫힌다
- `web/lib/inquiry-actions.ts:7, 27-64` — `addInquiry` 가 `said` 가 있으면 `materials` 에 한 행(kind 상담 · origin inquiry · inquiry_id · context=grade). 같은 `가리기()` 를 거친다. 폼·필드 이름은 안 건드렸다
- `web/lib/todo-text.ts:160-173` — `kind === "material"` 가지. 「초안 재료 한 줄 — 30초」 / 빈손 2 이상이면 「발행이 N주 멈췄습니다」
- `web/lib/drafts.ts:7-15` — `DISCARD_REASONS` 7개
- `web/lib/draft-actions.ts:111-142` — `discardDraft`. **이유를 하나도 안 고르면 아무것도 안 지운다**(`confirm !== "yes"` 자리를 이유 검사로). 지우기 **전에** `draft_feedback` 에 slug·title·reasons·note·앞 600자
- `web/app/admin/drafts/page.tsx:37-40, 183-199` — 버리기를 `<details>` 안으로. 이유 칩(체크박스) + 한 줄 + 「이 이유로 버립니다」
- `web/app/admin/AdminNav.tsx:7` — 「재료」를 「문의」 앞에
- `web/app/admin/admin.css:76-88` — `.adm-pick`(칩) · `.adm-said`(한 줄 답). 새 CSS 파일은 안 만들었다

---

## 인수 시험 — 실제 출력

**1. setup-materials.mjs 두 번 · company.mjs 준비() 두 번 — 통과**
```
academy.materials 준비됨 · 0건 (안 쓴 것 0개) · 문의에서 옮긴 것 0건
academy.draft_feedback 준비됨 · 0건
--- 두 번째 ---
academy.materials 준비됨 · 0건 (안 쓴 것 0개) · 문의에서 옮긴 것 0건
academy.draft_feedback 준비됨 · 0건
```
`node scripts/company.mjs --plan` 도 두 번 오류 없음.

**2. 재료 3건 + --dry → 모드=재료 · 따옴표 그대로 — 통과**
```
모드=재료
주제: 잠실에서 초등 코딩학원, 거리가 얼마나 돼야 다닐 만한가요?
  안 쓴 재료 3개 중 3개를 넘깁니다 · 재료 맞물림 2개 · 지는 검색어 맞물림 2개
...
# 이 글에 쓸 재료 (원장이 실제로 듣고 겪은 것. 여기 없는 장면은 하나도 만들지 마라)
- [m1] 질문 · 2026-09-23 · 초6 · 전화 상담: 「파이썬을 초등학교 때 시작해도 되냐고 물으심」
- [m2] 상담 · 2026-09-23 · 초5 · 대회반 상담: 「대회 준비도 해주냐고 물으심」
- [m3] 수업 · 2026-09-23 · 초3 · 스크래치 수업: 「블록을 지웠다가 되돌리는 걸 혼자 찾아냄」

첫 문단은 위 재료 중 하나를 그대로 인용해서 연다. 고쳐 쓰지 말고 들은 말 그대로 따옴표 안에 넣는다.
```

**3. 실제 1회 실행 → 첫 문단에 재료 그대로 · used_in · review_notes — 통과**
로컬에 모델 키가 하나도 없어(ANTHROPIC/GEMINI/GROQ/OPENROUTER 전부 0자) `LLM_PROXY_URL` 로
**127.0.0.1 의 가짜 모델**을 세워 실제 경로를 돌렸다. 프롬프트에서 `[m1]` 의 말을 뽑아 첫 문단에 넣는 응답을 준다.
```
모드=재료
  쓰는 모델: anthropic/claude-opus-5 (openrouter)
DRAFT_SLUG=jamsil-tonghak
초안으로 넣었습니다: 스크래치에서 파이썬으로 언제 넘어가야 하나요? (647자)
쓴 재료 1개: 「파이썬을 초등학교 때 시작해도 되냐고 물으심…」
```
DB 확인:
```
첫 문단: 상담에서 이런 말을 들었습니다. 「파이썬을 초등학교 때 시작해도 되냐고 물으심」
review_notes.모드: 재료 · 쓴재료: [ '4208a2d3-…-cfd346c0d348' ]
materials: { said: '파이썬을 초등학교 때 시작해도 되냐고 물으심', used_in: [ 'jamsil-tonghak' ] }
```

**4. 재료 0 → 모드=없음 + 일감 + 78 · posts 그대로 — 통과**
```
모드=없음
  안 쓴 재료 0개 · 쓸 사실도 없습니다. 초안을 만들지 않습니다.
재료 적는 곳: https://geo-rose-nine.vercel.app/admin/material
EXIT=78
```
일감:
```
dedupe_key: 'material-need', kind: 'material', status: '사람 대기', priority: 12,
detail: '안 쓴 재료 0개 · 마지막 기록 없음', payload: { last: null, unused: 0 }
```
`academy.posts` 45행 → 45행 (시험 전후 동일).
**모드 사실은 못 돌렸다** — 로컬에 GEMINI 키가 없어 조건이 `모드=없음` 으로 떨어진다 (KG-15-2).

**5. 재료 없이 지어낸 장면 → 종료 1 · 치명 「지어낸 장면」 — 통과**
```
시험: 지어낸 장면
  zz-test-scene · 쓴 재료 0개

치명 — 이대로는 원장 큐에 못 올립니다
  ✗ 지어낸 장면 1곳 — 한 학부모가 지난주 상담에서 이렇게 말했습니다.
      재료 없이 상담·수업 장면을 썼습니다. 원장이 실제로 들은 말만 씁니다
EXIT=1
```

**6. 그 말이 든 재료 + 쓴재료 → 종료 0 — 통과**
```
시험: 지어낸 장면
  zz-test-scene · 쓴 재료 1개

치명: 없음
EXIT=0
```

**7. 문단 5개 중 3개 무구체 → 치명 「일반론 문단 3/5」 — 통과**
```
치명 — 이대로는 원장 큐에 못 올립니다
  ✗ 일반론 문단 3/5 3곳 — 코딩 교육은 아이의 생각하는 힘을 기르는 데 도움을 주는 분야로… / 학습의 과정에서…
      숫자·지역·교구·인용이 하나도 없는 문단이 절반 가까이입니다. 검색하면 아무나 쓸 수 있는 글입니다
EXIT=1
```

**8. /admin/material 390px · 가림 — 통과** (playwright, 390×844)
```
material · scrollWidth 390 · innerWidth 390 · 가로 넘침 없음
저장 버튼 y: 416.28 · 첫 화면(844) 안: true
```
입력 「김민준 어머님이 010-1234-5678 로 전화하셔서 … 메일은 minjun@example.com」 →
- 화면: `메일 주소 · 전화번호 · 이름을 가리고 저장했습니다.`
- DB: `○○ 어머님이 010-****-**** 로 전화하셔서 대회 준비도 해주냐고 물으심. 메일은 ***@***`

입력 「이서연 학생이 02-1234-5678 로 물어봄 — 대회반 언제 여냐고」 →
- 화면: `전화번호 · 이름을 가리고 저장했습니다.` · DB: `○○ 학생이 0**-***-**** 로 물어봄 — 대회반 언제 여냐고`

칩은 5개가 한 줄에 들어가고 줄바꿈된다. 스크린샷 `material-390.png`.

**9. 재료 0 → /admin/ops 맨 위 · 3개 이상이면 안 뜸 — 통과**
ops 맨 위(스크린샷 `ops-390.png`):
```
오늘 원장님이 하실 일 6건
  초안 재료 한 줄 — 30초
  안 쓴 재료 0개. 3개 밑이면 자동 초안이 일반론이…
  [적기 →]
```
안 쓴 재료 5개로 `company.mjs --plan` → `material-need` 가 `닫힘` 으로 바뀌었다(신호 사라짐).

**10. 이유 없이 버리기 → 안 지워짐 · 이유 고르면 기록 — 통과**
```
카드 있음: 1
이유 없이 버린 뒤 글이 아직 있나: true
이유를 고르고 버린 뒤 글이 아직 있나: false
draft_feedback: { slug: 'zz-test-general', reasons: ['일반론','지어낸 장면'],
                  note: '학원 블로그라고 보기엔 너무 일반론적', excerpt: '코딩 교육은 아이의 생각하는 힘을 기르는 데 도움을 주' }
```
다음 `--dry` 프롬프트:
```
# 원장이 최근에 버린 이유 (되풀이하면 또 버린다)
- 일반론 · 지어낸 장면 — 「학원 블로그라고 보기엔 너무 일반론적」
```
스크린샷 `drafts-discard-390.png`.

**11. tsc --noEmit — 통과** (`node ./node_modules/typescript/bin/tsc --noEmit` → `TSC_EXIT=0`)
덤으로 `npm run build` 도 통과 (`BUILD_EXIT=0`) — `"use server"` 모듈 내보내기 규칙까지 확인했다.

### 브리프에 없는데 돌린 것
- **게이트 재시도·차단** (5번 항목) — 슬롭 본문을 주는 가짜 모델로 확인
```
게이트에 걸렸습니다 (1회차): ✗ 지어낸 장면 1곳 / ✗ 일반론 문단 3/4 3곳
  재료와 주제를 바꿔 한 번 더 씁니다 — 주제: 코딩 대회, 초등학생도 나갈 수 있나요?
게이트에 걸렸습니다 (2회차): ✗ 지어낸 장면 1곳 / ✗ 일반론 문단 3/4 3곳
두 번 다 걸렸습니다. 초안을 넣지 않습니다 — 원장 큐에 슬롭을 올리지 않습니다.
EXIT=78
```
`academy.posts` 47행 → 47행(안 늘었다). 일감 title 「재료가 필요합니다 — 자동 초안이 두 번 다 일반론이었습니다」, payload 에 치명 목록.
- **A3 두 주 연속** — 같은 실행을 한 번 더 → `⚠ 2주 연속 빈손입니다. 발행 멈춤 일감을 올렸습니다.`
  `material-stopped` priority 5 · 사람 대기 · sticky. 그 뒤 정상 초안 1회 → `material-stopped` 닫힘, `빈손` 0 으로 복구.
- **기존 slop-check 동작** — `node scripts/slop-check.mjs` → 「새로 쓴 글 14편을 봅니다 … 글 14편 중 0편에서 걸림」, 종료 0. 출력 형식 그대로라 company.mjs 의 `review` 정규식이 계속 먹는다.

---

## 운영 DB 에 남긴 것 / 지운 것

**남긴 것 (이 단계의 산출물이라 남아야 한다)**
- `academy.materials` 표 + `materials_unused_idx` (0행)
- `academy.draft_feedback` 표 (0행)
- `geo.agent_tasks` 의 `material-need` 1행 — 재료가 실제로 0개라서 뜬 **진짜 신호**다. 원장이 재료를 3개 적으면 다음 회사 루프가 닫는다

**지운 것 (전부 시험용)**
```
posts:     zz-test-scene, zz-test-general, jamsil-tonghak   (3편)
materials: 6행   draft_feedback: 1행
tasks:     material-stopped, material-need(시험 흔적이 붙은 것), review-zz-test-scene,
           review-jamsil-tonghak, illustrate-jamsil-tonghak
```
지운 뒤 확인: `posts 45 · materials 0 · draft_feedback 0` — 시험 시작 전 `posts 45` 와 같다.
그 뒤 `company.mjs --plan` 을 한 번 돌려 `material-need` 를 깨끗한 값으로 다시 만들었다
(`detail: 안 쓴 재료 0개 · 마지막 기록 없음`, `payload: { last: null, unused: 0 }` — 빈손·치명 키 없음).

`geo.agent_activity` 에는 시험 중 돌린 `company.mjs --plan` 의 일감 열기·닫기 기록이 남는다.
정상 운영 기록과 같은 모양이라 지우지 않았다.

---

## 스크린샷

`C:\Users\force\AppData\Local\Temp\claude\C--dev-AGO-GEO\b2c2577b-fff2-4142-b28e-645690daf80e\scratchpad\`
- `material-390.png` — /admin/material 390px (칩 줄바꿈 · 저장 버튼이 첫 화면 안)
- `material-390-masked.png` — 가린 뒤 한 줄이 뜬 화면
- `drafts-discard-390.png` — 버리기 이유 칩 + 한 줄 + 「이 이유로 버립니다」
- `ops-390.png` — /admin/ops 맨 위의 「초안 재료 한 줄 — 30초」

---

## Open Questions

1. **`가리기()` 의 이름 정규식 범위.** 성씨 사전 45자 + 제외 낱말 30개로 좁혔다(`materials.ts:32-46`).
   「우리 학생」 「여자 학생」은 안 걸리는 걸 확인했지만, 사전에 없는 성(예: 선우·남궁 같은 복성)은 안 가려진다.
   전화번호·메일은 확실히 잡히니 남는 위험은 이름뿐인데, 이대로 두고 빠지는 게 보이면 한 줄씩 더할지 봐 주세요.
2. **모드 B 조건에 `GEMINI_API_KEY` 존재를 넣은 것.** 브리프는 「뉴스거리가 있음」인데 write-draft 는
   그걸 미리 알 수 없어서 「write-news 를 돌릴 수 있는가」로 바꿔 읽었다(`write-draft.mjs:162-163`).
   키가 있으면 재료가 모자랄 때마다 write-news 를 부르게 된다 — 뉴스거리가 없으면 write-news 가 78 로 끝내고
   그때 재료 일감이 올라간다. 이 흐름이 맞는지 봐 주세요.
3. **재시도 때 주제를 `후보[1]` 로 바꾼다** (`write-draft.mjs:468`). `--question`·`--topic` 으로 주제가 고정된
   경우에는 후보가 하나뿐이라 주제가 안 바뀌고 재료 순서만 돈다. 그래도 되는지.
4. **`--strict` 는 `review_notes.쓴재료` 를 믿는다.** 모델이 안 쓴 라벨을 넣으면 게이트가 헐거워진다.
   프롬프트로 못박아 뒀지만(`"안 쓴 라벨을 넣으면 검사에서 걸려 글이 통째로 버려진다"`) 기계 검사는 아니다.
   재료 `said` 의 8자가 본문 어딘가에 있는지까지 보게 할지는 Arch 결정이 필요해 보인다.

---

## Out of Scope (BUILD-LOG Known Gaps 에 적음)

- **KG-15-1** `.inq-pick`(문의 화면 지역 CSS) 과 새 `.adm-pick`(admin.css) 이 같은 규칙이다. 브리프가 문의 화면은
  `addInquiry` 한 곳만 손대라고 해서 합치지 않았다
- **KG-15-2** 모드 사실(write-news 자식 실행)은 로컬에 GEMINI 키가 없어 실제로 못 돌렸다
- **KG-15-3** 「본문 1800자 미만」은 여전히 짜임새 흠일 뿐 게이트가 막지 않는다. 짧은 글이 원장 큐로 갈 수 있다
- **KG-15-4** 재료 고치기·지우기 화면이 없다(브리프 Out of Scope). 잘못 적은 재료는 DB 로만 지운다
