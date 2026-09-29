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
