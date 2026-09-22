# Review Request — Step 9 (감사관 · 원인 조사)
Date: 2026-09-22
Ready for Review: YES
Commits: f16fd29 (Step 9) · b021963 (activity run_url 수정) — main, pushed

## Files Changed
- academy/scripts/audit.mjs:1-428 — 새 파일. 규칙 R1~R6(SQL·GitHub API) → investigate 일감 upsert/닫기 → 하루 2건 claude -p 진단 → activity·step summary
  - :83-107 R1 반복 실패 (action·summary 둘 다 정규화해 묶음, 뒤에 같은 agent+action 성공이면 회복)
  - :109-120 R2 멈춘 측정 · :122-151 R3 근거 없는 완료(측정 일감 목록 :125-128) · :153-173 R4 인용 0(엔진별, n≥10 인 날만 회차)
  - :175-188 R5 크롤러 0(벤더 전부, pages_total≥10·<20%·first_seen>14일) · :190-211 R6 출근만(GH 못 읽으면 false → 닫지 않음)
  - :214-249 claude_calls ensure · company.mjs 일감()/상태() SQL 복사 (import 안 함)
  - :251-279 일감쓰기 — 진단 끝난 일감은 detail 을 덮지 않음, 읽기 성공한 규칙의 조사만 「신호 사라짐」으로 닫음
  - :281-318 조사관 프롬프트 · JSON 검증 · :321-382 진단(예산·한도/인증 중단·3번 실패 사람 대기·분류→상태)
- academy/scripts/claude-code.mjs:31-33,42,56 — `cwd`·`envDrop` 옵션. 기본값이면 전과 같다
- academy/scripts/company.mjs:206 — WORKFLOWS 에 `"audit.yml": "ops"`
- web/lib/ops.ts:345 — 정렬에 `'수리 대기'` 를 `'실패'` 다음(3)에. 뒤 번호만 한 칸씩 밀림
- .github/workflows/audit.yml — cron 35 21 * * * + dispatch, contents/actions read, persist-credentials false, .env.local 없음
- handoff/BUILD-LOG.md — Step 9 BUILT 항목 + Known Gaps 4개

## Brief 와 다른 점 (봐 주세요)
1. **조사관 규칙을 system 이 아니라 표준입력 앞머리로 넘긴다.** system 은 한 줄.
   윈도에서 claude 는 `shell:true` 로 cmd 를 거치는데 여러 줄 인자가 첫 줄에서 잘려 뒤의 `--tools`·`--allowedTools` 가 통째로 버려졌다.
   첫 두 로컬 시험이 도구 28개(Bash·Edit·Write 포함)가 보이는 채로 돌아 error_max_turns 로 끝났다(디버그 스트림으로 확인). 규칙 내용은 brief 그대로
   - 두 번 다 파일 변경 없음(git status). Bash 시도는 -p 기본 권한에서 「requires approval」로 거절됐다
   - claude-code.mjs 자체의 윈도 문제(writer-common 초안도 해당)는 고치지 않고 Known Gap 으로 적었다
2. 프롬프트에 턴 예산 두 줄 추가 (「한 턴에 도구 여러 개」「14턴쯤 JSON」)
3. R1 은 **action 도 정규화**. who-wins 제목이 「(9일째)」→「(12일째)」로 바뀌어 같은 실패가 갈렸다
4. R6 「출근」= `action like '%출근%'` (「로컬 에이전트 출근」 포함)
5. 대시보드 이름표: web 에 고정 한 줄 목록이 없다(AgentBoard 의 roles 는 카드 객체). brief 대로 손대지 않음 → `대기`·`수리 대기` 조사는 카드에 안 뜬다(KG)

## 확인해 줄 것
- audit.mjs 가 조사관에게 넘기는 env: `envDrop` 에 DATABASE_URL·GH_TOKEN·GITHUB_TOKEN·LLM_PROXY_*·GEMINI·GROQ. CLAUDE_CODE_OAUTH_TOKEN 은 남김
- 한도·인증실패 → claude_calls 에는 ok=false 로 남기고(예산에 셈), 일감은 attempts 안 올리고 대기 유지. 이게 맞는지
- `진단 N`(activity summary)은 **성공한 진단만** 센다. 실패한 호출은 claude_calls 에만 남는다
- R3 은 btrim 한 evidence 가 '', '완료', '성공' 인 것만. 「원장이 완료 표시」 같은 문장은 근거로 친다
- R5 `age <= 14` 는 제외 (「14일보다 오래된 것」만 신호)
- 진단 결과 evidence 의 근거에 audit.mjs 자기 주석(:176)을 인용했다 — 순환 근거. 프롬프트로 막을지

## 시험 결과 (실제 출력)
1. `node --check` audit.mjs · claude-code.mjs · company.mjs 통과. web `tsc --noEmit` 오류 없음
2. `--dry` (MEASURE_ENGINES=claude-code-web MEASURE_EVERY_DAYS=3, GH_TOKEN 줌 — Actions 와 같은 값)
   ```
   신호 3
     ● R1 [client 1] improve-c550c77a — improve 「자동 작업 optimize」 12건 실패 (2026-09-17, 2026-09-18, 2026-09-19, 2026-09-22) · 뒤에 성공 없음
     ● R1 [client 1] content-524d6740 — content 「자동 작업 write」 4건 실패 (2026-09-18, 2026-09-19, 2026-09-21, 2026-09-22) · 뒤에 성공 없음
     ● R5 [client 1] microsoft — microsoft 크롤러 커버리지 10.6% (5/47) · 처음 온 지 14.6일
   참고
     · R1 회복 — measure 「로봇&코딩학원 — 경쟁 검색어 #/# (#일째)」 실패 3건 · 마지막 성공 2026-09-21 22:52
     · R2 정상 — claude-code-web 마지막 측정 2026-09-22 (0일 전, 주기 3일)
     · R3 근거 있음 — 일감 60 openrouter-credits 2026-09-22 15:01 · ai_measurements 그날 20행
     · R4 client 1 claude-code-web — 1회차(2026-09-22 인용 0/20), 판단 보류
     · R4 client 1 openrouter — 2회차 인용 0 (2026-09-17 0/20 · 2026-09-18 0/11) 이지만 비활성 엔진
     · R5 제외 — client 1 duckduckgo 2.1% (1/47): 처음 온 지 14일 (2026-09-08 16:32), 14일 전엔 판단 안 함
     · R5 제외 — client 2 google 10% (1/10): 처음 온 지 7.9일 (2026-09-14 18:57), 14일 전엔 판단 안 함
     · R5 제외 — client 2 perplexity 10% (1/10): 처음 온 지 1.4일 (2026-09-21 05:53), 14일 전엔 판단 안 함
     · R6 일한 기록 48시간 19건 (마지막 2026-09-22 15:20)
     · R6 정상 — company.yml 2026-09-22 15:03 (0.8시간 전) success
     · R6 정상 — optimize.yml 2026-09-22 15:08 (0.8시간 전) success
   ```
   - duckduckgo 는 brief 기대(신호)와 달리 **제외**: first_seen 이 09-08 16:32 KST 라 시험 시각에 딱 14.0일. 내일 아침 실행부터 신호
   - optimize R1 은 실제로는 15:08 성공이 있는데 company 루프가 아직 activity 에 안 옮긴 상태라 신호. 다음 회사 루프 뒤 회복→닫힘 예상
   - MEASURE_ENGINES 없이 돌리면 `● R2 [client 1] engines — MEASURE_ENGINES 가 비어 있음` 확인
3. 기존 호출부 변경 없음: `git diff 301cf40 HEAD --stat -- academy/scripts/ai-measure.mjs academy/scripts/writer-common.mjs` → 빈 출력. company.mjs 는 206줄 한 줄만
4. `--no-diag` 두 번: `일감: 새 조사 3 · 닫음 0` → `일감: 새 조사 0 · 닫음 0`. 중복 키 쿼리(`having count(*) > 1`) 0행
   ```
   317 inv-R1-improve-c550c77a 대기 20 · 318 inv-R1-content-524d6740 대기 20 · 319 inv-R5-microsoft 대기 50
   ```
5. 로컬 진단 (`CLAUDE_CODE_LOCAL=1`) — R5 microsoft 를 집으려고 317·318 의 next_try_at 을 잠시 +3시간으로 미뤘다가 되돌렸다
   - 1·2회차: error_max_turns (위 1번 원인). 일감은 대기 유지·attempts+1·next_try +1일 — 실패 경로가 설계대로 돌았다. 수정 후 attempts 0 으로 되돌리고 재시험
   - 3회차 성공 150초 · $0.56: `✓ code (기지) → 수리 대기`. 근거 `academy/scripts/scout.mjs:57` · `company.mjs:519` · `robots.txt:34-35` · `sitemap.ts:1-19`
   - 결론: 「Bingbot 은 오고 있고 robots·사이트맵 정상. scout→crawl-push 가 openai·anthropic·google·naver 넷만 봐서 microsoft 는 감시·재전송 대상이 아니다」. 가설 4개(참 1·거짓 1·모름 2)
   - 「기지」 = true 로 표시했다. 다만 OpenAI↔Bing 을 명시적 이유로 적진 않았고 scout 넷 한정(BUILD-LOG 555줄)을 기지로 봤다
   - claude_calls 3행 (false 164s $0.47 · false 97s $0.35 · true 150s $0.56). **오늘 audit 호출 3건으로 AUDIT_MAX_DIAG(2) 초과** — 시험에 AUDIT_MAX_DIAG=3 을 줬다
   - 할일 문구에 `node scripts/company.mjs --dry` 라고 썼는데 그런 플래그는 없다(`--plan`). 조사관의 틀린 제안 — Step 10 검토자가 걸러야 할 종류
6. Actions `gh workflow run audit.yml` → run 35698048398 **success**. 로그 신호 3 · 참고 동일 · `진단: 오늘 3건 써서 더 안 부름 (AUDIT_MAX_DIAG 2)` — 그래서 **Actions 에서 진단(OAuth 토큰·cwd·envDrop)은 오늘 못 봤다**. 내일 06:35 실행이 첫 실제 진단
   - agent_activity: `audit 감사 true 「신호 3 · 새 조사 0 · 진단 0 · 회복 1」 run_url …/runs/35698048398 09-22 16:08`
   - step summary 표는 코드상 GITHUB_STEP_SUMMARY 에 쓰지만 화면으로는 안 봤다
7. company.yml 출근 기록 — **첫 시도에서 안 잡혔다.** audit 가 자기 「감사」 행에 run_url(=실행 주소)을 달았고, company.mjs 출근기록은
   `run_url` 이 이미 있으면 「본 실행」으로 건너뛴다. → b021963: audit 의 「감사」 행은 run_url 을 비운다(실행 주소는 회사 루프의 「자동 작업 audit」 행에 달림).
   company.mjs 는 한 줄 diff 그대로 유지. 시험 행 2개의 run_url 은 DB 에서 비웠다
   - 재시험: audit run 35700567515 (b021963) success → company dispatch 35700615601 success →
     `ops 자동 작업 audit true workflow_dispatch · success` 3행 (runs 35698048398 · 35700483517 · 35700567515)
   - 회사 루프가 optimize·write 성공을 옮긴 뒤 audit 재실행: `신호 1 · 회복 3`, `일감: 닫음 2` → 317·318 `닫힘` evidence 「2026-09-22 16:37 신호 사라짐」 (닫기 경로 확인)
   - 참고: company.yml schedule 이 실제로는 몇 시간씩 빈다(마지막 schedule 05:10Z → 이후 dispatch 뿐). R6 의 3시간 기준이 내일부터 잦게 걸릴 수 있다
8. `/admin/ops` 는 로그인이 필요해 ops.ts 쿼리를 DB 에 직접: 사람 대기 2건 다음에 `319 audit investigate 수리 대기`, 그다음 `318`·`317 대기` 순으로 나온다

## Out of Scope (logged in BUILD-LOG)
- company.yml schedule 간격이 3시간을 넘기는 일이 잦다 → R6 신호가 GitHub cron 지연 탓일 수 있음
- claude-code.mjs 윈도 여러 줄 system 잘림 (writer-common 초안 로컬 실행도 해당)
- 로컬 진단 시 조사관이 academy/.env.local 을 Read 할 수 있음 (규칙 문장으로만 막음)
- AgentBoard 에 audit 카드 없음 → 대기·수리 대기 조사가 카드에 안 뜸
