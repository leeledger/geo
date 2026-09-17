# Review Request — Step 8 에이전트 회사 (일감 표 · 매시 실행 · 로컬 에이전트 · 초안 검토)
*Builder → Reviewer. 원장 지시(2026-09-17): 카드의 「다음 행동」이 실제로 실행되게. 묻지 말고 완성.*

## 바뀐 파일
- `academy/scripts/company.mjs` (새) — 출근 기록(GitHub 실행→activity), 계획(정찰·초안·문의·리드·작업 실패→agent_tasks, 신호 사라지면 닫힘), 실행기(workflow-failed·site-check·rescan·check-index·brand-defense·who-wins(LLM)·weekly-draft·question-draft·review(LLM 다듬기)·announce·crawl-push)
- `academy/scripts/setup-company.mjs` (새) — agent_tasks·agent_activity·posts.review_notes
- `.github/workflows/company.yml` (새) — 매시 23분, concurrency, actions:write
- `tools/local-agent.mjs` (새) — 원장 PC 작업 스케줄러(12:40·19:10, 등록 완료): 네이버 이관·구글 색인 요청, 로그인 풀리면 사람 대기
- `academy/scripts/write-draft.mjs` — review_notes 저장
- `web/app/admin/drafts/page.tsx`, `web/lib/drafts.ts`, `web/lib/draft-actions.ts` (새) — 초안 읽기·수정·발행·버리기. 발행 시 deliver/announce 일감
- `web/lib/ops.ts`, `web/app/admin/ops/AgentBoard.tsx`, `agent-board.css` — 카드가 일감·활동을 읽음, 「원장님이 하실 일」 목록

## 확인한 것
- `company.mjs --plan` 로컬: 일감 8건 생성. CI 첫 실행 성공 (run 35226173757): write.yml 실패 재실행, 초안 2편 검사→사람 대기
- `tsc --noEmit` 통과, local-agent 스케줄 등록 State Ready

## 봐 줄 곳
- 서버 액션 인증(`draft-actions.ts` guard), 초안 렌더 XSS(`render`/`esc`)
- `일감()` upsert 상태 전이·`상태()` SQL 파라미터 타입, 신호 사라짐 닫기가 sticky·로컬 일감을 잘못 닫는지
- 실행기가 실제로 안 한 일을 「완료」로 적는 경로
- LLM 다듬기 가드(길이·새 숫자)가 사실 변경을 충분히 막는지
- local-agent 이중 실행·잘못된 일감 완료 처리
