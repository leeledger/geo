# Architect Brief — Step 19 · AI 직원 팀 (영상 「Hermes 멀티프로필로 AI 직원 팀 만들기」 적용)

## Goal

에이전트마다 **정체성·일하는 규칙·기억**을 파일로 따로 준다. 글은 **근거표(사실·추정·확인 필요)를 먼저 만들고 그 근거로만 쓴다**. 매일 아침 **총괄(PM)이 한 장짜리 보고**를 남긴다. 되풀이 실패는 계속 다시 하되 **5번 넘으면 PM 보고의 「확인 필요」로 올라간다**.

원장(2026-09-24): 「https://youtu.be/CmHhhT_Xt8M 참고해서 적용 끝날 때까지 묻지 말고 알아서 해」.
영상 요지(가이드 README, citizendev9c/yt-assets …/hermes-multi-profile-ai-team-26-06-13):
- 직원별 SOUL(누구인가)·USER(원장 공통, 얇게)·AGENTS(어떻게 일하나·보고 양식·handoff 규칙)·MEMORY(오래 갈 규칙만, 작업 로그 금지)
- 자비스(PM) = 분해·배분·취합·보고. 직접 일 안 함. 뉴턴 = 리서치, 사실/추정/확인 필요 분리. 헤밍웨이 = 뉴턴 근거로만 글, 수치 새로 만들지 않음
- handoff 최대 5회, 막히면 「원장 확인 필요」로 PM 에게. 반복 업무는 Cron, 발행 전 컨펌 게이트
- 보고 양식: status · conclusion · 직원별 요약 · needs_owner · artifacts · next_action

## 결정 (Bob 은 여기서 고르지 않는다)

- **D1. 슬랙·텔레그램은 안 한다.** 봇 토큰은 원장이 만들어야 한다. 보고 창구는 현황판이다. BUILD-LOG Known Gap 으로만 적는다.
- **D2. PM 보고는 LLM 없이 DB 에서 짓는다.** 숫자·상태를 모아 정해진 문장틀에 넣는다. 슬롭이 들어올 자리가 없고 지어낼 수 없다.
- **D3. 리서치 단계는 LLM 을 새로 부르지 않는다.** 재료 모드의 근거는 원장 재료(academy.materials)와 측정(ai_measurements) 자체다. write-news 는 이미 검색 근거가 있다. 대신 **결정적 근거표**를 만들고 **숫자 게이트**를 건다: 본문에 나온 숫자가 근거표·재료·측정 원문에 없으면 치명 「근거 없는 숫자」.
- **D4. 실패 재시도는 끊지 않는다(Step 17 원장 지시 유지).** 5번째 실패부터 PM 보고 「확인 필요」에 올린다. 원장 할 일 목록에는 안 올린다.
- **D5. 직원 파일은 저장소에 둔다** — `academy/agents/`. 기억(MEMORY.md)은 사람이·세션이 고치는 씨앗 규칙이다. 에이전트가 스스로 덮어쓰지 않는다(작업 로그가 쌓이면 역할이 섞인다 — 영상의 경고).

## 짓는 순서

### 1. 직원 파일 — `academy/agents/`
```
agents/USER.md                         원장 공통 (얇게): 호칭, 결론 먼저, 확인 안 된 건 「확인 필요」, 절대 규칙 요약(지어내지 않는다·고객사 가림·번역체 금지·불안 팔지 않음)
agents/<id>/SOUL.md                    Identity · Mission · Core Truths(5~7) · Tone · Boundaries. 운영 규칙은 AGENTS.md 포인터만
agents/<id>/AGENTS.md                  역할 · 판단 · 넘기는 곳(누구에게) · 보고 양식 · handoff 5회 · 막히면 PM 에게
agents/<id>/MEMORY.md                  씨앗 규칙 몇 줄. 작업 로그·날짜 지난 정보 금지
```
id: `pm`(총괄 — company.mjs·PM 보고), `research`(근거 — 측정·정찰·근거표), `content`(집필 — write-draft·write-news), `illustrate`, `deliver`, `sales`, `audit`, `repair`.
내용은 CLAUDE.md 의 규칙과 이 저장소가 실제로 하는 일에서 가져온다. 새 사실을 지어내지 않는다. 한국어, CLAUDE.md 「AI 가 쓴 티」 규칙대로.
MEMORY 씨앗 예: content — 「원장이 버린 초안 3편은 일반론·지어낸 장면이 이유였다(2026-09-23)」, 「사실·출처로 쓴 뉴스 글은 그대로 발행됐다」. 메모리 폴더(~/.claude/…/memory)의 draft-needs-real-material·openai-crawl-needs-bing·claude-search-needs-brave 를 해당 직원 MEMORY 에 옮겨 적는다.

`academy/scripts/profile.mjs` — `프로필(id)` 가 USER + SOUL + AGENTS + MEMORY 를 이어 붙인 문자열을 준다(없는 파일은 건너뜀, 합쳐 6,000자 상한 — 넘으면 MEMORY 부터 자른다).

### 2. 직원 파일을 실제로 쓴다
LLM 을 부르는 곳의 프롬프트(또는 시스템 프롬프트) 앞에 자기 프로필을 붙인다:
- write-draft.mjs(`content`), write-news.mjs(`content`), illustrate.mjs(`illustrate`), sales.mjs(`sales`), audit.mjs 진단(`audit`), repair.mjs(`repair`), company.mjs `물어보기`(`pm` — 분석), daily-agent.mjs 가 LLM 을 부르면(`research`).
각 파일에서 프롬프트가 만들어지는 한 곳에만 넣는다. 공급자 코드(writer-common·claude-code)는 고치지 않는다.

### 3. 근거표 + 숫자 게이트 (뉴턴 → 헤밍웨이)
- `slop-rules.mjs` `검사(본문, { 재료들, 근거 = "" })` — 새 치명 「근거 없는 숫자」: 본문의 숫자(아라비아 숫자 2자리 이상, 또는 % · 명 · 곳 · 개 · 원 · 점 · 회 · 번 · 년이 붙은 숫자)가 `근거` 문자열·재료 said/context 어디에도 없으면 걸린다. 연도(2020~2035)·「1편」「주 1」 같은 운영 숫자·목록 번호·소제목 번호는 제외 규칙을 둔다. 날짜 표기(9월 22일 등)는 근거에 같은 날짜가 있어야 통과. 시험 케이스를 slop-check 시험에 추가(있으면) 또는 `node -e` 로 검증한 출력을 REVIEW-REQUEST 에 붙인다.
- write-draft: 쓰기 전에 **근거표**를 만든다 — `{ 사실: [재료 원문·측정 요약·기존 글 제목 등 출처 달린 줄], 추정: [], 확인필요: [] }`. 모델 호출 없음(D3). 프롬프트에 「이 근거표에 없는 숫자·날짜·고유명사는 쓰지 않는다. 필요하면 확인 필요로 남긴다」. 게이트에 근거표 전체 텍스트를 `근거` 로 넘긴다. `review_notes.근거표` 에 저장.
- write-news: 검색 근거(출처 목록·본문)를 `근거` 로 넘긴다. 이미 저장하는 `review_notes.근거`·`출처` 를 쓴다.
- 발행 화면(/admin/drafts)에 근거표가 있으면 「근거표」 접힘 한 칸으로 보여 준다(사실 확인이 원장 몫이라 거기서 쓰인다).

### 4. PM 보고 — `academy/scripts/pm-report.mjs` + `geo.pm_reports`
- 표: `geo.pm_reports (day date primary key, at timestamptz, status text, body jsonb)`. 만드는 곳은 스크립트 안 `create table if not exists`(company.mjs ensure() 선례).
- 회사 루프(company.mjs main 끝)가 부른다: KST 08시 이후이고 오늘 보고가 없으면 1회 생성. 다시 부르면 덮어쓰지 않는다(`--force` 로만).
- body: `{ status: "정상"|"주의"|"막힘", conclusion: 한 문장, 직원: [{ id, 이름, 한 일(어제 09시~지금, 활동 수·성공/실패), 지금 상태 }], 확인필요: [...], 원장할일: n, 산출물: [새 초안·발행·색인 알림 수], 다음: [...] }`.
  - 확인필요 = (a) attempts ≥ 5 인 열린 일감(D4) (b) 조사(investigate) 사람 대기 (c) 24시간 넘게 「늦음」인 정해진 작업 (d) 수리공 꺼짐 7일 이상.
  - 문장은 전부 틀 + 숫자. 「다양한」「원활」 같은 말 금지. 숫자는 DB 에서 센 것만.
- 현황판: `web/lib/pm-report.ts` 가 오늘(없으면 가장 최근) 보고를 읽고, `/admin/ops` 맨 위(「오늘 원장님이 하실 일」 위)에 「오늘 아침 보고」 카드. status 배지 · conclusion · 확인 필요 목록(있을 때만) · 직원별 한 줄은 접힘. 날짜를 같이 쓴다(어제 것이면 「9/23 보고」). 못 읽으면 「보고를 못 읽었습니다」.

### 5. 실패 5회 → 확인 필요
company.mjs 근무() 는 그대로 계속 다시 한다. 5번째 실패에 `payload.escalated=true` 를 적고 활동 한 줄 「원장 확인 필요로 올림」(한 번만). PM 보고가 이것을 읽는다. 할 일 목록(Todo)에는 안 올린다.

## Out of Scope
슬랙·텔레그램(D1) · LLM 리서치 호출 추가(D3) · 수리공 스위치 · 공급자 코드 변경 · 랜딩 문구.

## 확인 (Bob 이 REVIEW-REQUEST 에 붙인다)
- `node --check` 바뀐 스크립트 전부, web `node ./node_modules/typescript/bin/tsc --noEmit -p .`
- `node scripts/pm-report.mjs --dry` 운영 DB 출력 전문
- 숫자 게이트: 걸리는 예·안 걸리는 예 각 3개 이상의 실제 출력
- `node -e` 로 `프로필("content")` 길이와 앞 300자
- CLAUDE.md 함정: 정규식·백슬래시가 든 파일은 Write/Edit 로 쓴다(히어독이 먹는다). 경로의 `&` 때문에 npx 대신 node ./node_modules/… 로.
