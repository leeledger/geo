# Architect Brief — Step 22 · 개선 루프 자기 점검 (넓이 · 정체 · 헛수고)

## 원장 (2026-09-29)

「AI 질문 기록에서 안 나옴이 너무 많고, 나온 것도 질문 범위가 좁은 것들에만 나오는 것 같다.
이런 문제를 스스로 진단하고 개선하는 노력을 에이전트가 하고 있는지 검증하고, 없다면 도입해」

## 검증 결과 (Arch, DB 에서 직접 잼 — 숫자는 전부 academy.ai_measurements·geo.agent_runs)

루프(`academy/scripts/daily-agent.mjs`, optimize.yml 매일 07:05)는 **있다.** 질문 하나씩 골라 글 재색인·초안을 한다.
그러나 **자기 점검이 없다.** 네 가지가 빠져 있다.

1. **적중이 좁은 질문에만 몰린 걸 모른다.** 9/22 이후 Claude(7회): 동네(q1~q8) 56건 중 이름 41 · 이름 질문(q18~20) 21건 중 21.
   일반 질문(q9~q17, problem·consider) 63건 **0**. ChatGPT·Gemini·Perplexity 화면 측정도 일반 질문 전부 0.
   루프는 질문을 한 개씩만 봐서 「9문항이 5곳 모두 0」이라는 구조를 진단에 한 번도 안 적었다.
2. **판정을 하나도 못 낸다.** 9/18 이후 행동 13건 중 효과 판정 0건(전부 「판정 전」 또는 「취소」).
   원인: 판정은 같은 엔진 전 5건·후 5건이 필요한데, 9/22 에 측정 엔진이 openrouter → claude-code-web 로 바뀌어
   전(前) 창에 같은 엔진이 없다. 35일 뒤 「표본 부족」으로 닫힐 때까지 사다리(content → offsite)가 안 움직인다.
3. **같은 처방을 되풀이한다.** 일반 질문 7개(q9·10·11·12·13·14·16)에 「글 고치기·재색인」을 했고 그 뒤 적중 0.
   Claude 가 일반 질문에서 받아 본 검색 결과(citations)에 robotncoding.com 이 **한 번도 없다** — 글을 고쳐도 검색 결과에 안 뜨니 못 읽는다.
   9/24 에 이미 원인(Brave 색인에 글이 없음)을 찾았고 원장이 Brave 제출(579)을 끝냈는데, 그 뒤 **아무도 다시 확인하지 않았다.**
4. **넓이를 재지 않는다.** 승인 질문 20개는 고정이다. 동네 질문이 맞는다는 건 「석촌·가락·헬리오시티」 반경에서만 안다.
   「송파 전체」「서울」「동네 없이」로 넓히면 어디서 빠지는지 재는 질문이 없다.

## 결정 (Bob 은 여기서 고르지 않는다)

- **D1. 자기 점검은 LLM 없이 DB 숫자로만.** 지어낼 자리를 안 만든다. 문장틀에 숫자를 넣는다. 사람 말로(메모리 dashboard-plain-words).
- **D2. 곳(collection_method)이 다르면 비율을 합치지 않는다.** 점검 문장도 곳별로 따로 쓴다. 「효과 있음」은 지금처럼 같은 엔진 전후 5건 이상에서만.
- **D3. 「효과 없음」은 기준선 없이도 낸다.** 같은 엔진으로 후 5건 이상이 **전부 0** 이면 오른 게 없으니 「효과 없음」. 영업 숫자로 가는 「효과 있음」과 달리 부풀릴 위험이 없다. note 에 「전 비교 없음 — 후 0/N」 을 그대로 적는다.
- **D4. 헛수고 차단.** 한 단계(stage)에서 최근 21일 content 행동이 3건 이상인데, 그 단계 질문들의 citations 에 우리 도메인이 한 번도 없으면
  그 단계는 **content 를 건너뛴다**(글 문제가 아니라 검색 결과에 안 뜨는 문제). 대신 「발견성」 일감을 만든다(D5).
- **D5. 발견성 일감은 원장 PC 가 확인한다.** Brave 는 curl 을 막아 GitHub 러너에서 못 본다. `geo.agent_tasks` 에 kind `brave-index-check`,
  status 「로컬 대기」, dedupe_key `brave-index-<stage>`, payload `{ slugs: [...] }`(그 단계 질문에 맞는 발행 글 — 기존 겹침() 0.4 이상).
  `tools/local-agent.mjs` 가 집어 `tools/brave-index-check.mjs <slug...>` 를 돌리고 결과(들어간 글 / 없는 글)를 evidence 에 적는다.
  없는 글이 있으면 같은 일감을 「사람 대기」로 올리고 detail 에 `node tools/brave-submit.mjs <slug...>` 한 줄(캡차는 사람 — 우회 금지).
  다 들어 있으면 「완료」 + evidence 「Brave 에 다 있음 — 원인이 색인이 아니다」. 7일에 한 번 이상 다시 만들지 않는다(done_at 기준).
  brave-submit.mjs 가 slug 인자를 받는지 Bob 이 확인하고, 안 받으면 detail 에 실제로 되는 명령을 적는다(지어내지 않는다).
- **D6. 넓힘 탐침(probe).** 승인 질문은 건드리지 않는다(기준선이 바뀐다). 새 표 `academy.ai_probe_questions`:
  `id serial, client_id int, prompt_id text, source_prompt text, radius text, text text, created_on date default current_date, active bool default true, unique(client_id, prompt_id)`.
  - 만드는 곳: daily-agent 자기 점검. 반경 사다리 `동네 → 송파 → 서울 → 없음`.
    동네 말(석촌호수·석촌동·석촌·가락동·헬리오시티·잠실) → 「송파」, 「서울 송파구」·「송파구」·「송파」 → 「서울」, 「서울」 → 삭제.
    치환 뒤 공백·조사 앞 공백을 정리한다. 바뀐 게 없거나 이미 있는 글이면 안 만든다.
  - **한 칸씩만 넓힌다.** 출발 질문(승인 q1~q8 또는 앞 칸 탐침)이 claude-code-headless-websearch 최근 7일 적중 50% 이상일 때만 다음 반경을 만든다.
    같은 질문이 계속 맞으면 다음 날 또 한 칸 넓어진다 → 어디서 빠지는지가 자동으로 나온다.
  - 하루 새로 만드는 건 최대 2개. prompt_id 는 `p1`, `p2`… stage 는 `probe`.
  - 적중 계산에 쓰지 않는다(daily-agent 의 표·후보는 승인 질문만 — 지금 코드가 이미 그렇다. 유지).
- **D7. 탐침 측정은 ai-measure.mjs 의 claude-code-web 엔진만, 하루 최대 `MEASURE_PROBES_PER_DAY`(기본 2)개.**
  승인 20문항을 다 잰 뒤에만, 시작 후 35분이 지났으면 건너뛴다(optimize.yml 제한 50분). 가장 오래 안 잰 탐침부터.
  표가 없으면(`to_regclass`) 조용히 건너뛴다. 같은 ai_measurements 에 prompt_id `p*`, stage `probe` 로 넣는다.
  주기(MEASURE_EVERY_DAYS)로 건너뛰는 날은 탐침도 건너뛴다.
- **D8. 점검 결과를 남기고 보인다.**
  - `geo.agent_runs.facts.selfcheck` = `[{ code, title, evidence, action }]` (code: narrow · stalled · repeat · discover · widen).
  - 진단(diagnosis) 맨 앞에 한 줄 요약 「자기 점검: …」 (가장 무거운 것 하나, 80자 안).
  - 오늘 행동이 이미 있어 일찍 끝나는 길에서도 점검은 돌고 facts 에 합친다(`facts = facts || jsonb`).
  - `/admin/ops` 개선 루프 카드에 「루프가 스스로 찾은 문제」 목록(title + evidence 한 줄). 로그 조각 금지, 사람 말.
  - `--review` 플래그: 점검만 찍고 끝(DB 안 씀). `--dry` 도 점검을 찍는다.

## 추가 (원장, 2026-09-29 16:37 스크린샷)

구글 AI 모드에 「송파구 코딩학원 추천」 → 로봇&코딩학원이 **두 번째** 카드(첫째 디랩 코딩학원 잠실캠퍼스). 원장 손 확인 1회.
원장: 「이렇게 보통 사람들이 검색하는 문장에 나와야 좋다」. 승인 20문항은 전부 대화체 문장이라 이런 **검색어형**을 안 잰다.

- **D9. 검색어형 탐침.** 탐침(D6)을 두 모양으로 만든다 — `form` 열 추가(`sentence` | `keyword`).
  - keyword 는 짧은 검색어: `{반경} 코딩학원 추천` · `{반경} 초등 코딩학원` · `{반경} 로봇코딩학원` (반경 = 석촌동·송파구·잠실·서울, 「없음」이면 반경 말 빼고).
    틀은 이 셋만. 새로 지어내지 않는다.
  - 첫날 씨앗: 반경 `송파구` 의 keyword 3개는 적중과 상관없이 바로 만든다(원장이 직접 본 질문이라 기준점이 필요하다). 그다음 넓힘은 D6 규칙(50% 이상일 때 한 칸).
  - 하루 새로 만드는 한도(D6 의 2개)에 씨앗 3개는 안 센다.
- **D10. 구글 AI 모드 화면 측정.** `tools/ai-web-measure.mjs` 에 엔진 하나 추가: 로그아웃 구글 AI 모드
  (`https://www.google.com/search?udm=50&q=...` — 동작하는지 Bob 이 실제로 한 번 열어 확인. 안 되면 되는 주소를 찾아 적고, 끝내 안 되면 멈추고 Known Gap).
  collection_method `google-ai-mode-web-logged-out`, engine `google-ai-mode`. 재는 것은 **keyword 탐침만**(승인 20문항 아님 — 하루 60질의 한도·문항 사이 4~8초 유지, Step 21 ToS 결정 그대로: 자동화 표시 숨기지 않음, 캡차·차단이면 그날 그 엔진 멈춤).
  - 이름: 답 본문과 장소 카드에 이름이 있으면 mentioned. 몇 번째 카드인지 `raw.rank`(1부터, 없으면 null)에 적는다 — 「두 번째」가 원장이 본 숫자다.
  - 인용: 답에 달린 출처 링크 중 우리 도메인. 카드의 「웹사이트」 버튼 링크는 인용으로 세지 않는다(raw.place_site 로 따로).
  - web/lib/asks.ts `whereOf` 에 「구글 AI 모드 화면 · 로그아웃」이 나오게 engineName 확인.
- 자기 점검 widen evidence 에 모양별(문장/검색어)로 따로 적는다. 곳끼리 합치지 않는다(D2).

## 짓는 순서

### 1. `academy/scripts/loop-review.mjs` (새 파일, 순수 함수)
`export function 자기점검({ questions, rows, runs, posts, today, domain })` → `{ findings, skipContent: Set<stage>, probes: [{source_prompt, radius, text}] }`.
- rows 는 daily-agent 가 읽는 것보다 넓게: 최근 21일, 자동 측정 전부(`api-%`, `claude-code-headless-%`, `%-web-logged-out`), collection_method 포함.
  daily-agent 의 기존 rows 쿼리는 바꾸지 말고 점검용 쿼리를 따로 둔다(판정 로직에 화면 측정이 섞이면 안 된다).
- 적중 정의는 daily-agent 의 `적중` 과 같게(brand 는 인용 또는 「석촌」). 함수로 받아 쓴다.
- narrow: 단계별·곳별 hit/n. 한 단계가 곳마다 n≥10 이고 전부 0, 다른 단계는 hit>0 이면 finding.
  evidence 예: 「일반 질문 9개 — Claude 0/63 · ChatGPT 0/18 · Gemini 0/18 · Perplexity 0/18 (14일). 동네 질문 Claude 41/56」
- stalled: 완료 · 판정 전 · effective_on ≤ today-14 인 행동 수.
- repeat + discover: D4. 우리 도메인이 그 단계 citations 에 나온 횟수(인용 판정이 아니라 받아 본 결과 전체).
- widen: D6. 기존 탐침과 그 결과(rows 의 p*)를 받아 반경별 hit/n 을 evidence 로 — 「동네 q2 6/7 → 송파 p1 3/4 → 서울 p3 0/2」.

### 2. `academy/scripts/daily-agent.mjs`
- 판정: D3 규칙 추가(고른 게 없을 때, 후 5건 이상 전부 0 인 엔진이 있으면 「효과 없음」).
- 점검 호출 → facts.selfcheck, diagnosis 앞 한 줄, skipContent 단계는 사다리에서 content 건너뜀,
  discover 일감 upsert(D5), 탐침 insert(D6, 표 create if not exists). `--dry`/`--review` 면 DB 안 씀.
- 일찍 끝나는 길(오늘 행동 있음)에서도 점검 facts 병합.

### 3. `academy/scripts/ai-measure.mjs` — D7.

### 4. `tools/local-agent.mjs` — D5 핸들러. brave-index-check.mjs 출력 모양을 읽고 맞춘다.

### 5. `web/lib/ops.ts` + `/admin/ops` 카드 — D8 목록.

## 확인 (Bob 이 REVIEW-REQUEST 에 출력 붙이기)
- `node academy/scripts/daily-agent.mjs --review` 실제 DB 로: narrow·stalled·repeat/discover·widen 이 위 검증 숫자와 맞는지.
- `--dry` 로 판정: 9/18 q9 행동이 D3 로 「효과 없음」이 되는지(찍기만).
- `node academy/scripts/ai-measure.mjs --engine claude-code-web --limit 0` 은 돌리지 말 것(구독 한도). 탐침 선택 로직은 dry 출력이나 작은 단위 확인으로.
- web: `node ./node_modules/typescript/bin/tsc --noEmit` (npx 금지 — 경로의 &).

## 하지 않는 것
- 승인 질문을 바꾸거나 늘리지 않는다. 탐침은 따로.
- Brave 캡차를 풀지 않는다.
- 탐침 결과로 「효과 있음」을 내지 않는다. 탐침은 반경을 재는 것뿐.
