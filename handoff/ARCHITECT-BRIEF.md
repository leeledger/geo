# Architect Brief — Step 40

## Goal
원장이 고객 탭을 열면 맨 위에서 「이번 주 실제로 한 일 / 밀린 일·며칠째」를 사람 말로 읽고, 화면의 숫자·일감이 지금 사실과 맞는다(은어·로그 조각·못 잰 것을 0 으로 쓰는 일 없음).

두 덩어리, 따로 커밋: **40a 데이터**(일감·판정이 거짓말 안 하게) → **40b 화면**(문구·고객 상태). 40a 먼저 — 화면을 고쳐도 일감이 거짓이면 소용없다.
결정 D57~D66 은 BUILD-LOG 「2026-10-10 Step 40 설계」.

## 흐름

```
 serp_checks(날마다 엔진 일부만 잴 수 있음: 10/6·8·9 는 bing 만)
   │  [지금] 「가장 최근 날」 하나만 봄 → bing 만 잰 날 = 브랜드 0·경쟁 0 → 일감 열림 → 네이버 잰 날 닫힘 (깜빡임)
   │  [바꿈] (검색어,엔진)마다 7일 안 최신 1행 → 판정
   ▼
 scout report → company 일감(brand/rival) ──신호 사라짐──▶ 닫힘

 세션 글 일감(question-draft, 세션 대기)
   who-wins(company) ─┐
   개선 루프(daily)  ─┼─▶ [바꿈] 고객당 열린 것 1개. 있으면 payload.questions 에 질문만 덧붙임
   탐침(daily)       ─┘          나이 = 첫 created_at. 나이로 안 닫음(D60)
                                  ├─ 세션이 --session-done → 완료
                                  └─ 7일 넘음 → 원장 할 일 한 줄 「○○ 저장소에서 Claude 세션 열기」(D61)

 naver-transfer(로컬 대기)
   announce ─[바꿈] 이미 naver_log_no 면 안 만듦
   local-agent 시작 ─[바꿈] naver_log_no 있는 로컬 대기 → 완료(근거 logNo)
   attempt 완료 ─[바꿈] evidence 에 logNo (R3 근거 없는 완료 방지)
```

## Build Order — 40a 데이터 (academy/ · tools/)

1. **검색 판정 순수 함수** — 새 파일 `academy/serp-judge.mjs` export `검색판정(rows, 오늘, { 마지막적중일, 첫측정일 })`.
   rows = `{query, engine, kind, day, hit}` (최근 7일). (query,engine)마다 day 가장 늦은 1행만 남긴다.
   - brandMiss = kind '브랜드' 검색어 중 남은 행이 전부 hit=false 인 것 `[{query, engines}]`
   - rival = `{won, total, zeroDays}` — won = 경쟁 검색어 중 남은 행 하나라도 hit 인 수. zeroDays 는 won 0 일 때만: 오늘 − (경쟁 hit 이 하나라도 있던 마지막 날, 전체 기록. 없으면 첫 측정일).
   - 7일 안 행이 0 이면 판정 없음(null) — report 안 함.
   - `academy/scripts/scout.mjs` 78~112 두 쿼리를 이 함수로 교체. SQL 은 `day > (now() at time zone 'Asia/Seoul')::date - 7` 행 + 마지막적중일·첫측정일 두 값.
   - 경쟁 제목 전→후: `${c.name} — 경쟁 검색어 0/${total} (${days}일째)` → `${c.name} — 이름 없이 찾는 검색어 ${total}개에서 한 번도 안 나옴 (${zeroDays}일째)`. 옛 셈(days.n = 잰 날 전체 수)은 「0인 날」이 아니었다.
   - 브랜드 제목 그대로.
2. **notracker 헛일감 끊기(D57)** — `scout.mjs:159` `if (ever.n === 0)` 앞에 briefing.mjs:206 과 같은 조건: `c.siteLog && c.출처?.siteLog !== "기본"` 이면 report 안 함(장치 일부러 없음). Flag: scout 의 c 에 `출처` 가 있는지 먼저 확인(없으면 briefing 과 같은 로더).
   → #1037 은 다음 매시 루프에서 「신호 사라짐」으로 닫힌다(sticky 아님 확인).
3. **bytedance 감시 제외(D59)** — `academy/scripts/audit.mjs:226` 덕덕고 줄을 표 하나로: `export const R5제외 = { duckduckgo: "덕덕고 결과는 빙 색인 기반 — 빙 커버리지로 대신 봄", bytedance: "바이트댄스(중국 Doubao)는 한국 학부모가 안 씀 — 감시 안 함" }` → `풀림("R5", …, R5제외[vendor])`. Flag: 풀림이 「사람 대기」 조사를 닫는지(298행 사람손 규칙) 확인 — 안 닫으면 8번 정리 스크립트가 닫는다.
4. **brand-defense 건너뜀은 실패가 아님** — `company.mjs:641`. 순수 함수 `색인결과(out, ok)` → `"접수" | "키없음" | "실패"` (serp-judge.mjs 에 둠). out 에 「키 설정이 없습니다」면 키없음.
   키없음: `{ status: "관찰", nextTry: 뒤(24), evidence: "${오늘()} 색인 알림은 이 고객 저장소가 배포 때 보냄 — 여기서는 안 보냄" }` — attempt 없음 → 활동 ok. 3회 사람 대기 분기는 「실패」가 쌓일 때만.
5. **네이버 이관 일감이 안 닫히는 것** — 원인(확인함): 세션이 손으로 옮긴 글은 naver_log_no 가 있어 local-agent 쿼리(tools/local-agent.mjs:120)에서 빠지고, 로컬 대기 일감을 닫을 곳이 없다. #389·#1571 둘 다 logNo 있음.
   - `tools/local-agent.mjs` 네이버 루프 앞: `update geo.agent_tasks t set status='완료', done_at=now(), updated_at=now(), evidence=left(t.evidence || E'\n' || $1 || ' 이미 네이버에 있음 logNo=' || p.naver_log_no, 4000) from academy.posts p where t.kind='naver-transfer' and t.status='로컬 대기' and p.slug = t.payload->>'slug' and p.naver_log_no is not null`.
   - 같은 파일 attempt 완료(147행 update): evidence 에 `${KST} logNo=${after.naver_log_no}` 를 같이 씀 → R3 「근거 없는 완료」가 안 생김.
   - `company.mjs:844` announce: 그 글 naver_log_no 가 있으면 naver-transfer 일감을 안 만듦.
6. **세션 글 일감 고객당 1개(D60)** — `academy/scripts/session-task.mjs`.
   - 새 export `세션일감묶기(q, { c, 질문, 출처, 오늘, DRY })`: 고객의 열린 「세션 대기」 question-draft 가 있으면 `payload.questions`(배열, 글자만() 기준 중복 제거, 상한 15 — 넘으면 안 넣고 evidence 에 「상한 — 안 묶음」)에 덧붙이고 evidence `${오늘} ${출처} 질문 묶음: 「…」`. 반환 `{ id, 말, 묶음: true }`. 열린 것이 없으면 undefined.
   - 새로 만들기 전에 부르는 세 곳: `세션일감열기`(같은 질문 일감이 없을 때) · `탐침글일감`(79~80행 「열린 일감이 있어 안 넘깁니다」 분기를 묶기로 바꿈) · `company.mjs:679~689` who-wins 세션 분기.
   - 나이로 닫기 제거: `탐침글일감` 72~77행 14일 update 삭제, `daily-agent.mjs:222` `세션일감닫기` 호출 삭제(run 의 「미처리」 판정은 그대로). 머리 주석 7행 → `닫기 — 나이로 안 닫는다. 세션이 끝내거나 원장이 닫는다. 7일 넘으면 현황판 원장 할 일 한 줄(Step 40 D61)`.
   - `같은질문` SQL(22행)을 넓힘: `payload->>'question'` 또는 `payload->'questions'` 원소 중 하나라도 글자가 같으면. → `세션완료찾기`·`같은질문일감` 이 묶인 질문도 찾는다.
7. **listing 일감 저절로 닫기(D62)** — `company.mjs` 매시 루프(세션글열기 근처): 열린 kind 'listing' 중 payload.query 가 최근 7일 serp_checks 에서 engine naver 또는 naver_all hit 인 것 → 완료, 근거 `${오늘()} 네이버 검색에 이미 나옴(${M/D} 측정)`. (#258 「잠실 초등 코딩학원」 10/10 naver hit.)
8. **한 번 정리 스크립트** — 새 `academy/scripts/step40-cleanup.mjs`. 기본은 찍기만, `--apply` 일 때 씀. 모든 변경에 evidence 한 줄.
   - 고객마다 열린 세션 대기 question-draft 중 가장 오래된 1개를 남기고, 나머지 질문을 그 payload.questions 로, 나머지는 닫힘 `#<남긴id> 에 묶음`. 예상: 아이로그 12→1(#28, 9/17), 문서딱 6→1(#1121).
   - 로컬 대기 naver-transfer 중 logNo 있는 것 완료(5번 SQL). 예상 #389·#1571.
   - R3 조사 중 대상이 naver-attempt 이고 그 글 logNo 가 있는 것: attempt evidence 에 logNo, 조사 닫힘. 예상 #987(→946, logNo 224425915981)·#1667(→1563, logNo 224431831182).
   - #1839(bytedance R5) 가 3번 뒤에도 열려 있으면 닫힘 `감시 제외(D59)`.
   - #1385(R1 문서딱 brand-defense 반복 실패) 닫힘 `건너뜀을 실패로 세던 것 — Step 40 4번에서 고침`.
   - 바꾼 것 목록을 찍는다. Arch 가 찍힌 것을 읽고 --apply.

## Build Order — 40b 화면 (web/ · 보고 문구)

9. **고객 상태 칸(D63)** — 새 `web/lib/client-status-core.mjs`(+`.d.mts`, 다른 -core 처럼 순수 함수) `상태문장(raw, 오늘)` + `web/lib/client-status.ts` `readClientStatus(clientId)` + `web/app/admin/ops/ClientStatus.tsx`. `page.tsx:201` PmReport **위**, client 가 있을 때만.
   raw (이번 주 = 어제까지 7일, KST):
   - 사이트 글 발행: academy.posts published_at
   - 바깥 글 올림: geo.marketing_posts status '올림' posted_at, 채널별(blog·jisikin·cafe → 블로그·지식iN·카페)
   - 고객 사이트에 반영한 가이드 글: question-draft 완료 done_at
   - 색인: agent_activity ok, action in ('구글 색인 요청','빙 주소 제출') 과 action like '네이버 이관:%'
   - AI 측정: agent_activity ok action '소비자 화면 AI 측정' 수. Flag: 학원(id 1)은 이 활동명이 아닐 수 있다 — 학원 측정 활동명을 grep 으로 확인, 없으면 academy.ai_measurements 7일 행 수.
   - 손댄 마지막 날 = 위 넷(측정 제외)의 max, 전체 기간
   - 밀린 일: 열린 일감 status in ('사람 대기','세션 대기','로컬 대기','수리 대기','실패') — 누구별 건수·가장 오래된 created_at. 세션 대기는 payload.questions 길이(없으면 1).
   문장 틀(이대로):
   ```
   제목   {이름} · 이번 주 ({M/D}~{M/D})        뱃지 돎 | 느림 | 멈춤
   한 일  0 아닌 것만 「 · 」로. 예) AI 답변 측정 42번 · 구글 색인 요청 10건 · 빙 주소 제출 8건
          측정 말고 전부 0 이면 끝에 「글·색인·사이트 반영은 0건입니다.」
   손댄 날 고객 사이트나 바깥에 실제로 손댄 마지막 날 {M/D} ({n}일 전) | 「아직 없습니다」
   밀린 일 · 원장님 — {n}건 · 가장 오래된 것 {d}일째
           · Claude 세션 — 가이드 글 {n}편(묶인 질문 {q}개) · {d}일째
           · 원장 PC — {n}건 · {d}일째 (PC 가 켜져 있어야 움직입니다)
           · 자동 코드 수리 — {n}건 · {d}일째 (수리가 꺼져 있어 안 움직입니다 | 매일 06:50 에 1건씩)
           · 자동 작업 실패 — {n}건 · {d}일째
           없으면 「밀린 일 없습니다」
   ```
   뱃지: 멈춤 = 손댄 날 14일 이상 전, 또는 밀린 일 하나라도 14일 이상 · 느림 = 7일 이상 · 아니면 돎. 0일째는 「오늘」.
   수리 꺼짐 여부는 pm-report 와 같은 셈(agent_activity repair 마지막 summary 가 「스위치 꺼짐」).
   읽기 실패면 「이 고객 상태를 못 읽었습니다」(빈 칸·0 금지).
10. **Todo.tsx**
    - 109 `없습니다. 나머지는 자동으로 돕니다` → 원장 밖 밀린 일이 있으면 `원장님 몫은 없습니다. 밀린 일은 맨 위에 있습니다`, 없으면 `원장님 몫은 없습니다`.
    - 125 `세션에서 할 일 {n}건 — 원장님 몫이 아닙니다. Claude 세션을 열면 세션이 처리합니다` → `Claude 세션 몫 {n}건 · 가장 오래된 것 {d}일째 — 세션을 열어야 움직입니다`.
    - D61: 세션 대기 가장 오래된 것이 7일 이상이면 할 일에 한 줄 — 제목 `{이름} 저장소에서 Claude 세션 한 번 열기`, 이유 `가이드 글 일감이 {d}일째 밀렸습니다. 세션에 「밀린 세션 글 써 줘」라고 하면 됩니다`, 행동 details(라벨 「묶인 질문 보기」, 본문 = 질문 목록). 이때 125 줄은 안 띄움.
    - `web/lib/ops.ts` tasks 에 `createdAt` 추가(81행 타입 + select).
11. **todo-text.ts**
    - listing why: 지금 `cut(plain(first(t.detail)))` → LLM 문장이 잘려 「…나온데다」. → `이 검색 1쪽을 차지한 곳: {targets 앞 3개 「, 」}. 그곳에 학원 정보를 올리면 됩니다(업체 로그인 필요)`. targets 없으면 `어디에 올릴지 모릅니다 — 닫아도 됩니다`.
    - crawl-push 새 분기: 제목 `{VENDOR 주격} 우리 글을 덜 읽습니다 ({pct}% · 가장 많이 읽는 곳 {hi}%)` — t.title 에서 「커버리지 N% (최고 M%)」 꼴을 정규식으로 읽고, 못 읽으면 괄호 뺌. 이유: vendor openai → `ChatGPT 는 빙이 읽은 글로 답합니다. 빙 웹마스터에 주소를 내면 늘어납니다(로그인 필요)`, 그 밖 → `이 검색 로봇이 robots.txt 에서 막혔는지 봅니다`.
    - VENDOR 에 apple `["애플", "애플이"]`.
12. **아침 보고** — `academy/scripts/pm-report.mjs` · `web/app/admin/ops/PmReport.tsx`
    - 143 건마다 `감사 조사 「${t.title}」 — 원장님 확인을 기다립니다` → 조사가 있으면 한 줄 `자동 점검이 원장님 판단을 기다리는 일 ${n}건 — 「오늘 하실 일」에 있습니다`.
    - 145 `수리공이 ${꺼진날}일째 꺼져 있습니다. 켜는 건 원장님 몫입니다` → `자동 코드 수리가 ${꺼진날}일째 꺼져 있습니다. 그동안 코드 문제 ${수리대기}건이 손대지 않은 채 쌓였습니다. 켜면 매일 06:50 에 1건씩 Claude 가 고치고, 검토를 통과한 것만 반영합니다. 켤지는 원장님 결정입니다 — Claude 세션에 「자동 수리 켜 줘」`. 수리대기 = 열린 status '수리 대기' 수.
    - 141 되풀이 → `「${cut(t.title, 50)}」 — ${t.attempts}번 해 봤는데 안 끝났습니다. 자동으로 계속 다시 합니다` (cut = 어절 경계, todo-text cut 과 같은 꼴의 작은 함수).
    - 고객줄읽기(239~) d CTE·join 둘 다 `coalesce(a.stage,'') <> 'brand'`(D58). 문구 `AI 답변 ChatGPT 20번 중 3번 이름 나옴(10/9)` → `이름 안 넣은 질문 — ChatGPT ${n}개 중 ${k}개에 이름 나옴(${M/D})`. 일감 `열린 일감 n건(원장 몫 h · 세션 몫 s)` → `밀린 일 ${n}건(원장님 ${h} · Claude 세션 ${s})` — 셈은 9번 밀린 일 상태 목록.
    - 학원 AI답변읽기(287~)도 이름 질문 제외(D58 — KG-34-3 닫음).
    - 직원 이름(31행) → `["pm","매시 점검"], ["research","측정"], ["content","글 쓰기"], ["illustrate","그림"], ["deliver","색인·블로그 옮기기"], ["audit","자동 점검"], ["repair","자동 코드 수리"]`.
    - PmReport.tsx 124~133 `<details>` 「담당별로 한 일과 다음 할 일」 통째 삭제 → `{b.다음.length > 0 && <p className="pm-meta">다음: {b.다음.join(" · ")}</p>}`. body.직원 저장은 그대로.
    - `academy/scripts/loop-grow.mjs:103` → 「더 넓게 바꿔 물은 질문 {n}개 — 최근 7일 이름이 나온 질문 {k}개」, 덜 이 있으면 뒤에 「 ({덜}개는 아직 두 번 넘게 못 물어 판단 전)」. test-grow-loop.mjs 기대값 같이.
13. **자동 일 줄 — 「정상」인데 「기록 없음」 금지**
    - `web/lib/agents.ts` ROLES name: 운영→`매시 점검`, 수리공→`자동 코드 수리`, 콘텐츠→`글 쓰기`, 삽화→`그림`, 유통→`색인·블로그 옮기기`. job name `감사`→`자동 점검`.
    - 340 `꺼 둠 · 켜는 건 원장님 결정` → `꺼져 있음 — 코드 문제가 쌓입니다. 켤지는 원장님 결정`.
    - clientRows content(445~): does → `글은 Claude 세션이 ${c.name} 저장소에 씁니다 · 밀린 글 ${n}편` (바깥 글 고객은 기존 바깥 글 문장을 앞에). 세션 대기 가장 오래된 것 3일 이상 → late, reason `가이드 글이 ${d}일째 안 써졌습니다 — Claude 세션을 열어야 움직입니다`. 열린 것 없고 10일 활동 없음 → idle, reason `최근 10일 한 일이 없습니다`.
    - judge 일반 규칙: 마지막 활동(shown)이 없는데 ok 가 나오면 idle + `최근 10일 한 일이 없습니다`.
14. **나머지 문구**
    - `AgentBoard.tsx:132` `Claude 세션을 열면 세션이 씁니다. 원장님 몫이 아닙니다.` → `Claude 세션을 열어야 움직입니다. 아무도 안 열면 그대로 쌓입니다.`
    - `Marketing.tsx:60` `읽을 자리 — 원문에 없을 수 있는 문장 {n}개` → `올리기 전에 확인할 문장 {n}개 — 고객 사이트 원문에서 못 찾은 말입니다`.
15. **못 잰 것은 「안 잼」(D64)** — `web/lib/growth.ts` readGrowth 에 `tracked: { crawl: boolean; posts: boolean }` (crawl = 그 고객 crawl_hits 1행이라도 · posts = academy.posts 1행이라도). `Growth.tsx`:
    - 답변 색인 카드(201) → crawl 이 false 면 `<Card none head="검색 엔진이 읽은 쪽 수 — 안 잽니다" />`, note `이 사이트에는 방문 기록 장치가 없습니다. 색인은 서치콘솔 숫자로 봅니다`.
    - 글 카드(208~216) → posts 가 false 면 `<Card none head="글 — 여기서 안 셉니다" />`, note `글은 고객 저장소에 올라가 이 화면에 기록이 안 들어옵니다`.
    - GrowthMore 「로봇 방문」(302) → crawl false 면 `안 잽니다 — 방문 기록 장치 없음`. 차트 섹션 → `안 잽니다`.
16. **은어 검사 시험** — 새 `academy/scripts/test-ops-words.mjs`: 화면 문장을 만드는 순수 함수 출력(9 상태문장 · 11 todoText · 12 확장줄 · 13 clientRows reason/does)을 fixture 로 돌려 금지어 0: `총괄 근거 집필 삽화 유통 수리공 감사 조사 영점 커버리지 확장 질문 불림 덜 잼 읽을 자리 세션 대기 세션에서 할 일 원장님 몫이 아닙니다`. 더해 `web/app/admin/ops/*.tsx` 의 주석 아닌 줄에서 따옴표·JSX 텍스트를 grep 해 같은 목록 0 — status 값 비교(`===` 나 `by(` 옆 리터럴)는 뺀다.

## Failure modes

| 새 길 | 실제로 날 수 있는 일 | 처리 | 원장에게 |
|---|---|---|---|
| 검색 판정 7일 최신 | 네이버를 7일 넘게 못 재면 bing 만 남아 「안 나옴」 | 7일 안 행 0 이면 판정 없음. 측정 멈춤은 R2 가 따로 잡음. fixture 시험 | 헛일감 안 열림 |
| 세션 일감 묶기 | 상한 15 넘음 | 안 넣고 evidence 「상한 — 안 묶음」 | 상태 칸 「묶인 질문 15개」 |
| 나이로 안 닫음 | 영영 열림 | 의도. 7일부터 원장 할 일, 14일부터 뱃지 멈춤 | 보임(이 Step 의 목적) |
| 정리 스크립트 | 잘못 닫음 | 찍기 먼저, evidence 남김, status 되돌리면 복구 | Arch 가 찍힌 것 확인 |
| local-agent 이관 닫기 | logNo 있는데 실제 글 없음 | logNo 는 이관 성공 때만 쓴다(기존 규칙) | 없음 |
| bytedance 제외 | 나중에 의미가 생김 | 제외 표 한 곳, 풀림 사유가 감사 출력에 매일 남음 | 조용 — 수용(D59) |
| listing 자동 닫기 | 하루 걸렸다 빠짐 | who-wins 주 1회가 다시 엶 | 다시 보임 |
| 상태 칸 읽기 실패 | DB 오류 | 「못 읽었습니다」 | 보임 |
| 아침 보고 | 오늘 저장된 보고는 옛 문구 | 배포 뒤 `node scripts/pm-report.mjs --force` | 없음 |

critical gap 없음.

## Test map
- 검색판정: bing 만 잰 날이 최신이어도 7일 안 네이버 hit 면 brandMiss 0 · won 은 검색어 기준 · zeroDays · 7일 안 행 0 → null [GAP → 새 `test-serp-judge.mjs`, 10/6~10/10 실제 꼴 fixture]
- 색인결과 접수/키없음/실패 · R5제외 bytedance·duckduckgo [GAP → 같은 파일]
- 세션일감묶기: 열린 것 있음→덧붙임 · 같은 질문→안 늘어남 · 상한 15 · 없음→undefined · 같은질문 이 questions 안도 찾음 · 탐침글일감 이 막지 않고 묶음 [GAP → `test-ilog-loop.mjs` 가짜 q 에 추가]
- 나이 닫기 제거 회귀: daily-agent 14일 run 은 미처리, 일감은 세션 대기 그대로 [GAP → test-ilog-loop]
- 상태문장: 아이로그 꼴(측정만 42 · 손댄 날 9/18 · 세션 1편 질문 12개 23일 → 멈춤) 정확한 문장 · 문서딱 꼴(색인 있음) · 학원 꼴 · 전부 빈 것 · 뱃지 경계 6/7/13/14일 [GAP → 새 `test-client-status.mjs`]
- todo-text listing·crawl-push 분기 · clientRows content late/idle · judge ok+활동 없음 → idle [GAP → 새 `test-todo-words.mjs`, test-login.mjs:84 의 TS 깎기 방식]
- 확장줄 문구 [TESTED test-grow-loop — 기대값 갱신]
- 은어 검사 [GAP → test-ops-words.mjs]
- 회귀: test-ilog-loop · test-grow-loop · test-login · test-marketing · test-docttak · test-clients · test-client-core 통과, tsc 0 (`node ./node_modules/typescript/bin/tsc --noEmit` — 경로의 & 때문에 npx 금지)

## Out of Scope (BUILD-LOG Known Gaps)
- 문서딱 지식iN 실제 질문 찾아 답하기·카페 멈춤 → `handoff/NEXT-BRIEF-kin.md` (Step 41)
- 세션 글을 머리 없는 Claude 로 자동 작성 (KG-40-1)
- 세 고객 모두 bing `site:` 0 — 빙 색인 자체 (KG-40-2)
- perplexity·apple R5 를 감사 진단이 「code」로 분류해 수리 대기로 보낸 것 (KG-40-3)
- REPAIR_ENABLED 켜기 — 원장 결정
- 케이스 리포트의 이름 질문 셈

## Acceptance
- 40a 배포 뒤 `node scripts/step40-cleanup.mjs` 출력을 Arch 가 읽고 `--apply`. 그 뒤: 아이로그 세션 대기 1(#28, 질문 12) · 문서딱 세션 대기 1 · #389·#1571 완료 · #987·#1667·#1385·#1839 닫힘 · 다음 매시 루프 뒤 #1037·#63·#64 닫힘(문서딱 #1048·#1257 은 그날 판정대로) · #258 완료.
- 매시 루프 로그: bing 만 잰 날에 brand/rival 신호 없음.
- 40b 배포 뒤 `pm-report.mjs --force`. 세션이 운영 /admin/ops 세 탭(?c=robotncoding·ilog·docttak) HTML 을 받아 금지어 0. 아이로그 탭 맨 위 뱃지 「멈춤」 · 손댄 날 9/18 · Claude 세션 23일째 · 할 일 「아이로그 저장소에서 Claude 세션 한 번 열기」. 문서딱 탭 답변 색인·글 카드 「안 잽니다 / 안 셉니다」. 아침 보고 고객 줄 ChatGPT 숫자 = 그 탭 표 숫자.
- Test map 시험 전부 통과, tsc 0.
- academy 앱(robotncoding.com)은 손대지 않음 — vercel 배포 불필요. web 은 push 로 배포.
