# Architect Brief — Step 52

## Goal
네이버 블로그 세션(학원 프로필 `tools/.browser-profile`)이 풀리면 로컬 에이전트가 저장된 아이디·비번으로 먼저 혼자 다시 로그인한다. 막히면(캡차·2단계·새 기기·처음 보는 화면) 손을 떼고 오늘과 같은 사람 일감을 올린다.

원장 승인 2026-10-17 원문: 「로그인창 열어서 아이디 비번 입력 받고 저장해놓고 앞으로 자동으로 해」. 결정 D176~D184, KG-52-1~5 는 BUILD-LOG 에 있다.

## 사실 (Arch 실측 2026-10-17 — 다시 재지 말 것)
- 사람 일감을 올리는 곳: `tools/local-agent.mjs:171-175`. `naver-blog-post.mjs` 출력이 `/로그인이 필요/` 에 걸리면 `사람로그인("naver","네이버 블로그")`(dedupe `login-naver`) · 활동 「네이버 이관 멈춤」 · break
- 로그인 화면으로 튀는 곳: `tools/naver-blog-post.mjs:210-215`. `nid.naver.com` 이면 「네이버 로그인이 필요합니다. 창에서 로그인해 주세요 (최대 8분).」을 찍고 사람을 8분 기다린다. 그다음 에디터 프레임이 없으면 exit 1
- 프로필: `naver-blog-post` 는 `path.resolve(cwd, PROFILE)`. local-agent 는 cwd=tools 로 띄우니 실제로는 `tools/.browser-profile`. `--profile .browser-profile-<고객>` 이면 고객 계정
- 잠금: `tools/.local-agent.lock`(local-agent, 2시간 신선), `tools/.open-session.lock`(login-poll, 13분 신선). local-agent 는 OS 잠금이 있으면 기다리고 login-poll 은 LA 잠금이 있으면 기다린다. 잠금 없이 같은 프로필을 여는 도구(yt-upload 등)는 launchPersistentContext 에서 바로 죽는다(메모 browser-profile-shared-with-agent)
- 쿠키 판정: `tools/login-rules.mjs` `네이버쿠키(cookies)` → "유지" | "세션만" | "없음"(NID_AUT 만료일 유무)
- 퍼플렉시티: `tools/ai-web-measure.mjs:159` method `perplexity-web-logged-out`. 일부러 로그아웃 상태로 잰다. 되살릴 세션이 없다 → 뺀다(D183)
- `git check-ignore tools/.secrets/naver.xml` → 지금은 출력 없음(무시 안 됨). 루트 `.gitignore` 에 넣어야 한다

## Flow
```
local-agent (12:40·19:10, LA 잠금)
  └─ naver-blog-post <slug>        (프로필 열기 실패 시 60초 x 3 재시도, 남의 프로세스는 안 죽임)
       goto Write → 12초
       ├─ nid 아님 ─> [세션 살아 있음] 에디터 찾음 → state.blocked=false · 「NID_AUT 남은 N일」 → 기존 발행
       └─ nid.naver.com
            ├─ PROFILE ≠ ".browser-profile" ─────────────┐
            ├─ 저장값 없음 ──────────────────────────────┤
            ├─ 시도가능 아님(20시간 · blocked · bad) ─────┤
            └─ 자동로그인(page)                           │
                 state.lastAttemptAt = 지금 (치기 전에 씀)
                 이미 캡차·2단계 표지? ─ 예 ─> 멈춤 ──────┤
                 복호화(powershell → base64 → 메모리)
                 아이디·비번 사람처럼 치기 · 상태 유지 켬 · 로그인 1번 클릭
                 30초 안에 nid 떠남 AND NID_AUT "유지"?
                   ├─ 예 ─> 「✓ 네이버 자동 로그인」 ─> 기존 발행
                   └─ 아니오 ─> 스크린샷 · 사유 분류 · state 갱신 ─┤
                                                                   v
                 기존 줄 「네이버 로그인이 필요합니다…(최대 8분)」 (글자 그대로)
                 + 「자동 로그인 멈춤: <사유> · 화면 <경로>」 또는 「자동 로그인 안 함: <까닭>」
                 기존 사람 8분 대기 (아무것도 안 누름)
  ├─ 출력 /로그인이 필요/ ─> 사람로그인("naver", 근거=멈춤 줄) · 활동 「네이버 이관 멈춤」
  └─ 출력 「NID_AUT 남은 N일」 ─> 활동 「네이버 세션」 · N≤3 이고 저장값 없음 ─> login-naver-soon 일감

save-login.mjs naver (원장이 한 번, 사람 앞)
  잠금 확인(LA·OS 신선 → 30초씩 최대 15분) → OS 잠금 wx
  → powershell.exe Get-Credential → Export-Clixml tools/.secrets/naver.xml   (Node 는 비번을 안 봄)
  → state 초기화 → 프로필 열기(창 보임) → nid 로그아웃 → Write 주소 → 자동로그인 → ✓ / ✗ 사유
  → ✗ 면 창을 5분 둔다(원장이 손으로 마저, 우리는 주소만 봄) → 5초 → ctx.close()(쿠키 flush) → 잠금 풂
```

## Build Order

### 52a 저장·복호화 — 새 `tools/auto-login.mjs`, 새 `tools/save-login.mjs`, 루트 `.gitignore`
- 루트 `.gitignore` 에 `tools/.secrets/` 한 줄 + 까닭 주석 한 줄. `tools/.gitignore` 는 안 건드린다
- `tools/auto-login.mjs` 내보내기
  - `비밀폴더()` = env `AUTO_LOGIN_SECRETS_DIR` ?? `tools/.secrets`(이 파일 기준 절대경로). env 는 시험만 쓴다
  - `저장값있음(name)` → `<폴더>/<name>.xml` 있음
  - `상태읽기(name)` / `상태쓰기(name, s)` → `<폴더>/<name>.state.json` `{ lastAttemptAt, lastResult, blocked, bad }`. 아이디·비번 안 들어감
  - `시도가능(s, now)` → `!s.bad && !s.blocked && (!s.lastAttemptAt || now - s.lastAttemptAt >= 20*3600*1000)` (D180)
  - `복호화(name)` → `execFileSync("powershell.exe", ["-NoProfile","-NonInteractive","-Command", 스크립트], { stdio:["ignore","pipe","pipe"], windowsHide:true, encoding:"utf8" })`
    - 스크립트(PowerShell): Import-Clixml 로 PSCredential 을 읽고, `@{u=UserName; p=GetNetworkCredential().Password}` 를 `ConvertTo-Json -Compress` → UTF8 바이트 → `[Convert]::ToBase64String` 한 줄만 출력
    - Node: `trim()` → base64 → JSON. 실패면 **고정 문구** `new Error("저장된 로그인 값을 못 읽음")` 만 던진다(원래 e.message·stdout·stderr 안 붙임)
  - Flag: `powershell.exe`(5.1) 를 이름으로 부른다. `pwsh` 아님 — 5.1 Get-Credential 이 윈도 GUI 창이다
  - Flag: base64 인 까닭 = PowerShell 출력에 BOM·줄바꿈이 붙는다(CLAUDE.md 함정). 명령 인자에는 파일 경로만 들어간다. 비번은 인자·env·평문 파일 어디에도 없다
- `tools/save-login.mjs naver` — 지금은 `naver` 하나만. 다른 값이면 사용법 찍고 exit 1
  1. 잠금: `.local-agent.lock` 2시간 안 또는 `.open-session.lock` 13분 안이면 「로컬 에이전트가 브라우저를 쓰는 중 — 기다립니다」 30초 간격 최대 15분, 그래도면 exit 3. 그다음 `.open-session.lock` 을 `wx` 로 잡는다(login-poll 과 같은 꼴·pid 확인 해제, finally·SIGINT 에서 풂). 남의 프로세스는 절대 안 죽인다
  2. `spawnSync("powershell.exe", [...], { stdio:"inherit" })` — PowerShell 안에서 `Get-Credential -Message "네이버 블로그(학원) 아이디와 비밀번호"` → 취소면 exit 2 → 폴더 만들고 → `Export-Clixml -LiteralPath <폴더>/naver.xml`. 비번은 PowerShell 프로세스 안에만. exit 2 → 「취소했습니다」 exit 1
  3. 상태 초기화 `{ lastAttemptAt:null, lastResult:"saved", blocked:false, bad:false }`
  4. `프로필열기(tools/.browser-profile, 기존 옵션 headless:false)` → `https://nid.naver.com/nidlogin.logout` → `https://blog.naver.com/<NAVER_BLOG_ID ?? force11>?Redirect=Write` → nid 면 `자동로그인(page, ctx, "naver")`
  5. 결과 줄: `✓ 저장했고 자동 로그인도 됐습니다` / `✗ 자동 로그인 멈춤: <사유>` + 「창을 5분 둡니다. 손으로 로그인을 마쳐 주세요」(주소만 본다). 아이디·비번은 어떤 줄에도 안 찍는다
  6. 5초 쉬고 `ctx.close()` → 잠금 해제
- Flag: 시험용 로그아웃은 이 프로필 이 브라우저에서만. 사람이 보고 있을 때(save-login)만 한다

### 52b 자동 로그인 — `tools/auto-login.mjs` 이어서
- `프로필열기(dir, opts)` → `chromium.launchPersistentContext(dir, opts)` 그대로. 실패하면 60초 쉬고 최대 3번, 그래도면 원래 오류를 던진다. 프로세스를 찾거나 죽이지 않는다. 옵션·`--disable-blink-features=AutomationControlled` 는 지금 도구들 그대로 — 더하지도 빼지도 않는다(UA·stealth 금지)
- `자동로그인(page, ctx, name, { shotsDir })` → `{ ok, 사유, 화면 }`
  1. `상태쓰기` 로 `lastAttemptAt=now` 를 **치기 전에** 남긴다
  2. 들어가기 전 판정: 캡차·2단계·새 기기·보호조치 표지가 이미 있거나 아이디·비번 칸이 없으면 아무것도 안 치고 멈춤
  3. `복호화` → 아이디 칸 클릭 → `pressSequentially(u, { delay })`(키마다 60~160ms 무작위) → 비번 칸 같은 방식 → 「로그인 상태 유지」 꺼져 있으면 켬 → 로그인 버튼 **한 번** 클릭. 쓴 뒤 지역 변수는 `""` 로 덮는다. `fill`·쿠키 주입·쿠키 내보내기 금지
  4. 성공은 긍정형만(D179): 30초 안에 주소가 `nid.naver.com` 을 떠나고 `네이버쿠키(await ctx.cookies("https://nid.naver.com")) === "유지"`. → 상태 `{ lastResult:"ok", blocked:false }`
  5. 아니면 스크린샷 `<shotsDir>/naver-<KST yyyyMMdd-HHmm>.png`(기본 `tools/.secrets/shots`, 최근 10장만 남김) → 사유 분류 → 상태 갱신 → 반환. 다시 치거나 다시 누르지 않는다
  - 사유 분류(화면 글자·요소로. **선택자와 문구는 Bob 이 실측** — scratchpad 에 빈 임시 프로필을 만들어 `https://nid.naver.com/nidlogin.login` 을 열고 읽기만. 그 창에는 아무것도 치지 않는다)

    | 사유 | 상태 |
    |---|---|
    | `비번틀림` · `저장값 못 읽음` | `bad=true` — save-login 을 다시 돌려야 풀림 |
    | `캡차` · `2단계` · `새기기` · `보호조치` · `모르는화면` | `blocked=true` — 사람 로그인이 확인되면(52c) 풀림 |
    | `시간초과`(30초 안에 아무 변화 없음) | 20시간 규칙만 |
- `세션남은일(cookies)` → NID_AUT `expires` 로 남은 날(정수, 내림). 없거나 세션만이면 null
- `멈춤줄(out)` → `/자동 로그인 (멈춤|안 함): [^\n]*/` 첫 줄 또는 null · `남은날줄(out)` → `/NID_AUT 남은 (\d+)일/` 의 N 또는 null (local-agent 는 실행 파일이라 시험할 함수는 여기 둔다)
- `자동로그인할까(PROFILE, 저장값, 상태, now)` → `{ 할까, 까닭 }` — naver-blog-post 210행 조건을 함수로(시험용)

### 52c 끼우기 — 기존 `tools/naver-blog-post.mjs`, `tools/local-agent.mjs`
- `naver-blog-post.mjs`
  - 192행 `chromium.launchPersistentContext` → `프로필열기`(재시도만 더해짐)
  - 210행 블록: `nid` 이고 `자동로그인할까(...)` 가 참이면 `자동로그인`. 성공이면 9초 쉬고 아래로(8분 대기 건너뜀). 아니면 기존 줄 「네이버 로그인이 필요합니다. 창에서 로그인해 주세요 (최대 8분).」을 **글자 그대로** 찍고, 시도했으면 `자동 로그인 멈춤: <사유> · 화면 <경로>`, 안 했으면 `자동 로그인 안 함: <저장값 없음|20시간 안|막힘|비번틀림|고객 프로필>` 한 줄. 그다음 기존 8분 대기 그대로
  - 에디터 프레임을 찾은 뒤(=로그인 확인) 학원 프로필이면: 상태 `blocked=false`(bad 는 안 건드림) · `NID_AUT 남은 N일` 또는 `NID_AUT 남은 날 모름` 한 줄
  - Flag: `--profile .browser-profile-<고객>` 에는 학원 저장값을 절대 안 쓴다. 비교는 `PROFILE === ".browser-profile"` 하나(D178)
- `local-agent.mjs`
  - `사람로그인(kind, what, 근거 = null)` — 근거가 있으면 `evidence = left(coalesce(evidence,'') || E'\n' || $4, 4000)`. 제목·dedupe 그대로
  - 171행 분기: `멈춤줄(r.out)` 이 있으면 `KST() + " " + 그 줄` 을 근거로. 활동 summary 는 「로그인 필요 — <그 줄>」
  - `남은날줄(r.out)` = N → 활동 「네이버 세션」 ok=true 「N일 남음」. N≤3 이고 `!저장값있음("naver")` 이면 일감 `login-naver-soon` 「네이버 블로그 로그인이 N일 뒤 풀립니다」(detail: 「PC 에서 node tools/save-login.mjs naver 를 한 번 돌리면 그 뒤로는 혼자 다시 로그인합니다.」). N>3 이면 열린 `login-naver-soon` 을 완료. `로그인됨("naver")` 은 그대로
  - 사람로그인 detail 끝에 한 문장: 「저장된 로그인 값이 있으면 먼저 혼자 다시 로그인해 보고, 막혔을 때만 이 일감이 뜹니다.」 — `test-login.mjs:81` 이 세는 문구는 바꾸지 않는다

## Failure modes
| 새 길 | 실제로 날 일 | 처리 | 보이나 |
|---|---|---|---|
| 복호화 | 윈도 계정 바뀜·PC 이전 → DPAPI 못 풂 | 고정 문구 → `멈춤: 저장값 못 읽음`, bad=true | 일감 근거 |
| 치기 | 네이버가 로그인 화면을 바꿔 칸 못 찾음 | `모르는화면`, 안 누름, 스크린샷 | 일감 근거 |
| 클릭 뒤 | 캡차·새 기기 알림·2단계 | 멈춤·스크린샷·blocked → 오늘과 같은 일감 | 일감 근거 |
| 클릭 뒤 | 원장이 비번을 바꿈 | `비번틀림` bad=true → 다시 안 침(잠김 방지) | 근거 + 「save-login 다시」 |
| 클릭 뒤 | 들어갔는데 상태 유지 꺼짐(세션만) | 긍정 판정 실패 → `모르는화면` | 일감 근거 |
| 상태 파일 | 치는 중 프로세스가 죽음 | lastAttemptAt 을 먼저 써서 20시간 재시도 없음 | 다음 근거 「20시간 안」 |
| 프로필 | 잠금 없는 도구가 프로필을 쥠 | 60초 x 3 후 원래 오류 → 기존 「네이버 이관 실패」 | 활동 |
| save-login | 원장이 창 취소 | exit 1, 파일 안 생김 | 콘솔 |
| save-login | local-agent 가 도는 중 | 최대 15분 기다림, 그래도면 exit 3 | 콘솔 |
| 유출 | 비번이 stdout·로그·근거·상태 파일로 샘 | 찍는 곳이 없는 구조 + 카나리아 시험 | 시험이 잡음 |
| 사전 경고 | NID_AUT 만료일과 서버 쪽 만료가 다름 | 경고는 참고. 진짜 안전망은 자동 로그인 | KG-52-2 |

치명 틈(시험 없음 + 처리 없음 + 조용함): 없음.

## Test map
새 `academy/scripts/test-auto-login.mjs`. DB 안 씀. 네트워크 안 씀 — `ctx.route` 로 `nid.naver.com/**`·`blog.naver.com/**` 를 가짜 HTML 로 채운다. 저장값은 `AUTO_LOGIN_SECRETS_DIR` = scratch 임시 폴더에 PowerShell 비대화형으로 만든다(ConvertTo-SecureString -AsPlainText -Force → New-Object PSCredential → Export-Clixml). 카나리아 비번은 `CANARY-` + 무작위 + 특수문자(& 따옴표 둘 % 한글).

| 갈래 | 상태 |
|---|---|
| `git check-ignore -q` tools/.secrets/naver.xml · naver.state.json · shots/x.png 종료코드 0 | [GAP] → 새 |
| `git ls-files tools/.secrets` 빈 출력 | [GAP] → 새 |
| 복호화 왕복(카나리아 그대로 돌아옴) | [GAP] → 새 |
| 복호화 실패(깨진 xml) → 고정 문구 하나, 다른 글자 없음 | [GAP] → 새 |
| 시도가능: 19h59m false · 20h true · blocked false · bad false | [GAP] → 새 |
| 자동로그인할까: 고객 프로필·저장값 없음·20시간 안·blocked·bad → 각 까닭 | [GAP] → 새 |
| 가짜 화면 성공: 제출 postData 에 카나리아가 실제로 들어감 + 상태 유지 체크됨 + NID_AUT 만료일 쿠키 심음 → ok | [GAP] → 새 |
| 가짜 화면 캡차 · 2단계 · 새 기기 · 비번틀림 · 모르는화면 · 시간초과 → 각 사유·상태 값·스크린샷 파일 있음·로그인 클릭 ≤1 | [GAP] → 새 |
| 처음부터 캡차 표지 → 입력 이벤트 0 | [GAP] → 새 |
| **유출**: 위 시나리오를 자식 프로세스로 돌려 stdout+stderr, state.json, 반환 객체 JSON, 시험 중 바뀐 `tools/*.log` 에 카나리아·카나리아 base64·JSON base64 가 0번 | [GAP] → 새 |
| `멈춤줄(out)`: 「자동 로그인 멈춤: 캡차 · 화면 …」→ 근거, 같은 출력에 `/로그인이 필요/` 여전히 걸림 | [GAP] → 새 |
| 남은 날: N=2·저장값 없음 → soon 올림 / N=2·저장값 있음 → 안 올림 / N=10 → soon 완료 (가짜 q, 판단은 함수로) | [GAP] → 새 |
| 「로그인 창 열기」 버튼·문구 | [TESTED] `academy/scripts/test-login.mjs` — 회귀 |
| login-poll 끝에서 끝 | [TESTED] `academy/scripts/test-login-live.mjs` — 회귀 |
| save-login GUI 창 | [GAP] 사람만 — 원장 1회 실행(Acceptance 6) |

## Out of Scope
- 퍼플렉시티(로그아웃 측정, 세션 없음 D183) · 구글 서치콘솔 · 빙(2단계·SSO)
- 고객 블로그 프로필 자동 로그인(KG-52-1)
- 서치어드바이저 세션 따로 살리기 · login-poll/open-session 「로그인 창 열기」 길 · 지식iN(kin-*) 캡차 길
- 죽기 전에 미리 다시 로그인하기(KG-52-2) · 이관할 글이 없는 날의 세션 확인(KG-52-3)

## Acceptance
1. `node academy/scripts/test-auto-login.mjs` 실패 0. 통과 줄 수를 REVIEW-REQUEST 에
2. 회귀: `test-login.mjs` · `test-login-live.mjs` 이전과 같은 통과 수
3. `git check-ignore -v tools/.secrets/naver.xml` 이 루트 `.gitignore` 줄을 가리킴. `git status --porcelain` 에 `.secrets` 없음
4. `grep -n "console\." tools/auto-login.mjs tools/save-login.mjs` 결과를 REVIEW-REQUEST 에 붙이고, 줄마다 u·p·복호화 결과를 안 받는다고 적는다
5. 실측해 적을 것(REVIEW-REQUEST): nid 로그인 화면의 아이디·비번·상태 유지·로그인 버튼 선택자, 캡차·2단계·새 기기·비번틀림 표지(빈 임시 프로필, 아무것도 안 침). 학원 프로필 NID_AUT 남은 날(LA·OS 잠금이 없을 때만 열고 읽기만)
6. Bob 은 실제 네이버 계정으로 로그인하지 않는다. 원장 1회: `node tools/save-login.mjs naver` → 윈도 창 입력 → 「✓ 저장했고 자동 로그인도 됐습니다」. 그 뒤 Arch 가 `tools/.secrets/naver.state.json` 과 다음 local-agent 활동 줄 「네이버 세션 N일 남음」을 확인
