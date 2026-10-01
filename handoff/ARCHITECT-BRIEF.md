# Architect Brief — Step 25 · 26 · 27 · 외부 고객 한 곳을 약속대로 받는 최소선

(이전 Step 23·24 설계서는 git 이력에 있다.)

## 목표 (원장 2026-09-29 「서비스가 가능한 수준까지, 멈추지 말 것」)

외부 고객 한 곳이 문의 → 계약 → 온보딩 → 기준선 → 30일 차 재측정 보고까지 **코드 수정 없이, research/paid-pilot-order-form.md 대로** 받는다.
끝에서 끝 점검(2026-09-29, 읽기 전용) 결과 치명 7 · 중요 10. 아래 괄호 번호는 그 점검의 번호다. 한 Step 씩 짓고 Richard 통과 즉시 배포한다(공개 문구가 바뀌면 원장 승인 — 이번 범위에는 공개 문구 변경이 없어야 한다. 생기면 멈추고 알린다).

**원장 몫으로 모아 둘 것(짓는 쪽은 기본값으로 안전하게 동작하게):** 화면 측정 하루 상한 60 을 올릴지 · Claude 하루 상한 40 을 올릴지 · 파일럿 기간 PC 켜 두기 · 고객 Search Console 권한 · 세금계산서 · 구축·세팅 환불(KG-24-3) · 리드 알림 메일 설정이 없으면 설정.

---

## Step 25 — 여러 고객 측정 (점검 1·2·3·11·17)

- **D1 고객 설정을 DB 로.** `geo.clients` 에 `answer_pattern text`(이름 판별 정규식 원문), `measure_active boolean default false` 를 더한다(`alter table ... add column if not exists`).
  `academy/clients.mjs` 는 DB 값을 먼저 쓰고 없으면 지금 덩어리로 대체(학원은 지금 정규식 — 「똑똑한 로봇&코딩학원」 제외 — 과 같은 값이 되게. 비어 있을 때만 채운다).
  등록 화면(`web/lib/pilot-actions.ts` createPilot)에서 도메인·이름 판별 말(쉼표로 여러 개 → escape 한 정규식으로 조립)을 받는다. 사용자 입력 정규식 원문은 받지 않는다(ReDoS).
- **D2 실행기가 고객을 돈다.** `optimize.yml`(ai-measure)와 `tools/pc-runner.mjs`(ai-web-measure)가 고객을 지정하지 않던 것을 → 스크립트 안에서 대상 목록을 만든다: `measure_active` 이거나 진행 중 파일럿(오늘이 시작~종료+7일) 고객 + 학원.
  `--client` 를 주면 그 고객만(지금처럼). 순서: **유료 파일럿 고객 → 학원 → 탐침.**
- **D3 예산은 늘리지 않고 나눈다.** 화면 측정 하루 합계 상한(env `WEB_MEASURE_DAILY_MAX`, 기본 60 그대로)과 Claude 측정 몫(`CLAUDE_MEASURE_RESERVE`, 기본 22 그대로)을 위 순서로 쓴다.
  모자라서 못 잰 고객은 조용히 빠지지 않는다: `geo.agent_tasks` 사람 대기 「오늘 측정 예산이 모자라 ○○ 를 못 쟀습니다 — 상한을 올릴지 정해 주세요」(dedupe `measure-budget-<client>` sticky, 다 재면 닫음). 유료 고객이 있는 날 탐침은 끈다. 원장이 상한을 올리면 env 하나로 끝나게.
- **D4 (17)** 경보 일감 `coalesce(…,1)` 로 학원에 붙는 것 제거. 측정 설정 없는 고객은 그 고객 id 로.
- 확인: 대상 목록 함수는 가짜 행으로. 실측정 금지. **학원만 있을 때 동작이 지금과 같다**(질문 수·순서·상한)는 걸 보인다.

## Step 26 — 파일럿 생애주기와 보고 (점검 4·5·6·7·8·9·14)

- **D5 (7) 날짜.** `geo.pilots` 에 `kickoff_on date`(착수 = 질문 승인 + 첫 측정일), `baseline_sent_at timestamptz`, `site_launch_on date`, `needs_build text`(none|setup|build). 시작·종료는 착수 기준 KST: 구축 없음 → kickoff 포함 30일(+29); 구축·세팅 → 기준선은 kickoff 부터 7일, 30일은 site_launch_on 부터. `current_date` 대신 `(now() at time zone 'Asia/Seoul')::date`. approveQuestions 가 승인 시각을 남긴다.
- **D6 (4) 기준선 보고.** `pilot-report.mjs --stage baseline --client <slug>`: kickoff 부터 7일, 곳×방법별, 질문마다 「n번 중 k번」, 브랜드 문항 따로, 방법 표기(로그아웃·ko-KR·날짜·엔진, Claude 는 「Claude Code(Max) 경유 — claude.ai 화면과 다를 수 있음」), 손 확인 절(D8). `--dry` 는 표준출력만. 보고서 파일은 고객별 비공개 폴더(web/public 아님).
- **D7 (5) 최종 보고 다시 쓰기.** `--stage final`: 파일럿 기간만, 기준선 7일 vs 마지막 7일을 **같은 곳끼리만** 비교, 브랜드 3문항 제외(research/pilot-measurement-sop.md 「성공 판정」 절 그대로 — 다르면 SOP 를 따르고 차이를 REVIEW-REQUEST 에), 표본 부족이면 「판정 보류」. 첫 행·끝 행 비교 제거.
- **D8 (8) 손 확인 기록.** 표 `geo.pilot_manual_checks(id, pilot_id, question text, surface text check in (google_ai_overview, naver_ai_briefing, google_ai_mode), checked_on date, shown text check in (이름, 링크, 안 나옴, 화면 없음), note text, capture bytea, capture_type text, created_at)`.
  `/admin/pilots/[id]` 에 입력 줄(질문·화면·결과·캡처, 30초). 캡처는 이미지 한 장 2MB 상한, 이미지 형식만, 관리자만 읽음. 보고서가 이 표를 읽는다.
- **D9 (6) 업무 목록.** 기본 업무를 신청서 「제공」 6줄 + SOP 회차로(기준선 보고 업무 포함). 이미 만든 파일럿은 건드리지 않는다.
- **D10 (9) 기한.** company.mjs 가 기한 지난 `pilot_tasks` 를 「사람 대기」 일감으로(dedupe pilot·task).
- **D11 (14) 계약 칸.** `geo.pilots` 에 `biz_type text`, `refund_terms_sent_on date`, `invoice_issued_on date`, `cancelled_on date`, `refund_amount int`. 파일럿 화면에서 입력.

## Step 27 — 운영 위생 (점검 10·13·15·18·19·21)

- **D12 (10) 리드 알림.** health.mjs 가 이미 실패 메일을 보낸다 — 그 경로를 재사용해 `/api/lead` 저장 직후 원장에게 한 통(연락처 일부만, 본문은 관리 화면 링크). 메일 설정이 없으면 건너뛰고 지금처럼 할 일로만. 새 외부 서비스·키를 만들지 않는다.
- **D13 (13)** health.mjs llms.txt 검사는 그 고객에 llms.txt 가 있다고 설정된 경우만(학원은 있음).
- **D14 (15)** submit-gsc.mjs 도메인 하드코딩 → clients 설정. write-draft 인격 고정은 KG.
- **D15 (18·19)** 자동 질문 20개·정합성 출처 문구를 업종 무관하게(학원 문장은 업종이 학원일 때만). 가림 별칭은 지역·업종 조합이 아닌 「고객 A/B…」.
- **D16 (21)** 새 표는 첫 입력이 아니라 company.mjs 시작에서 만든다 — 화면 오류 표시 없애기.

## 공통

- DB 시각 KST. 새 숫자 지어내기 금지. 학원 영업 숫자(케이스 리포트·현황판) 계산식 불변.
- 확인은 dry-run·가짜 행·tsc(`node ./node_modules/typescript/bin/tsc --noEmit`). 실측정·DB 쓰기 실행 금지(스키마 변경은 코드의 if not exists 로만).
- 설계서 밖은 KG.

## Step 26 추가 (Arch, 2026-09-30)

- **D18 경쟁사 점유율(보고서 안).** 지오랭크는 경쟁사 3~5곳 점유율·언급 순위를 보고한다(research/georank-dossier.md §3·4). 우리만 없다.
  새로 묻지 않는다 — 이미 보관한 답 원문(ai_measurements.raw.answer)에서 센다. `geo.pilots` 에 `competitors text`(쉼표로 이름, 등록 화면에서 받음, escape).
  기준선·최종 보고에 질문×곳별로 「우리 n번 중 k번 · 경쟁사 A n번 중 k번 …」와 답 안에서 처음 나온 순서(평균이 아니라 분포: 첫째 x번, 둘째 y번). 곳끼리 합치지 않는다. 가중치·점수(GVI 같은)는 만들지 않는다.
  학원(리허설 파일럿)은 경쟁사 이름을 원장이 넣기 전까지 칸을 비우고 절을 「경쟁사 미설정」으로.

## Step 28 — 재점검(2026-09-30 01시) 잔여 (코드 치명 0 · 원장 몫 제외)

- **D19 (15)** submit-gsc.mjs 가 clients.mjs 에 없으면 measure-targets 처럼 `geo.clients.domain` 으로 대체. 기본값 학원 그대로.
- **D20** 이름 판별 말 띄어쓰기: `answer-pattern` 조립 때 한글 글자 사이 `\s?` 허용(「미소치과」가 「미소 치과」에도 걸리게). ReDoS 없게 글자 수 상한 유지. 학원 정규식(clients.mjs 원문)은 건드리지 않는다.
- **D21** ai-web-measure.mjs: 질문 승인 전(질문 없음)은 exitCode 를 건드리지 않는다 — ai-measure 와 같은 「대기」.
- **D22** 구축·세팅 고객이 site_launch_on 을 안 넣으면: 착수 + 60일에 측정 대상에서 빼고 원장 할 일(dedupe pilot-launch-<id>) 「사이트 연 날을 넣어 주세요」.
- **D23** 등록 폼 검증 실패를 조용히 돌려보내지 않는다 — `?err=` 로 무엇이 빠졌는지 사람 말 한 줄(slug 는 영문·숫자·- 만).
- **D24 (KG-25-3)** repair.yml·sales.yml 등 claude-code.mjs 를 부르는 워크플로 전부 `CLAUDE_MEASURE_RESERVE`·`CLAUDE_DAILY_MAX` 를 vars 에서 넘기게(optimize.yml 과 같은 줄). 값은 안 바꾼다.

### Step 28 추가 — 원장 결정 (2026-09-30, Arch 승인 · Bob 기록)

- 설계 밖 두 가지 승인: 경쟁사 정규식도 D20 같은 규칙 · slug 는 몰래 고치지 않고 거절
- **D25 측정 상한.** 유료 파일럿 고객이 측정 대상에 있는 날만 두 배 — Claude 하루 40→60 · 측정 몫 22→42, 화면 60→120질의. 없는 날은 지금 값. measure-targets 가 「유료 있음」을 알려 주고 claude-code.mjs·ai-measure·ai-web-measure 가 그걸로 상한을 고른다. env 가 있으면 env 우선. repair·sales 등 다른 워크플로도 같은 규칙(유료 있음은 DB 로 판단)으로 합계가 맞게.
- **D26 구축·세팅 환불.** 착수 전 전액 · 시안(세팅은 작업 보고) 보여 준 뒤 50% · 사이트 공개(세팅 완료) 뒤 환불 없음. research/paid-pilot-order-form.md 의 「계약서에 따로」를 이 글자로. 신청서와 web 문구 대조 규칙 유지. 랜딩 공개 문구는 안 바꾼다.
- **D27 리드 메일.** Resend HTTP API. /api/lead 저장 뒤 `RESEND_API_KEY`·`LEAD_ALERT_TO` 가 있으면 한 통(제목 「새 상담 신청」, 본문: 이름 첫 글자+**, 연락처 끝 4자리만, 관리 화면 링크). 없으면 조용히 건너뜀. 실패해도 저장은 성공. 키는 원장이 만든다 — 코드만.
- **D28 PC.** 코드 없음. SOP 에 「파일럿 기간 PC 매일 10시 전후 켜 둠」 한 줄.

## Step 29 — 고객사 사이트 사람 방문 추이 (원장 2026-09-30)

원장: 「고객사 랜딩에 방문수 추이를 모니터링할 수 있게. 지금은 로봇앤코딩과 아이로그」.
지금 두 사이트 proxy.ts 는 **봇만** 보낸다(학원: academy/proxy.ts → 자기 /api/crawl → DB, 아이로그: C:\dev\자동피드백생성기\proxy.ts → 사이티드 web /api/crawl, x-cited-client·x-cited-key). 사람 방문은 아무도 안 센다.

- **D29 표** `geo.site_visits(id bigserial, client_id int, at timestamptz default now(), day date(KST), path text, ref_host text, ref_kind text check in (ai, search, sns, direct, other), visitor text, device text)` + RLS, 인덱스(client_id, day). 양쪽 schema.sql.
  - **IP 를 저장하지 않는다.** visitor = sha256(ip + ua + KST 날짜 + 비밀 소금) 앞 16자 — 같은 날 같은 사람만 묶이고 다음 날은 못 잇는다(쿠키 없음 → 동의 배너 불필요). 소금은 env `VISIT_SALT`(없으면 기록 안 함).
  - ref_kind: ai = chatgpt.com·chat.openai.com·perplexity.ai·gemini.google.com·claude.ai·copilot.microsoft.com 등 / search = google·naver·daum·bing·yahoo·duckduckgo / sns = instagram·facebook·kakao·youtube·x·t.co·blog.naver 는 search 가 아니라 sns? → **blog.naver.com·cafe.naver.com 은 sns**, search.naver.com 은 search / 같은 도메인 이동은 기록하되 ref_kind 는 direct 가 아니라 `internal` 로(체크에 추가) / 없으면 direct. utm_source 가 있으면 그것을 우선(chatgpt.com 은 링크에 utm_source=chatgpt.com 을 붙인다).
- **D30 무엇을 셀지** — 사람의 **문서 요청만**: GET, `sec-fetch-dest: document`(없으면 Accept 에 text/html), `next-router-prefetch`·`purpose: prefetch`·RSC 요청 제외, /_next·/api·/admin·정적 파일 제외, identify() 가 봇이거나 UA 에 bot|crawl|spider|headless|preview|monitor 면 제외. 응답을 붙잡지 않는다(waitUntil — 기존 봇 기록과 같은 방식).
- **D31 받는 곳** — 사이티드 web `/api/visit`(x-cited-client·x-cited-key, /api/crawl 과 같은 인증·clientForKey). 학원도 같은 곳으로 보낸다(학원 client 에 crawl_key 가 없으면 학원은 자기 /api/visit 를 두어 DB 로 — 둘 중 코드를 보고 단순한 쪽, REVIEW-REQUEST 에 이유). 본문 크기 상한, path·ref 길이 상한, 초당 폭주 대비(같은 visitor·path 1분 안 중복은 무시).
- **D32 화면** — `/admin/ops` 고객 탭(로봇&코딩학원·아이로그)에 「사람 방문」 카드:
  - 최근 30일 날짜별 방문자(visitor 중복 제거)·페이지뷰 선 그래프(기존 현황판 차트 모양·색을 따르고 새 라이브러리 금지), 지난 7일 vs 그 전 7일.
  - 유입 경로 막대: AI · 검색 · SNS · 바로 · 기타 (내부 이동은 빼고), **AI 유입은 곳별(ChatGPT·Perplexity·Gemini·Claude…) 숫자**를 따로 — 매출 고리의 새 근거다.
  - 많이 본 페이지 5개.
  - 기록 시작일을 적는다(「9/30 부터 셈 — 그 전은 없음」). 0 이면 0 이라고. 지어낸 추정치 금지.
- **D33 배포** — 학원은 `academy/` 에서 `npx vercel --prod --yes`(git push 로 배포 안 됨 — CLAUDE.md). 아이로그는 C:\dev\자동피드백생성기 에서 같은 명령(메모리 ilog-source-repo). 두 곳에 env `VISIT_SALT` 가 필요하면 Arch 가 넣는다 — 코드에서는 없으면 조용히 건너뜀. 사이티드 web 은 git push.
- 확인: 가짜 요청으로 분류 함수(ref_kind·사람/봇·문서 요청) 단위 시험, tsc(세 저장소 각각), 학원·아이로그 기존 봇 기록 경로가 그대로인지. 실제 운영 DB 쓰기·배포 금지.

## Step 30 — 아이로그를 학원과 같은 수준으로 돌린다 (원장 2026-09-30 「에이전트들이 아이로그 업무는 왜 잘 안 하지?」)

진단(Arch, DB·코드):
- **질문 패널 0개 → AI 측정 0건(학원 381건).** 아이로그는 9/10 등록인데 geo.pilots·pilot_questions 가 없다. Step 25 측정기는 승인 질문이 있는 고객만 잰다.
- **개선 루프가 학원 전용.** `daily-agent.mjs:33 SLUG = "robotncoding"` → geo.agent_runs 에 아이로그 0행(학원 14행).
- **콘텐츠가 막힌 채 쌓임.** 아이로그 「겨냥 초안」 일감 7건이 9/27 부터 「관찰」. write-draft 는 학원 원장 인격·academy.posts 전용(KG-27-3)이고, 아이로그 글은 DB 가 아니라 코드(C:\dev\자동피드백생성기\lib/guides.ts → npx vercel --prod)다. 자동 경로가 없다.
- **보고가 학원 전용.** pm-report(아침 보고)·case-report 가 client_id=1 고정. 현황판에 아이로그 성과가 안 모인다.
(9/24 원장 결정 「학원 레퍼런스가 먼저」로 영업을 멈춘 것과는 별개 — 아이로그는 자사 제품이라 측정·개선은 돌아야 한다.)

- **D34 질문 패널.** 아이로그용 0원 리허설 파일럿(학원과 같은 모양, status 리허설, measure 대상) + 질문 20개 **초안**(approved=false). 재료는 지어내지 않고 이미 있는 것만: 「겨냥 초안」 일감 7건의 질문 원문, Step 22 검색어형 틀(「{지역없음} 학원 관리 프로그램 추천」「학원 출결 앱」「학원 문자 알림 프로그램」 류 — 아이로그가 실제로 하는 기능은 C:\dev\자동피드백생성기 lib/marketing-facts·guides 에서 확인한 것만), 이름 질문 3개. stage 는 problem/consider/brand + 검색어형은 keyword. 승인은 원장이 /admin/pilots 에서. 초안을 넣는 SQL 은 스크립트(`academy/scripts/seed-ilog-panel.mjs`, --dry 기본)로 만들고 **Arch 가 실행한다.**
  answer_pattern: 「아이로그|ilog(\.ai\.kr)?|i-log」 류(escape, 흔한 영단어 오탐 주의 — ilog 단독이 영어 문장에 섞이는지 판단).
- **D35 개선 루프 고객별.** daily-agent 가 승인 질문이 있는 고객을 돈다(학원 동작·기록은 그대로 — 학원만 있을 때 출력 동일 확인). 고객마다 LADDER 는 같되, content 칸에서 그 고객에 글쓰기 경로가 없으면(학원 외) write-draft 를 부르지 않고 사람 대기 일감 「세션에서 아이로그 가이드 초안: 「질문」」(dedupe) — 이미 있는 question-draft 일감과 중복되지 않게 그 일감을 다시 열어 쓴다. entity 칸의 홈 JSON-LD 검사 정규식(석촌|송파)도 고객 설정으로.
- **D36 보고.** pm-report 아침 보고에 고객별 한 줄(아이로그: 측정 곳별 「n번 중 k번」, 방문, 열린 일감 수). 학원 줄과 숫자 불변. case-report 는 학원 그대로(아이로그 케이스는 KG).
- **D37 막힌 7건.** 「관찰」로 멈춘 question-draft 7건을 현황판 원장/세션 할 일에 보이게(상태 정리만 — 글은 세션이 쓴다).
- 확인: daily-agent --dry 두 고객, pm-report dry, seed 스크립트 --dry 출력(질문 20개 원문을 REVIEW-REQUEST 에 붙인다 — Arch·원장 검토용). DB 쓰기·배포 금지.

## Step 31 — 성과가 개수로 늘어나는 고리 (원장 2026-09-30 「성과가 있으면 갯수가 늘어나야 하는데 장치가 있는지 확인해」)

점검(읽기): 루프는 안 불리는 질문(<50%)만 다룬다. 「효과 있음」은 daily-agent.mjs:252·261 에서 기록만 되고 읽는 코드가 없다. 50% 이상 질문은 버려 둔다(:396). 불린 탐침은 다음 반경 탐침만 만들고 승인 질문·글로 안 이어진다(loop-review.mjs:239-244). 후퇴 감지 없음. 경쟁사 점유율은 파일럿 보고서에만. 아이로그는 탐침 꺼짐(clients.mjs:103).

- **D38 효과 전파(자동).** 「효과 있음」 행동의 action_kind 를 같은 묶음(같은 고객·같은 stage)에서 그 처방을 아직 안 해 본 후보의 첫 칸으로 올린다. 하루 1건·열린 초안 1편 규칙 그대로. evidence 에 원판정 id. 전파 행동도 원래 규칙으로 따로 판정 — 미리 성과로 세지 않는다.
- **D39 지킴·후퇴(자동, loop-review `regress`).** 같은 곳·같은 엔진에서 이전 14일 ≥50% 이고 최근 7일 ≤25%, 양쪽 5건 이상 → finding + 그 질문을 후보 맨 앞(50% 미만 필터와 무관), 처방은 불리던 글 재색인부터. 엔진 바뀐 구간은 비교 안 함, 표본 모자라면 「모른다」.
- **D40 불린 탐침 → 승인 질문 후보(제안, 원장 승인).** 7일 안 4번 이상 재서 50% 이상 → agent_tasks 사람 대기 「승인 질문 후보: 「문장」 (탐침 k/n)」 (dedupe probe-promote-<id>, 30일 쿨다운). 승인 방식: 원장이 「했어요」 → 20문항 세트 교체는 자동으로 하지 않는다(기준선이 바뀐다) — 대신 **승인 질문 세트 밖 「확장 질문」**(pilot_questions 에 stage 'extend', 영업 숫자·판정에서 제외, 측정은 한다)로 들어간다. 이렇게 「불리는 질문 개수」가 20 밖에서 늘어나는 것이 보이게 현황판·아침 보고에 「확장 질문 n개 중 k개 불림」 한 줄.
- **D41 안 불린 반경 겨냥(세션).** 넓힘 사슬에서 처음 0 이 된 칸이 7일 4건 이상 모두 0 → 그 문장으로 「세션 대기」 글 일감(session-task.mjs, 열린 세션 글 1편 규칙). 재료 없으면 「재료 필요」(메모리 draft-needs-real-material).
- **D42 경쟁사 우세 우선(자동 정렬).** 후보 정렬 둘째 키 = 최근 7일 답 원문에서 (경쟁사 이름 횟수 − 우리 이름 횟수), pilot-report-core `점유` 재사용. 경쟁사 미설정이면 0. 점수·가중치 만들지 않음.
- **D43 아이로그 탐침.** 반경 넓힘 대신 검색어형 변형(clients.mjs 에 아이로그용 틀: 「{기능} 앱」「{기능} 프로그램」「{기능} 무료」 — 기능은 승인 질문에 나온 말만)으로 탐침 켠다. 하루 탐침 몫 안에서.
- 공통: 학원 동작(Step 30 이전과 같은 날 입력이면 같은 선택)이 D38~D42 조건이 안 걸리는 날 그대로인지 dry 비교. 영업 숫자 불변. 새 finding·일감 문구 사람 말.

## Step 32 — 문서딱(docttak.com) 두 번째 자사 레퍼런스 (원장 2026-10-01)

브리프: research/docttak-brief-2026-10-01.md (문서딱 저장소 docs/GEO-BRIEF-FOR-CITED.md 사본). 사이트 코드는 문서딱 저장소 절차 — 우리는 건드리지 않는다.
원장 결정: ① 시작(등록·질문 초안·승인 뒤 기준선) ② 예산은 고객 수만큼 늘린다 ③ Cloudflare 서버 통계 연결(토큰은 원장이 준다 — D46 은 토큰 받은 뒤).

- **D44 등록.** seed-ilog-panel.mjs 를 고객 설정을 받는 일반형으로(`seed-panel.mjs --client <slug>`, 아이로그 결과 불변 확인) 또는 같은 모양의 seed-docttak-panel.mjs. geo.clients: slug docttak, name 문서딱, domain docttak.com, relation 자사, answer_pattern 「문서딱|docttak(\.com)?」(escape), measure_active. 0원 리허설 파일럿, competitors 「iLovePDF, Smallpdf, 알PDF, allinpdf, 한컴독스」.
  질문 20개(approved=false, 원장 승인): 브리프 「측정 요청」의 자동완성 검색어에서만 — keyword 17 + brand 3(「문서딱 어떤 사이트야?」「docttak.com 이 사이트 뭐 하는 곳이야?」「문서딱 파일 안 올리고 처리돼?」 꼴). 지어낸 검색어 금지. 브리프 22개 중 17개 고르는 기준(도구 5개 고르게)을 REVIEW-REQUEST 에.
  clients.mjs 덩어리: 이름 질문 적중 말, 홈 JSON-LD 검사(WebApplication), 탐침 변형 틀(「{도구} 무료」「{도구} 사이트」 — 도구 말은 승인 질문에 나온 것만), 글쓰기 경로 없음 → 세션 대기(문서딱 저장소에 넘길 안내 페이지 제안).
  방문·크롤러: 문서딱은 정적 사이트·추적 금지 → proxy 방식 안 씀. 현황판 카드는 「Cloudflare 통계 연결 전」.
- **D45 예산 = 고객 수.** 측정상한: k = 학원 밖 측정 대상 고객 수(유료+자사). claude = 40+20k, reserve = 22+20k, web = 60+60k (k=1 이면 지금 60·42·120 과 같다, k=0 이면 40·22·60). env 우선·reserve ≤ claude 유지. optimize.yml timeout 이 Claude 측정 62회를 견디는지 계산하고 모자라면 늘린다(근거 REVIEW-REQUEST).
- **D46 (토큰 뒤) Cloudflare 통계.** 원장이 줄 읽기 전용 토큰(Zone Analytics Read)으로 GraphQL Analytics API 를 매일 읽어 `geo.site_traffic_daily(client_id, day, requests, page_views, uniques, top_paths jsonb, source text)` 에 적는다. 요금제에서 실제로 보이는 칸만 — 안 보이는 칸(봇 구분·리퍼러)은 null 로 두고 화면에 「Cloudflare 무료 요금제라 안 보임」. 지어낸 추정 금지. 토큰은 GitHub secret 으로만.
