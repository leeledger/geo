# Review Request — Step 22 · 개선 루프 자기 점검 (넓이 · 정체 · 헛수고) + D9 검색어형 탐침
Date: 2026-09-29
Ready for Review: YES

커밋·푸시·배포·DB 쓰기 없음. daily-agent 는 `--review`·`--dry` 로만 돌렸다. ai-measure 로 Claude 측정은 안 돌렸다.

## Files Changed
- academy/scripts/loop-review.mjs (새 파일, 255줄) — 순수 함수 `자기점검()`·`점검요약()`·`넓히기()`·`검색어넓히기()`·`겹침()`. DB 를 건드리지 않는다
- academy/scripts/daily-agent.mjs:24 — loop-review 가져오기. 로컬 `두글자/겹침` 은 loop-review 로 옮겨 지웠다(같은 코드)
- academy/scripts/daily-agent.mjs:29-30 — `--review` (DRY 를 포함)
- academy/scripts/daily-agent.mjs:115-126 — 점검용 rows(21일, `api-%`·`claude-code-headless-%`·`%-web-logged-out`, collection_method 포함)와 탐침 표(to_regclass 로 없으면 []). 판정용 rows 쿼리는 그대로
- academy/scripts/daily-agent.mjs:201-215 — D3: 같은 엔진 전후가 없고, 후 5건 이상인 엔진이 있고, 후 전체에 적중이 하나도 없으면 「효과 없음」, note `<엔진> 전 비교 없음 — 후 0/N`
- academy/scripts/daily-agent.mjs:240-258 — 점검 호출, 발견성 일감 상태 읽기(열려 있음/7일 안에 끝남이면 안 만듦), 진단 앞 한 줄
- academy/scripts/daily-agent.mjs:259-262 — facts.selfcheck, 저장() 이 diagnosis 앞에 「자기 점검: …」 줄을 붙임
- academy/scripts/daily-agent.mjs:280-326 — 점검 출력 → `--review` 면 끝 → (DRY 아니면) 일감 upsert·탐침 표 create·insert → 오늘 행동이 이미 있으면 `facts = facts || {selfcheck}` 병합 후 끝
- academy/scripts/daily-agent.mjs:365-366 — skipContent 단계는 사다리에서 content 건너뜀
- academy/scripts/ai-measure.mjs:36-39, 248-266, 355-395 — D7 탐침 측정. `적재()` 로 insert 를 한 곳에 모음(승인·탐침 같은 모양). 오늘 잰 문항 집합(done)은 `prompt_id like 'q%'` 로 좁힘 — 안 그러면 재실행 때 탐침이 20문항 완료 판정·요약 숫자에 섞인다
- tools/local-agent.mjs:9, 157-186 — D5 핸들러 `brave-index-check`
- web/lib/ops.ts:72-73, 226, 323, 333-335 — agentLoop.selfcheck (최근 행의 facts.selfcheck)
- web/app/admin/ops/AgentBoard.tsx:133-137 · agent-board.css:20-23 — 개선 담당 카드에 「루프가 스스로 찾은 문제」 목록(제목 + 근거 한 줄)

## 결정별로 어떻게 했나
- **D1** 점검은 LLM 없이 DB 숫자를 문장틀에 넣는다. findings = `{code,title,evidence,action}`
- **D2** 곳(collection_method)별로 `곳 h/n` 을 따로 쓴다. 합친 비율은 없다. 곳 이름표: Claude·ChatGPT·Gemini·Perplexity·OpenRouter(모르는 방법은 방법 이름 그대로)
- **D3** 위 daily-agent:201-215. 「효과 있음」 규칙은 안 건드렸다
- **D4** 묶음(아래 판단 1)마다 최근 21일 `action_kind=content`·`status=완료` 행동 ≥3 이고, 21일 측정 전부(곳 불문)의 citations 에 우리 도메인이 0번이면 → repeat + discover finding, 그 묶음의 stage 전부 skipContent
- **D5** 일감 `kind=brave-index-check`, `status=로컬 대기`, `dedupe_key=brave-index-general`, agent `deliver`, priority 20, payload `{sticky:true, group, slugs}`. slugs = 발행·비공개 아님 글 중 그 묶음 질문과 겹침 ≥0.4.
  on conflict 는 기존이 `완료/닫힘` 이고 done_at 이 7일 넘었을 때만 다시 연다. 열려 있거나 7일 안에 끝났으면 만들지 않고 finding.action 에 그 사실을 붙인다.
  local-agent: `brave-index-check.mjs <slug...>` 출력의 `있음|없음  <url>` 줄을 센다. 줄 수가 slug 수와 다르면 실패로 attempts+1·last_error, 상태 유지.
  없는 글이 있으면 `사람 대기` + detail `node tools/brave-submit.mjs https://robotncoding.com/blog/<slug> …` — **brave-submit.mjs 는 slug 를 안 받고 전체 주소를 받는다**(`/^https?:\/\//` 로 거름). 그래서 주소로 적었다. 다 있으면 `완료` + evidence 「Brave 에 다 있음 — 원인이 색인이 아니다」
- **D6** 표 `academy.ai_probe_questions`(설계서 열 + D9 `form text not null default 'sentence'`). 반경 사다리·치환·조사 정리는 loop-review `넓히기()`. q1~q8 전부 확인한 결과:
  q1 「서울 송파구에서…」→ 서울 「서울에서 초등학생…」→ 없음 「초등학생 코딩학원 좀 추천해줘」 · q4 「잠실이나 송파 쪽에…」→ 송파 「송파 쪽에…」(겹친 말 합침) → 서울 → 「파이썬 가르치는 초등 학원 알려줘」. 나머지 6개도 어색한 조사 없이 나옴.
  출발 = 활성 탐침 먼저, 그다음 승인 local 질문. Claude(claude-code-headless-websearch) 최근 7일 적중 ≥50% **그리고 n≥2**. 자식이 이미 있는 출발은 건너뜀(한 칸씩). 하루 새로 2개(오늘 만든 비씨앗 수를 뺌). prompt_id `p<max+1>`
- **D7** ai-measure: claude-code-web 이 승인 20문항을 오늘 다 쟀을 때만(`done.size + ok === 20`), `--limit` 없을 때만, 시작 35분 안에서만, 표가 있을 때만. 주기 건너뛰는 날은 그 앞의 `continue` 로 탐침도 건너뜀. 가장 오래 안 잰 것부터(`order by last_day nulls first`), 오늘 잰 탐침 수만큼 한도에서 뺌. `MEASURE_PROBES_PER_DAY`(기본 2, 0 이면 끔)
- **D8** facts.selfcheck · 진단 첫 줄 · 일찍 끝나는 길 병합 · 카드 목록 · `--review`/`--dry` 출력 모두 함. 요약 줄 무게 순서: repeat > narrow > stalled > discover > widen, 80자 넘으면 자름
- **D9** `form` 열. 틀 3개(`코딩학원 추천`·`초등 코딩학원`·`로봇코딩학원`) 밖의 글은 안 만든다. 검색어 사다리 석촌동·잠실 → 송파구 → 서울 → 없음. 송파구 씨앗 3개는 적중과 무관하게 한 번 만들고 하루 한도에 안 센다(씨앗 = source_prompt null). widen evidence 는 `문장 · Claude 7일: …` 과 `검색어 · <곳> 7일: …` 을 곳마다 따로
- **D10 짓지 않음 — Known Gap KG-22-1.** 실제로 열어 봄(로그아웃 Playwright, 자동화 표시 안 숨김):
  1) `https://www.google.com/search?udm=50&hl=ko&q=송파구 코딩학원 추천` 직접 → `google.com/sorry` 「비정상적인 트래픽」 캡차.
  2) `https://www.google.com/aimode?hl=ko` → 캡차 없이 열림(입력칸 `textarea[aria-label=무엇이든 물어보세요]`), 입력·Enter 하면 `search?aep=11&udm=50&q=…` 로 가는데 답이 130초 넘게 「…」 에서 안 나옴. 화면 밖 창·화면 안 창 둘 다 같음. HTML 에도 답 글이 없음.
  → 로그아웃 자동 브라우저에는 답을 안 준다. 우회 안 함. `tools/ai-web-measure.mjs`·`web/lib/asks.ts` 는 안 건드렸다. loop-review 곳 이름표에 `google-ai-mode-web-logged-out → 구글 AI 모드` 한 줄만 넣어 둠(데이터가 생기면 쓰임)

## 확인 출력
`node academy/scripts/daily-agent.mjs --review` (실제 DB, 쓰기 없음)
```
로봇&코딩학원 · 2026-09-29
  최근 7일 자동 측정 적중 58/120 · 측정된 질문 20/20
  오늘: claude-code-web 10/20
  판정·후속: q9 content 판정: 효과 없음 · claude-code-web 전 비교 없음 — 후 0/5

자기 점검 4건 · 글 고치기 건너뛰는 단계: problem, consider
  [narrow] 일반 질문 9개는 어느 AI 에도 안 나옵니다
      근거: 일반 질문 9개 — Claude 0/63 · ChatGPT 0/18 · Perplexity 0/18 · Gemini 0/18 · OpenRouter 0/12 (14일). 동네 질문 Claude 41/56 · 이름 질문 Claude 18/21
  [repeat] 일반 질문에 글 고치기·재색인을 7번 했는데 오른 게 없습니다
      근거: q9·q12·q14·q10·q11·q13·q16 · 21일 동안 content 7건 · 같은 기간 적중 Claude 0/63 · ChatGPT 0/18 · Perplexity 0/18 · Gemini 0/18 · OpenRouter 0/12
  [discover] 일반 질문의 글이 AI 검색 결과에 안 뜹니다
      근거: 측정 129건에서 AI 가 받아 본 검색 결과에 robotncoding.com 이 0번 — 글을 고쳐도 못 읽습니다 · 맞는 발행 글 5편
  [widen] 동네 질문을 한 칸씩 넓혀 어디서 빠지는지 잽니다
      근거: 아직 잰 탐침 없음 · 오늘 새로: 씨앗 송파구「송파구 코딩학원 추천」, 씨앗 송파구「송파구 초등 코딩학원」, 씨앗 송파구「송파구 로봇코딩학원」, q1→서울「서울에서 초등학생 코딩학원 좀 추천해줘」, q2→송파「송파 근처에 로봇이랑 코딩 같이 배울 수 있는 학원 있어?」
  → 자기 점검: 일반 질문에 글 고치기·재색인을 7번 했는데 오른 게 없습니다 (외 3건)
  (dry) 발견성 일감 brave-index-general: ai-sidae-koding-baeul-piryo, aiga-sukjereul-haetdamyeon, beullogeseo-paisseoneuro, hagweoneseo-mueoseul-baewossna, koding-myeot-hangnyeonbuteo
  (dry) 탐침 keyword 씨앗 송파구「송파구 코딩학원 추천」 (… 3개) · sentence q1 → 서울 · sentence q2 → 송파
```
(「할 일」 줄은 줄였다.)

설계서 숫자와 대조:
| 설계서 | 출력 | |
|---|---|---|
| Claude 일반 63건 중 0 | Claude 0/63 | 맞음 |
| ChatGPT·Gemini·Perplexity 일반 전부 0 | 각 0/18 | 맞음 (+OpenRouter 0/12 — 14일 창에 9/17·18 이 들어옴) |
| 동네 56건 중 이름 41 | 동네 Claude 41/56 | 맞음 |
| 이름 질문 21건 중 21 | 이름 Claude **18/21** | 다름 — 설계서는 「언급」으로 셌고, 점검은 설계서 지시대로 daily-agent 적중(brand 는 인용 또는 「석촌」)을 쓴다. 21 중 3건은 이름만 따라 말함 |
| 일반 질문 7개(q9·10·11·12·13·14·16)에 content | q9·q12·q14·q10·q11·q13·q16, 7건 | 맞음 |
| 일반 질문 citations 에 robotncoding.com 0 | 129건 중 0 (21일, 5곳) | 맞음 |
| 행동 13건 중 판정 0 → stalled | **stalled 0건 (안 뜸)** | 규칙 `effective_on ≤ 오늘-14` 에 걸리는 게 없다. 가장 오랜 완료 q9 가 9/18(11일 전). 설계서 규칙을 그대로 뒀다 — 아래 질문 2 |

`--dry` (오늘 행동이 이미 있어 일찍 끝나는 길): 판정 줄 `q9 content 판정: 효과 없음 · claude-code-web 전 비교 없음 — 후 0/5` (q9 claude 후 창 9/25·26·27·28·29 = 5건 전부 0) — D3 확인. 끝줄 `오늘(2026-09-29) 행동은 이미 기록돼 있습니다 — content · 완료`.

사다리 길 확인: 복사본에서 todayRun 을 비우고 `--dry` (복사본은 지웠다):
```
진단: 자기 점검: 일반 질문에 글 고치기·재색인을 7번 했는데 오른 게 없습니다 (외 3건)
q9「초등학교 몇 학년부터 코딩 배우는 게 좋아?」 최근 7일 적중 0/6 (problem) · …
행동: 사이트 글로는 안 움직였습니다. AI 가 대신 읽는 곳에 학원 정보가 실리게 합니다: scratch.mit.edu, apps.apple.com, codingworldnews.com, solvecompass.com, kkddhh123456.tistory.com
상태: 사람 대기
```
→ D3 로 닫힌 q9 가 후보가 되고, content 는 skipContent 로 건너뛰어 offsite 로 간다.

탐침 고르기 SQL(D7): 롤백되는 트랜잭션 안에서 임시로 표·측정 행을 넣고 확인. `한도 2: [p4(안 잼), p1(가장 오래)]` — 비활성 p3 빠짐, 어제 잰 p2 뒤로. p4 를 오늘 잰 뒤 `[p1]`(한도 1 남음). 롤백 뒤 `to_regclass` null — 남은 것 없음.

검색어 넓힘 단위 확인: `검색어넓히기({송파구 코딩학원 추천}) → 서울 코딩학원 추천`, `서울 로봇코딩학원 → 로봇코딩학원`, `없음 → null`. 가짜 행으로 문장·검색어 사슬과 곳별 줄이 따로 찍히는 것 확인.

tsc: `web/ node ./node_modules/typescript/bin/tsc --noEmit` → 종료 0, 출력 없음. `node --check` 로 mjs 넷 통과.

## Open Questions
1. **「일반 질문」 묶음.** 설계서는 단계(stage)별이라 했지만 숫자(9개·63건·7건)는 problem+consider 를 합친 것이다. `묶음 = {local, brand, general(problem+consider)}` 로 셌다. 단계별로 나누면 consider 는 content 2건뿐이라 D4 가 안 걸린다.
2. **stalled 가 오늘은 안 뜬다.** 규칙대로면 14일 넘은 완료·판정 전 행동이 없다. 설계서 문제 2(판정 0건)는 D3 가 q9 를 닫아서 해결된다. 기준을 `오늘-7`(후 창이 열린 뒤)로 내릴지는 Arch 판단.
3. **넓힘 조건 n≥2.** 설계서는 「50% 이상」만 있다. 1/1 로 넓히지 않게 n≥2 를 붙였다. 검색어 탐침도 D6 대로 **Claude 적중**으로만 넓힌다(구글 AI 모드는 못 재니 지금은 차이 없음).
4. **brave-index 「사람 대기」 뒤 길이 없다(KG-22-2).** 원장이 제출해도 일감은 사람 대기에 머문다. done_at 이 없어 7일 재생성도 안 된다. 원장이 닫거나, local-agent 가 사람 대기 일감도 며칠 뒤 다시 확인하게 할지 결정 필요.
5. 발견성 일감 agent 를 `deliver`(유통 담당)로 뒀다. 카드에서 「PC 에서 할 일」로 보인다. `improve` 가 맞으면 한 글자 바꾸면 된다.
6. 요약 줄 무게 순서(repeat 를 가장 무겁게)는 내가 정했다.

## Out of Scope (Known Gaps, BUILD-LOG 에 적음)
- KG-22-1 구글 AI 모드 로그아웃 자동 측정 불가(위 D10). 원장 손 확인(「송파구 코딩학원 추천」 두 번째 카드)은 사람 측정으로만 남길 수 있다
- KG-22-2 위 질문 4
- KG-22-3 위 질문 2
- 확인 중 구글 `/sorry` 캡차가 1번 떴다(9/29 16:40 KST, IP 58.29.236.171). 그 뒤로는 직접 search 주소를 안 열었다. 원장 PC 브라우저에서 한동안 구글이 캡차를 물을 수 있다

## 추가 반영 (Arch 결정, 2026-09-29)
1. **stalled 기준 `effective_on ≤ 오늘-10`** — academy/scripts/loop-review.mjs:9, 147-152 (주석·제목 「10일」). 오늘 걸리는 건 q9(9/18) 하나다.
   그런데 점검은 판정 뒤에 돌고, 같은 실행에서 D3 가 q9 를 「효과 없음」으로 먼저 닫는다. 그래서 오늘 `--review` 에는 stalled 가 안 뜬다(정상 — 닫힌 걸 멈춤으로 세지 않는다). q12(9/20)는 내일부터 대상이 된다.
2. **KG-22-2 해결** — tools/local-agent.mjs:160-164. brave-index-check 일감이 `사람 대기`로 `updated_at` 7일을 넘기면 `로컬 대기`로 되돌린다. evidence 에는 「<날짜> 사람 대기 7일 — 다시 확인」을 붙인다. 바로 아래 루프가 같은 실행에서 다시 확인한다. 다 들었으면 `완료`, 아직 없으면 다시 `사람 대기`로 돌아가고 7일 시계가 새로 돈다.

`node academy/scripts/daily-agent.mjs --review` 다시 찍음 (쓰기 없음, 종료 0):
```
로봇&코딩학원 · 2026-09-29
  최근 7일 자동 측정 적중 58/120 · 측정된 질문 20/20
  오늘: claude-code-web 10/20
  판정·후속: q9 content 판정: 효과 없음 · claude-code-web 전 비교 없음 — 후 0/5

자기 점검 4건 · 글 고치기 건너뛰는 단계: problem, consider
  [narrow] 일반 질문 9개는 어느 AI 에도 안 나옵니다
      근거: 일반 질문 9개 — Claude 0/63 · ChatGPT 0/18 · Perplexity 0/18 · Gemini 0/18 · OpenRouter 0/12 (14일). 동네 질문 Claude 41/56 · 이름 질문 Claude 18/21
      할 일: 질문 하나씩 고치지 않고 묶음 전체의 원인(검색 결과에 뜨는지)부터 봅니다.
  [repeat] 일반 질문에 글 고치기·재색인을 7번 했는데 오른 게 없습니다
      근거: q9·q12·q14·q10·q11·q13·q16 · 21일 동안 content 7건 · 같은 기간 적중 Claude 0/63 · ChatGPT 0/18 · Perplexity 0/18 · Gemini 0/18 · OpenRouter 0/12
      할 일: 일반 질문은 글 고치기를 건너뛰고 다음 칸(바깥 지면)으로 넘어갑니다.
  [discover] 일반 질문의 글이 AI 검색 결과에 안 뜹니다
      근거: 측정 129건에서 AI 가 받아 본 검색 결과에 robotncoding.com 이 0번 — 글을 고쳐도 못 읽습니다 · 맞는 발행 글 5편
      할 일: 원장 PC 가 이 글 5편이 Brave 색인에 있는지 확인합니다(Claude 검색이 Brave 를 씁니다).
  [widen] 동네 질문을 한 칸씩 넓혀 어디서 빠지는지 잽니다
      근거: 아직 잰 탐침 없음 · 오늘 새로: 씨앗 송파구「송파구 코딩학원 추천」, 씨앗 송파구「송파구 초등 코딩학원」, 씨앗 송파구「송파구 로봇코딩학원」, q1→서울「서울에서 초등학생 코딩학원 좀 추천해줘」, q2→송파「송파 근처에 로봇이랑 코딩 같이 배울 수 있는 학원 있어?」
      할 일: 탐침은 하루 2개까지 Claude 로만 잽니다(검색어 씨앗 3개는 한도 밖). 적중률 계산·효과 판정에는 쓰지 않습니다.
  → 자기 점검: 일반 질문에 글 고치기·재색인을 7번 했는데 오른 게 없습니다 (외 3건)
  (dry) 발견성 일감 brave-index-general: ai-sidae-koding-baeul-piryo, aiga-sukjereul-haetdamyeon, beullogeseo-paisseoneuro, hagweoneseo-mueoseul-baewossna, koding-myeot-hangnyeonbuteo
  (dry) 탐침 keyword 씨앗 송파구「송파구 코딩학원 추천」
  (dry) 탐침 keyword 씨앗 송파구「송파구 초등 코딩학원」
  (dry) 탐침 keyword 씨앗 송파구「송파구 로봇코딩학원」
  (dry) 탐침 sentence q1 → 서울「서울에서 초등학생 코딩학원 좀 추천해줘」
  (dry) 탐침 sentence q2 → 송파「송파 근처에 로봇이랑 코딩 같이 배울 수 있는 학원 있어?」
```
Known Gaps 수정: KG-22-2·KG-22-3 닫힘. KG-22-1(D10 구글 AI 모드)은 그대로.

## 2차 반영 (Richard REVIEW-FEEDBACK + Arch 결정, 2026-09-29)
Ready for Review: YES

### Must Fix
1. **[치명] 탐침 측정은 따로 표에 넣는다** (Arch: 가)
   - academy/scripts/ai-measure.mjs:250-270 — `적재()` 는 `x.form` 이 있으면(탐침) `academy.ai_probe_measurements` 에 넣는다. 열은 ai_measurements 와 같고 `form`·`radius` 가 더 있다. **ai_measurements 에는 p* 가 들어갈 길이 없다.**
   - :362-400 — 탐침 블록. 새 표 create if not exists, 고르기·오늘 잰 수도 새 표에서 센다. 1차에 넣었던 `prompt_id like 'q%'`(:~290)는 필요 없어져 원래대로 돌렸다
   - academy/scripts/daily-agent.mjs:115-129 — 점검rows 는 ai_measurements 에 `union all` 로 ai_probe_measurements 를 붙인다(표가 있을 때만). 판정용 `rows`·`엔진별`·facts.engines 는 ai_measurements 만 본다 → 영업 숫자에 안 섞인다
   - web/lib/asks.ts:148-186 `readProbeGrid()` 추가(기존 함수는 안 건드림). 줄은 탐침 × 곳이고, 안 잰 탐침도 「아직 안 잼」으로 보인다. 표가 없으면 null
   - web/app/admin/asks/page.tsx — 맨 아래 「넓혀 본 질문 · 승인 20문항과 따로 셉니다」 격자(질문·곳 / 모양(문장·검색어) / 반경 / 날짜별 ●◐·). CSS 두 줄(.ak-note, 칸 안 small)
   - 확인: 롤백되는 트랜잭션 안에서 새 표 두 개를 만들고 고르기 SQL 을 돌렸다 — `한도 2: [p4(안 잼), p1]` → p4 를 오늘 잰 뒤 `[p1]`. 롤백 뒤 두 표 다 없고 `ai_measurements` 의 p* 는 0건
2. **[중요] stalled** (Arch: 기준 `오늘-14`, 근거는 곳별 전/후 건수만) — loop-review.mjs:150-167. 원인 문장(「9/22 엔진 전환」)은 뺐다. 행동마다 `claude-code-web 전 0건 · 후 4건` 처럼 엔진별로 적는다.
   센 행은 판정과 같은 `판정rows`(daily-agent `rows`, 70일)다 — 점검rows(21일)로는 전 창이 잘린다. 전 = [기준일-14, 기준일), 후 = 기준일+7 부터(판정 창과 같음).
   단위 확인(가짜 행): `q9 content 2026-09-15: claude-code-web 전 0건 · 후 2건`. 실제 DB 로는 오늘 걸리는 행동이 없어 안 뜬다(가장 오랜 완료 q9 는 9/18, 게다가 같은 실행에서 D3 가 닫는다)

### Should Fix — 다 고침
- **Brave 캡차 → 확인 불가** (Arch 결정) — tools/brave-index-check.mjs:17-31: 바깥 링크가 0이고 「결과 없음」 문구도 없거나, 캡차 문구가 보이면 `확인 불가  <url>` 을 찍는다.
  tools/local-agent.mjs:184-190: 확인 불가가 한 줄이라도 있으면 일감을 `로컬 대기` 그대로 두고 evidence 에 「<날> Brave 확인 불가 (캡차 또는 빈 화면) n/N편」만 적는다. 사람에게 제출 요청은 안 간다. attempts 도 안 올린다(실패가 아니라 못 본 것)
- 35분 확인을 탐침 문항마다 한다 — ai-measure.mjs:385-389
- 출력이 모자라 실패하면 3번째에 `사람 대기` 로 올린다. detail 은 「Brave 확인이 3번 실패했습니다. 원장 PC 에서 node tools/brave-index-check.mjs <slug…> 로 직접 확인해 주세요.」 — local-agent.mjs:174-182
- widen 할 일 문구: 「새 탐침은 하루 2개까지 만들고(검색어 씨앗 3개는 따로), 측정은 하루 2개씩 Claude 로 합니다.」
- narrow: n≥10 인 곳만 근거·조건에 쓴다(`큰곳`). 합 0 조건은 모든 곳을 본다 — 작은 곳에 적중이 있으면 「어느 AI 에도」라 쓰지 않는다
- repeat: 그 묶음 측정이 10건 안 되면 안 켠다
- evidence 붙이기를 `left` 에서 `right` 로 바꿨다(새 줄을 남김) — local-agent 의 Brave 핸들러 4곳

### Escalate 답
- 3(agent `deliver`/`improve`) — Arch 답이 없어 `deliver` 그대로 뒀다

### 다시 찍은 `--review` (실제 DB, 쓰기 없음, 종료 0)
```
로봇&코딩학원 · 2026-09-29
  최근 7일 자동 측정 적중 58/120 · 측정된 질문 20/20
  오늘: claude-code-web 10/20
  판정·후속: q9 content 판정: 효과 없음 · claude-code-web 전 비교 없음 — 후 0/5

자기 점검 4건 · 글 고치기 건너뛰는 단계: problem, consider
  [narrow] 일반 질문 9개는 어느 AI 에도 안 나옵니다
      근거: 일반 질문 9개 — Claude 0/63 · ChatGPT 0/18 · Perplexity 0/18 · Gemini 0/18 · OpenRouter 0/12 (14일). 동네 질문 Claude 41/56 · 이름 질문 Claude 18/21
      할 일: 질문 하나씩 고치지 않고 묶음 전체의 원인(검색 결과에 뜨는지)부터 봅니다.
  [repeat] 일반 질문에 글 고치기·재색인을 7번 했는데 오른 게 없습니다
      근거: q9·q12·q14·q10·q11·q13·q16 · 21일 동안 content 7건 · 같은 기간 적중 Claude 0/63 · ChatGPT 0/18 · Perplexity 0/18 · Gemini 0/18 · OpenRouter 0/12
      할 일: 일반 질문은 글 고치기를 건너뛰고 다음 칸(바깥 지면)으로 넘어갑니다.
  [discover] 일반 질문의 글이 AI 검색 결과에 안 뜹니다
      근거: 측정 129건에서 AI 가 받아 본 검색 결과에 robotncoding.com 이 0번 — 글을 고쳐도 못 읽습니다 · 맞는 발행 글 5편
      할 일: 원장 PC 가 이 글 5편이 Brave 색인에 있는지 확인합니다(Claude 검색이 Brave 를 씁니다).
  [widen] 동네 질문을 한 칸씩 넓혀 어디서 빠지는지 잽니다
      근거: 아직 잰 탐침 없음 · 오늘 새로: 씨앗 송파구「송파구 코딩학원 추천」, 씨앗 송파구「송파구 초등 코딩학원」, 씨앗 송파구「송파구 로봇코딩학원」, q1→서울「서울에서 초등학생 코딩학원 좀 추천해줘」, q2→송파「송파 근처에 로봇이랑 코딩 같이 배울 수 있는 학원 있어?」
      할 일: 새 탐침은 하루 2개까지 만들고(검색어 씨앗 3개는 따로), 측정은 하루 2개씩 Claude 로 합니다. 적중률 계산·효과 판정에는 쓰지 않습니다.
  → 자기 점검: 일반 질문에 글 고치기·재색인을 7번 했는데 오른 게 없습니다 (외 3건)
  (dry) 발견성 일감 brave-index-general: ai-sidae-koding-baeul-piryo, aiga-sukjereul-haetdamyeon, beullogeseo-paisseoneuro, hagweoneseo-mueoseul-baewossna, koding-myeot-hangnyeonbuteo
  (dry) 탐침 keyword 씨앗 송파구「송파구 코딩학원 추천」
  (dry) 탐침 keyword 씨앗 송파구「송파구 초등 코딩학원」
  (dry) 탐침 keyword 씨앗 송파구「송파구 로봇코딩학원」
  (dry) 탐침 sentence q1 → 서울「서울에서 초등학생 코딩학원 좀 추천해줘」
  (dry) 탐침 sentence q2 → 송파「송파 근처에 로봇이랑 코딩 같이 배울 수 있는 학원 있어?」
```
숫자는 1차와 같다(Claude 0/63 · 동네 41/56 · 이름 18/21 · 129건 0번 · q9 효과 없음 후 0/5). narrow 근거의 곳 5개는 다 n≥10 이라 그대로다.

tsc: `web/` 에서 `node ./node_modules/typescript/bin/tsc --noEmit` 종료 0, 출력 없음. `node --check` 로 mjs 다섯 개(loop-review·daily-agent·ai-measure·local-agent·brave-index-check) 통과.
