# Review Feedback — Step 8 에이전트 회사
Date: 2026-09-17
Ready for Builder: NO

## Must Fix

1. `web/lib/draft-actions.ts:47-52` — 발행 후 알리기(announce) 일감이 한 번도 실행되지 않는다.
   payload 가 `{ slug }` 뿐이라 sticky 가 아니다. 다음 회사 루프는 `계획()` 을 `근무()` 보다 먼저 돈다.
   `company.mjs:234-240` 의 「신호 사라짐」 닫기가 이 일감을 본키에 없다고 곧바로 `닫힘` 으로 만든다.
   그러면 IndexNow 알림, gsc-submit, naver-transfer 로컬 일감이 하나도 안 생긴다.
   고칠 것: payload 를 `JSON.stringify({ slug, sticky: true })` 로 준다.
   on conflict 쪽에도 `payload = geo.agent_tasks.payload || excluded.payload` 를 넣는다.
   insert 의 `.catch(() => {})` 는 삼키지 말고 `log(..., ok=false)` 로 남긴다.

2. `academy/scripts/company.mjs:179-182, 160, 233-240` — 신호원을 못 읽었을 때도 일감을 전부 닫는다.
   scout 가 실패하거나 시간 초과, JSON 파싱 실패로 `found=[]` 가 되면 정찰에서 온 일감이 모두 `닫힘` 이 된다.
   GH API 를 못 읽어도(`GH_TOKEN` 없이 로컬 `--plan`, 403/5xx) `wf-*` 일감이 모두 닫힌다.
   다음 시간에 신호가 돌아오면 `닫힘→대기` 로 바뀌고 `next_try_at=now()` 가 된다.
   그래서 관찰 대기와 cooldown(who-wins 7일, crawl-push 7일)을 건너뛰고 LLM 분석과 IndexNow 를 다시 돌린다.
   고칠 것: 신호원별 성공 여부를 기록한다(scoutOk, ghOk, inquiriesOk, leadsOk).
   닫기는 성공한 신호원에서 온 kind/key 접두사에만 적용한다. scout 가 `!sc.ok` 이면 정찰 쪽은 닫지 않는다.
   `indexOf("[")` 가 -1 인 경우도 실패로 친다.

3. `academy/scripts/company.mjs:361-385` — LLM 다듬기가 원장 확인 전에 본문을 덮어쓴다. 사실 변경을 막는 가드가 모자라다.
   (a) 원문을 어디에도 남기지 않는다. 그런데 검토 화면(`page.tsx:135`)은 「사실은 원문 그대로인지 확인해 주세요」라고 한다. 비교할 원문이 없다.
   (b) 숫자 검사가 한쪽만 본다. 없던 숫자만 막고, 원문 숫자가 사라지거나 다른 숫자로 바뀐 경우("3개월"→"석 달", 숫자 문장 삭제)는 통과한다.
   (c) 프롬프트가 「못 바꾸겠으면 그 문장을 지운다」를 허용한다. "안 쟀다" 같은 단서 문장이 조용히 빠질 수 있다. 길이 -20% 까지 허용된다.
   (d) 경합이 있다. 원장이 LLM 호출(수 분) 사이에 `saveDraft` 로 고친 본문을 `update ... where slug=$1 and not published` 가 덮어쓴다.
   고칠 것:
   - 덮어쓰기 전에 `notes.원문 = post.body` 를 저장한다. 검토 화면에 원문과 다듬은 본문의 차이(최소한 「원문 보기」)를 보여 준다.
   - 숫자 multiset 이 원문과 정확히 같을 때만 채택한다. 추가, 삭제, 변경 모두 버린다.
   - `##` 소제목 목록과 링크/이미지 목록이 같을 때만 채택한다.
   - 프롬프트에서 「지운다」를 뺀다. 길이 하한을 0.9 로 올린다.
   - update 에 `and updated_at = $3`(읽을 때 값)을 붙이고, rowCount 0 이면 버린다.

4. `tools/local-agent.mjs:90-115` — 네이버에 두 번 올라가는 경로가 남아 있다.
   `naver-blog-post.mjs:403-407` 은 발행에 성공해도 주소에서 logNo 를 못 뽑으면 DB 에 안 적는다. 「손으로 적어야 합니다」만 찍는다.
   execFileSync 15분 timeout 도 문제다. 로그인 대기 8분과 편집 시간이 더해져 발행 클릭 뒤에 죽을 수 있다. 이때도 `naver_log_no` 는 null 이다.
   local-agent 는 두 경우를 일반 실패로만 기록한다. 다음 실행(하루 두 번)이 14일 창 안에서 같은 글을 다시 올린다.
   고칠 것: 이관을 시작하기 전에 해당 slug 의 시도를 DB 에 남긴다. 예를 들어 naver-transfer 일감을 `실행 중` 으로 바꾸고 `payload.tried_at` 을 넣는다.
   출력에 `발행된 것으로 보입니다` 가 있거나 timeout 이면서 logNo 가 없는 경우에는 재시도하지 않는다.
   이런 글은 `사람 대기`(「네이버에 올라갔을 수 있음 — 블로그 확인 후 logNo 기록」)로 올리고, 이후 자동 대상에서 뺀다.
   posts 쿼리에서 시도 기록이 있는 slug 는 제외한다.

## Should Fix

- `company.mjs:113-129` — `닫힘/완료→대기` 로 다시 열 때 `attempts` 를 0 으로 되돌리지 않는다. 새로 실패한 워크플로는 재실행 없이 곧장 사람 대기로 간다. crawl-push 와 brand-defense 도 첫 시도에서 사람 대기로 간다. 재개방 case 에서 `attempts = 0` 으로 둔다.
- `company.mjs:436-446` — 집어 가기가 원자적이지 않다(select 후 update). CI concurrency 는 막히지만 로컬에서 수동 실행하면 겹친다. `update ... set status='실행 중' where id=$1 and status='대기' returning id` 로 집고, 0행이면 건너뛴다.
- `company.mjs:335-338` — write-news 는 `DRAFT_SLUG=` 를 안 찍는다(「슬러그 X」만 찍는다). 초안은 써졌는데 일감이 `실패` 로 기록된다. `/슬러그 (\S+)/` 도 받는다.
- `academy/scripts/write-news.mjs:192-198`(기존 코드, 이번에 자동화됨) — `on conflict (slug) do update` 가 `published` 를 보지 않는다. 모델이 이미 발행된 slug 를 내면, 발행된 글 본문을 사실 확인 없이 덮는다. `where not academy.posts.published` 를 붙이거나 충돌하면 slug 에 접미사를 단다. 범위 밖이면 BUILD-LOG Known Gaps.
- `company.mjs:309-323` — who-wins 결과의 `query`/`targets` 가 scout 출력(`r.out`)에 실제로 있는지 확인하지 않는다. 지어낸 도메인으로 등재 일감이 생길 수 있다. `r.out.includes()` 로 거른다.
- `company.mjs:450-452` + 실행기 — MAX=4 에 write-draft 15분 × 여러 건이 걸리면 55분 잡 timeout 에 잘린다. 예산 체크를 kind 별 최대 소요로 바꾸거나 MAX 를 낮춘다.
- `tools/local-agent.mjs:47-51` — lock 확인과 생성이 원자적이지 않다. `fs.openSync(LOCK, "wx")` 를 쓴다.
- `tools/local-agent.mjs:120-133` — `submit-gsc` 가 로그인 외 이유로 실패(`!r.ok`)해도 `로그인됨("google")` 이 로그인 일감을 완료로 만든다. `r.ok` 일 때만 부른다.
- `tools/local-agent.mjs:102-104` — 완료 update 가 `client_id=1` 로 고정돼 있다. 다른 고객사 naver-transfer 일감은 닫히지 않는다. 지금은 발행 고객사가 1곳뿐이라 영향이 없다.
- sticky `사람 대기` 일감(listing, login 등)은 대시보드에서 완료 처리할 방법이 없어 계속 쌓인다. 「했음」 버튼(guard 포함 서버 액션)이 필요하다.
- `draft-actions.ts:15` — `isAdmin()` 에 key 를 안 넘긴다. `?key=` 옛 토큰으로 들어온 사람에게는 화면은 보이는데 버튼이 예외를 낸다. 보안상으로는 안전한 쪽이다. 안내만 필요하다.

## Escalate to Architect

- LLM 다듬기를 원장 확인 전에 본문에 직접 쓰는 방식이 맞는가? 아니면 `review_notes.제안본문` 에만 두고 원장이 「적용」을 누르게 할 것인가? 「발행 전 사실 확인은 사람만」 규칙과 닿는 제품 결정이다.

## Cleared

서버 액션 3개 모두 guard 가 먼저 돈다. `render/esc` 는 escape 를 먼저 하고 https 링크만 허용해 XSS 가 없다.
`일감()`/`상태()` SQL 파라미터 타입($9 text 재사용, $11 int, $3::text, $5::timestamptz)은 문제없다.
ops.ts 와 AgentBoard 는 React escape 와 http 링크 제한으로 안전하다.
