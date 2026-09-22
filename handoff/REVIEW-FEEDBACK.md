# Review Feedback — commit a5cee3d (Claude Code 구독 경로)
Date: 2026-09-22
Ready for Builder: NO

## Must Fix
- academy/scripts/claude-code.mjs:41-42 — `out += d` 가 Buffer 조각을 하나씩 문자열로 바꾼다. 파이프 조각 경계가 3바이트 한글 한가운데 걸리면 U+FFFD 가 본문에 박힌다. 짧은 답은 조각 하나라 로컬 검증에서 안 드러났다. 긴 초안이나 뉴스 result 줄은 여러 조각에 걸친다. 고칠 법: spawn 직후 `child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");` 를 넣는다. StringDecoder 가 경계를 이어 준다.
- academy/scripts/claude-code.mjs:74 — `child.stdin` 에 error 리스너가 없다. claude 가 stdin 을 다 읽기 전에 끝나면(인증 실패, 설치 안 됨 ENOENT, 시간 초과로 kill) EPIPE 가 잡히지 않은 'error' 로 올라와 node 프로세스 전체가 죽는다. 매시간 도는 company 루프도 같이 죽는다. 고칠 법: end() 앞에 `child.stdin.on("error", () => {});` 를 둔다. 실패 내용은 close 경로가 이미 받는다.

## Should Fix
- claude-code.mjs:64 — 한도 판정 정규식이 현재 CLI 문구 「You've hit your limit · resets 3am」 을 못 잡는다(usage limit·limit reached·rate limit·"resets at" 어느 것도 안 맞는다). 놓치면 500 으로 떨어진다. write-draft 는 고장(exit 1)으로 올리고, ai-measure 는 status 0 이라 루프를 안 멈춘다. 권장: `result.is_error` 일 때 `/usage limit|limit reached|hit your limit|rate.?limit|resets\b|API Error: 429/i` 로 보고, stderr 도 함께 검사한다.
- claude-code.mjs:40 + ai-measure.mjs:62 — 시간 초과와 「결과 없음」이 status 0 으로 가서 318행 break 에 안 걸린다. claude 가 멈추면 문항마다 10분을 쓴다. 20문항이면 200분이고 optimize.yml 은 50분에 잘린다. 요약도 안 남는다. 권장: 측정 호출에 `timeoutMs: 3*60*1000` 을 주고, 시간 초과나 결과 없음이면 break 목록에 든 코드(503 등)로 돌려준다. company.mjs 도 같다. BUDGET_MS 40분 확인은 일감 사이에서만 하니 39분에 시작한 호출은 10분 초과와 예비 공급자까지 더해 55분 job 제한을 넘을 수 있다. 분석 호출에는 timeoutMs 를 짧게 준다.
- claude-code.mjs:30 — 검색 모드가 `--allowedTools WebSearch` 만 쓴다. 이건 미리 허가만 한다. Bash·Read·WebFetch 같은 나머지 내장 도구는 모델에게 그대로 보인다. -p 모드는 허가 안 된 호출을 거부하니 멈추지는 않는다. 다만 검색 결과에 섞인 프롬프트 인젝션이 도구 호출을 부르고, 거부될 때마다 턴을 먹는다. Read·Glob 은 허가가 필요 없어 빈 폴더 밖을 읽을 수도 있다. 권장: `--tools WebSearch --allowedTools WebSearch` 를 함께 준다. `--tools ""` 는 도구 전체를 끄는 올바른 쓰임이다(현행 CLI).
- claude-code.mjs:37 — `env: process.env` 를 그대로 넘긴다. CLI 는 ANTHROPIC_API_KEY/ANTHROPIC_AUTH_TOKEN 을 CLAUDE_CODE_OAUTH_TOKEN 보다 먼저 쓴다. write.yml:65 가 아직 ANTHROPIC_API_KEY 를 넘긴다(지금은 시크릿이 없어 빈 값). 누가 다시 넣거나 .env.local 에 있으면 구독이 아니라 바닥난 선불 잔액으로 간다. 권장: 자식 env 에서 ANTHROPIC_API_KEY·ANTHROPIC_AUTH_TOKEN·ANTHROPIC_BASE_URL 을 뺀다.
- claude-code.mjs:40 — 윈도에서 `shell:true` 로 띄우면 `child.kill()` 은 cmd.exe 만 죽인다. claude 는 고아로 남아 한도를 계속 쓴다. 로컬 전용이다. 권장: win32 에서는 `taskkill /pid <pid> /T /F`. 리눅스도 SIGTERM 몇 초 뒤 SIGKILL 을 한 번 더 둔다.
- writer-common.mjs:142 + write-news.mjs:182-183 — 출처가 검색 결과 링크 전부다. 최대 14턴이면 수십 개다. 본문에 안 쓴 링크와 경쟁 학원 페이지까지 「## 출처」로 붙는다. 글이 쓰지 않은 근거를 댄 것처럼 보인다. 권장: 모델이 이미 내는 `근거` 배열에 나온 주소나 본문에 나온 주소로 걸러 붙인다. 전체 목록은 로그에만 남긴다.
- claude-code.mjs:70 — 결과가 성공이 아니어도 is_error 가 false 면 error 가 null 이다(예: error_max_turns 는 result 텍스트가 없다). 권장: `error: ok ? null : (text.slice(0,300) || result.subtype || "알 수 없음")`.
- 워크플로 세 곳 — `npm install -g @anthropic-ai/claude-code` 버전을 고정하지 않았다. `--tools`·stream-json 모양·한도 문구가 바뀌면 조용히 깨진다. 로컬에서 검증한 버전으로 고정한다.
- claude-code.mjs 로컬 실행 — 빈 폴더에서 돌려도 ~/.claude 의 사용자 CLAUDE.md 와 MCP 서버는 읽힌다. 로컬 측정은 CI 측정과 조건이 다른데 같은 method 로 DB 에 들어간다. 권장: `--strict-mcp-config`. CLAUDE.md 가 끼는 문제는 로컬 측정을 CI 에서만 하도록 규칙을 두거나 BUILD-LOG 에 적는다.
- company.mjs:136 — 공급자 라벨이 `${p.이름}/${model}` 이라 claude-code 는 실제로 부른 sonnet 대신 opus 로 찍힌다. 표시 문제다.

## Escalate to Architect
- write-news 출처를 걸러 붙일지(근거 배열 기준) 전부 붙일지. 발행 전 원장 확인 부담과 「지어내지 않는다」 규칙이 걸린 판단이다.

## Cleared
확인한 것: stream-json 파싱(--verbose 있음, result 의 is_error/subtype, 문자열 tool_result 의 URL 정규식). anthropic-web 과 같은 인용 기준. 재시도() 우회. 200/429/500 매핑과 write-draft 폴백·78 분기. company 물어보기의 sonnet 강제. ai-measure 의 429 break(다른모델은 []). MEASURE_ENGINES=claude-code-web, WRITER_PROVIDER=claude-code, WRITER_MODEL 미설정(기본 opus) 변수. 리눅스 인자 전달(셸 없음). company 매시간 호출은 who-wins/review 일감에서만, 한 번에 최대 3건이다. 위 두 Must Fix 말고는 로직이 맞다.
