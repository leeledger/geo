# Review Request — Step 53 (+ D198 마이크로소프트)
Date: 2026-10-17
Ready for Review: YES
Status: DONE

## Files Changed
- tools/auto-login.mjs:52-67 — `계정이름(profileDir)` (basename 만, 기본값 없음) · `자동로그인할까(계정, …)` 계정 null → 「프로필 모름」
- tools/auto-login.mjs:127-145 — `세션경고(q, n, 저장값, 지금, clientId = 1, 계정 = "naver")`: insert/update 가 그 client 행, 문구 명령이 그 계정. 네이버 계정 꼴이 아니면 던짐(마소 사전 경고 없음 D195)
- tools/auto-login.mjs:145-162 — `저장아이디(계정)`: xml 의 `<S N="UserName">` 평문만(UTF-16 BOM 처리, 앞 `\` 뗌). 복호화 안 함
- tools/auto-login.mjs:171-173 — 네이버 로그인 버튼 선택자 후보마다 `:visible` (버그 수정, 아래 질문 1)
- tools/auto-login.mjs:184 — 나쁨사유에 「아이디틀림」(마소 「계정이 없음」 화면)
- tools/auto-login.mjs:296-312 — `네이버다시로그인(page, ctx, profileDir, 선택)` → `{ ok, 줄 }`, 줄은 멈춤줄 꼴
- tools/auto-login.mjs:314-419 — D198: `마소계정이름`(학원 프로필만) · `마소로그인화면` · `마소자동로그인`(이메일→다음→비번→로그인→유지 예→로그인 화면 떠남, 그 밖 멈춤) · `마이크로소프트다시로그인`
- tools/naver-blog-post.mjs:41,212-231 — 분기를 네이버다시로그인으로, 기존 「네이버 로그인이 필요합니다…」 줄 그대로. 에디터 뒤 상태·NID_AUT 남은 날을 `계정이름(PROFILE)` 이 있으면(고객 포함)
- tools/smartplace-keyword.mjs:19,32-63 — nid 면 네이버다시로그인(학원 프로필), ok 면 원래 주소 재방문 + nid 재확인, 아니면 줄 + 기존 「로그인이 안 돼 있습니다.」 + 종료 2
- tools/kin-find.mjs:33,83-84,145-163 — 쿠키 없음이면 nid 로그인 주소 → 네이버다시로그인(고객 프로필) → 쿠키 재확인. 로그인된 날 NID_AUT 남은 날 + `세션경고(q, 남은, 저장값있음(계정), KST(), c.id, 계정)` (DRY 면 안 함). 로그인 일감 detail 에 멈춤줄
- tools/local-agent.mjs:107-113 — 사람로그인 자동 로그인 안내를 microsoft 일감에도
- tools/local-agent.mjs:211-221 — 고객 블로그 로그인일감에 선택 근거(evidence 덧붙임 SQL, 사람로그인과 같은 꼴) + save-login naver-<slug> 안내
- tools/local-agent.mjs:235-237,244-247 — 고객 블로그 세션경고(그 client·그 계정), 로그인 필요 분기에서 멈춤줄 근거
- tools/local-agent.mjs:264-269,387-389 — 플레이스·빙 사람로그인에 멈춤줄 근거
- tools/bing-submit-urls.mjs:20,28-50 — 빙나감이면 마이크로소프트다시로그인(로그인 화면일 때만), ok 면 재방문·재확인, 아니면 줄 + 기존 「로그인이 풀렸습니다」. 로그인돼 있으면 microsoft blocked 풀기
- tools/save-login.mjs (전체 다시 씀) — naver | naver-<slug> | microsoft | --all. export `프로필경로`(한 방향 표 + 되짚기) · `계정목록` · `인자판정` · `창문구`. [1] 입력 전부(취소=건너뜀) → [2] 저장한 것만 시험(로그아웃 → 로그인 화면 → 자동로그인/마소자동로그인 → 멈추면 5분 손) → [3] 요약 표. 잠금 끝까지 + 60초 갱신. main 은 직접 실행일 때만
- academy/scripts/test-auto-login.mjs — 가짜 nid 화면을 2026-10 실제 꼴로(#loginStay · #loginBtn_row/#loginBtn_column 하나만 보임), 계정이름·자동로그인할까·네이버다시로그인 안 함 3종·저장아이디·세션경고 고객·todo-text 고객 행·끼운 자리·save-login 인자/목록/실행, 카나리아 A/B/C 교차(학원·고객 상대/절대, 성공·막힌 제출), 마소 가짜 login.live.com(성공·Authenticator·비번틀림·모르는화면·계정 고르기·로그인 화면 아님), 임시 폴더 전 파일 유출 검사

## 시험 결과
- `node academy/scripts/test-auto-login.mjs` → **242 통과 · 0 실패** (기존 138)
  - 기존 단정 중 고친 것 **4개**: 자동로그인할까 「고객 프로필」 2개 → 「프로필 모름」·고객 계정 함/저장값 없음으로 바꿈, naver-blog-post 「학원 프로필 비교 하나」 → 「비교 없음 · 계정이름 하나로」, todo-text 키 정규식 `values \(1,` → `values \(\$3,`. 자동로그인할까 나머지 5개는 첫 인자를 ".browser-profile" → "naver" 로만
  - 변이 확인: 네이버다시로그인이 늘 "naver" 를 쓰게 바꾸면 교차 단정 8개(+제출 검사 2)가 실패 → 원복
- `test-login` 56/0 · `test-kin` 110/0 · `test-clients` 99/0 (기존 수 그대로)
- `node tools/save-login.mjs google` → 안내 + 종료 1 · `naver-nope` → 종료 1 · `naver-../x` → 종료 1. 창 안 뜸(인자 판정이 잠금·PowerShell 앞)
- `git status` 에 tools/.secrets 없음 · `PROFILE === ".browser-profile"` auto-login·naver-blog-post 0건
- 실계정 로그인·실제 tools/.secrets 접근 없음. 모든 시험은 AUTO_LOGIN_SECRETS_DIR 임시 폴더 + 가짜 화면(ctx.route)

## Open Questions
1. **로그인 버튼 선택자 버그(범위 안으로 고침)** — 실제 꼴대로 가짜 화면을 만들자 「#loginBtn_row 숨김 + #loginBtn_column 보임」에서 `.first()` 가 `button.btn_login`/form submit 후보로 숨은 row 버튼을 집어 「모르는화면」으로 멈췄다. 후보마다 `:visible` 을 붙여 고침. save-login 창 폭 1440 이면 row 가 보여서 D187 이후 원장 실행에는 안 걸렸을 수 있으나 폭 좁은 창에서는 걸린다. 맞는 판단인지 봐 주세요
2. **Acceptance 5 「복호화( 호출 1곳」** — D198 로 마소자동로그인이 생겨 auto-login.mjs 안 2곳(둘 다 auto-login 안, 밖에서는 0). 시험은 「auto-login 안 2 · 밖 0」으로 단정
3. **Acceptance 3** — `save-login microsoft` 는 D198 로 이제 대상이다(창이 뜬다). 대신 `google` 로 「대상 아님 + 종료 1」 확인
4. **빙 로그인 풀림이 실제로 마소 로그인 화면으로 가는가 (KG-53-5)** — 기존 주석(2026-10-05 확인)은 /webmasters/about 으로 간다고 한다. 이때 bing-submit-urls 는 「자동 로그인 안 함: 로그인 화면이 아님」만 남기고 사람 일감. about → 로그인 화면 길은 실측 전이라 짐작으로 안 지었다. 실제로 자동 로그인이 붙으려면 Arch 결정 필요
5. 마소 성공 판정: 「유지 예」를 누른 뒤 로그인 화면을 떠나면 ok. 「유지」 화면 없이 바로 떠나면 모르는화면(blocked)으로 둠 — 세션이 브라우저 닫으면 사라질 수 있어서. 너무 보수적인지
6. save-login 마소 시험은 `https://login.live.com/logout.srf` → `https://login.live.com/login.srf` (실측 전). 로그아웃이 안 되면 「로그아웃이 안 돼 로그인 화면이 안 뜸」으로 아무것도 안 침
7. --all 에서 시험한 계정이 0개(전부 취소)면 종료 1 로 둠(단일 계정 취소의 기존 종료 1 과 같게)
8. kin-find 는 가볍게(그림 차단)인 채로 nid 자동 로그인 (KG-53-6)

## Out of Scope (logged in BUILD-LOG)
- KG-53-5 빙 /webmasters/about → 로그인 화면 길 실측
- KG-53-6 kin-find 가볍게 + 캡차 그림
- KG-53-7 마소 표지 문구 실측 전(안전 쪽 실패)
