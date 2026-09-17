# Review Request — Step 7 매일 AI 추천 개선 루프
*Builder → Reviewer. 브리프: handoff/ARCHITECT-BRIEF.md (Step 7)*

## 바뀐 파일
- `academy/scripts/ai-measure.mjs` (새) — 승인 질문 20개를 gemini(google_search)·groq/compound 에 묻고 `academy.ai_measurements` 에 적재
- `academy/scripts/daily-agent.mjs` (재작성) — 판정 → 고르기 → 행동(entity/content/offsite) → `geo.agent_runs` 원장
- `academy/scripts/write-draft.mjs` — `--question/--stage/--sources` 모드, 기존 글 덮어쓰기 금지, `DRAFT_SLUG=` 출력
- `.github/workflows/optimize.yml` — 측정 → 루프. 측정 실패는 끝에서 빨간불
- `web/lib/ops.ts`, `web/app/admin/ops/AgentBoard.tsx` — `day` 예약어 별칭 오류 수정(카드가 원장을 못 읽던 원인), 최근 7줄·엔진별 측정 표시
- `web/db/schema.sql` — agent_runs 칸 추가

## 확인한 것
- `node --check` 3개 통과, `tsc --noEmit` 통과
- `daily-agent.mjs --dry` (측정 0건) → 「최근 7일 자동 AI 측정이 없습니다」 실패 경로, DB 행 안 씀 (단 `alter table add column if not exists` DDL 은 돈다)
- `ai-measure.mjs` 키 없음 → 종료코드 78
- `write-draft.mjs --dry --question ...` 프롬프트에 질문·경쟁 출처 들어감

## 못 한 것 (로컬에 API 키 없음)
- 실제 gemini/groq 응답 모양 — push 후 workflow_dispatch 로 확인 예정
- 초안 작성 → slop-check → 원장 경로 실제 실행

## 봐 줄 곳
- 날짜: KST 로 run_day·measured_on 을 명시했는지, UTC 로 새는 곳
- 같은 날 재실행 시 초안 중복 방지(`todayRun`)
- 「실패」「사람 대기」「판정 전」 상태가 질문을 영원히 잠그는 경로
- 브랜드 질문 적중 규칙, 「똑똑한 로봇&코딩」 제외 정규식
- 지어낸 결과를 원장에 적는 경로가 없는지 (실행 안 했는데 완료)
