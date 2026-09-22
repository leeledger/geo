# Architect Brief — Step 14 · 관리 화면 단순화 (14a 현황판 → 14b 나머지)
*Arch 작성 2026-09-22. Step 13 통과(e146cf1). 이 파일은 Step 14 만.*

원장 말: 「검색에 처음 나온 날 같은 의미 없는 건 빼」「너무 알아보기 힘들어」「전반적으로 알아보기 쉽게」
「실시간으로 에이전트 직원들이 일을 잘 처리하고 있는지 보여야 해」「상태등도 액티비티하게」.
원장이 관리 화면을 여는 이유: **(1) 내가 뭘 해야 하나 (2) 직원들이 잘 돌고 있나 (3) 크고 있나.** 나머지는 소음.

**짓는 순서: 14a-1 → 14a-2 → Richard → 푸시·운영 확인 → 14b.** 14b 가 밀리면 14a 만 배포한다.

---

## 공통 원칙 (14a·14b 모두)

1. **맨 위는 「지금 할 일」.** 없으면 「없음」 한 줄. 결정에 안 쓰이는 것은 맨 아래 접힌 `<details>` 「자세히 (운영자용)」 하나로.
2. **쉬운 말.** 화면에 내부 이름 금지 — `claude-code-web`·`api-openrouter-*`·`geo.*`·워크플로/스크립트/테이블 이름·vendor 키(`microsoft`·`anthropic`)·커밋 해시·URL.
   엔진 표기: 문자열에 `claude`→「Claude」, `gpt|openai|chatgpt`→「ChatGPT」, `perplexity`→「퍼플렉시티」, `gemini`→「Gemini」, 그 외→「AI」. 방법(method) 이름은 화면 어디에도(자세히 포함) 안 쓴다.
3. **카드·줄 하나 = 3줄 이내.** 「뜻」「좋아지려면」 블록은 카드에서 빼서 자세히 「숫자 읽는 법」 한 곳에.
4. **글자.** 본문 ≥16px · 보조 ≥14px · 카드 머리문장 ≥21px 굵게 · 보조 글자색 `--ink2`(#A7B2C0) 이상(`--mut`/`--faint` 는 날짜·각주만) · 줄간격 1.55 · `word-break:keep-all`.
5. **모바일 먼저(390px).** 가로 스크롤 0(자세히 안의 표 래퍼만 예외). 본문 폭 최대 920px.
6. **정직 규칙 그대로.** 지어내지 않는다 · %·증감률 금지(절대 수와 이전 값만) · 같은 엔진·방법끼리만 비교 · 비교 창은 어제로 끝나는 완전한 날 · 비교 못 하면 「아직 비교 전」 · 못 읽으면 「확인 못함」(정상으로 칠하지 않는다). growth.ts 의 Delta·compare 그대로 — 비교 로직 새로 짜지 않는다.
7. **변화 단어.** 기호+단어+색 같이: `▲ 늘었음`(--ok) · `▼ 줄었음`(--crit) · `그대로` · `아직 비교 전`(둘 다 --ink2).
8. **dataviz 스킬 먼저**(Skill `dataviz`) — stat tile·hero number·sparkline·anti-pattern·motion 부분만 읽고 따른다. 계열색은 Step 13 검증 셋(구글 #1F9E90 · 네이버 #7C8AF2 · 빙 #C27A14) 그대로.
9. **CSS `transform` 은 속성 하나.** 애니메이션은 opacity·box-shadow 로, scale 이 필요하면 **전용 요소**(점 안의 ring span)에만. 이미 transform 을 쓰는 요소(`.gr-dot` 의 translate 등)에 애니메이션 걸지 않는다.

---

# Step 14a — /admin/ops 현황판

## 결정표 (지금 있는 것 전부)

| 지금 있는 것 | 결정 | 이유 |
|---|---|---|
| 머리 「AI 직원이 하고 있는 일」 + `Live` 시계·다음 칸·5분 새로고침 | **제거** (Live.tsx 삭제) | SLOTS 가 실제 일정과 다르다. 새로고침은 ② 직원 줄이 대신 |
| SLOTS 하루 시간표 · 자동/세션 칸 수 | **제거** | 틀린 표는 접어도 틀렸다. 실제 일정은 ② 의 「다음」 칸 |
| HUMAN 「사람만 할 수 있는 일」 고정 목록 + 그 안 경고 3개 | **제거** | 고정 문구. ①·카드가 대신 |
| 영업판·파일럿·상담 기록 링크 3개 | **KEEP** (작은 링크 줄) | 14b 에서 AdminNav 로 |
| 고객사 칩 줄 | **축소** | 1곳이면 제목 옆 이름만, 2곳 이상일 때만 칩. meta(도메인·착수·진단점수)·「직접 운영하는 곳으로…」 제거 |
| AgentBoard 「원장님이 하실 일」 | **KEEP → ①** (AgentBoard 에선 지움) | 질문 (1) |
| AgentBoard 요약 카운트 | **제거** | ①·② 가 대신 |
| AgentBoard 직원 카드 격자·caveat | **MOVE → 자세히** | ② 가 한 줄 요약. 상세는 운영자용 |
| Brief 「오늘의 운영 기록」 | **MOVE → 자세히** | 운영자용 |
| 옛 「고객사 성과 지표」 KPI 7칸 | **제거** | Growth 와 중복. 「제일 낮은 커버리지 %」는 학습 로봇까지 섞인 다른 숫자 |
| ↳ 플레이스 순위 | **MOVE → 자세히 「그 밖의 숫자」** | |
| Growth 판정 줄(좋아진 것 n…) | **제거** | 카드 단어가 대신 |
| Growth AI 답변 / ★답변 색인 / 발행 / 학원 문의 | **KEEP → ③ 카드 4장** | 질문 (3) |
| Growth 경쟁 검색어 · 크롤러 방문(중립) · 사이티드 리드·진단 | **MOVE → 자세히 「그 밖의 숫자」** | 4장 제한. 리드는 사이티드 전체 숫자라 학원 카드와 섞으면 헷갈린다 |
| Growth 막힌 곳(사람 대기·실패) | **MERGE** → 사람 대기는 ①, 실패는 ② | |
| Growth 커버리지 누적 차트 | **KEEP → ④** | 차트는 이것 하나 |
| Growth 「표로 보기」 | **MOVE → 자세히** | 주별 요약 「AI 측정 회차」는 엔진 이름만 |
| 크롤러 커버리지 표 | **MOVE → 자세히** | vendor 키 대신 사람 이름(구글·네이버·빙·ChatGPT·Claude…). brave 줄 `claude-code-web` → 「Claude 답변 측정의 인용으로 본다」 |
| 검색에 처음 나온 날 | **제거** (ops.ts `firstSeen` 까지) | 원장 지시 |
| 최근 발행 표 | **MOVE → 자세히, 5편만** | 카드가 「마지막 글 N일 전」을 말한다 |
| Flow.tsx | **삭제** | import 하는 곳 없음(죽은 코드) |

## 새 화면 순서

```
[제목] 운영 현황 · 로봇&코딩학원        (작은 링크 줄: 영업판 · 파일럿 · 상담 기록)
① 오늘 원장님이 하실 일            ← 14a-1
② 에이전트 직원 — 지금 (실시간)    ← 14a-2
③ 크고 있나 — 카드 4장 (1280: 2×2 / 390: 1열)   ← 14a-1
④ 답변 색인 수집 — 차트 1개 + 한 줄              ← 14a-1
⑤ <details> 자세히 (운영자용)                   ← 14a-1
```

## 14a-1 · ① 오늘 원장님이 하실 일 — 새 `web/app/admin/ops/Todo.tsx`

- 원천: `d.company.tasks` 중 `status === "사람 대기"` (AgentBoard 의 필터 그대로). 새 쿼리 없음.
- 파생 1개: `g.inquiries.unresolved > 0` 이고 큐에 `/admin/inquiry` 링크 일감이 없을 때 「상담 결과 N건 입력」 · 「문의가 등록으로 이어졌는지 이것으로만 잰다」 · /admin/inquiry.
- 한 줄 = **무엇**(t.title 굵게) · **왜**(t.error || t.detail, 1줄 말줄임 `-webkit-line-clamp:1`) · **행동** 하나. 행동은 AgentBoard 것을 그대로 옮긴다(naver-attempt 폼 `resolveNaverAttempt` · `t.link` 도메인 떼고 drafts 면 「읽고 발행하기」 · 없으면 「했어요」 `finishTask`). 서버 액션 새로 만들지 않는다.
- 최대 5개, 넘치면 「외 N건 — 자세히의 직원별 현황」. 0건 「없음 — 직원들이 알아서 돌고 있습니다」. `d.company.ok` false 면 「할 일 목록을 못 읽었습니다」.
- Flag: 일감 문구에 내부 이름이 섞여 있으면 데이터는 고치지 않는다 — 예시와 함께 BUILD-LOG Known Gaps.

## 14a-1 · ③ 크고 있나 — Growth.tsx 다시 쓰기 (카드 4장)

카드 = 머리문장(≥21px, 숫자 굵게) / 비교 줄(변화 단어 + 이전 값) / 선택 1개(스파크라인 또는 링크). 3줄 이내.

| 카드 | 머리문장 | 비교 줄 (원천) | 선택 |
|---|---|---|---|
| 1 AI 답변 | 「{엔진}에게 물은 {prompts}개 중 **{mentioned}번** 학원 이름이 나왔습니다」 + 인용 0 「· 사이트 인용은 아직 0」 / 아니면 「· 사이트 인용 {cited}번」 | `aiTop.compare` 있으면 「{md(prevDay)} 같은 질문 {common}개: {m0}번 → {m1}번」+단어. 없으면 「아직 비교 전 — 같은 방법으로 한 번 더 재야 합니다」. 측정일은 줄 끝 회색 | 같은 쌍 회차 ≥3 일 때만 스파크라인(언급 수) |
| 2 답변 색인 | 「{라벨+조사} 우리 {total}쪽 중 **{now}쪽**을 읽었습니다」 (셋 중 제일 낮은 곳. 구글이·네이버가·빙이) | covDelta 「7일 전 {prev}쪽」+단어 (지금 코드 그대로: 어제 대 7일 전) | 없음(④ 차트) |
| 3 글 | 「최근 7일 글 **{n}편** · 목표 주 1편」 | posts.last7 「그 전 7일 {p}편 · 마지막 글 {k}일 전」+단어 | 0편이면 「초안 보러 가기 →」 /admin/drafts |
| 4 문의 | 「최근 30일 학원 문의 **{n}건**」 / `ever === 0` 「상담 기록이 아직 없습니다」 | inquiries.last30 「그 전 30일 {p}건」+단어 | unresolved>0 「결과 미입력 {u}건 →」 /admin/inquiry |

- 부제 한 줄만: 「어제까지 7일을 그 전 7일과 비교합니다. 문의는 30일.」
- `g === null` → 「성장 숫자를 못 읽었습니다 — {err}」. 조각 null → 그 카드만 「확인 못함」.
- `Spark` 재사용(높이 40). 카드당 최대 1개.
- 지운다: Tile·Mean·Do·NoVal·판정 줄·gr-pairs·gr-foot·gr-bars·`pairName` 과 안 쓰는 CSS.
- 「그 밖의 숫자」·표는 별도 export `GrowthMore` 로 나눠 page 가 ⑤ 안에 놓는다.

## 14a-1 · ④ 차트
- CoverageChart 그대로. 제목 「AI 가 답할 때 찾는 검색 색인 — 우리 쪽이 몇 쪽 들어갔나」, 한 줄 「구글·네이버·빙이 지금 있는 {total}쪽 중 한 번이라도 읽어 간 쪽 수. 착수부터 누적.」
- Brave(→Claude) 각주는 ⑤ 「숫자 읽는 법」으로.

## 14a-1 · ⑤ 자세히 (운영자용) — `<details>` 하나, 기본 닫힘
1. 숫자 읽는 법 — 카드별 2줄(뜻 · 좋아지려면). 엔진·방법 이름 없이
2. 그 밖의 숫자 — 한 줄씩: 지역·업종 검색 · 로봇 방문 7일(검색 색인/AI 학습, 중립이라 단어 없이 이전 값만) · 플레이스 최고 순위 · 사이티드 리드·무료 진단 30일 · 에이전트 실패 7일
3. 날짜별 커버리지 표 · 주별 요약 표
4. 크롤러 표 (사람 이름)
5. 최근 글 5편
6. 직원별 현황 (AgentBoard, 할 일·요약 뺀 것)
7. 오늘의 운영 기록 (Brief)

---

## 14a-2 · ② 에이전트 직원 — 지금 (실시간 줄)

### 행 7개 (역할 → 원천). 설정은 `web/lib/agents.ts` 의 ROLES 배열 하나에

| 행 | activity.agent / 구분 | 정해진 시각 (KST, `.github/workflows/*.yml` cron 에서 옮김) |
|---|---|---|
| 운영·감사관 | `ops`(회사 루프·점검·정찰) + `audit` | 회사 루프 매시 :23 · 점검 00·03·06·09·12·15·18·21시 :11 · 감사 06:35 · 정찰 06:37 |
| 수리공 | `repair` | 06:50 |
| 측정 | `measure` + `improve` | AI 답변 측정·판정 07:05 · 검색 노출 07:41 |
| 콘텐츠(글쓰기) | `content` 중 삽화 아닌 것 | 주간 초안 월 06:07 · 검토 일감은 회사 루프(매시) |
| 삽화 | `content` 중 일감 kind `illustrate` | 회사 루프(매시), 하루 6회 상한 |
| 유통(색인·네이버) | `deliver` | 색인 알림 03:23 · 원장 PC 12:40·19:10 (PC 가 켜져 있어야) |
| 영업 | `sales` | 월 08:10 |

- 삽화 구분: activity 에 task_id 가 있다. 새 쿼리에서 `left join geo.agent_tasks t on t.id = a.task_id` 로 kind 를 같이 읽는다.
- 회사 루프가 GitHub 실행 기록을 activity 로 옮겨 적는다(`company.mjs` 출근기록, action 「자동 작업 {이름}」, 최대 1시간 늦게). **페이지에서 GitHub API 를 부르지 않는다.** 옮긴 줄은 audit·repair 도 agent 가 `ops` 로 적혀 있으니 **action 이름으로 행을 가른다**(자동 작업 audit → 운영·감사관, 자동 작업 repair → 수리공, 자동 작업 optimize → 측정 …).
- 시각표는 상수. 파일 맨 위 주석 「yml 의 cron 을 바꾸면 여기도」. Richard 가 yml 과 대조한다. (어긋날 위험은 Known Gaps)

### 상태 (서버에서 판정, 위에서부터 먼저 맞는 것)

| 상태 | 조건 | 표시 |
|---|---|---|
| 확인 못함 (회색) | 쿼리 실패 | 「확인 못함」 — 정상으로 칠하지 않는다 |
| 꺼짐 (회색 고정) | 수리공: 가장 최근 repair 활동이 「스위치 꺼짐」 또는 geo.settings repair_paused=true | 「스위치 꺼짐 — 켜는 건 원장님」 / 「멈춤 — {이유}」 |
| 막힘·지연 (빨강 깜빡) | (a) 그 행의 가장 최근 활동이 실패이고 그 뒤 성공 없음 → 「막힘 — {요약 한 줄}」 (b) 정해진 시각 + 90분이 지났는데 그 시각 이후 활동 없음 → 「지연 — 06:35 예정이었는데 기록이 없습니다」 (c) 운영: 회사 루프 활동이 2시간 넘게 없음 | 빨강 + 이유 |
| 일하는 중 (맥동) | 그 행 일감 중 status 「실행 중」 이고 updated 30분 이내 | 「일하는 중 — {일감 제목}」 |
| 쉬는 중 (회색) | 정해진 시각이 없고(삽화) 24시간 활동·열린 일감 없음 | 「쉬는 중 — 할 일 없음」 |
| 정상 (숨쉬기) | 나머지 | 「정상」 |

- 지연 판정의 「정해진 시각」 = 오늘 KST 로 이미 지난 가장 최근 시각(요일 제한 반영). 매시 작업은 「2시간 무소식」 하나로.
- 옮겨 적기가 최대 1시간 늦으므로 grace 90분. 상수로 두고 주석.

### 한 행에 보이는 것 (390 에선 2줄, 1280 에선 1줄)
`[● 정상] 측정   14분 전 · 검색 노출 측정 성공   다음 07:41   오늘 3건 · 실패 0`

- 마지막 한 일 = 가장 최근 활동을 **쉬운 말로**. 「자동 작업 X」 → WORKFLOW_PLAIN {watch 사이트 점검 · scout 문제 정찰 · serp 검색 노출 측정 · snapshot 색인 알림 · write 주간 초안 작성 · optimize AI 답변 측정·판정 · audit 감사 · repair 수리 · sales 영업 주간 정리} + 「성공/실패」 (summary 의 「schedule · success」 류는 버린다). 그 밖 summary 는 `plain()` 로 URL·`geo.*`·7자 이상 16진 해시·`--옵션` 을 지우고 1줄 말줄임. `plain()` 전후 예시 5개를 REVIEW-REQUEST 에.
- 「n분 전」은 **클라이언트가 1분마다 다시 센다**(서버는 ISO 시각만 준다, 표시는 `timeZone: "Asia/Seoul"`).
- 오늘 건수 = 오늘(KST) 그 행 활동 성공/실패. **이중 계산 금지** — 스스로 활동을 적는 역할(audit·repair·sales·content·deliver·회사 루프 일감)은 옮긴 줄(자동 작업 *)을 세지 않되, 옮긴 줄이 실패면 실패로 센다. 스스로 안 적는 것(serp·optimize·watch·scout)은 옮긴 줄을 센다. ROLES 에 `countMirror` 로 명시.
- 섹션 머리에 한 번: 「오늘 Claude 사용 {n}회 / 하루 상한 {cap}」 — `geo.claude_calls` 오늘 KST 건수. cap 은 web env `CLAUDE_DAILY_MAX`; **없으면 상한을 쓰지 않고** 「오늘 Claude 사용 {n}회」만. (Vercel env 에 40 을 넣을 땐 CLAUDE.md 함정대로 파일로 넘기고 env pull 로 길이 확인)

### 실시간
- 새 `web/app/api/admin/agents/route.ts` (GET) — `isAdmin()` 쿠키 검사(api/pilots 선례), 실패 401. `readAgents(client)` JSON, no-store.
- 새 client 컴포넌트 `web/app/admin/ops/AgentStrip.tsx` — 서버가 준 첫 값으로 그리고 **45초마다** fetch. `document.hidden` 이면 쉬고, 다시 보이면 즉시 한 번. 실패하면 마지막 값 유지 + 머리에 「연결 끊김 · {n}분 전 값」.
- 마지막 활동 시각이 바뀐 행은 **잠깐 번쩍**(배경 --acc 12% → 1.8초에 사라짐).
- 섹션 머리: 「에이전트 직원 — 지금」 + 「45초마다 새로 봅니다 · 마지막 {HH:MM}」.

### 상태등 움직임 (원장 지시 「액티비티하게」)
- 점 = `<span class="lt">` 안에 전용 `<i class="ring">`. 애니메이션은 이 둘과 행 배경에만.
- 일하는 중: ring 이 퍼지며 사라지는 맥동(scale 1→2.2 + opacity .6→0, 1.6s 무한 — ring 전용 요소라 transform 충돌 없음) + 행 배경 옅은 흐르는 줄(`background-position` shimmer, 2.4s).
- 정상: 점 box-shadow 천천히 숨쉬기(3s, 0→6px --ok 35%).
- 막힘·지연: 빨강 점 opacity 깜빡(1.2s, 1→.35) + 이유 글자 빨강.
- 꺼짐·쉬는 중·확인 못함: 회색 고정.
- 점 옆에 **글자 라벨 항상**(일하는 중/정상/막힘/지연/꺼짐/쉬는 중/확인 못함). 색만으로 뜻 싣지 않는다.
- `@media (prefers-reduced-motion: reduce)` 에서 모든 animation·번쩍 끔 — 색과 글자만.

### 수리공 스위치를 화면이 알 수 있게 — `academy/scripts/repair.mjs` 한 줄
- REPAIR_ENABLED 는 GitHub 변수라 페이지가 못 읽는다. 628행 부근 「꺼짐 — 지난 수리 확인만」 분기의 return 전에 `활동(true, "스위치 꺼짐 — 지난 수리 확인만 했습니다")`. 685행 merge 거부 분기도 같은 문구. 다른 동작은 안 바꾼다.
- 첫 기록은 다음 06:50 실행. 그 전엔 수리공 행이 「정상」/「지연」으로 보일 수 있다 — REVIEW-REQUEST 에 적는다.

## 파일 (14a 전체)
- `web/app/admin/ops/page.tsx` — 순서 재배치. SLOTS·HUMAN·옛 KPI·covLow·안 쓰는 CSS 삭제. VENDOR_USE 는 자세히 표로(사람 이름 추가). 기본 16px, `.w` 920px.
- `web/app/admin/ops/Growth.tsx` — 카드 4장 + 차트 + `GrowthMore`.
- `web/app/admin/ops/Todo.tsx` · `AgentStrip.tsx` — 새 파일.
- `web/app/admin/ops/AgentBoard.tsx` — 할 일 목록·요약 카운트 제거.
- `web/lib/agents.ts` — 새 파일: ROLES · `readAgents(client)`(새 쿼리: 오늘 활동 집계 · 역할별 마지막 활동(task kind join) · 실행 중 일감 · repair_paused · claude_calls 오늘 수) · `plain()` · 판정 순수 함수 `judge(role, rows, now)`.
- `web/app/api/admin/agents/route.ts` — 새 파일.
- `academy/scripts/repair.mjs` — 활동 한 줄.
- 삭제: `Live.tsx`, `Flow.tsx`.
- `web/lib/ops.ts` — `firstSeen` 제거. 다른 필드는 grep 해서 소비처 0 인 것만. 모르면 남긴다.
- `web/lib/growth.ts` — 손대지 않는다.

## Out of Scope (14a)
- growth.ts 비교 로직, 일감 데이터 문구 수정, 웹소켓/SSE, 페이지의 GitHub API 호출, 라이트 테마, 다른 관리 화면(→14b)
- 수리공 스위치 켜기 (원장 몫 — 에이전트가 켜지 않는다)

## Acceptance (14a)
- 1280 첫 화면에 ①과 ② 전체. 390 첫 화면에 ①.
- 자세히 닫힌 상태 innerText 에 claude-code · openrouter · api- · geo. · vendor · microsoft · anthropic · % · .yml 0건 — Playwright 검사 결과를 REVIEW-REQUEST 에.
- 「검색에 처음 나온 날」 이 코드·화면 어디에도 없다.
- 카드·행 각각 3줄 이내(390). 가로 스크롤 0. 콘솔 오류 0.
- ②: 45초 폴링이 도는지 네트워크 로그(요청 2회 이상). 활동 시각이 바뀐 행에 flash 클래스가 붙는지 — 응답을 Playwright route 로 바꿔 끼워 흉내(**운영 DB 에 가짜 활동 넣지 않는다**). reduced-motion 에뮬레이션 스크린샷 1장. 로그아웃 상태 `/api/admin/agents` 401.
- 지연 판정: `judge()` 에 가짜 시각 3개(정시 전 · 정시+60분 · 정시+100분) → 정상/정상/지연 을 node 로 확인해 적는다.
- tsc: web/ 에서 `node ./node_modules/typescript/bin/tsc --noEmit` 0 (npx 금지 — `&` 경로 함정).
- 스크린샷: 로컬 next dev + 운영 DB, Playwright 1280·390 × robotncoding·ilog(`?c=`), 자세히 닫힘/열림. 관리자 키는 env 에서 읽어 쿠키로 넣고 **출력·로그·파일명에 절대 찍지 않는다.** 스크린샷은 scratchpad.
- Richard 통과 → `gh auth switch --user leeledger` → push → Vercel 배포 뒤 운영 `/admin/ops` 확인. repair.mjs 는 Actions 가 저장소에서 읽으니 push 로 끝.

---

# Step 14b — 나머지 관리 화면 (14a 배포 뒤)

## 먼저: 공통 한 벌
- `web/app/admin/admin.css` — 토큰(ops 어두운 판, 보조 글자 --ink2 이상) + 공통 클래스만: `.adm`(바탕·16px·폭 920) · `.adm-todo` · `.adm-card`(3줄) · `.adm-btn` · `.adm-more`(자세히 details) · `.adm-tw`(표 래퍼) · `.lt`(상태등, 14a 에서 옮김). 디자인 시스템 만들지 않는다.
- `web/app/admin/layout.tsx` — `import "./admin.css"` 만 (agent-board.css 선례).
- `web/app/admin/AdminNav.tsx` — 현황 · 초안 · 문의 · 리드 · 영업판 · 파일럿, 지금 페이지 표시. 로그인 화면엔 안 넣는다. ops 의 링크 줄을 이걸로 바꾼다.
- 각 페이지 `const CSS` 에서 공통으로 옮긴 건 **지운다**(복사본 금지). ops 토큰도 admin.css 로.
- 테마는 하나 — 어두운 판(결정됨). 밝은 페이지가 있으면 맞춘다.

## 페이지별 결정표 (이 순서로)

| 순서 | 페이지 | 맨 위 「지금 할 일」 | KEEP | 자세히로 접기 | 제거 |
|---|---|---|---|---|---|
| 1 | `/admin/inquiry` 문의 기록 | 「결과 미입력 N건」 줄마다 등록/안 함 (있는 액션) | 새 문의 입력 폼 | 「지금까지」 표 → 최근 10건 카드, 나머지 자세히. 요약 통계 → 한 줄 | 결정에 안 쓰이는 설명 문단 |
| 2 | `/admin/drafts` 초안 검토 | 「검토할 초안 N편」 — 제목 + 「사실 확인할 문장」 + 발행/버리기 | 사실 확인 문장, 도해 썸네일(작게) | AI 티 검사·짜임새: 통과면 자세히, 걸리면 한 줄 「AI 티 2곳 — 보기」. 되돌리기·도해 다시 요청 | — |
| 3 | `/admin` 리드 큐 | 「새로 연락할 사람 N명」 카드: 회사 · 연락처 · 관심/고민 한 줄 · 상태 버튼 | 상태 변경 액션 | 9칸 표 → 카드. 등급·진단 도메인·경로는 카드 안 details. 연락함 이후·종료는 「지난 연락」 자세히 | 모바일에서 깨지는 넓은 표 |
| 4 | `/admin/outreach` 영업판 | 「오늘 할 일 — 위에서 3곳」 그대로 맨 위 | 3곳 카드 | 나머지 7곳 | — |
| 5 | `/admin/pilots`, `/admin/pilots/[id]` | 목록: 진행 고객 먼저, 등록 폼은 자세히 / 상세: 「오늘 해야 할 일」 맨 위 | 오늘 할 일 | 목표 질문 20개·측정 원장·로컬 정합성·콘텐츠 승인 → 각각 details | — |
| 6 | `/admin/login` | — | 폼 | — | 공통 CSS 만 |

- pilots 두 파일은 한 줄로 압축돼 있다. 동작 변경 없이 풀어 쓰는 건 허용. 빈 상태 문구만 쉬운 말로.
- 서버 액션·폼 이름·필드는 안 바꾼다. 배치와 글자만.

## Out of Scope (14b)
- 액션·DB·인증 변경, 새 페이지, 공개 랜딩, 초안 편집기 기능

## Acceptance (14b)
- 각 페이지 390 첫 화면에 「지금 할 일」 또는 「없음」.
- `--bg:` 정의가 admin.css 한 곳(grep).
- 내부 이름 검사(14a 목록) 모든 관리 화면 0건.
- 폼: 버튼이 올바른 액션에 물려 있는지 코드로 확인하고 렌더만 본다. **운영 DB 에 가짜 데이터 넣지 않는다.**
- tsc 0 · Playwright 1280/390 페이지별 · 가로 스크롤 0 · 콘솔 오류 0 · Richard 통과 → push → 운영 확인.
