# Architect Brief — Step 15 · 초안 재료

## Goal

자동 초안이 **원장만 쓸 수 있는 말**에서 시작한다. 재료가 없으면 일반론을 쓰는 대신 아무것도 안 쓰고 재료를 달라고 한다.

## 왜 (근거)

2026-09-23 원장이 밤사이 초안을 버리며: 「내용이 너무 AI slop 강했어. 학원 블로그라고 보기에는 너무 일반론적인 내용, 억지스러운 상황 설정 등」. 이틀에 3편을 버렸다. 같은 기간 **사실·출처로 쓴 뉴스 글(`ai-textbook-16-subjects-2028`)은 그대로 발행했다.**

DB 를 봤다. `academy.inquiries` 는 고객사 1번에 **2행**, 둘 다 `said` 가 **빈 문자열**이다. `write-draft.mjs:167` 은 재료가 있으면 넣게 돼 있지만 넣을 게 없어서 「기록이 없다」 가지가 늘 탄다. 프롬프트에 금지 목록을 아무리 쌓아도 모델은 빈자리를 일반론과 지어낸 장면으로 채운다. **모델 문제가 아니라 재료 문제다.**

---

## 결정 (Bob 은 여기서 고르지 않는다)

### D1. 새 표 `academy.materials` — `inquiries.said` 재사용 안 함

`inquiries` 는 **유입 경로에서 등록 전환을 재는 표**다(`inquiry_summary` 뷰, `source`·`enrolled`). 재료를 여기에 넣으면 ①수업 장면·아이 말은 문의가 아닌데 가짜 `source` 행을 만들어야 하고 ②상담 하나에서 재료 셋이 나올 때 문의 수가 부풀어 **전환율 지표가 망가진다**. 사이티드 영업 숫자가 여기서 나온다 — 오염시키지 않는다.

대신 **`inquiries.said` 는 재료의 입력구 중 하나로 잇는다**: `addInquiry` 가 `said` 를 쓰면 `materials` 에 한 행(kind `상담`, origin `inquiry`, inquiry_id)을 같이 넣는다. 원장은 한 곳에만 친다.

### D2. 화면은 새 `/admin/material`

문의 화면은 「상담 결과 입력」 흐름이라 수업·아이 말이 들어갈 자리가 없다. 재료는 문의가 없는 날에도 매일 생긴다. AdminNav 에 「재료」를 넣는다.

### D3. 모드 C 는 **글을 안 쓴다**

재료도 없고 사실 출처도 없으면 초안을 만들지 않는다. 대신 사람 대기 일감을 올린다. **빈손으로 오는 게 슬롭을 내놓는 것보다 낫다** — 원장이 읽고 버리는 시간이 더 비싸다.

### D4. 사실 글은 `write-news.mjs` 를 부른다 (새로 안 짠다)

원장이 유일하게 발행한 자동 글이 그 경로에서 나왔다. 모드 B 는 write-draft 안에서 뉴스 글을 다시 구현하지 말고 `write-news.mjs` 를 자식 프로세스로 실행하고 그 종료 코드를 그대로 넘긴다.

---

## 짓는 순서

### 1. 표 — `academy/scripts/setup-materials.mjs` (새 파일, `setup-inquiries.mjs` 를 본 뜬다)

```sql
create table if not exists academy.materials (
  id         uuid primary key default gen_random_uuid(),
  client_id  int  not null default 1,
  -- 기본값을 current_date 로 두면 UTC 러너에서 전날로 찍힌다 (CLAUDE.md 함정)
  day        date not null default ((now() at time zone 'Asia/Seoul')::date),
  kind       text not null check (kind in ('상담','수업','질문','사례','숫자')),
  said       text not null,                -- 들은 말·있었던 일 그대로. 요약 금지
  context    text not null default '',     -- 학년·상황 (예: 초5 · 대회반 상담)
  used_in    text[] not null default '{}', -- 이 재료로 쓴 글 slug
  origin     text not null default 'owner',-- owner | inquiry
  inquiry_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists materials_unused_idx
  on academy.materials (client_id, day desc) where cardinality(used_in) = 0;

create table if not exists academy.draft_feedback (
  id         bigserial primary key,
  client_id  int  not null default 1,
  slug       text not null,
  title      text not null default '',
  reasons    text[] not null default '{}',
  note       text not null default '',
  excerpt    text not null default '',     -- 버린 본문 앞 600자. 다음 프롬프트가 본다
  created_at timestamptz not null default now()
);
```

- 같은 두 `create table if not exists` 를 **`academy/scripts/company.mjs` 의 준비() (149~158행 옆)** 에도 넣는다. 그래야 Actions 가 사람 손 없이 굴러간다. 기존 `alter table academy.posts add column if not exists review_notes` 와 같은 자리다.
- 뒤채움 1회: `academy.inquiries` 에서 `said` 가 빈 문자열이 아닌 행을 kind `상담` · origin `inquiry` · inquiry_id 로 옮긴다. 지금은 0건이지만 스크립트는 넣어 둔다(이미 옮긴 inquiry_id 는 건너뛴다).

### 2. 입력 화면 — `web/app/admin/material/page.tsx` + `web/lib/material-actions.ts` (둘 다 새 파일)

- **모바일 먼저.** 390px 에서 가로 스크롤 0, 저장 버튼이 첫 화면 안. `admin.css` 의 `.adm`·`.adm-card`·`.adm-btn` 과 `AdminNav here="/admin/material"` 을 쓴다. 새 CSS 파일 만들지 말 것 — 필요한 것만 `admin.css` 에 붙인다. `AdminNav` 의 PAGES 에 「재료」를 「문의」 앞에 넣는다
- 폼은 **한 줄이면 끝난다**: 종류 칩(상담·수업·질문·사례·숫자, 기본 `상담`) + `said` textarea(자동 포커스, required) + 저장. `context`·`day` 는 접힌 자리에
  - 칩은 `/admin/inquiry` 의 `.inq-pick` 라디오 패턴을 그대로 옮긴다(숨긴 radio + label)
- placeholder 는 지어낸 말 말고 이런 것: 「대회 준비도 해주냐고 물으심 — 초5, 학교에서 정보 수업 듣고 옴」
- 아래에 최근 10건. 쓴 글이 있으면 slug 배지, 없으면 「안 씀」
- 맨 위 한 줄: 「안 쓴 재료 N개」. N 이 3 미만이면 눈에 띄게
- **서버 액션 `addMaterial` 은 반드시 `await guard()` 로 연다.** 14b 에서 문의·리드 액션 11개가 인증 없이 열려 있었다 — 되풀이 금지

**개인정보 막기** — `web/lib/material-actions.ts` 안에 순수 함수 `가리기(s)` 로 분리해 시험 가능하게 한다.

- 전화번호 → `010-****-****`
- 숫자 7자리 이상 연속 → 별표로
- 메일 주소 → `***@***`
- 한글 이름 2~4자 + (어머님|어머니|아버님|아버지|학생|군|양) → `○○ 어머니` 꼴로
- 저장을 막지 않고 **가린 뒤 저장**한다. 화면에 「전화번호를 가렸습니다」처럼 무엇을 가렸는지 한 줄. 30초 안에 끝나야 하니 되돌려 보내지 않는다
- `said` 400자, `context` 120자로 자른다. 학년(초5)은 개인정보가 아니다 — 남긴다
- 정규식이 든 파일이다. **Write 로 쓴다** — Bash 히어독이 백슬래시를 먹는다

**`/admin/inquiry` 한 군데 손댄다:** `addInquiry` 가 `said` 가 비어 있지 않으면 `materials` 에 같은 행을 같이 넣는다(kind `상담`, origin `inquiry`, inquiry_id, context 는 `grade`). 같은 `가리기()` 를 거친다. 폼·필드 이름은 그대로 둔다.

### 3. 재료 독촉 — 「오늘 원장님이 하실 일」

- **`academy/scripts/company.mjs`** 에 신호 하나. 고객사 1번에서 안 쓴 재료 수가 **3 미만**이거나 `max(day)` 가 **14일보다 오래됨** → 일감
  `{ agent: "content", kind: "material", key: "material-need", priority: 12, status: "사람 대기", link: ADMIN + "/admin/material" }`
  detail 은 「안 쓴 재료 N개 · 마지막 기록 YYYY-MM-DD」. payload 에 `unused`(수)·`last`(날짜). 조건이 풀리면 기존 일감 갱신 규칙대로 닫힌다
- **`web/lib/todo-text.ts`** 에 `t.kind === "material"` 가지 (naver-attempt 가지 옆)
  - title `초안 재료 한 줄 — 30초`
  - why `안 쓴 재료 N개. 3개 밑이면 자동 초안이 일반론이 됩니다`
  - action `{ type: "link", label: "적기", href: "/admin/material" }`

### 4. 쓰는 쪽 — `academy/scripts/write-draft.mjs`

**주제 고르기를 뒤집는다. 주제 은행이 아니라 재료가 먼저다.**

```
select id, kind, said, context, day
  from academy.materials
 where client_id = 1 and cardinality(used_in) = 0
 order by day desc limit 12
```

재료와 주제를 맞추는 것은 기존 `점수()`·`STOP` 을 그대로 쓴다 — 핵심어 자리에 재료 낱말을 넣는다.

| 모드 | 조건 | 하는 일 |
|---|---|---|
| **A 재료** | 안 쓴 재료 3개 이상, 그중 **주제와 맞물리는 것 1개 이상** | 그 주제로 쓴다. 맞물리는 주제가 없으면 **재료 자체에서 제목을 뽑는다** — 학부모 질문을 검색어 꼴로 |
| **B 사실** | 재료가 모자라는데 `--question` 의 `측정.answer` 가 있거나 뉴스거리가 있음 | `write-news.mjs` 를 자식 프로세스로 실행하고 종료 코드를 그대로 넘긴다. write-draft 는 글을 안 쓴다 |
| **C 없음** | 둘 다 아님 | **아무것도 안 쓴다.** `geo.agent_tasks` 에 `kind='material'` 사람 대기 일감(3번과 같은 dedupe_key)을 올리고 `process.exitCode = 78` |

첫 줄에 `모드=재료|사실|없음` 을 찍는다. `--dry` 에서도 찍는다.

**모드 A 프롬프트** — 지금 167~169행의 `상담말` 자리를 이것으로 갈아 끼운다.

```
# 이 글에 쓸 재료 (원장이 실제로 듣고 겪은 것. 여기 없는 장면은 하나도 만들지 마라)
- [m1] 상담 · 2026-09-23 · 초5 대회반: 「대회 준비도 해주냐고 물으심」
- [m2] 수업 · 2026-09-21 · 초3: 「블록을 지웠다가 되돌리는 걸 혼자 찾아냄」

첫 문단은 위 재료 중 하나를 그대로 인용해서 연다. 고쳐 쓰지 말고 들은 말 그대로 따옴표 안에 넣는다.
재료에 없는 상담·수업 장면은 한 줄도 쓰지 마라. 「한 학부모가」 「어떤 아이가」로 시작하는 문장은
위 재료에 그 말이 있을 때만 쓴다. 없으면 그 문단을 통째로 지운다.
```

- 출력 JSON 에 `"쓴재료": ["m1","m2"]` 를 받는다. 실제로 안 쓴 id 는 넣지 말라고 못박는다
- 넣은 뒤 `update academy.materials set used_in = used_in || $2 where id = any($3)`. `review_notes` 에 `쓴재료`·`모드` 를 같이 남긴다(`/admin/drafts` 가 읽는다)
- 「쓸 수 있는 숫자: 없다」 규칙은 **그대로 둔다.** 단 `kind='숫자'` 재료는 예외 — 재료에 적힌 그대로만 쓸 수 있다고 한 줄 붙인다
- **버린 이유를 프롬프트에 넣는다** (모드 A·B 공통). `academy.draft_feedback` 에서 최근 5건:

```
# 원장이 최근에 버린 이유 (되풀이하면 또 버린다)
- 일반론 — 「학원 블로그라고 보기엔 너무 일반론적」
- 지어낸 장면 — 「억지스러운 상황 설정」
```

### 5. 슬롭 게이트 — `academy/scripts/slop-rules.mjs` (새) + `slop-check.mjs` 개조

검사 로직을 `slop-rules.mjs` 로 빼고 `검사(본문, { 재료들 })` → `{ 치명: [], 경고: [] }` 를 내보낸다. CLI 와 write-draft 둘 다 이걸 부른다.

**치명 — 하나라도 걸리면 초안이 원장 큐에 못 간다**

1. **지어낸 장면** — 「한 학부모가/어머님이/아버님이」 · 「어떤 아이가/학생이/친구가」 · 「최근 상담에서 / 얼마 전 상담 / 지난주 상담 / 한 번은 이런」 · 「수업 중에 한~ / 수업 시간에 어떤~」
   - 쓴 재료가 하나도 없으면(`쓴재료` 빈 배열) **무조건 치명**
   - 재료가 쓰였으면, 그 표시가 든 **문장**이 쓰인 재료 `said` 의 **8자 이상 연속 부분**을 담고 있어야 통과. 아니면 치명
2. **일반론 문단** — 120자 이상 문단 중 **구체 명사가 하나도 없는 것**이 전체 문단의 40% 를 넘으면 치명
   - 구체 = 숫자·날짜 · 지역(송파·잠실·석촌·가락·헬리오) · 출처 도메인 · 교구·과목 사전(스크래치, 엔트리, 아두이노, 파이썬, 마이크로비트, 라즈베리파이, 레고, EV3, 정보올림피아드, 정보 교과, 알고리즘, 디버깅, 블록코딩, 피지컬컴퓨팅) · 따옴표 인용
   - 사전은 `slop-rules.mjs` 맨 위 상수로. 늘리기 쉽게 둔다
3. **2인칭 훈계 덩어리** — 한 문단에 「하세요 / 해 보세요 / 권합니다 / 추천합니다 / 확인해 보시길」이 3회 이상
4. 기존 MARKS 중 **「서론으로 여는 말」 1회 이상**, **「훈계조로 닫기」 3회 이상**

**경고 — 지금처럼 세기만** 한다. 나머지 기존 MARKS 전부.

**CLI**: `node scripts/slop-check.mjs --strict <슬러그>` 를 더한다. 치명이 있으면 **종료 코드 1**, 치명 목록을 먼저 찍는다. 인자 없는 기존 동작(발행 글 훑기)은 그대로 — 이미 Actions 가 쓴다.

**write-draft 안에서**: 초안을 **넣기 전에** 게이트를 돌린다.

- 치명 있음 → 재료·주제를 바꿔 **한 번만** 다시 쓴다
- 두 번째도 치명 → **넣지 않는다.** `kind='material'` 사람 대기 일감을 올리되 title 은 「재료가 필요합니다 — 자동 초안이 두 번 다 일반론이었습니다」, detail 에 치명 목록. `exitCode = 78`
- `academy.posts` 에 행이 안 생기니 company.mjs 의 `review` 일감도 안 생긴다 → **원장 큐에 안 간다.** 큐 쪽에 새 로직은 필요 없다

### 6. 버린 이유 받기 — `web/app/admin/drafts/page.tsx` + `web/lib/draft-actions.ts`

- 버리기 폼을 `<details>` 안에 넣는다: 이유 칩(복수 선택 체크박스) + 자유 입력 한 줄 + 「버립니다」
  - 칩: 일반론 · 지어낸 장면 · 사실이 틀림 · 우리 얘기가 아님 · 문체(AI 티) · 주제가 안 맞음 · 이미 쓴 내용
- `discardDraft` — **이유를 하나도 안 고르면 아무것도 안 지운다.** 지금의 `confirm !== "yes"` 자리를 이유 검사로 바꾼다
- 지우기 **전에** `academy.draft_feedback` 에 넣는다 — slug · title · reasons · note · 본문 앞 600자
- 기존 동작(일감 닫기, `post_images` 지우기, 활동 기록)은 그대로. 활동 기록 summary 에 이유를 붙인다

---

## 손대지 않는 것 (Out of Scope)

- 재료 고치기·지우기 화면 — 넣기와 보기만
- 고객사 여럿의 재료 화면 — `client_id` 칸은 두되 화면은 1번 고정
- 사진·음성 입력, 네이버 톡에서 재료 자동 뽑기
- `write-news.mjs` 내부 — 부르기만 한다
- 기존 MARKS 어휘 목록 손보기
- `--all` 등 slop-check 의 기존 CLI 동작
- 14b 의 KG(ops 를 admin.css 로 옮기기) — 따로 간다

발견한 다른 문제는 고치지 말고 **BUILD-LOG 의 Known Gaps 에 적는다.**

---

## Flag — 짐작하지 말 것

- **DB 시각은 UTC.** 날짜 기본값은 `(now() at time zone 'Asia/Seoul')::date`. 화면 표시는 `timeZone: "Asia/Seoul"`
- **서버 액션은 공개 POST 끝점이다.** 새 액션은 전부 `await guard()` 로 연다
- **`npx tsc` 는 저장소 경로의 `&` 때문에 깨진다.** `node ./node_modules/typescript/bin/tsc --noEmit` 로 부른다
- **배포**: `web/`(관리 화면)는 git push 로 나간다. `academy/scripts/*` 는 Actions 가 저장소에서 읽으니 push 로 충분하다. **이 단계에 `npx vercel` 은 필요 없다** (`academy/` 앱 자체를 건드렸다면 `npx vercel --prod --yes` — 지금 범위엔 없다)
- **정규식이 든 파일은 Write 로 쓴다.** Bash 히어독이 백슬래시를 먹는다
- **`grep -c` 는 0건에 종료코드 1.** `&&` 로 잇지 말 것
- 프롬프트·화면 문구는 전부 한국어, CLAUDE.md 말투. 번역체·빈 강조 금지
- 운영 DB 에 시험 행을 남기지 않는다. 남겼으면 지우고 무엇을 지웠는지 REVIEW-REQUEST 에 적는다

---

## Acceptance — 이게 다 되면 끝

1. `node scripts/setup-materials.mjs` 를 **두 번** 돌려도 오류 없음. company.mjs 준비()도 마찬가지
2. 재료 3건을 넣고 `node scripts/write-draft.mjs --dry` → 첫 줄 `모드=재료`, 프롬프트에 세 건이 **따옴표 그대로** 있고 「첫 문단은 위 재료 중 하나를 그대로 인용해서 연다」가 있다
3. 실제 1회 실행 → 본문 **첫 문단에 재료 `said` 의 10자 이상 연속 부분**이 그대로 있다. `review_notes.쓴재료` 에 그 id, `materials.used_in` 에 그 slug
4. 재료를 다 지우고(또는 전부 used) `--dry` → `모드=사실` 로 write-news 에 넘기거나, 넘길 것도 없으면 `모드=없음` + `geo.agent_tasks` 에 `kind='material'` 사람 대기 1행 + 종료 78. **`academy.posts` 행 수는 그대로**
5. 「한 학부모가 지난주 상담에서 이렇게 말했습니다」가 든 본문을 재료 없이 넣고 `node scripts/slop-check.mjs --strict <슬러그>` → **종료 코드 1**, 치명에 「지어낸 장면」
6. 같은 본문에 그 말이 든 재료 행을 넣고 `쓴재료` 를 채우면 → 종료 코드 0
7. 문단 5개 중 3개에 숫자·지역·교구·인용이 하나도 없는 본문 → 치명 「일반론 문단 3/5」
8. `/admin/material` 을 390px 로 → 가로 스크롤 0, 저장 버튼이 첫 화면 안, 칩이 줄바꿈됨. 전화번호와 실명이 든 문장을 저장하면 DB 값이 가려져 있고 화면에 무엇을 가렸는지 한 줄이 뜬다
9. 안 쓴 재료 0개로 company.mjs 를 돌리면 `/admin/ops` 맨 위에 「초안 재료 한 줄 — 30초」가 뜬다. 3개 이상이면 안 뜬다
10. 이유를 안 고르고 버리기 → **아무것도 안 지워진다.** 이유를 고르고 버리기 → `academy.draft_feedback` 1행, 글 삭제, 다음 `--dry` 프롬프트의 「원장이 최근에 버린 이유」에 그 이유가 보인다
11. `node ./node_modules/typescript/bin/tsc --noEmit` 오류 0 (web)

## 다 되면

`handoff/REVIEW-REQUEST.md` 에 바꾼 파일과 줄 범위, 위 11개 시험의 실제 출력, 운영 DB 에 남긴 것을 적는다. Richard 는 그것만 읽는다.

---

## Builder Plan (Bob · 2026-09-23 · Arch 확인 완료)

Arch 가 위 결정 전부를 확인하고 세 가지를 더했다. 아래대로 짓는다.

**Arch 추가 3가지**
- A1. 재료 독촉은 **하루 한 번까지**. `일감()` 의 `cooldownH: 24` 로 다시 열리는 주기를 하루로 묶는다. 사람 대기로 떠 있는 동안은 상태를 안 건드리니 매시 루프가 다시 알리지 않는다
- A2. 개인정보는 **가리고 저장**한다(원장 입력을 절대 되돌려 보내지 않는다). 무엇을 가렸는지 한 줄을 화면에 띄운다 — 서버 액션이 `redirect("/admin/material?m=...")` 로 넘긴다(폼을 클라이언트 컴포넌트로 바꾸지 않으려고)
- A3. 모드 C 는 한 주 건너뛰어도 된다. 단 **연속 두 번 빈손**이면 별도 일감 `material-stopped`(priority 5 · 사람 대기 · sticky)로 「발행이 멈췄습니다」를 올린다. 초안이 나오면 write-draft 가 닫고 카운터를 0 으로

**Bob 이 고른 것 (브리프가 안 정한 자리)**
- `가리기()` 는 `web/lib/materials.ts` 에 둔다. `"use server"` 모듈은 내보내는 게 전부 async 여야 해서(`inquiries.ts` 머리 주석) `material-actions.ts` 에서 내보내면 빌드가 죽는다. 읽기·상수와 같은 자리에 두고 액션이 가져다 쓴다 — 시험은 그대로 가능하다
- 한글 이름 정규식은 **성씨 사전 + 제외 낱말**로 좁힌다. 「한글 2~4자 + 학생」만 보면 「우리 학생」 「여자 학생」이 `○○ 학생` 으로 망가진다
- 모드 B 조건: `측정.answer` 가 있거나 `GEMINI_API_KEY` 가 있다(write-news 는 제미나이 그라운딩이 있어야 돈다 — 그 파일 머리 주석). write-news 를 돌리고 종료 코드를 그대로 넘기되, **초안이 안 나왔으면** 재료 일감도 같이 올리고 빈손을 센다(A3)
- `review_notes.쓴재료` 에는 프롬프트 표시(m1)가 아니라 **materials.id(uuid)** 를 넣는다. slop-check 가 그 id 로 재료를 읽어야 한다
