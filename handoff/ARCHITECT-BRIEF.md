# Architect Brief
*Written by Architect. Read by Builder and Reviewer. Overwrite each step.*

---

## Step 7 — 매일 AI 추천 개선 루프를 사람·세션 없이 돌게 한다

### 지금 문제 (Arch 확인, 2026-09-17)
- `optimize.yml` + `daily-agent.mjs` 는 DB 숫자로 병목 문장 하나를 **적기만** 한다. 실행은 Codex heartbeat 에 넘겼는데 Codex 사용 한도가 끝나 아무도 안 한다
- AI 답변을 자동으로 재는 장치가 없다. 기준선은 수동 8건(09.10)·2건(09.17)뿐
- 대시보드 `개선 담당` 카드가 원장을 못 읽는다 — `web/lib/ops.ts:307` `run_day::text day` 에서 `day` 가 예약어라 문법 오류, `catch` 가 삼킨다
- `run_day` 기본값이 DB `current_date`(UTC). 07:05 KST 실행이면 전날 날짜로 찍힌다
- GitHub Secrets 에 `GEMINI_API_KEY`·`GROQ_API_KEY` 가 있다. 제미나이는 `google_search` 근거 검색이 되고 출처가 응답에 온다(`writer-common.mjs`)

### 루프 (매일 07:05 KST, GitHub Actions)
1. **측정** `academy/scripts/ai-measure.mjs` — 승인 질문 20개를 API 엔진에 그대로 묻는다
   - gemini(`google_search` 켬), groq(`groq/compound`, 웹 검색 내장). 키 없는 엔진은 건너뛰고 그렇게 적는다
   - `academy.ai_measurements` 에 `collection_method` = `api-gemini-google-search` / `api-groq-compound`, `prompt_id` = `q{position}`, KST 날짜. 같은 날 같은 질문은 다시 안 묻는다
   - 언급: `로봇&코딩`·`로봇앤코딩`·`robotncoding` (단 「똑똑한 로봇&코딩」은 다른 곳 — 제외). 인용: 출처 도메인이 `robotncoding.com`
   - 소비자 ChatGPT 화면이 아니다. 방법이 다르다는 걸 이름에 남기고 다른 방법과 합산하지 않는다
2. **판정** 끝난 행동의 효과를 잰다 — 기준일 전 14일 vs 기준일+7일 이후. 양쪽 표본 5 이상일 때만. 기준일은 글이면 발행일, 색인이면 완료일
   - 적중 = 인용 또는 언급(브랜드 질문은 인용 또는 답에 `석촌` 이 있을 때만 — 질문에 이름이 들어 있어 따라 말하기 때문)
   - 후 적중률이 전보다 20%p 이상 높고 적중 2회 이상 → `효과 있음`, 아니면 `효과 없음`. 기준일 35일 지나도 표본 모자라면 `표본 부족`
3. **고르기** 최근 7일 적중률 50% 미만 질문 중 열린 행동이 없는 것. 우선순위 local → brand → problem → consider, 같으면 적중률 낮은 순
4. **행동** 질문 단계별 사다리에서 `효과 없음` 이 안 난 첫 칸
   - brand: `entity` → `content` → `offsite` / 나머지: `content` → `offsite`
   - `entity` (자동) 홈 JSON-LD 에 주소가 있나 가져와 본다. 있으면 통과로 적고 다음 칸. 없으면 `사람 대기`(코드 수정)
   - `content` 발행된 글 중 질문 핵심어 2개 이상 겹치는 글이 있으면 그 글에 IndexNow → `완료`(기준일 오늘). 없으면 `write-draft.mjs --question` 으로 초안 → `사람 대기`(발행 전 사실 확인). **미발행 자동 초안이 이미 있으면 새로 안 쓴다** — 쌓이기만 한다
   - 이전에 `사람 대기` 였던 글이 발행됐으면 그날 IndexNow 하고 `완료`(기준일 = 발행일)
   - `offsite` 경쟁 출처 상위 도메인을 적고 `사람 대기`(외부 지면 등록은 로그인이 필요)
5. **원장** `geo.agent_runs` 에 하루 한 줄: 진단·행동·근거·대상 질문·행동 종류·대상 글·판정. 실행 안 한 걸 했다고 적지 않는다

### 스키마 (agent_runs 에 칸 추가, 스크립트가 `add column if not exists`)
`target_prompt text`, `action_kind text`, `target_slug text`, `verdict text not null default '판정 전'`, `verdict_note text not null default ''`, `effective_on date`, `judged_at timestamptz`

### Build Order
1. `academy/scripts/ai-measure.mjs` (새 파일)
2. `academy/scripts/write-draft.mjs` — `--question <text> --stage <stage> --sources <csv>` 모드. 주제 은행 대신 질문을 겨냥. slug 는 모델이 로마자로 주고 형식·중복 검사, 기존 글 덮어쓰기 금지. `DRAFT_SLUG=` 한 줄 출력
3. `academy/scripts/daily-agent.mjs` — 위 2~5. `--complete` 는 유지. `--dry` 는 DB 에 안 쓰고 판단만 찍는다
4. `.github/workflows/optimize.yml` — 측정 → 루프, 키 전달, 요약을 `GITHUB_STEP_SUMMARY` 로
5. `web/lib/ops.ts`·`AgentBoard.tsx` — 별칭 수정, 최근 원장 7줄·엔진별 최신 자동 측정 표시
6. `web/db/schema.sql` 동기화, `next build`, 수동 실행 1회로 확인

### Flags
- 발행은 자동으로 하지 않는다 (CLAUDE.md 「발행 전 사실 확인」)
- 측정 수치를 소비자 화면 결과로 부르지 않는다
- 한 엔진 실패가 루프 전체를 멈추지 않게. 전 엔진 실패면 측정 단계 실패로 표시
