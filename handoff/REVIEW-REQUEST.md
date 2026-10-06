# Review Request — Step 39 (39a · 39b · 39c)
Date: 2026-10-06
Ready for Review: YES
Status: DONE (세션 몫 4개는 아래 「세션이 할 것」 — Bob 은 원장 로그인 브라우저·작업 스케줄러를 안 건드렸다)

커밋 셋(푸시·배포 안 함): `9724204` 39a · `c569e0e` 39b · `31b73b4` 39c

## Files Changed

### 39a — 바깥 글 범용화
- academy/scripts/marketing-draft.mjs:45-52 — 금지말 → 공통금지말 둘. remove-background 줄은 문서딱 config.banned 로
- academy/scripts/marketing-draft.mjs:124-185 — 「문서딱」 리터럴 → c.name · persona 기본값 · situations 없으면 「(예: …)」 통째 뺌 · 프롬프트 export
- academy/scripts/marketing-draft.mjs:211-244 — 관문 문장 c.name · 금지말 = 공통 + c.marketing.banned · 대안찾기(글들, 기관, 이름들)
- academy/scripts/marketing-draft.mjs:289-306 — 바깥글빠진칸(사실 0 → marketing.facts) · 사실줄(c, 안내수)
- academy/scripts/marketing-draft.mjs:316-321,352-354,383-385 — 건너뜀 문구 · guidePrefix 로 안내 수 · 부르기전멈춤 → 안부름만
- academy/clients.mjs:224-235 — 문서딱 marketing 에 persona·facts·guidePrefix·alternatives·banned·situations(글자 그대로)
- academy/clients.mjs:433-456 — 고객설정 marketing.facts(≤10·text 1~200·checkedOn)·guidePrefix(/)·alternatives·banned(lit, gi)·persona·situations 형 검사
- web/lib/client-core.mjs:243-348 — 페이지줄읽기/페이지줄글 · 바깥글입력검사 · 바깥글config(새 사실 줄만 checkedOn=오늘) · 바깥글고치기 · 바깥글폼값
- web/lib/client-core.mjs:(체크리스트 끝) — offsite 줄: 꺼짐 해당없음 · 켜짐+사실 0 「사실 목록이 비어 글을 안 씁니다」(기다림, 일감 없음) · 됨
- web/lib/client-actions.ts:75-89 — updateMarketing(useActionState)
- web/app/admin/clients/MarketingForm.tsx (새) · web/app/admin/clients/[slug]/page.tsx:6,14,168-174 — 「바깥 글」 폼 한 덩어리
- academy/scripts/test-marketing-snapshot.mjs · fixtures/marketing-prompt-docttak.txt (새) — 고치기 전에 뜬 스냅샷
- academy/scripts/test-marketing.mjs · test-client-core.mjs · test-new-client.mjs — DB 고객 시험 · E2E 는 사실 0 건너뜀 + `--no-claude`

### 39b — 로그인 창 버튼 + 운영 정리
- tools/login-rules.mjs (새) — 구글·네이버·블로그·빙 풀림 판정 · NID_AUT · 판정걸음(두 번 연속 + 10초)
- tools/open-session.mjs (다시 씀) — 기본 셋(빙 추가) · `--only` · SITES 기준 done · 출력 「✓ <이름> 로그인 확인」 그대로
- tools/bing-submit-urls.mjs:19,32-33 — 판정을 login-rules 빙나감으로
- web/lib/login-core.mjs·.d.mts (새) — 로그인대상 표 · 창요청검사 · 확인된곳 · 창요청(upsert) · 오래된창요청닫기(30분 로컬 대기·20분 실행 중)
- tools/login-poll.mjs (새) — 창 잠금 먼저 쓰고 local-agent 잠금 보기 → 실행 중 → open-session(OPEN_SESSION 바꿔 끼움) → 완료/실패
- tools/pc-runner.mjs:36-46 — 측정 10:00·16:00 · OLD_TASKS 루트 경로 / 64-101 끝줄(종료코드 3 건너뜀)·시간창안·환경값 / 131-172 로그인 타이머(loginBusy) / 172-203 옛작업상태·관리자한줄·옛작업끄기(schtasks, 원문·끈 뒤 상태 로그) / 215-240 --disable-old · 대소문자 무시 직접실행 판정
- tools/local-agent.mjs:55-76 — 잠금 건너뜀 exit 3 · .open-session.lock 기다림(최대 13분, 넘으면 exit 3) · 108·188 login 문구
- tools/ai-web-measure.mjs:63-64 — 잠금 건너뜀 exit 3
- web/lib/task-actions.ts:(끝) requestLogin · web/lib/todo-text.ts login 분기 · web/lib/ops.ts:346,356 dedupe_key · web/app/admin/ops/Todo.tsx 「로그인 창 열기」 폼
- academy/scripts/company.mjs:553-557 — PC살핌 뒤 오래된창요청닫기
- academy/scripts/test-login.mjs · test-login-live.mjs · fixtures/fake-open-session.mjs (새)

### 39c — GSC 권한 탐침
- tools/gsc-access.mjs (새) — `--client|--domain [--look]`, PROP = submit-gsc 와 같음, 9초, GSC_ACCESS=/GSC_URL=/GSC_SAMPLE= 줄
- web/lib/client-core.mjs:595-633 — 점검저장이 gscAccess 를 남김 · 권한판정(늘 「모름」) · 탐침읽기 · 탐침저장(있음만 gsc true, gsc true 면 안 건드림)
- web/lib/client-core.mjs:716-737 — 체크리스트 gsc 줄 4갈래
- tools/local-agent.mjs:317-342 — 탐침 대상(DB 고객·active·wantGsc·gsc 아님·오늘 안 봄), 구글 풀림이면 login-google

## 증거
- 39a 스냅샷: `node scripts/test-marketing-snapshot.mjs` → 「문서딱 스냅샷 같음 (6242자)」. 스냅샷은 `export` 만 붙인 코드로 떴다(프롬프트 3채널·관문 이유 3묶음·대안·사실 줄)
- 39a `node scripts/marketing-draft.mjs --client docttak --dry --no-claude` 전후 `diff` 0 줄
- 39a E2E(시험 고객 geo-rose-nine.vercel.app, status test): 사실 0 → 「시험바깥: 사람이 확인한 사실 목록이 비었습니다 — 건너뜀」 code 0 / 폼 길로 사실 2줄 저장(checkedOn 2026-10-06) → `--dry --channels jisikin --max-calls 1` Claude 1회 · 관문 통과 · 출력 「문서딱」 0 · marketing_posts 0행 · 지우기 뒤 남은 행 0
- 39b `test-login-live.mjs --live`(next dev :3078 + 헤드리스): 19 통과 — 버튼 두 번 → open-login 1행 · login-* 아닌 id 거부 · local-agent 잠금 → 기다림 note · 가짜 창 확인 없음 → 실패/사람 대기 · 다시 → 전부 ✓ → 둘 다 완료 · 31분 뒤 → 「PC 가 꺼져 있어 창을 못 열었습니다」 · 일 없을 때 login-poll 1.0초 · 남은 행 0
- pc-runner 다시 띄움: pid 15464 끝 → VBS 가 13:47:07 새 일꾼(pid 39856) 「로그인 창 집기 꺼짐(LOGIN_POLL_HOURS 빈 값)」. `--status` 일꾼 떠 있음
- 시험: test-clients 99 · test-client-core 186 · test-marketing 51 · test-docttak 32 · test-login 56 · test-new-client --live 20 · 전부 0 실패. web tsc 0
- 회귀 전후(clients.mjs 를 cd4d265 판으로 돌려 뜬 것과 비교): briefing · health · daily-agent --dry 출력 diff 0

## Open Questions
- **login-poll 의 「같은 프로필」**: 브리프는 「.local-agent.lock 신선 & 같은 프로필」. local-agent 는 한 실행에 학원 프로필과 고객 블로그 프로필을 다 열 수 있는데 지금 어느 걸 여는지 기록이 없다 → 잠금이 신선하면 프로필과 상관없이 기다리게 했다(크로미움 프로필 깨짐보다 늦게 뜨는 쪽을 골랐다). 블로그 창이 local-agent 실행(최대 90분) 동안 늦을 수 있다
- 체크리스트 offsite 「켜짐 + 사실 0」을 상태 「기다림」으로 뒀다(사람 칸 아님 → 일감 없음). 요약의 기다림 수에 들어간다
- 바깥 글 폼에 situations 칸은 안 넣었다(브리프 칸 목록에 없음). config 에 있으면 저장해도 남긴다
- 창요청이 「실행 중」 15분 넘은 행은 다시 받는다(login-poll 이 죽은 경우). 브리프에 없는 길이라 봐 줄 것
- open-login dedupe 는 `open-<login dedupe>`(= open-login-google · open-login-naver-blog-<slug>)

## 세션이 할 것 (Bob 이 안 돌림)
1. 옛 작업 끄기: `node tools/pc-runner.mjs --disable-old` → pc-runner.log 의 「옛 작업 …: 끄기 종료코드 · 원문 · 지금 끔」 세 줄. 못 끄면 화면에 관리자 PowerShell 한 줄이 찍힌다 → 원장 일감 1건
2. Neon 요금제 확인 뒤 academy/.env.local `LOGIN_POLL_HOURS=8-24` (지금 빈 값). 바꾸면 일꾼 재시작 없이 다음 분부터 먹는다
3. 로그인 버튼 시험: 현황판 login 일감(없으면 시험용 login-microsoft 한 건) 「로그인 창 열기」 → 2분 안에 창
4. GSC 탐침 원문: `cd tools && node gsc-access.mjs --client robotncoding --look` · `node gsc-access.mjs --domain example.com --look` → fixtures 두 개 → 판정 정규식(39c 5)

## Out of Scope (logged in BUILD-LOG)
- KG-39-3 DB 고객 바깥 글은 아무도 매일 안 돌린다 — optimize.yml 이 `--client docttak` 만 부른다
- KG-39-4 바깥 글 폼에 situations·blogDays 칸 없음

## 2차 (Richard 보류 반영)
- tools/login-poll.mjs — 기다림 note 마다 updated_at=now()(status 로컬 대기 조건). 기다리는 동안 「PC 꺼짐」 30분 닫기에 안 걸린다
- academy/scripts/test-login-live.mjs — 「31분째 기다리는(poll 이 계속 오는) 행은 닫히지 않는다」·「poll 이 끊긴 31분 행은 닫힌다」. live 20 통과 · test-login 56 · web tsc 0
- BUILD-LOG: 최대 90분 늦을 수 있음 결정 · KG-39-6(관문에 다른 고객 이름 검사 없음) · KG-39-5 「원장 결정 대기, 기본 막음」
