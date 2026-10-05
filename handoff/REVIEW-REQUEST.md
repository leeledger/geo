# Review Request — Step 38 (고객사 등록 화면 · 세팅 점검 · 체크리스트 · 사람 일감)
Date: 2026-10-05
Ready for Review: YES
Status: DONE — 단위 127 통과, 기존 시험 그대로 통과, web tsc exit 0 · next build 성공, E2E(로컬 next dev + 운영 DB + Playwright 헤드리스) 32/32·남은 행 0, 기존 3곳 회귀 차이 0(데이터 흐름 제외 — 아래)

## Files Changed
- web/lib/client-core.mjs:14-34 — CODE_SLUGS·AI_BOTS(clients.mjs·crawler-class.ts 베낌, 시험이 맞춰 봄).
- web/lib/client-core.mjs:36-62 — answerPattern(raw, exclude) 구현(옮겨 옴). exclude 면 각 말 앞에 `(?<!(?:앞말)\s*)`. nextAlias 도 여기로.
- web/lib/client-core.mjs:64-146 — 도메인정리·호스트(스킴·userinfo·포트·경로 떼고 IP·localhost·점 없음·한글 거부)·입력검사(사람 말 오류[])·오류말.
- web/lib/client-core.mjs:148-240 — 고객칸준비(add column if not exists 만)·새키·등록(코드 slug·DB slug·같은 도메인 거부, tx, on conflict 없음)·고치기(slug·status 불변, 도메인 바뀌면 derived {}, 키·gsc·marketing 보존)·폼값.
- web/lib/client-core.mjs:242-430 — 열기(redirect 손으로, https·같은 호스트만, 8초/전체 20초)·robots막힘·ld타입·세팅점검(home·robots·llms·키 파일 병렬 → 사이트맵·하위 5개)·점검저장. 본문은 칸마다 앞 300자.
- web/lib/client-core.mjs:432-540 — 체크리스트(10칸, 사람 칸 최대 3: send·gsc·measure, send 할일 = 복사해 보낼 글)·요약·파일럿상태.
- web/lib/client-core.mjs:542-645 — 일감계획(순수)·사람일감맞추기(upsert setup-<칸>, 됨 완료·해당없음 닫힘·기다림 그대로, 활동 agent setup)·재점검고르기·점검하고맞추기·세팅재점검(company 매시).
- web/lib/client-core.mjs:646-700 — 지우기: status test 만, pg_constraint FK 순서로 한 tx, 남은 행 세어 0 아니면 rollback·left, .catch 없음.
- web/lib/client-core.mjs:702-710 — 파이프(config·derived → posts/indexnow/marketing).
- web/lib/client-core.d.mts — 위 타입.
- web/lib/client-actions.ts:1-111 — server actions(guard=isAdmin): registerClient·updateClient(useActionState, 오류+친 값 돌려줌) · recheckClient · markGscGranted · deleteTestClient(?err=).
- web/lib/answer-pattern.ts:11-13 — answerPattern 은 client-core 에서 다시 내보내기만. competitorNames 그대로.
- web/lib/pilot-intake.ts:50-60 — nextAlias 삭제(쓰는 곳 없음, client-core 로).
- web/lib/pilot-actions.ts:17-57 — createPilot: client_id 로 고객 행 읽기, geo.clients insert/upsert·alter 2줄 삭제, 외부만·answer_pattern 필수, 실패는 /admin/clients/<slug>?err=…#pilot.
- web/app/admin/clients/page.tsx:1-84 — 목록(코드 3곳은 「코드 설정 — 화면에서 안 고침」, DB 고객은 「사람 n · 기다림 n」) + 등록 폼. maxDuration 60.
- web/app/admin/clients/[slug]/page.tsx:1-207 — 체크리스트(data-check/data-state)·보낼 글 textarea+복사·권한 받음·다시 점검·점검 근거 표·고치기·파일럿 시작(옛 pilots 폼 칸 그대로)·지우기(시험만). maxDuration 60.
- web/app/admin/clients/ClientForm.tsx:1-71 — 등록·고치기 클라이언트 폼(useActionState, key=n 으로 친 값 다시 그림).
- web/app/admin/clients/clients.css — 화면 꼴(keep-all).
- web/app/admin/pilots/page.tsx — 만들기 폼·FIELDS·errText 삭제, 「새 고객사는 고객사 화면에서 등록합니다」 링크.
- web/app/admin/AdminNav.tsx:12 — 「고객사」.
- web/lib/agents.ts:2,61-69,475-477 — PipeClient, pipeOf(client) = 코드 1·2·3 은 PIPES, 그 밖은 파이프(config, derived).
- web/app/admin/ops/AgentBoard.tsx:2,13,79 · web/app/admin/ops/page.tsx:270 — clientId 대신 client 를 넘김.
- web/lib/ops.ts:172-174,184-199,207 — Client 에 config·derived(to_jsonb, 칸 없는 DB 안전).
- web/lib/todo-text.ts:176-187 — kind setup: 제목 그대로, 칸별 이유, 「고객 화면 열기」 → /admin/clients/<slug>.
- academy/clients.mjs:326-328,434 — config.presence → presenceRe(lit, 없으면 null · 출처 입력/기본). 533 주석 /admin/clients.
- academy/scripts/company.mjs:39,565-566,929-930 — 세팅재점검 매시 호출 · 「신호 사라짐」 닫기에서 setup-% 제외.
- academy/scripts/test-client-core.mjs — 단위 시험(Test map 전부, DB·네트워크 없음).
- academy/scripts/test-client-screen.mjs — E2E --live.
- CLAUDE.md:115 — 함정 줄 교체(그 줄만).

## 시험
```
test-client-core      127 통과 · 0 실패
test-clients           99 통과 · 0 실패
test-docttak           32 통과 · 0 실패
test-marketing         38 통과 · 0 실패
test-growth-import     59 통과 · 0 실패
web/scripts/check-crawler-class   AI_BOTS 같음 (20) · SEARCH_BOTS 같음 (5)
node --check scripts/company.mjs  OK
web: node ./node_modules/typescript/bin/tsc --noEmit -p .   exit 0
web: next build   성공(/admin/clients · /admin/clients/[slug] ƒ)
```

## 회귀 — 기존 3곳 전후 (cwd academy, 전 13:57 · 후 14:2x)
```
daily-agent --dry                                   차이 0
marketing-draft --no-claude --client docttak        차이 0
pilot-report --dry --stage baseline robotncoding    차이 0
indexnow --list                                     차이 0
health                                              차이 0
pilot-report ilog · docttak · briefing              30분 사이 들어온 AI 측정(표본 80→96 등)·크롤러 수로 달라짐 →
                                                    git stash 로 전/후를 바로 붙여 다시: 차이 0 · 0 · 0
check-index --dry                                   문서딱 실시간 검색 3줄만(브랜드 「미노출→노출 1위」·네이버 노출 1/7→2/7·경고 줄) — 데이터
```

## E2E 로그 원문 — `node scripts/test-client-screen.mjs --live` (exit 0)
```
next dev http://localhost:3077 뜸
  ✓ 관리자 쿠키 → /admin/clients
  ✓ docttak.com 중복 거부 — 사람 말
  ✓ 거부 뒤 친 값이 남음
  ✓ 거부는 행을 안 만듦
  등록 → 상세 3.1초 (/admin/clients/e2e-screen)
  ✓ 행 생김 — status test · 외부 · alias 「고객 …」
  ✓ IndexNow 키 32자 · mode 우리
  ✓ answer_pattern 만들어짐
  derived: checkedAt 2026-10-05T05:16:44.974Z · home 200 · robots 200 막힘 [] · sitemap 200 https://geo-rose-nine.vercel.app/sitemap.xml 주소 13 · llms 200 ok true · homeLdTypes [Organization,Service,FAQPage] · 키 파일 404 ok false · 오류 []
  ✓ derived.checkedAt 방금
  ✓ derived.robots.status 실제 코드
  ✓ derived.sitemap.pages 실제 수
  ✓ derived.homeLdTypes 배열
  ✓ 본문 앞부분 300자 이하
  ✓ 키 파일 없음(우리 랜딩에 이 키 파일은 없다)
  ✓ 체크리스트 뜸
  ✓ 사이트 열림 = 됨
  ✓ 「고객 담당에게 보낼 것」 = 사람
  ✓ 보낼 글에 키 파일 이름·내용
  ✓ GSC = 사람 · 파일럿 = 사람
  ✓ 바깥 글 = 해당없음
  ✓ 사람 칸 셋까지
  동기화 1차 엶 [setup-send,setup-gsc,setup-measure] · 2차 엶 []
     setup-gsc · 사람 대기 · 화면시험고객: 구글 서치콘솔 권한을 받아 주세요
     setup-measure · 사람 대기 · 화면시험고객: 파일럿을 시작해 주세요
     setup-send · 사람 대기 · 화면시험고객: 고객 담당에게 보낼 것이 있습니다
  ✓ 사람 대기 일감 셋(setup-send·gsc·measure)
  ✓ 두 번 돌려도 중복 없음
  ✓ 제목 사람 말 · 링크 고객 화면
  ✓ 고객사말에 새 이름·도메인
  ✓ 권한 받음 → GSC 됨
  ✓ 됨이면 일감 완료로 닫힘
  파일럿 6457d6ce-34b3-442d-9f16-3eb66e6fa96a · 질문 20 · 과업 13 · 고객 행 4 → 4
  ✓ 파일럿 하나·질문 20·과업 생김
  ✓ createPilot 이 geo.clients 를 안 만듦
  ✓ 파일럿 뒤 AI 측정 = 기다림(질문 승인 전)
  ✓ /admin/pilots 열림 · 고객사 화면 링크
  ✓ 지우기 → 목록(지웠습니다)
  ✓ client_id·pilot_id 표 25칸 전부 0 · slug 0 (id 7)

32 통과 · 0 실패
```

## Open Questions
- 등록·고치기 폼만 ?err= 대신 useActionState(오류+친 값). 브리프의 「?err= 사람 말 한 줄」과 다르다 — 리다이렉트면 열 칸을 다시 쳐야 해서 바꿨다. 다른 동작은 ?err=.
- answerPattern 구현 위치를 client-core.mjs 로 옮겼다(브리프는 answer-pattern.ts 에 두 번째 인자). node 22 가 .ts 를 못 읽어 academy·시험이 같은 함수를 부르려면 이 길뿐. 한 인자 결과는 옛 구현과 11표본 글자 비교.
- 원장이 「끝냈어요」로 닫은 setup 일감은 신호가 남으면 24시간 뒤 다시 열린다. 점검이 닫은 것은 바로. 이 규칙이 맞는지.
- hitWords = 주소 일부(전화 끝자리 제외). 브리프에 칸 정의가 없어 정했다.
- 매시 세팅재점검은 --plan 에서도 돈다(일감 계획과 같은 층). 지금 DB 고객은 코드 3곳뿐이라 대상 0.

## Out of Scope (logged in BUILD-LOG)
- KG-38-2 시험 → 진짜 고객 전환 화면 없음 · KG-38-3 robots 일부 경로 막힘 안 봄 · KG-38-4 본문 크기 상한 없음(8초가 막음) · KG-38-5 E2E 시퀀스 7 · KG-38-6 /admin/pilots 운영 주소 확인은 배포 뒤
