# Review Request — Step 52 (네이버 자동 재로그인) · 2차(리뷰 반영)
Date: 2026-10-17
Ready for Review: YES
Status: DONE_WITH_CONCERNS (test-login-live --live 회귀는 Arch 몫 · 실측은 원장 첫 save-login 으로(D186))

## 2차 반영 (REVIEW-FEEDBACK 1차 · Arch 결정)
- Must Fix → (a) D185: 키 `naver-session-soon` (tools/auto-login.mjs 세션경고 insert·update, 시험 2곳). 새 시험: 세션경고가 실제로 넣는 키를 뽑아 web/lib/todo-text.ts(TS 깎아 임시 파일)에 넣으면 action.type ≠ login · 「로그인 창이 뜹니다」 없음, 대조로 login-naver 는 login
- 클릭 뒤 판정: `표지찾기(page, { 비번먼저: true })` — 비번틀림 글자를 캡차 요소보다 먼저. 시나리오 「비번틀림+캡차」→ 비번틀림·bad=true. 기존 「캡차」 시나리오는 캡차만 뜨는 화면으로
- 비번 칸 선택자 `input#pw[type="password"], input[name="pw"][type="password"]`. 시나리오 「비번 칸이 글자칸」→ 모르는화면·입력 이벤트 0·제출 0
- Acceptance 5 → D186: 원장의 첫 save-login 실행을 실측으로 친다
- 결과: test-auto-login **138 통과 · 0 실패**, test-login 56 · 0. --live·실제 네이버는 안 돌림

## Files Changed
- .gitignore:62-64 — `tools/.secrets/` 한 줄 + 까닭 주석
- tools/auto-login.mjs (새) — 비밀폴더·저장값있음·상태읽기/쓰기(네 칸만)·시도가능(20h)·자동로그인할까·복호화(고정 문구)·프로필열기(60s x3)·세션남은일·멈춤줄·남은날줄·세션경고(naver-session-soon)·자동로그인(사전 판정→복호화→한 글자씩 60~160ms→상태 유지→클릭 1번→긍정 판정·스크린샷 10장)
- tools/save-login.mjs (새) — 잠금 대기(30s, 15분, exit 3)·OS 잠금 wx·Get-Credential→Export-Clixml(PowerShell 안에서만)·상태 초기화·로그아웃→Write→자동로그인·✗ 면 5분 창·5초 뒤 ctx.close·잠금 해제
- tools/naver-blog-post.mjs:35-41 — chromium import 빼고 auto-login import
- tools/naver-blog-post.mjs:~192 — `프로필열기`로 교체(옵션 그대로)
- tools/naver-blog-post.mjs:~210-235 — nid 분기: 자동로그인할까→자동로그인, 실패/안 함이면 기존 줄 글자 그대로 + 「자동 로그인 멈춤|안 함: …」 + 기존 8분 대기. 에디터 확인 뒤 학원 프로필이면 blocked=false(저장값 있을 때)·`NID_AUT 남은 N일|날 모름`
- tools/local-agent.mjs:27 — auto-login import
- tools/local-agent.mjs:~107-114 — `사람로그인(kind, what, 근거)`: evidence 에 근거 덧붙임, naver 일감 detail 끝 문장
- tools/local-agent.mjs:~142-185 — 세션 남은 날 활동 「네이버 세션」 + 세션경고(실행당 한 번), 로그인 필요 분기에 멈춤줄 근거·활동 summary
- academy/scripts/test-auto-login.mjs (새) — 단위 + 가짜 nid 화면 12 시나리오(자식 프로세스) + 카나리아 유출 검사

## 결과
- `node academy/scripts/test-auto-login.mjs` → **122 통과 · 0 실패** (약 90초)
  - 시험이 진짜로 잡는지 확인: 분류를 망가뜨리자 10 실패, 복호화 값을 base64 로 console.log 하게 심자 「유출 — 자식 stdout+stderr」 실패(base64·base64 그대로). 둘 다 되돌림
- 회귀 `node academy/scripts/test-login.mjs` → 56 통과 · 0 실패 (이전 56)
- 회귀 `test-login-live.mjs --live` → **못 돌림** (운영 DB 쓰기 — 자동 모드 분류기 거부). Arch 가 돌려 주세요
- `git check-ignore -v tools/.secrets/naver.xml` → `.gitignore:64:tools/.secrets/	tools/.secrets/naver.xml`. `git status --porcelain` 에 .secrets 없음. tools/.secrets 폴더 자체가 없음(실제 저장값 안 만듦)
- `node tools/save-login.mjs foo` → 사용법, exit 1
- `node --check` 5파일 통과

## Acceptance 4 — console. 줄 (u·p·복호화 결과를 받는 줄 없음)
```
tools/auto-login.mjs:91   프로필 재시도 회차(i)만
tools/save-login.mjs:20   사용법 고정 문구
tools/save-login.mjs:48   15분 초과 고정 문구
tools/save-login.mjs:49   기다림 고정 문구
tools/save-login.mjs:64   취소 고정 문구
tools/save-login.mjs:65   저장 실패 고정 문구(PowerShell 출력 안 붙임)
tools/save-login.mjs:67   저장 완료 고정 문구
tools/save-login.mjs:90   ✓ 고정 문구
tools/save-login.mjs:93   r.사유(고정 분류 글자)·r.화면(스크린샷 경로)만
tools/save-login.mjs:94   고정 문구
tools/save-login.mjs:97   고정 문구
tools/save-login.mjs:101  고정 문구(catch 의 e 를 안 씀)
```
naver-blog-post 에 더한 줄도 판단.까닭·r.사유·r.화면·남은 날 숫자만 찍는다. 자동로그인은 오류를 밖으로 안 던진다(Playwright 오류 문구가 근거로 새지 않게).

## Acceptance 5 — 실측: 못 함 (BLOCKED, Arch 판단 필요)
빈 임시 프로필(scratchpad)로 `https://nid.naver.com/nidlogin.login` 을 열어 DOM 만 읽는 스크립트가 자동 모드 분류기에 거부됨([Third-Party Attack]). 우회하지 않았다. 학원 프로필 NID_AUT 남은 날도 같은 까닭으로 안 읽었다.
지금 들어간 선택자는 **알려진 nid 구조로 넣은 후보**고 실측값이 아니다.
- 아이디 `input#id, input[name="id"]` · 비번 `input#pw, input[name="pw"][type="password"]`
- 상태 유지 `input#keep, input#nvlong, input[name="nvlong"]`(라벨 `label[for=<id>]` 클릭, 안 되면 check force. 그래도 꺼져 있으면 안 누르고 모르는화면)
- 로그인 `[id="log.login"], button.btn_login, form#frmNIDLogin button[type="submit"]`
- 캡차 요소 `#captcha, #captchaimg, #chptcha`(보일 때만) · 문구 /자동입력 ?방지|자동 입력 방지|보안문자|보이는 대로 입력/
- 2단계 /2단계 인증|2차 인증|OTP 인증/ · 새기기 /새로운 기기|새 기기|새로운 환경|등록되지 않은 기기|기기 인증/ · 보호조치 /보호조치|보호 조치|도용이 의심|이용이 제한/ · 비번틀림 /비밀번호를 (잘못|정확하게)|비밀번호가 (잘못|일치하지)/
- 문구는 body innerText(보이는 글자)로만 본다
틀렸을 때 일어나는 일: 칸을 못 찾으면 아무것도 안 치고 `모르는화면`(blocked) → 오늘과 같은 사람 일감 + 스크린샷. 실계정 잠김 위험 쪽으로는 안 기운다. 단, 정상 로그인 화면에 위 문구가 보이면 매번 사전 판정에서 멈춘다(헛 blocked) — 실측으로만 지울 수 있는 위험.
제안: Arch 또는 원장이 `C:\Users\force\AppData\Local\Temp\claude\C--dev-AGO-GEO\4532bd60-6822-4139-9841-8e77d27995eb\scratchpad\probe-nid.mjs`(빈 임시 프로필·헤드리스·읽기만·끝나면 프로필 삭제)를 돌려 선택자를 맞추거나, 원장 1회 save-login 결과(✓/✗ 사유·스크린샷)로 확인.

## Open Questions
- 선택자 실측(위). Acceptance 6(원장 save-login 1회)이 사실상 첫 실측이 된다
- 세션 확인 뒤 blocked=false 는 저장값이 있을 때만 쓴다(저장값 없는 PC 에 .secrets 폴더를 만들지 않게)
- 사람로그인 evidence: insert 때 `coalesce($4,'')`, 충돌 때 근거가 있을 때만 덧붙임

## Out of Scope (logged in BUILD-LOG)
- 우려 두 줄(실측·live 회귀)만 BUILD-LOG Step 52 빌드 절에. 새 Known Gap 없음
