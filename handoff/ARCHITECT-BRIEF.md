# Architect Brief — Step 9 · 10 · 11
*Arch 작성 2026-09-22. Bob 은 **Step 9 만** 짓는다. 10·11 은 9 가 배포·기록된 뒤 이 파일을 다시 쓴다.*

---

## 왜 (오늘 확인한 것)

9/22 에 찾은 문제는 전부 사람이 연 세션이 찾았다. 루프는 하나도 못 찾았다.

- who-wins 12일 · write 매주 · optimize 반복 실패 (agent_activity `not ok` — optimize 12건 9/17~9/22, write 6건)
- 측정 4일 정지 (MEASURE_ENGINES 없음) — 「안 돈 것」은 실패 기록조차 안 남는다
- 근거 없이 「완료」 (크레딧 일감 60)
- AI 인용 `cited` 가 **모든 자동 측정에서 0** (openrouter 9/17·9/18, claude-code-web 9/22 20건 중 0). 아무도 「왜 0인가」를 안 물었다
- 크롤러: client 1 microsoft 10.6% · duckduckgo 2.1% / client 2 google·perplexity 10%. `scout.mjs:57` 은 openai·anthropic·google·naver 넷만 본다 — Bing(ChatGPT·Copilot 의 색인)과 Brave(Claude 의 색인)는 감시 밖
- 목표 3(고객)은 담당 에이전트가 없다

지금 회사는 「일감을 집어 처리」는 한다. 없는 것은 **자기 자신을 의심하는 자리**다.

## 전체 순서

| Step | 자리 | 하는 일 | 코드 수정 |
|---|---|---|---|
| **9** | 감사관 + 원인 조사 | 매일 이상 신호를 찾고, 가설을 세워 확인하고, 분류해서 일감으로 넘긴다 | 안 함 (읽기만) |
| 10 | 수리공 | 분류가 `code` 인 조사를 가지에서 고치고, 두 번째 검토를 받고, 합치고, 다음 실행이 실패하면 되돌린다 | 함 (가드 안에서) |
| 11 | 영업 담당 | 케이스 리포트 주간 갱신 · 영업판 후속 · 리드 답장 초안 → 사람 대기 | 안 함 |

9 를 먼저 하는 이유: 진단 없이 수리를 붙이면 엉뚱한 곳을 고친다. 9 의 조사 결과가 10 의 입력이다.

---

# Step 9 — 감사관 · 원인 조사 (이번 세션)

## Goal
매일 아침 루프가 스스로 「반복 실패 · 멈춘 측정 · 근거 없는 완료 · 0 인 지표」를 찾고, 각 건에 가설·확인·분류가 붙은 조사 일감을 만든다.

## Build Order

### 1. `academy/scripts/claude-code.mjs` — 옵션 2개 추가 (기본 동작 불변)
- `cwd` — 주면 그 폴더에서 실행. 안 주면 지금처럼 빈 임시 폴더(끝나면 지우는 건 임시 폴더일 때만)
- `envDrop` — 자식 환경에서 추가로 뺄 키 목록. 기본 `[]`
- 기존 호출자 전부 그대로 돌아야 한다. 인자 기본값만 늘린다

### 2. `academy/scripts/audit.mjs` — 새 파일
`.env.local` 은 **있을 때만** 읽는다 (`fs.existsSync`). Actions 에서는 환경변수로만 받는다.

**2-1. 표 (additive)** — `ensure()` 에서 `create table if not exists`
```
geo.claude_calls (id bigserial pk, at timestamptz default now(), purpose text not null,
  ok boolean not null, secs int, cost_usd numeric, task_id bigint, note text default '')
```
Step 10 에서 모든 호출자의 하루 상한을 여기서 센다. Step 9 에서는 audit 만 기록한다.

**2-2. 규칙 (SQL·GitHub API 만. LLM 없음)**. 한 건마다 `{rule, subject, facts}`. `facts` 는 쿼리 결과 원문(숫자·날짜 포함). 날짜는 전부 `Asia/Seoul`
- **R1 반복 실패** — `geo.agent_activity` 최근 7일 `ok=false` 를 `(agent, action, 정규화 summary)` 로 묶는다. 정규화 = 숫자→`#`, URL 제거, 앞 120자. **3건 이상 · KST 2일 이상에 걸침 · 마지막 실패 뒤 같은 (agent, action) 의 ok=true 없음** 이면 신호. 뒤에 성공이 있으면 「회복」으로 콘솔에만
- **R2 멈춘 측정** — `MEASURE_ENGINES`(env, 쉼표)가 비었으면 신호. 엔진마다 `academy.ai_measurements` 최신 `measured_on` 이 `MEASURE_EVERY_DAYS + 1` 일보다 오래됐으면 신호
- **R3 근거 없는 완료** — 최근 7일 `status='완료'` 인데 `evidence` 가 비었거나 「완료」「성공」 한 단어뿐인 것. 그리고 측정 성격 일감(Bob 이 `company.mjs`·`ai-measure.mjs` 에서 실제 kind/dedupe_key 를 grep 해 목록으로 박는다 — 크레딧 일감 60 포함)이 `완료` 인데 `done_at` KST 당일 해당 표(`ai_measurements`·`serp_checks`)에 새 행이 없는 것
- **R4 영점 — 인용** — 같은 `engine` 의 최근 2회차(서로 다른 `measured_on`, 각 n≥10)가 모두 `cited=0`. 엔진이 `MEASURE_ENGINES` 에 없으면 「비활성 엔진」으로 콘솔만. **엔진끼리 섞어 세지 않는다** (9/22 결정)
- **R5 영점 — 크롤러** — `academy.coverage_by_vendor` 에서 `pages_total ≥ 10` · `coverage_pct < 20` · `first_seen` 이 14일보다 오래된 것. 벤더 전부 본다 (scout 의 넷 한정을 따르지 않는다)
- **R6 출근만 하는 회사** — 최근 48시간 `agent_activity` 에 action 이 「출근」「회사 루프」「자동 작업 %」「감사」가 아닌 ok=true 행 0건. 또는 `company.yml` 최근 실행이 3시간 넘게 없음 · `optimize.yml` 26시간 넘게 없음
- GitHub 실행 목록은 `company.mjs:207 gh()` 방식(GH_TOKEN). 못 읽으면 R6 의 워크플로 쪽은 「못 봄」으로 두고 **그 규칙의 일감은 닫지 않는다**

**2-3. 조사 일감** — `geo.agent_tasks` upsert. company.mjs `일감()`(169)·`상태()`(192)의 SQL 을 그대로 복사해 쓴다. **import 하지 말 것** — company.mjs 는 import 시 main 이 돈다
- `agent='audit'`, `kind='investigate'`, `dedupe_key='inv-<rule>-<subject>'`, 쿨다운 7일, `payload={rule, subject, facts, sticky:true}`
- client_id: 지표가 속한 고객사. 사이티드 자체 일은 1 (company.mjs HOUSE 규칙)
- `sticky:true` 로 company.mjs 의 「신호 사라지면 닫기」(302)에 안 걸리게. 닫기는 audit 이 한다 — 이번 실행에서 신호가 없고 해당 규칙을 **읽는 데 성공한** 조사 일감만 `닫힘` + evidence 「<KST> 신호 사라짐」
- `kind='investigate'` 는 company.mjs `EXEC` 에 없으니 회사 루프가 집지 않는다 (확인만. 코드 변경 없음)

**2-4. 원인 조사 (claude -p)** — 하루 **최대 2건** (`AUDIT_MAX_DIAG`, 기본 2). `geo.claude_calls` 에서 오늘(KST) `purpose like 'audit%'` 를 세서 넘으면 안 부른다
- 대상: `status='대기'` 인 investigate 일감. 우선순위 R6 > R2 > R1 > R3 > R4 > R5, 같으면 client 1 먼저
- 호출: `클로드코드(prompt, { cwd: 저장소 루트, tools: ["Read","Grep","Glob","WebSearch","WebFetch"], model: "sonnet", maxTurns: 20, timeoutMs: 10분, system: 조사관, envDrop: ["DATABASE_URL","GH_TOKEN","GITHUB_TOKEN","LLM_PROXY_TOKEN","LLM_PROXY_URL","GEMINI_API_KEY","GROQ_API_KEY"] })`
  - `CLAUDE_CODE_OAUTH_TOKEN` 은 CLI 인증에 필요하다 — **빼지 않는다**
  - Edit·Write·Bash 는 주지 않는다. Step 9 는 읽기만
- 조사관 시스템 프롬프트 (요지. 문장은 Bob 이 다듬되 규칙은 그대로)
  - 너는 사이티드 운영 조사관이다. 고치지 않는다. 원인을 좁힌다
  - 가설 3개 이상. 각각 「참이면 보일 것 / 거짓이면 보일 것」을 먼저 적고 도구로 확인한다
  - 먼저 `handoff/BUILD-LOG.md` 끝 80줄을 읽는다. 이미 아는 원인(Brave 색인 0건, 네이버 루트 422, Gemini 그라운딩 0 등)은 새 발견으로 쓰지 말고 「기지」로 표시
  - 숫자는 `facts` 에 있거나 도구로 직접 본 것만. 추정은 추정이라고 쓴다
  - 알려진 대응: OpenAI 는 Bing 색인에 기댄다 · Claude 웹 검색은 Brave 색인 · 구글은 IndexNow 불참
- 출력: JSON 한 덩어리

```
{ "가설": [{"내용","참이면","거짓이면","확인한것","판정":"참|거짓|모름"}],
  "결론": "한두 문장",
  "분류": "code|config|index|content|money|login|human|unknown",
  "기지": true 또는 false,
  "근거": ["파일:줄 또는 URL — 도구로 본 것만"],
  "다음": {"누가":"agent|local|human","할일":"30초 안에 끝낼 수 있게 구체적으로","파일":["분류가 code 일 때 고칠 파일"]} }
```

- 파싱 실패·시간 초과 → 일감 `대기` 유지, next_try +1일, `last_error` 기록, `claude_calls` ok=false. **완료로 닫지 않는다**. 3번 실패면 `사람 대기`
- `한도`·`인증실패` → 그날 남은 진단 중단. 시도 횟수에 안 센다
- 결과 반영
  - evidence = `<KST> 결론 · 분류 · 근거 앞 2개`. payload.diagnosis = JSON 전체
  - 분류 → 상태: `code` → `수리 대기`(Step 10 이 집는다) · `config`·`money`·`login`·`human`·`content`·`index` → `사람 대기`, detail = `다음.할일` (index 는 할일에 `node tools/brave-submit.mjs …` 같은 명령 그대로) · `unknown` → `관찰` next_try 3일
  - `근거` 가 비었으면 분류와 상관없이 `관찰` (근거 없는 진단은 믿지 않는다)
  - 기지면 evidence 앞에 「기지」 — 같은 원인을 새 일로 부풀리지 않는다

**2-5. 기록**
- 실행마다 `geo.agent_activity` 한 줄: agent `audit`, action `감사`, summary `신호 N · 새 조사 N · 진단 N · 회복 N`
- `GITHUB_STEP_SUMMARY` 에 신호 표
- `--dry`: DB 쓰기·claude 호출 없이 신호만 찍는다. `--no-diag`: 일감은 쓰되 claude 안 부름

### 3. `.github/workflows/audit.yml` — 새 파일
- cron `35 21 * * *` (06:35 KST — optimize 07:05 앞) + `workflow_dispatch`
- `permissions: contents: read, actions: read` · `concurrency: audit` · `timeout-minutes: 30`
- checkout `persist-credentials: false` — 조사관이 Read 로 `.git/config` 의 토큰을 못 보게
- `.env.local` 을 **만들지 않는다**. env 로만: `DATABASE_URL` · `GH_TOKEN: github.token` · `CLAUDE_CODE_OAUTH_TOKEN` · `MEASURE_ENGINES: vars.MEASURE_ENGINES` · `MEASURE_EVERY_DAYS: vars.MEASURE_EVERY_DAYS`
- `npm install pg --no-save` (academy) · `npm install -g @anthropic-ai/claude-code@2.1.278` (company.yml 과 같은 판)

### 4. `academy/scripts/company.mjs:206` — `WORKFLOWS` 에 `"audit.yml": "ops"` 한 줄
감사관이 죽으면 회사 루프가 「자동 작업 실패」 일감을 연다. 서로 지켜본다.

### 5. 대시보드 (`web/lib/ops.ts:345`)
- 상태 정렬 case 에 `'수리 대기'` 를 `'실패'` 다음에 (한 줄)
- 담당 이름표가 고정 목록이면(`web/` 에서 grep) `audit: "감사관"` 한 줄. 목록이 없으면 손대지 않는다

## Flags — 짐작하지 말 것
- 조사관에게 DB 를 주지 않는다. 필요한 숫자는 `facts` 로 넘긴다
- 조사 결과로 **어떤 글·측정값·리포트도 바꾸지 않는다**
- client 2(아이로그) 조사 내용은 대시보드 안에서만. 공개 경로·케이스 리포트로 내보내지 않는다
- 로컬 시험은 Git Bash 면 `MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*"`
- DB 시각 UTC 함정: 날짜 비교·출력은 전부 `timeZone: "Asia/Seoul"` 또는 SQL `at time zone 'Asia/Seoul'`

## Out of Scope (나오면 Known Gaps)
- 코드 수정·합치기·되돌리기 (Step 10)
- 영업 (Step 11)
- scout.mjs 벤더 넷 한정 고치기 — audit R5 가 대신 본다
- 다른 스크립트의 claude 호출을 claude_calls 에 기록하기 (Step 10)

## Acceptance (오늘 확인 가능)
1. 새/바뀐 .mjs 전부 `node --check` 통과
2. `node scripts/audit.mjs --dry` (academy/) 가 오늘 데이터로 최소 이것을 찍는다
   - R5: client 1 `microsoft 10.6%` · `duckduckgo 2.1%`, client 2 `google 10%` · `perplexity 10%` (first_seen 조건에 걸러진 건 이유와 함께 「제외」)
   - R4: `openrouter` 2회차 cited 0 → 「비활성 엔진」. `claude-code-web` → 「1회차, 판단 보류」
   - R1: optimize·write 반복 실패 각각 「신호」 또는 「회복(마지막 성공 KST 시각)」 — 실제 판정을 REVIEW-REQUEST 에
3. 기존 claude-code 호출부 변경 없음 (grep 결과 첨부). company.mjs 는 WORKFLOWS 한 줄만 diff
4. `node scripts/audit.mjs --no-diag` → `inv-*` 일감 생성 (쿼리 결과 첨부). 두 번 돌려도 중복 없음
5. 로컬 `CLAUDE_CODE_LOCAL=1 node scripts/audit.mjs` → 진단 1건(R5 microsoft 기대). JSON 파싱 · 분류 · 상태 반영 · `claude_calls` 1행. OpenAI↔Bing 을 「기지」로 표시하는지
6. 커밋·푸시 후 `gh workflow run audit.yml` → 성공 · 요약에 신호 표 · `agent_activity` 에 `감사` 행
7. 다음 `company.yml` 실행 출근 기록에 `audit.yml` 이 잡힘
8. `/admin/ops` 에 감사관 일감이 보임 (로그인 307 이면 ops.ts 쿼리를 DB 에 직접 돌려 대신)

---

# Step 10 — 수리공 (다음. 설계 확정분)

## Goal
분류 `code` 조사를 사람 없이 고쳐 합치고, 틀렸으면 스스로 되돌린다.

## 설계 결정
- `repair.yml` 06:50 KST + dispatch. `permissions: contents: write, actions: write`. 킬 스위치: 저장소 변수 `REPAIR_ENABLED=1` 일 때만
- `repair.mjs` 가 `수리 대기` 1건을 집는다. **하루 1건** (`REPAIR_MAX_PER_DAY`)
- 브랜치 `auto/fix-<task_id>`. 수리 claude -p: cwd 저장소, tools `Read,Grep,Glob,Edit` + `Bash(node --check:*)`·`Bash(git diff:*)`·`Bash(git status:*)`, maxTurns 30. 비밀 env 전부 뺌(OAuth 토큰만). checkout `persist-credentials: false` — 푸시는 claude 가 끝난 뒤 스크립트가 토큰 URL 로
- **가드는 claude 밖에서 스크립트가 검사한다**
  - 허용 경로: `academy/scripts/*.mjs` 만
  - 금지: `.github/**` · `web/**` · `academy/app/**` · `**/.env*` · `package*.json` · `claude-code.mjs` · `audit.mjs` · `repair.mjs` · 숫자를 파는 스크립트(`verdict.mjs`·`case-report.mjs`·`pilot-report.mjs`·`report.mjs`) · 글 데이터(`seed-post-*`·`insert-diagrams.mjs`)
  - 파일 3개 · 바뀐 줄 80 이하 · 새 import 패키지 없음 · 추가 줄에 토큰 모양 문자열 없음
  - `node --check` 통과 · 조사 payload 에 재현 명령(`--dry`)이 있으면 실행해 종료코드 0
- 검토 claude -p (Richard 역): tools `Read,Grep,Glob` 만. 입력 = diff + 조사 JSON + 체크리스트(원인과 diff 가 맞나 · 판정 기준(mentioned/cited 계산·엔진 비교 규칙)이 바뀌었나 · 에러를 삼켜 성공으로 보이게 했나 · 완료를 근거 없이 찍나 · KST · 고객사 가림 · 새 비밀 사용). 출력 `{verdict: pass|fail, must: []}`. fail 이면 합치지 않고 가지만 푸시, `사람 대기`
- 합치기: `git push origin HEAD:main` fast-forward 만. main 이 움직였으면 rebase 1회, 충돌이면 포기. 같은 커밋에 `handoff/BUILD-LOG.md` 끝 「### 자동 수리」 항목을 스크립트가 붙인다(무엇·왜·조사 id·검토 결과). 커밋 메시지는 Arch 형식
- 배포: `academy/scripts` 는 Actions 가 매번 checkout 해서 쓰니 **합친 순간이 배포**. 확인은 해당 워크플로를 `workflow_dispatch` 로 바로 돌린다 (GITHUB_TOKEN 푸시는 다른 워크플로를 안 깨우지만 dispatch 는 된다)
- 표: `geo.repairs (id, task_id, branch, base_sha, merge_sha, files text[], lines int, review jsonb, checks jsonb, status, verify_run_url, reverted_sha, created_at)`
- 되돌리기: 다음 audit 이 확인. 확인 실행 실패 또는 같은 신호 재발 → `git revert <merge_sha>` 푸시 → `되돌림`, 조사 일감 `사람 대기`. 7일에 되돌림 2번이면 `geo.settings repair_paused=true` (사람이 풀 때까지 정지)
- 전체 claude 예산: 모든 호출자가 `geo.claude_calls` 에 기록. `CLAUDE_DAILY_MAX` 기본 40. 측정이 먼저, 수리·조사는 남은 몫에서

## 못 하는 것 (설계로 받아들인다)
- **워크플로 파일 수정 불가.** GITHUB_TOKEN 은 `workflows` 권한을 받을 수 없다 — `.github/workflows/*` 가 든 푸시는 거절된다. 이 분류는 `사람 대기`(Arch 세션)
- **저장소 변수·시크릿 쓰기 불가.** GITHUB_TOKEN 에 그 권한이 없다. MEASURE_ENGINES 같은 설정 문제는 `config` → 사람 대기 + 정확한 `gh variable set` 명령
- **학원 사이트(academy/ Next) 배포 불가.** `git push` 로 안 올라가고 Vercel 토큰이 Actions 에 없다. academy/app 은 금지 경로
- **web/ 은 푸시하면 Vercel 이 공개 랜딩을 바로 올린다.** 그래서 금지 경로
- 비공개 무료 플랜이라 브랜치 보호가 없다(API 403 확인). 가드는 전부 repair.mjs 안에 있어야 한다

---

# Step 11 — 영업 담당 (다음. 설계 확정분)

## Goal
고객 유치에 담당이 생긴다. 보내는 건 사람, 준비는 에이전트.

## 설계 결정
- `sales.mjs` 매주 월 08:10 KST. 별도 워크플로, `contents: write` (리포트 커밋)
- **케이스 리포트 갱신**: `case-report.mjs --out ../web/public/case/academy.html`. 바뀐 게 없으면 커밋 안 함. 커밋 전 가림 검사 — `clients.mjs` 의 이름·도메인·지역어, `geo.outreach_targets.name`, 전화번호 정규식이 공개본에 하나라도 있으면 중단·사람 대기. 숫자는 DB 에서 온 것만(case-report 원칙), 새 숫자를 만들지 않는다
- **영업판 후속**: `outreach_targets` 에서 `next_due <= 오늘` 이고 종결 아닌 곳마다 `사람 대기` 일감. detail 에 통화문 초안(claude -p 주 1회 묶음 1호출). 재료는 케이스 리포트 공개본 문장만 — 자사 학원 이름을 경쟁 학원에 밝히지 않는다
- **리드**: `geo.leads` status new 24시간 초과 → 답장 초안 → `사람 대기`. 진단 점수·도메인은 그 리드 행에서만
- **아무것도 자동 발송하지 않는다.** 전화·문자·메일은 원장
- 주간 활동 한 줄: 연락한 곳 N · 다음 약속 N · 리드 N (전부 DB 에서 센 값)

---

## Budget (Max 구독 — 원장이 평소 쓰는 한도와 같은 통)
- 지금: 측정 20회/3일 + 회사 루프 분석·초안 몇 회/주
- Step 9: 조사 ≤ 2회/일 (sonnet, 20턴)
- Step 10: 수리 ≤ 1회/일 + 검토 1회
- Step 11: ≤ 1회/주
- 한도 문구(claude-code.mjs 의 한도 판정)가 뜨면 그날 남은 조사·수리는 건너뛴다 — 실패로 세지 않는다
