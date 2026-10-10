# Architect Brief — Step 43 · 학원 주 1편: 주제·감수·발행까지 자동, 원장은 사후 「내리기」

원장 결정 2026-10-10: 「새 글 포스팅도 자동화해서 주제 선택과 감수 모두 자동으로.」 결정 D81~D94 · KG-43-x 는 BUILD-LOG.
Step 42 브리프는 BUILD-LOG Step 42 절에 있다.

## Goal
월요일 초안이 사람 버튼을 기다리지 않는다. 기계 감수 4관문(출처 대조·AI 티·원장 관점·가림)을 모두 통과한 글만 스스로 발행되고, 하나라도 걸리면 발행 없이 다음 날 다시 쓰고, 3번 지면 버리고 다음 주제로 간다. 원장은 나간 글을 「내리기」 한 번으로 내린다.

## 지금 흐름 (조사 — 2026-10-10 운영 DB 읽기 전용)
```
월 06:07 write.yml ─┐
매시 company.mjs ───┴─ weekly-draft → write-draft.mjs
                         ├ 재료 ≥3 → 관점 글        ← academy.materials 0행 · inquiries 0행. 한 번도 안 탐
                         ├ 사실 → write-news.mjs    ← 실제로 나간 길(ai-textbook·68시간·국민대, 모델 opus)
                         └ 없음 → 78 건너뜀
                       초안(published=false)
매시 company review     → slop-check + 다듬기(숫자·소제목·링크 고정) → 「사람 대기」   ◀ 여기서 사람을 기다린다
매시 company illustrate → post_images(DB) 도해 → /blog/img/<slug>/<name>.svg (배포 불필요)
원장 /admin/drafts 「발행」 publishDraft() → announce 일감 → IndexNow · gsc(로컬) · naver-transfer(로컬, pc-runner)
```
- 버려진 이유: 9/23 관점 초안 3편 「AI slop · 일반론 · 억지 상황」(재료 없이 씀, Step 15). 9/28 이관 글 「코딩학원의 선택」 재발행 → 옛 지점(로보티즈키즈랩 반포교육원·헬리오시티 2호점) 설명이라 내림(review_notes.비공개이유). draft_feedback 은 지금 0행.
- 사람 문은 publishDraft 하나다. 앞(초안·다듬기·도해)과 뒤(색인·네이버)는 이미 자동. **이번 Step 은 그 문을 기계 감수로 바꾸는 것이 전부.** 새 발행 파이프라인을 짓지 않는다.
- 「커밋」 단계는 자동 경로에 없다: 글은 DB, 도해는 post_images(DB). 바뀌는 파일이 없다(D90).

## 새 흐름
```
weekly-draft(월~, 이번 주 발행 0편)
  └ auto-post --pick ──후보 0──▶ 활동 「이번 주 쓸 주제 없음」 · 다음 월요일
        │ 고름(post_reviews kind=고름, why=고른 이유)
        ▼
  재료 관문: 이 주제가 학원 사실을 요구하나?
        ├ 요구 + m#/i# 라벨 0 ──▶ kind=재료부족 · 다음 후보(한 실행 3후보까지)
        └ 아니면 사실 글 / 재료 있으면 재료 섞은 글
  write-news.mjs --topic-json (재료 모드면 write-draft) → 초안 + notes.주장[] + notes.주제
        ▼
  company review → auto-post --review <slug>   (회차 n, 하루 1회)
     (a) 출처 대조 ─ 지지 안 됨 → 문장 지움 → 길이·첫 문단 확인 ─ 못 지움 → 실패
     (b) AI 티 ─── 걸림 → 다듬기 1 + 다시 쓰기 1 (다시 쓰면 a부터) ─ 그래도 → 실패
     (c) 원장 관점 Claude ─ 걸림 → 실패
     (d) 가림 ──── 걸림 → 실패
        ├ 4개 통과 → notes.감수={통과, 해시} → illustrate(기존) → 발행가능? → 발행(core) → announce(기존)
        ├ 실패, n<3 → 대기(내일 06:30 KST) · 실패 이유를 고침 목록으로 다시 씀
        ├ 실패, n=3 → kind=버림 · 초안 삭제 · draft_feedback 1행 · 다음 날 다음 주제(주당 2주제까지)
        └ 한도·출처 전부 네트워크 오류 → 미룸, 회차 안 셈
  발행 뒤 /admin/drafts 「자동 글」 카드 [내리기] → 내리기(core) → 사이트 5분 안(revalidate 300) 사라짐 · 네이버는 사람 일감 · IndexNow
```

## Build Order

### 43a 데이터·핵심 판정 (행동 변화 0 — 먼저 합칠 수 있게)
1. `academy/scripts/setup-post-reviews.mjs` (setup-*.mjs 꼴, 전부 if not exists):
   ```sql
   create table if not exists academy.post_reviews (
     id bigserial primary key, client_id int not null default 1,
     slug text, topic_key text not null,
     kind text not null check (kind in ('고름','재료부족','감수','발행','버림','내림','못냄')),
     attempt int, passed boolean, stages jsonb not null default '{}'::jsonb,
     why text, at timestamptz not null default now());
   create index if not exists post_reviews_topic on academy.post_reviews (client_id, topic_key, at desc);
   create index if not exists post_reviews_slug on academy.post_reviews (slug, at desc);
   -- geo.settings 에 post_auto_publish='on' (칸 이름은 repair_paused 쓰는 곳에서 확인)
   ```
   운영 적용은 Bob. 적용 뒤 select 결과를 REVIEW-REQUEST 에.
2. 새 `web/lib/post-auto-core.mjs` (+`.d.mts`, 의존성 0, DB 는 q 주입 — repair-core 꼴). auto-post·company·web 화면·pm-report 가 이 한 곳만 쓴다:
   - `주제키(후보)` → `bank:<id>` | `q:<sha1 10>`(질문 정규화: 공백·물음표 제거) | `serp:<sha1 10>`
   - `후보모으기(q, client)` 네 신호. 후보 = `{키, 제목, 신호[], 이유, 점수, 학원사실필요}`:
     - A 안 불린 질문: ai_measurements 14일, `stage <> 'brand'`(이름 질문은 성과 아님), prompt_text 별 `bool_or(mentioned or cited) = false`. 점수 30 + 잰 엔진 수
     - B 경쟁사가 이기는 질문: geo.agent_tasks client 1 kind='question-draft' status in ('대기','관찰'). 25점. 이유에 payload.sources
     - C 지는 검색어: serp_checks kind='경쟁' 7일 `bool_or(hit)=false` (write-draft.mjs 181행 SQL 그대로). 20점
     - D 주제 은행: topics.json `!slug`. 10점, season 이 이번 달에 맞으면 +5
     - 같은 질문(같은 키)이 여러 신호에 걸리면 한 후보로 합치고 점수 더함. 이유는 사람 말 한 줄: 「AI 답 4곳 중 0곳이 우리를 안 부름(10/8 잼) · 경쟁 학원 2곳이 이김」
   - `거르기(후보들, 기록, 최근글)` → `{남은것, 뺀것:[{제목, 왜}]}`:
     - 같은 topic_key 에 '발행' 있으면 영구 제외 · '버림' 8주 · '재료부족' 4주 제외
     - 최근 28일 발행 글(내린 글 포함) 제목+tags 와 핵심 낱말(2자 이상, write-draft STOP 불용어 제외) 2개 이상 겹치면 제외 — 왜 「10/4 국민대 글과 겹침」
     - 모든 발행 글 제목과 정규화 문자열이 같으면 제외
     - topics.json category·제목에 「과정」「모집」「특강」「반」 이면 `학원사실필요=true` (메모리 course-post-concrete-not-essay)
   - `주장뽑기(body)` → 문장별 `{문장, 숫자[], 고유명사[], 제도어[]}`. 숫자: 아라비아 숫자, 쉼표 제거·전각→반각, 목록 번호·「n단계」·`(n)` 은 fact-check.mjs 규칙 그대로 뺌. 고유명사: 「대학교|대학|대|부|청|원|위원회|재단|전형|법|고시|방안|과정|대회|교과서」로 끝나는 어절 + 라틴 대문자 시작 낱말. 제도어: 의무화|도입|신설|시행|폐지|개정|확대|축소|필수. 셋 다 비면 대상 아님
   - `창찾기(원문, 주장)` → 주장의 숫자 전부가 원문에 있고, 각 숫자 ±300자 안에 고유명사·제도어 중 하나 이상 있는 창(최대 3개, 600자). 비교는 공백 무시. 숫자 없는 주장은 고유명사+제도어 둘 다 한 창 안에
   - `문장지우기(body, 문장들)` → 지운 뒤 문단 < 80자면 문단째, 빈 `##` 절이면 소제목째. `{body, 지운것[], 첫문단지움}`
   - `본문해시(body)` → 이미지 마크다운 줄 제거·공백 정규화 뒤 sha1(node:crypto 는 의존성 아님)
   - `다음행동({회차, 결과, 오늘감수있음})` → 통과 | 내일다시 | 버림 | 미룸
   - `글기록말(rows)` → 화면·보고용 사람 말 줄(현황판 규칙: 로그 조각·영문 키·JSON 금지)
   - `발행가능` · `발행` · `내리기` — 43c
3. `academy/scripts/test-post-auto.mjs` — 아래 Test map 전부. 순수 함수는 고정 입력, DB 함수는 가짜 q(호출 SQL·인자 기록).

### 43b 주제·재료·쓰기
4. 새 `academy/scripts/auto-post.mjs` (company 가 부름):
   - `--pick [--dry]`: 후보모으기 → 거르기 → 점수순. 1위부터 재료 관문(5). 고르면 post_reviews '고름'(why) 후 쓰기. `--dry` 는 후보표·뺀 이유만 찍고 DB 안 씀
   - `--review <slug> [--dry]`: 43c. `--dry` 는 발행 글도 받고 DB·본문 안 씀
   - 마지막 줄 `AUTOPOST=<JSON>` (illustrate 의 `ILLUSTRATE=` 꼴) — company 가 읽음
5. 재료 관문(D84) — 학원만 아는 사실의 근거는 DB 셋뿐. 라벨을 붙여 쓰기에 넘김:
   - `m#` academy.materials 안 쓴 것 · `i#` academy.inquiries said 비지 않은 것 · `p#` 원장 글: client 1, published, (source_url is not null 이관 글 또는 활동 「원장 승인 발행」 글), **비공개이유 있는 글 제외**. 수업·대회·합격·커리큘럼 낱말 든 문단만, 발행 연도 붙여 최대 8개
   - `학원사실필요` 후보인데 m·i 라벨 0개 → '재료부족', 다음 후보(한 실행 3후보까지). p# 만으로는 과정 글 안 씀(옛 글은 옛 사실)
   - 아니면 사실 글: write-news.mjs 에 새 인자 `--topic-json <tmp 파일>`(제목·각도·이유·재료표). 인자 없으면 지금처럼 스스로 찾음 — 기존 경로 유지
   - 쓰기 프롬프트 추가: 「학원 경험 문장은 라벨 있는 재료에만. p# 를 쓰면 그 연도를 문장에 적는다」「주장 목록을 내놓는다」
   - 출력 JSON 에 `주장: [{문장, 종류:"바깥"|"학원"|"판단", 출처:[url], 재료:["p2"]}]` → review_notes.주장. review_notes.주제 = `{키, 제목, 이유, 신호}`
6. `write-draft.mjs` 주 1편 확인을 「이번 주(KST) **발행된** 글 또는 감수 중(notes.주제 있음·미발행·비공개이유 없음) 초안」으로(지금은 created_at). 머리 주석 20~23행·write.yml 14~17행 「발행은 사람」 문구를 새 흐름으로
7. `company.mjs`:
   - `weekly-draft`: write-draft 대신 `auto-post.mjs --pick`. 이번 주 발행 1편이면 다음 월요일. 이번 주 '버림' 2건이면 '못냄' 한 줄 + 다음 월요일(주당 2주제, D88)
   - `question-draft` client 1: 직접 안 씀 → 관찰, nextTry 뒤(24*7), evidence 「주제 후보로 넘김」. 후보 B 가 읽음(쓰는 길이 둘이면 주 1편이 깨진다)
   - 다른 고객 분기(773~779행)는 손대지 않음

### 43c 자동 감수·발행·내리기
8. `auto-post.mjs --review <slug>` — 하루 1회차(같은 KST 날 '감수' 행 있으면 미룸). a→b→c→d 고정, 앞이 지면 뒤는 안 돌림(호출 절약). 결과는 stages jsonb 한 행:
   - **(a) 출처 대조** — `fact-check.mjs` 확장(기존 CLI 출력 유지 + `export async function 출처대조(post, notes, {fetch, 클로드})`):
     - 대상 = 주장뽑기(body) 전부 ∪ notes.주장 중 바깥·학원. 주장 목록에 없는 문장은 그 글의 모든 출처가 후보
     - 바깥: notes.주장 출처 ∪ notes.출처 URL 을 실제로 가져옴. fetch 15초·2MB·리다이렉트 따라감(그라운딩 리다이렉트 포함)·UA 지정·script/style/태그 제거. PDF·비 HTML = 「못 읽음」(D86). 최종 주소 기록
     - 학원: 라벨 재료 원문
     - 창 없음 → 「없음」. 창 있으면 Claude 한 번에 묶어 판정 `클로드코드(prompt, {purpose:"출처대조", capRequired:true})` → 문장별 `{id, 판정:"맞음"|"다름"|"없음", 근거:"원문 그대로 한 줄"}`. 근거가 그 창의 부분문자열이 아니면 「없음」. JSON 깨짐 → 전부 「없음」(fail-closed)
     - 「맞음」 아닌 문장 → 문장지우기. 지운 뒤 본문 < 1,500자(사실)·1,800자(재료) 또는 첫문단지움 → (a) 실패. 아니면 통과 + 지운것 기록 + 본문 갱신(updated_at 낙관 잠금 — company review 822행 꼴)
     - 바깥 출처 전부 네트워크 오류(DNS·타임아웃) → 미룸(회차 안 셈). 일부만 못 읽음 → 그 문장만 「없음」
   - **(b) AI 티** — slop-rules `검사` 치명 0 + MARKS 어휘 0 + `공통짜임새` 0 + 제목 질문형(`?`·`요`·`까`로 끝) + 문단 80~400 + 소제목 ≤4. 걸리면 기존 review 다듬기(숫자·소제목·링크 고정) 1회 → 그래도 걸리면 쓰기 모델에 고침 목록 주고 다시 쓰기 1회(다시 쓴 글은 a부터) — 합 2회. 그래도 걸리면 실패
     - CLAUDE.md 「AI 가 쓴 티」 각 줄 → 잡는 규칙 이름 표를 test-post-auto 에 넣는다. 빈 칸이면 slop-rules 에 규칙 추가. 지금 빈 것으로 보이는 둘: 「결론에서 앞 말 반복」(마지막 문단 vs 앞 문단 `겹치나`), 「목록 남발」(목록 덩어리 2개 이상 또는 항목 8개 초과)
   - **(c) 원장 관점** — 쓰기와 다른 호출, 쓰기 프롬프트를 안 봄. `클로드코드(..., {purpose:"감수", capRequired:true})`. 프롬프트: CLAUDE.md 절대 규칙 6줄 + AI 티 목록 + 9/23 버린 이유 + 9/28 내린 이유 + 「너는 이 학원 원장이다. 학부모가 읽고 광고로 느낄 곳을 찾아라」. 출력 `{걸림:[{문장, 종류:"광고"|"학원홍보마무리"|"불안팔기"|"지어낸경험"|"일반론"|"번역체"}], 말리기:"하지 말라고 한 문장 원문"}`. 통과 = 걸림 0 **그리고** 말리기 문장이 본문 부분문자열. 본문에 없는 걸림 문장은 버리되 기록. JSON 깨짐 → 실패
   - **(d) 가림** — masks.mjs `가림검사(제목+요약+본문, await DB고객말(q, 1))` + 옛 이름 `["로보티즈키즈랩","반포교육원","2호점"]`(9/28). 걸리면 실패(자동으로 안 지움 — 글 전체 판단)
   - 4개 통과 → notes.감수 = `{통과:true, 해시:본문해시(body), 날:KST}` + '감수' 행 passed=true
9. 발행(core, D89):
   - `발행가능(q, slug, {자동})`: 지금 publishDraft SQL 조건 그대로(그림 있음·비공개이유 없음·post_images 다 있음). 자동이면 **+** notes.감수.통과 **+** `본문해시(body) = notes.감수.해시` **+** geo.settings post_auto_publish='on'(못 읽으면 false). 아니면 `{ok:false, 왜}`
   - `발행(q, slug, {누가})`: publishDraft 의 update + announce 일감 + review 일감 완료 + 활동(「자동 감수 통과 발행」/「원장 승인 발행」)을 옮김. `web/lib/draft-actions.ts publishDraft` 는 이걸 부름(누가='원장', 자동 조건 안 봄 — 원장 판단이 감수)
   - 부르는 곳: company `illustrate` 「붙임」 직후 + company `review` 가 그림 이미 있는 글을 통과시킨 직후. 둘 다 발행가능 먼저. post_reviews '발행'
10. company `review(t)`: post_auto_publish='on' 이고 notes.주제 있음(자동 글) → `auto-post.mjs --review` → 통과→완료 · 내일다시→대기 nextTry 내일 06:30 KST · 버림→닫힘 · 미룸→대기 뒤(6). 아니면(스위치 off·세션 초안) 지금 코드 그대로 「사람 대기」. 버림: draft_feedback(reasons ['자동 감수 3회 실패'], note=마지막 실패 사람 말) → 초안 delete → 재료 used_in 에서 slug 제거 → weekly-draft 일감 next_try=내일
11. 내리기(D91): `내리기(q, slug, {이유})` = published=false + review_notes.비공개이유 「원장 내림 <날>: <이유|이유 안 적음>」 + post_reviews '내림' + 활동 + deliver 일감 kind `announce-removal`(실행기는 indexnow.mjs 그대로, company EXEC 에 추가) + naver_log_no 있으면 사람 대기 일감 「네이버 글도 내려 주세요」(블로그 주소: naver-blog-post.mjs 가 쓰는 블로그 아이디 env — Bob 확인)
    - `web/lib/draft-actions.ts takedownPost(form)` (guard 동일) → core 내리기
12. 화면·보고:
    - `/admin/drafts` 위 「자동 글」 절: 감수 중 초안 + 최근 30일 자동 발행 글. 카드 = 제목 · 고른 이유 · 쓴 재료(원문 앞 40자) · 대조한 출처(주소 + 맞은 문장 수 / 못 읽은 곳 / 지운 문장 원문) · 감수 4줄(통과/걸림 + 사람 말) · 회차 n/3 · [내리기](발행 글만, 이유 한 줄 선택)
    - `/admin/ops` 콘텐츠 줄 + pm-report 아침 보고: `글기록말` 한 줄 — 「이번 주 글: 감수 2/3회 — 출처에 없는 숫자 1곳(국민대 정원)」「10/13 자동 발행: …」「이번 주 못 냄 — 주제 2개 다 3번 걸림」
13. 문서:
    - CLAUDE.md 「사람만 할 수 있는 일」의 `- 발행 전 사실 확인` 을 이 줄로 교체:
      `- 자동 발행된 글 훑어보기 — 이상하면 /admin/drafts 「내리기」 한 번. 발행 전 확인은 자동 감수(출처 원문 대조·AI 티·원장 관점·고객사 가림)가 하고, 하나라도 걸리면 안 나간다`
    - `.claude/skills/post/SKILL.md` 4절 앞: 세션이 손으로 쓴 글도 `node scripts/auto-post.mjs --review <slug>` 통과 뒤 발행. 7절(topics.json slug·커밋)은 세션 경로라 유지
    - write-draft.mjs·write.yml·fact-check.mjs 머리 주석의 「판단은 사람」「발행은 사람」 갱신

- Flag: 감수 기준을 느슨하게 만들지 않는다. 애매하면(파싱 실패·근거 부분문자열 불일치·스위치 못 읽음) **안 나간다**.
- Flag: 해시는 4관문 통과 시점 본문으로만 찍는다. illustrate 는 이미지 줄만 더하므로 해시 불변. 그 밖이 바뀌면 발행가능이 막는다 — 맞는 동작.
- Flag: 회차는 하루 1번. company 가 매시 돌아도 같은 날 두 번째 감수는 미룸.
- Flag: 공급자 한도(`한도:true`)는 실패 아님. 회차 안 셈.
- Flag: 다른 고객(아이로그·문서딱) 경로는 바꾸지 않는다(D93).
- Flag: 원장 버튼 publishDraft 동작은 core 로 옮겨도 그대로(회귀 테스트).

## 실패 모드
| 경로 | 운영에서 일어날 일 | 처리 | 사람에게 |
|---|---|---|---|
| 출처 가져오기 | 언론사가 Actions IP 막음·JS 렌더 | 그 문장 「없음」→ 지움. 전부 막히면 미룸 | 카드 「못 읽은 출처 n곳」 |
| 출처 PDF(국민대 모집요강) | 본문 못 읽음 | 근거 아님. 다른 기사에 같은 숫자 있으면 통과 | 카드 |
| 판정 Claude | 근거를 지어냄 | 근거가 창 부분문자열 아니면 「없음」 | 테스트 |
| 원장 관점 Claude | 「문제 없음」 남발 | 말리기 문장 원문 인용 필수 — 못 대면 실패 | 카드 |
| 문장 지우기 | 앞뒤가 안 이어짐 | (b)(c)가 지운 본문으로 돈다 | 카드에 지운 문장 원문 |
| 도해 | 감수 뒤 본문이 바뀜 | 해시 불일치 → 발행 막힘 → 다음 review | 카드 「감수 뒤 본문이 바뀜」 |
| 주제 | 같은 주제 두 번 | topic_key + 28일 낱말 + 제목 정규화 | --pick --dry 표 |
| 재료 | 옛 글 사실을 지금 일로(9/28 재발) | p# 연도 붙임·과정 글 금지·옛 이름 가림 | (d) 실패 |
| 한도 | 측정이 하루 몫을 다 씀 | 미룸, 회차 안 셈 | 아침 보고 「한도로 미룸」 |
| 스위치 | geo.settings 못 읽음 | 발행 안 함, 초안 보존 | ops 줄 |
| 내리기 | 네이버엔 남음 | 사람 일감(로그인 필요) | 오늘 할 일 |
| 주 1편 | 버림 2번 → 그 주 0편 | '못냄' 한 줄, 다음 월요일 | 아침 보고 |

조용한 실패(테스트·처리·표시 다 없음) 남은 것 없음. 「판정이 맞았나」의 마지막 그물은 사후 내리기 — 원장 결정 범위.

## Test map (`test-post-auto.mjs` 새 파일 — 전부 [GAP], 이번에 채움)
- 주제키: 물음표·공백 차이 → 같은 키
- 후보모으기(가짜 q): A·B·C·D 각 1건 → 4후보 · 같은 질문 A+B → 1후보 점수 합 · brand stage 제외
- 거르기: 발행 키 영구 · 버림 8주 안/밖 · 재료부족 4주 · 28일 낱말 2개 겹침 제외/1개 통과 · 과정 글 학원사실필요
- 재료 관문: 학원사실필요 + m·i 0 → 재료부족 · p# 만 → 재료부족 · 비공개이유 글은 p# 에서 빠짐
- 주장뽑기: 목록 번호·「3단계」 제외 · 「2027학년도」「10명」「국민대」「신설」 잡힘 · 숫자 없는 판단 문장 대상 아님
- 창찾기: 1,500·전각 숫자 · 숫자 있는데 300자 안 고유명사 없음 → 없음
- 판정 파서: 근거가 창 밖 → 없음 · JSON 깨짐 → 전부 없음
- 문장지우기: 문단 < 80자 → 문단째 · 빈 절 → 소제목째 · 첫문단지움 감지
- 본문해시: 이미지 줄 더해도 같음 · 글자 하나 바뀌면 다름
- 다음행동: 1·2회 실패 → 내일다시 · 3회 → 버림 · 한도 → 미룸(회차 그대로) · 같은 날 두 번째 → 미룸
- 원장 관점 파서: 말리기 인용 본문에 없음 → 실패 · 본문에 없는 걸림 → 버리고 기록
- 가림: DB 고객 이름 → 실패 · 「로보티즈키즈랩」 → 실패 · 「로보티즈 드림」 → 통과
- 발행가능: 해시 다름 · 스위치 off · 스위치 못 읽음 · 그림 없음 · 비공개이유 → 각각 false+왜 · 원장 버튼(자동 아님)은 감수 없이 true
- 내리기: published=false·비공개이유·announce-removal·네이버 일감(가짜 q SQL 순서)
- AI 티 규칙표: CLAUDE.md 줄마다 규칙 이름 있음
- 글기록말: 영문 키·JSON 조각 없음(test-ops-words 금지어 재사용)
- 회귀(그대로 통과): test-ops-words · test-todo-words · test-client-status · test-repair-core · test-marketing · tsc web·academy (`node ./node_modules/typescript/bin/tsc` — npx 는 경로 `&` 로 깨짐)

## Out of Scope
- 아이로그·문서딱 세션 글(D93): 틀(주제 기록·AI 티·원장 관점·가림)은 옮겨진다. 그러나 사실의 원문이 기사가 아니라 그 고객 **제품 코드**고(9/30 아이로그 초안 「출결 내보내기 없음·예약 발송 없음」), 발행이 고객 저장소 커밋·배포다. 대조기가 달라 Step 44 후보. KG-43-1
- 네이버 글 자동 내리기(로그인 필요) — 사람 일감까지. KG-43-2
- 한글 숫자 표기(「열 명」) 대조 — 아라비아 숫자만. KG-43-3
- PDF 본문 추출(의존성 추가) — KG-43-4
- topics.json slug 채우기 — 자동 경로는 post_reviews 가 기록
- /admin/material 재료 입력 화면

## Acceptance
- 43a 먼저 합칠 수 있음: 테이블·core·테스트만, 발행 동작 변화 0
- `node scripts/test-post-auto.mjs` 전부 ✓ + 회귀 0 실패 + tsc 0
- `node scripts/auto-post.mjs --pick --dry` 운영 DB 읽기 — 후보표(신호·점수·이유)와 뺀 이유가 사람 말로. 국민대·68시간 주제가 28일 겹침으로 빠지는지 REVIEW-REQUEST 에 붙임
- `node scripts/auto-post.mjs --review 2027-algorithm-talent-admission-kookmin --dry` — 출처 8곳 실제 fetch 결과(읽음/못 읽음/PDF), 대조 문장 수, 지웠을 문장, (b)(c)(d) 결과. **로컬 1회 + Actions 러너 1회(workflow_dispatch dry)** — 러너 IP 차단 여부가 이 Step 의 가장 큰 미확인(D86)
- 같은 본문 「10명」→「12명」 가짜 초안(fixture, DB 안 씀) → (a) 에서 그 문장 「없음」
- 가짜 초안 끝에 「우리 학원으로 오세요」 → (b) 또는 (c) 실패
- setup-post-reviews 운영 적용 + post_auto_publish='on' select 확인
- /admin/drafts 자동 글 절·내리기 버튼 운영 주소 화면 확인(누르지 않음)
- CLAUDE.md 한 줄 교체 · post SKILL · 주석 갱신
- 배포: web `git push`(Vercel) · company·write 는 Actions 가 main 사용 · academy 사이트 코드 변경 없음(바뀌면 `npx vercel --prod --yes`)
