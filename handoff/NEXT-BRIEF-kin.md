# Next Brief — Step 41 (문서딱 지식iN: 실제 질문 먼저, 등록 직전까지 자동)

Step 40 배포·기록 뒤에 ARCHITECT-BRIEF.md 로 옮긴다. 원장 결정 2026-10-10 「등록 직전까지 자동」(BUILD-LOG D67~D71).

## Goal
지식iN 답은 kin.naver.com 의 실제 최근 질문에 맞춰 쓰고, 원장은 현황판 버튼 하나로 그 질문 페이지가 답이 채워진 채 열리면 「등록」만 누른다.

## 왜
지금은 AI 가 질문을 상상해 답부터 쓰고(marketing-draft.mjs 대상고르기 = 승인 검색어), 원장이 맞는 실제 질문을 찾는다. 거꾸로라 초안 8건(지식iN 4·카페 4)이 밀렸다.

## 흐름

```
 PC local-agent (하루 1번, 12:40 차례)
   ① kin-find  tools/.browser-profile-docttak 로 kin.naver.com 검색
               검색어 = 문서딱 승인 검색어(keyword stage) 차례로
               거름: 7일 안 질문 · 채택 답 없음 · 답 3개 미만 · 본문이 문서딱 도구로 풀리는 것
               → geo.kin_questions (url unique) 저장, 상한 하루 3개 후보
   ② 답 쓰기   후보 1개만(하루 1건 상한) marketing-draft.mjs --client docttak --kin-question <id>
               질문 본문 + 그날 가져온 문서딱 페이지 본문만 근거. 기존 숫자 게이트·slop·
               「제가 만든 무료 도구입니다」 밝힘 그대로 → marketing_posts(jisikin, 초안, kin_question_id)
 현황판 「오늘 올릴 글」 카드
   질문 제목·본문 앞 200자·질문 날짜 + 답 초안 + [이 질문에 답하기]
   [이 질문에 답하기] → agent_tasks kind open-kin 「로컬 대기」(Step 39b 로그인 창과 같은 길)
        → pc-runner login-poll 이 집음 → 프로필로 질문 페이지 열고 답 입력칸에 채움 + 클립보드
        → 등록 클릭은 원장. 자동 등록 코드 없음(약관)
   원장이 등록 → 카드 「올렸어요」(주소 = 질문 주소로 미리 채움) → 올림
```

## Build Order
1. 표 `geo.kin_questions(id, client_id, url unique, title, body, asked_at, answers int, adopted bool, query, found_at, status '후보'|'씀'|'버림')`. marketing-core MARKETING_DDL 에 붙임, marketing_posts 에 `kin_question_id bigint null` 추가.
2. `tools/kin-find.mjs --client docttak [--dry]` — Playwright, 프로필 tools/.browser-profile-docttak (없거나 로그인 풀림이면 Step 39b login-<slug> 사람 일감 한 건, 건너뜀). 화면 글자 읽기만 — 클릭은 검색·질문 열기까지. 판정 문구·셀렉터는 첫 실행에서 `--look` 으로 원문 찍어 확정(Flag: 셀렉터를 짐작해 쓰지 말 것). 요청 사이 3~6초 쉼, 하루 검색 10회 상한.
3. `marketing-draft.mjs` — `--kin-question <id>`: 대상고르기 대신 그 질문. 프롬프트에 질문 본문을 넣고 「질문에 나온 상황에만 답한다, 질문에 없는 상황을 지어내지 않는다」. 맞는 문서딱 페이지가 없으면 안 쓰고 kin_questions 버림(이유 기록).
   - 매일 채널에서 `cafe` 를 뺀다(D69). `jisikin` 은 Actions(optimize.yml:100)에서 빼고 PC 쪽 ②로만. 블로그는 그대로.
4. `tools/local-agent.mjs` — 문서딱 차례에 ①→② (하루 1건: 그날 kin_question_id 있는 jisikin 초안이 있으면 건너뜀).
5. open-kin 창 — `web/lib/login-core.mjs` 창요청 꼴을 따라 `kin-open` 요청(30분 지나면 버림) + `tools/login-poll.mjs` 가 집어 `tools/kin-open.mjs <marketing_post_id>`: 프로필로 질문 주소 열기 → 답 입력칸 찾기 → 본문 채우기 + 클립보드. 「등록」 버튼은 건드리지 않음 — 코드에 등록 셀렉터를 두지 않는다. 12분 뒤 창 닫음(로그인 창과 같은 시간).
6. `web/app/admin/ops/Marketing.tsx` 지식iN 카드: 질문 제목·날짜·본문 앞 200자·질문 링크, 버튼 「이 질문에 답하기」(server action → kin-open 요청), 「올렸어요」는 posted_url 기본값 = 질문 주소. 질문 없는 옛 초안은 버튼 없음.
7. 밀린 초안 정리 스크립트(한 번): 카페 초안 4건 버림 「카페 멈춤(D69)」. 지식iN 초안 4건은 kin-find 로 그 target_query 검색 → 7일 안 맞는 실제 질문이 있으면 kin_question_id 붙이고 ③으로 다시 씀, 없으면 버림 「실제 질문 없음(D70)」.

## Failure modes
- 네이버 화면 바뀜 → 셀렉터 못 찾음: kin-find 는 0건 + 활동 실패 한 줄(조용히 0 아님). kin-open 은 입력칸 못 찾으면 클립보드만 채우고 창은 띄움 — 카드에 「입력칸을 못 찾아 클립보드에만 넣었습니다」.
- 로그인 풀림 → login-docttak 사람 일감(기존 길).
- PC 꺼짐 → open-kin 30분 뒤 「PC 가 안 켜져 있었습니다」(login 과 같은 규칙).
- 같은 질문에 두 번 답 → kin_questions url unique + status '씀'.
- 차단·캡차 → 멈추고 사람 일감, 우회 안 함.

## Test map
- kin 후보 거름(날짜·채택·답 수·도구 맞음) 순수 함수 [GAP → test-kin.mjs, `--look` 원문 fixture]
- marketing-draft --kin-question 프롬프트에 질문 본문·밝힘 문구 · 맞는 페이지 없음 → 버림 [GAP → test-marketing.mjs]
- 하루 1건 상한 [GAP]
- kin-open 에 등록 버튼 셀렉터 없음(정적 grep 시험) [GAP]
- cafe 매일 채널에서 빠짐 · Actions 에서 jisikin 빠짐 [GAP → test-docttak.mjs]
- 회귀: test-marketing · test-docttak · test-login

## Out of Scope
- 자동 등록(약관 — 하지 않는다)
- 카페 재개
- 학원·아이로그 지식iN

## Acceptance
- PC 에서 `node tools/kin-find.mjs --client docttak --dry` 가 실제 질문 3개 이하를 주소·날짜·답 수와 함께 찍음
- 다음 날 현황판 문서딱 「오늘 올릴 글」에 실제 질문이 붙은 지식iN 초안 1건, 버튼을 누르면 2분 안에 PC 에 질문 페이지가 답이 채워진 채 뜸, 등록은 원장
- 밀린 카페 4건 버림, 지식iN 4건은 질문 붙음 또는 버림
