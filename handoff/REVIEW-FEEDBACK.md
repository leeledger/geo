# Review Feedback — Step 8 에이전트 회사 (재검토, HEAD abaf0c0)
Date: 2026-09-17
Ready for Builder: NO

## 앞선 Must Fix 1~4 확인
- 1 발행 알리기 sticky: 해결. sticky, payload 병합, attempts=0 이 들어갔고 실패도 기록한다.
- 2 신호원별 닫기: 해결. `읽음` 집합과 dedupe_key 로 가려 닫는다. 재개방 시 attempts 는 0 으로 돌아간다. UPDATE 는 옛 행 값을 보므로 CASE 가 맞다. 집어 가기는 `for update skip locked` 로 원자적이다.
- 3 LLM 다듬기 가드: 해결. 숫자 multiset, 소제목, 링크 비교가 있고 길이 0.9–1.15, 낙관적 잠금(`updated_at::text` 는 마이크로초까지 되돌아옴), 원문 보존과 되돌리기(guard 포함)가 들어갔다. Arch 결정(엄격 가드 하 자동 적용)을 따른다.
- 4 네이버 중복: 대부분 해결. 남은 두 경로는 아래 1·2.

## Must Fix
1. `tools/naver-blog-post.mjs:391-397` + `tools/local-agent.mjs:316, 322-324` — 최종 발행 클릭 뒤에 죽으면 중복으로 올라간다.
   - 경로: 391행에서 발행을 누른 다음 13초 대기(392) 사이에 창이 닫히거나 브라우저가 죽으면 "Target closed" 같은 예외로 끝난다. 이때 출력에는 `발행된 것으로 보입니다` 도 `화면이 그대로입니다` 도 없다.
   - 결과: `발행했을수도` 가 false 가 되어 시도 일감이 `닫힘` 이 되고, 다음 실행이 같은 글을 다시 올린다.
   - 고칠 것: 391행 직전에 `console.log("발행 버튼을 누릅니다")` 를 찍고 이 문구를 정규식에 넣는다. 더 안전한 방법도 있다. 판정을 뒤집어 「발행 버튼을 누릅니다」가 **없을 때만** 닫힘으로 하고, 나머지는 모두 사람 대기로 둔다.
2. `web/lib/task-actions.ts:463-469` (AgentBoard `했어요` 버튼) — 네이버 확인 일감에서 「했어요」를 누르면 다시 올라간다.
   - 경로: naver-attempt 사람 대기 일감은 「올라갔는지 확인」하라는 일이다. 원장이 올라간 것을 보고 「했어요」를 누르면 상태가 `완료` 가 된다. 하지만 SQL 로 logNo 를 적지 않았으므로 `naver_log_no` 는 null 이다.
   - 결과: `local-agent.mjs:301-302` 는 완료/닫힘 시도를 「다시 해도 됨」으로 본다. 다음 실행에서 같은 글이 또 올라간다.
   - 고칠 것: kind='naver-attempt' 인 일감에는 「했어요」 대신 두 동작을 둔다.
     (a) logNo 입력칸과 「올라가 있음」 버튼. guard 를 거쳐 `update academy.posts set naver_log_no=$1, naver_at=now() where slug=$2 and naver_log_no is null` 을 실행하고 일감을 완료한다.
     (b) 「안 올라감 — 다시 시도」 버튼. 일감을 닫힘으로 둔다.
     `finishTask` 는 `kind <> 'naver-attempt'` 로 막는다.
3. `academy/scripts/write-news.mjs:193-202` — 거짓 완료가 생긴다.
   - 경로: `on conflict ... where not academy.posts.published` 로 발행 글 덮어쓰기는 막혔다. 그런데 0행이어도 `DRAFT_SLUG=` 를 찍는다.
   - 결과: `company.mjs` weekly-draft 가 초안이 없는데도 `완료 · 초안 작성` 으로 기록한다.
   - 고칠 것: `returning slug` 를 붙이고, 행이 있을 때만 `DRAFT_SLUG` 를 찍는다. 없으면 「발행된 글과 슬러그가 겹침」을 찍고 `process.exitCode = 1` 로 끝낸다.

## Should Fix
- `academy/scripts/company.mjs` review — `notes.원문` 을 본문 update 와 따로, 나중에 저장한다. 그 사이 러너가 죽으면 원문이 사라진다. 본문 update 한 문장에 `review_notes = review_notes || jsonb_build_object('원문', $4::text)` 로 함께 넣는다.
- `company.mjs` 근무 시작의 「멈춘 실행 중 되살리기」가 90분 지난 `naver-attempt` 까지 `대기` 로 바꾼다. 실행기는 없고 보드에는 「다음 일」로 계속 남는다. 중복 위험은 없다. `and kind = any(EXEC 키)` 로 좁힌다.
- `web/lib/draft-actions.ts` revertDraft — 다듬은 뒤 원장이 직접 고친 내용도 말없이 버린다. 버튼 옆에 「직접 고친 내용도 사라집니다」를 적는다.

## Cleared
앞선 Must Fix 1~3 은 해결됐다. 4 는 위 1·2 의 두 경로만 남았다. 새로 들어온 revertDraft, finishTask 의 인증 guard 와 원문 렌더 XSS 는 문제없다.
