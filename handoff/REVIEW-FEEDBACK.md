# Review Feedback — Step 53 (+ D198 마이크로소프트)
Date: 2026-10-17
Ready for Builder: YES

## Must Fix
없음.

## Should Fix
- tools/auto-login.mjs:220-221 (confidence: 7/10) — 마소 4단계 `if (넷.표) return 멈춤(넷.표);` 는 「시간초과」를 그대로 넘긴다. 2·3단계는 `둘.표 === "시간초과" ? "모르는화면" : …` 로 바꾸는데 여기만 다르다. 「유지 예」를 누른 뒤 login.live.com 에 머무는 경우(계정 보호·보안 정보 확인 같은 중간 화면)는 표지에 안 걸리면 시간초과가 되고, 막힘사유에 없으니 blocked 가 안 걸린다. 그러면 20시간마다 같은 화면에 비번을 다시 친다. 고치는 법: 2·3단계와 같이 `넷.표 === "시간초과" ? "모르는화면" : 넷.표` 로 바꿔 blocked 를 걸고, 시험 하나 추가(유지 예 뒤 login.live.com 에 머무는 가짜 화면 → 모르는화면·blocked).
- academy/scripts/test-auto-login.mjs (confidence: 6/10) — 위 4단계 머묾 경우에 대한 시험이 없다. 위 수정과 같이 넣는다.

## Escalate to Architect
- KG-53-5 — 빙 로그인이 풀리면 /webmasters/about 으로 간다는 기존 확인(2026-10-05)이 맞다면 bing-submit-urls 의 마소 자동 로그인은 운영에서 한 번도 안 붙는다(「로그인 화면이 아님」 → 사람 일감). 안전 쪽이라 코드 문제는 아니지만 D198 이 실제로 일하게 하려면 about → 로그인 화면 길을 실측하고 결정해야 한다.
- kin-find `--dry`/`--look` 에서도 쿠키가 없으면 실제로 비번을 치고 20시간 한도를 쓴다(tools/kin-find.mjs:311-317, DRY 는 세션경고만 막는다). 브리프 58행을 글자대로 따른 것이다. 「시험 실행이면 로그인도 안 한다」가 맞는지 Arch 판단.
- 마소 성공 판정에 「로그인 상태 유지」 화면을 필수로 둔 것(Open Question 5) — 안전 쪽이고 동의한다. 다만 KMSI 화면을 안 띄우는 계정이면 매번 모르는화면으로 멈추고 사람 일감이 된다. 원장 첫 --all 결과로 확인.

## Cleared
검토 범위: auto-login.mjs(계정이름·마소계정이름·네이버/마이크로소프트다시로그인·마소자동로그인·저장아이디·세션경고), save-login.mjs 전체, naver-blog-post·smartplace-keyword·kin-find·bing-submit-urls·local-agent 분기, test-auto-login.

1. 교차 계정 사용 — 계정은 프로필 basename 에서만 나온다. `^\.browser-profile-([a-z0-9-]{1,40})$` 는 점·슬래시를 막고, naver 로 떨어지는 기본값이 없다. 마소는 학원 프로필에서만 나오고 계정이름은 microsoft 를 낼 수 없다. save-login 프로필경로는 되짚어 확인한다. `naver-../x` 는 종료 1. 카나리아 A/B/C 교차 시험이 통과하고, 변이 시험도 확인됐다.
2. 비밀값 유출 — 복호화( 는 auto-login 안 2곳뿐이다. 명령 인자는 파일 경로만, 오류는 고정 문구다. u/p 는 finally 에서 비운다. 상태 파일은 네 칸만 남는다. 스크린샷 이름은 계정+시각이다. 일감 근거는 멈춤줄(고정 사유+스크린샷 경로)이다. save-login 요약 표의 아이디 출력은 D193 결정이다.
3. 멈춤 — 화면이 순서 밖이면(표지·칸 없음·시간초과) 멈추고 더 치지 않는다. lastAttemptAt 은 치기 전에 남는다. 비번틀림·아이디틀림은 bad. 예외 하나는 위 Should Fix.
4. UA·stealth·쿠키 주입은 0건이다. 실행 옵션도 기존 그대로다.
5. 「로그인이 필요」「로그인이 안 돼 있습니다」「로그인이 풀렸습니다」 줄과 사람 일감 분기는 그대로이고, 근거만 덧붙는다.
6. :visible 수정은 맞다. 쉼표 목록의 후보마다 :visible 이 붙어야 `.first()` 가 숨은 #loginBtn_row 를 집지 않는다.
7. tools/.secrets/ 는 .gitignore:64 에 있고 추적 파일은 0개다.

시험: test-auto-login 242/0 · test-login 56/0 · test-kin 110/0 · test-clients 99/0. 실제 tools/.secrets 는 읽지 않았다.
