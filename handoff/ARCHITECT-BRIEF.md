# Architect Brief — Step 54

원장 원문(2026-10-17): 「신규 고객사가 계약이 되었을때 업무를 랜딩하는 페이지가 필요해 여러 실제 상황을 반영해서 만들어봐」.
결정 D204~D216 · KG-54-1~6 (BUILD-LOG). Step 53 브리프: handoff/research/ARCHITECT-BRIEF-step53.md

## Goal
계약한 고객 한 곳을 열면 「계약 → 받을 것 → 사이트 → 질문 승인·착수 → 첫 7일 기준선 → 30일 → 30일 판정」이 그 고객 상황대로 한 줄 순서로 나오고, 줄마다 누가(자동 · Claude 세션 · 원장님 · 고객) · 지금 상태(DB 근거) · 어디서 하는지가 보인다.

## 이미 있는 것 (새로 만들지 않는다 — 읽어서 묶는다, D204)
| 무엇 | 어디 | 이 화면에서 |
|---|---|---|
| 세팅 체크리스트(site·robots·sitemap·llms·jsonld·keyfile·send·gsc·measure·offsite) | `web/lib/client-core.mjs` 체크리스트() + 매시 세팅재점검 | 「사이트」 단계 줄로 그대로 |
| 파일럿 계약 칸(paid_on·refund_terms_sent_on·invoice_issued_on·needs_build·kickoff_on·site_launch_on·baseline_sent_at·ends_on·cancelled_on·refund_amount) | `geo.pilots` · `web/lib/pilot-plan.ts` | 계약·기간·환불 위치 |
| 파일럿 업무 14개(intake…renewal, owner·due_on·status) | `geo.pilot_tasks` · pilotTasks() | 단계별 줄의 본체 |
| 질문·업무·로컬 점검·콘텐츠·측정 묶음·손 확인 | `web/lib/pilots.ts` getPilot(id) | 그대로 부른다 |
| 늦은 착수 7일 원장 일감 · 기한 지난 업무 원장 일감 · 날짜 맞추기 | `academy/scripts/company.mjs` 파일럿업무 | 건드리지 않는다. 화면은 같은 날짜를 보여 줄 뿐 |
| 고객 블로그 로그인 신호 | `geo.agent_tasks` 그 client_id 의 dedupe `naver-session-soon` · `login-naver-blog-<slug>` | 블로그 줄의 살아 있는 상태 |
| 크롤러 방문 | `academy.crawl_hits`(client_id) · `geo.clients.crawl_key` | 구축 고객만 |
| 환불 위치 문장 | pilot-plan.ts refundGuide() | 맨 위 띠 |
| 날짜 KST | client-status-core.mjs 오늘KST·며칠전·월일 | 재사용 |

## 상황 갈래 (D205)
| 갈래 | 입력(어디서 오나) | 바뀌는 것 |
|---|---|---|
| 준비: 진단 통과 / 기술 세팅 / 사이트 구축 | `pilots.needs_build` none·setup·build (파일럿 시작 폼에서 이미 고름) | 단계 순서(아래 흐름) · 사이트 줄 |
| 기존 채널만(블로그·플레이스·SNS) | `config.onboard.channels` {blog, place, sns} · `noChannels` | 로컬 점검(제공 3) 대상 · 받을 것 줄 |
| 블로그 글 이관 계약(+80) | `config.onboard.migrate` · `migrateState` 아직·진행·끝 | 이관 줄(Claude 세션) 생김 |
| 도메인·호스팅을 누가 만지나 | `config.onboard.dns` 고객·우리·모름 | send 줄: 고객 → 복사해 보낼 글 · 우리 → Claude 세션이 직접 고침 · 모름 → 고객에게 물을 글(원장님 몫) |
| 구글 서치콘솔 | 기존 `config.gsc`·`wantGsc`·`derived.gscAccess` | 기존 gsc 줄 그대로 + 권한 받음 버튼 |
| 네이버 서치어드바이저 | `config.onboard.naverSa` 아직·확인파일보냄·끝·안씀 | 원장님 몫(캡차 — 우회 안 함) → 확인 파일은 dns 갈래대로 고객 또는 우리 |
| 빙 웹마스터 | `config.onboard.bing` 아직·끝·안씀 | GSC 가 됨이어야 「가져오기」 — 아니면 「아직」 |
| 네이버 블로그 계정 | `config.onboard.blog` 없음·안맡김·받음 · `blogSavedOn` | 받음 → 원장 PC `node tools/save-login.mjs naver-<slug>` 1회. 저장 여부는 웹이 모른다 → 원장 표시 날짜만 됨 근거. 로그인 일감이 열려 있으면 그게 우선 |
| 고객이 느림 | 고객 몫 줄의 due_on(없으면 paid_on, 파일럿 없으면 started_on) | N일째 · 3일 이상이면 재촉 글 · 진단 통과는 「승인이 늦어도 30일은 M/D 에 끝납니다(신청서 8행)」 |
| 취소 | `pilots.cancelled_on`·`refund_amount` | 맨 위 띠 · 모든 줄 해당없음 |
| 자사·리허설·코드 고객 | `clients.relation` · `pilots.status` 리허설 · CODE_SLUGS | 계약 줄 해당없음 · 「리허설」 표시 · 코드 고객 3곳은 안내 한 줄 |
| 기준선 전에 사이트 개시 | site_launch_on < kickoff_on + 7 | 띠 경고 「전후 비교가 깨집니다」 |

## 흐름 (needs_build 로 순서가 갈린다 — 신청서 「순서」)
```
진단 통과(none) · 파일럿 없음:
 계약 - 받을것 - 사이트점검(고칠 것 보냄) - 질문승인 - 착수(첫 측정) - 7일 기준선 - 30일(입금일부터) - 판정
                                                                       + 콘텐츠 초안·승인·게시

기술 세팅(setup) / 사이트 구축(build):
 계약 - 받을것 - 질문승인 - 착수 - 7일 기준선(손대기 전) - 세팅·구축 - 연 날 입력 - 30일(연 날부터) - 판정
                                          build: 시안 -> 공개      + 연 뒤 세팅점검 줄이 살아난다
                                                                   + build 만: 크롤러 방문 줄(자동)

줄 상태: 됨 | 도는 중 | 원장님 몫 | 고객 기다림 | 아직(앞 단계 먼저) | 해당없음 | 못 읽음
누가:    자동 | Claude 세션 | 원장님 | 고객
```

## Build Order

### 54a 순수 함수 `web/lib/onboard-core.mjs` (+ `onboard-core.d.mts`, client-core.d.mts 모양)
- `export function 착수순서(입력, 오늘)` → `{ 띠: string[], 요약: {원장, 고객, 고객최장일, 자동}, 다음고비: string|null, 단계: [{ id, 이름, 줄: [{ id, 칸, 누가, 상태, 사람말, 근거?, 링크?, 보낼글? }] }] }`. DB 를 안 만진다.
  - 입력 = `{ row(slug,name,domain,relation,status,started_on,config,crawl_key), derived, 세팅줄(체크리스트() 결과), pilot(getPilot().pilot | null), tasks, questions, content, ai, checks, audits, 로그인일감: [{dedupe_key,title,status}] | "못읽음", 크롤: {n7, last} | null | "못읽음" }`.
- 단계·줄 id 고정(시험·화면 data- 속성이 쓴다):
  - `contract`: refund · paid · invoice · pilot
  - `receive`: intake · channels · dns · gsc · naversa · bing · blog · migrate(migrate 켬일 때만)
  - `site`: 세팅줄 site·robots·sitemap·llms·jsonld·keyfile·send · setup: report·launch · build: draft·launch·crawl
  - `kickoff`: questions · first-measure · inquiry-sheet
  - `baseline`: local-audit · manual-baseline · baseline-report
  - `run30`: period · content-draft · content-approve · content-publish
  - `day30`: manual-day30 · final-report · renewal
- 단계 순서: none·파일럿 없음 → contract·receive·site·kickoff·baseline·run30·day30. setup/build → contract·receive·kickoff·baseline·site·run30·day30. 파일럿 없음이면 contract.pilot 사람말 「계약이 되면 파일럿 시작 칸을 넣습니다 — 필요한 준비도 거기서 고릅니다」, 링크 `/admin/clients/<slug>#pilot`.
- pilot_tasks 코드 → 누가(D207): intake 고객 · questions 고객 · inquiry-sheet 원장님 · measure-start 자동 · local-audit Claude 세션 · manual-baseline 원장님 · baseline-report Claude 세션(만들기), 됨 근거는 baseline_sent_at · site-launch 원장님 · content-draft Claude 세션 · content-approve 고객 · content-publish Claude 세션 · manual-day30 원장님 · final-report Claude 세션 · renewal 원장님. status 완료 → 됨. 앞 단계 핵심(착수 등)이 안 끝났으면 「아직」.
- 계약 줄 근거: refund ← refund_terms_sent_on · paid ← paid_on · invoice ← invoice_issued_on(없으면 원장님 몫 「세금계산서 발행일 미입력」, 링크 파일럿 화면 계약 칸) · pilot ← 파일럿 존재.
- send 줄 dns 분기(D208): 고객 → 기존 할일 글 그대로 보낼글 · 우리 → 누가 Claude 세션, 「우리가 직접 고칩니다」 · 모름 → 원장님 몫, 보낼글 「홈페이지 도메인과 호스팅 관리 화면에 누가 들어갈 수 있는지 알려 주세요. 저희가 직접 고칠지, 담당자께 고칠 목록을 드릴지 정하려고 합니다.」(첫 줄 인사에 row.name).
- build 이고 site_launch_on 없음 → site 단계 세팅줄 전부 해당없음 「사이트를 연 뒤 점검합니다」. setup 은 사이트가 있으니 세팅줄 그대로.
- 숫자 규칙(D211): 근거 숫자는 입력에 있는 것만 — 질문 승인 n/20 · 「마지막 측정 M/D · 최근 7일 n건」(ai 묶음) · 손 확인 n건 · 로컬 점검 n칸 · 크롤 n7. 입력이 "못읽음"·null 이면 상태 「못 읽음」 또는 「기록 없음」, 0 을 지어내지 않는다. 비율·성공 판정은 계산하지 않는다.
- 고객 기다림 일수: 기준일(위 표)에서 오늘까지(KST), 기한 전이면 「기한 M/D」. 3일 이상이면 보낼글 = 재촉 글(무엇을 · 왜 지금 필요한지 · 회신 방법, 세 문장. 불안 팔지 않음).
- period 줄: none → paid_on~ends_on, 남은 날 = ends_on − 오늘 · setup/build 연 날 없음 → 「사이트 연 날 미입력 — 30일 아직 안 셈」.
- renewal 사람말: SOP 「성공 판정」 요약 고정 글 + 「이 화면은 판정하지 않습니다. 최종 보고서 숫자로 정합니다」.
- 띠: 취소 → 「M/D 취소 · 돌려드린 금액 n원」(refund_amount 없으면 「금액 미입력」) / 아니면 refundGuide 세 문장 중 하나 / 기준선 전 개시 경고. refundGuide 는 ts 라 import 하지 말고 같은 세 문장을 이 파일에 두고, 시험이 pilot-plan.ts 글자와 같음을 본다(D212). 리허설이면 「리허설 — 계약 줄은 없습니다」.
- `export function onboard입력검사(f)` → `{ ok, 칸, 오류 }` (54c 가 쓴다).
- Flag: 고객 이름은 보낼글 안에만. 이 화면은 활동·일감·로그에 아무것도 안 쓴다(읽기 + 상황 저장만).

### 54b 읽기 `web/lib/onboard.ts`
- `getOnboard(slug)` → 착수순서 입력 | null.
  - 고객 행 `select to_jsonb(c) as r from geo.clients c where slug=$1`.
  - 파일럿 id: `select id from geo.pilots where client_id=$1 order by (cancelled_on is null) desc, (status <> '리허설') desc, created_at desc limit 1` → getPilot(id) 재사용(취소만 있으면 그 파일럿으로 띠).
  - 세팅줄 = 체크리스트(row, derived, { pilot: await 파일럿상태(q, row.id) }) 그대로.
  - 로그인일감: `select dedupe_key, title, status from geo.agent_tasks where client_id=$1 and dedupe_key in ('naver-session-soon', 'login-naver-blog-' || $2) and status not in ('완료','닫힘')` · `.catch(() => "못읽음")`.
  - 크롤(needs_build build 일 때만): crawl_hits 의 7일 count·마지막 시각 — 칸 이름은 web/lib/crawl.ts insert 문을 보고 맞출 것 · `.catch(() => "못읽음")`.

### 54c 저장 `web/lib/onboard-actions.ts` ("use server")
- `saveOnboard(form)` — client-actions.ts 와 같은 관리자 확인 · 코드 고객 거부 · onboard입력검사:
  - dns ∈ 고객·우리·모름 · naverSa ∈ 아직·확인파일보냄·끝·안씀 · bing ∈ 아직·끝·안씀 · blog ∈ 없음·안맡김·받음 · migrateState ∈ 아직·진행·끝 · migrate·noChannels 켬/끔 · channels.blog/place/sns = http(s) 주소 200자까지 또는 빈 칸 · blogSavedOn·draftShownOn·setupReportOn = YYYY-MM-DD(pilot-plan ymd 와 같은 규칙) 또는 빈 칸. 모르는 값 하나라도 → 저장 안 함, `?err=onboard`.
- 쓰기는 한 문장(D209): `update geo.clients set config = jsonb_set(config, '{onboard}', coalesce(config->'onboard', '{}'::jsonb) || $2::jsonb) where slug = $1` — 다른 config 키 안 건드림.
- 끝나면 revalidatePath · redirect `?saved=1`.

### 54d 화면 `web/app/admin/clients/[slug]/onboard/page.tsx`
- [slug]/page.tsx 와 같은 머리(key → enter redirect · isAdmin · slug 모양 · notFound · force-dynamic · runtime nodejs). AdminNav here="/admin/clients".
- 위에서 아래: 제목 「{name} · 계약 뒤 순서」 · 띠 · 요약 한 줄 「원장님 몫 n · 고객 기다림 n(가장 오래 n일) · 자동 n」 · 다음 고비 「기준선 보고 M/D」 꼴 · 단계마다 `<section data-stage={id}>` 안에 `<li data-row={id} data-state={상태} data-who={누가}>`.
- 원장님 몫·고객 기다림 줄에 보낼글 있으면 textarea readOnly + CopyButton(ops/CopyButton 재사용). gsc 줄에는 기존 markGscGranted 폼 그대로. 링크는 http(s)·/admin 경로만 렌더.
- 맨 아래 `<details id="situation">` 「상황 바꾸기」 — 54c 폼 하나. 기존 폼(고치기·파일럿 시작·파일럿 계약 칸)은 복제하지 않고 링크만.
- 코드 고객 3곳: 「코드로 설정한 고객입니다. 계약 순서가 없습니다」 한 줄, 폼 없음.
- CSS: clients.css 에 `.ob-*` 몇 줄. 한글 `word-break: keep-all`, 주소·보낼글 `overflow-wrap: anywhere`. 줄 = 칸 · 누가 칩 · 상태 칩 · 사람말 — 390 에선 두 줄로 접힘. 가로 넘침 없음.
- 문구는 손으로 쓴 사람 말(메모 dashboard-plain-words). 로그 조각·영문 상태값·% 금지.

### 54e 진입
- `web/app/admin/clients/[slug]/page.tsx`: sub 줄에 「계약 뒤 순서」 링크(here + "/onboard") 하나. 다른 변경 없음.
- `web/app/admin/clients/page.tsx`: 고객 줄마다 같은 링크(코드 고객 빼고).
- `web/app/admin/clients/ClientForm.tsx`: 등록 모드 도메인 칸 설명에 「홈페이지가 없으면 열 도메인(구축 계약 때 정함)」 한 줄(D206). 입력검사는 안 바꾼다.

### 54f 시험
- `academy/scripts/test-onboard-core.mjs` (test-client-status.mjs 모양, 입력 꾸러미로):
  1 none·파일럿 없음 → none 순서 · contract.pilot 원장님 몫
  2 build·연 날 없음 → setup/build 순서 · site 세팅줄 전부 해당없음 · launch 원장님 몫
  3 build·연 날 있음·크롤 {n7:12} → 세팅줄 살아남 · crawl 근거 「12」 / 크롤 "못읽음" → 상태 못 읽음, 근거에 숫자 없음
  4 setup·연 날 < 착수+7 → 띠 경고
  5 dns 고객/우리/모름 → send 줄 누가·보낼글 셋 다름
  6 intake due 오늘−4 → 「4일째」 + 재촉 보낼글 · due 오늘+1 → 「기한 M/D」, 보낼글 없음
  7 none·승인 안 옴 → 「30일은 M/D 에 끝납니다」
  8 취소 → 띠 취소 · 모든 줄 해당없음 · refund_amount 없음 → 「금액 미입력」
  9 자사·리허설 → 계약 줄 해당없음 · 리허설 띠
  10 blog 받음·blogSavedOn 없음 → 원장님 몫(save-login 명령 글) · naver-session-soon 열림 → 원장님 몫 + 일감 제목 · 로그인일감 "못읽음" → 못 읽음
  11 bing 아직·gsc 안 됨 → 아직 / gsc 됨 → 원장님 몫
  12 ai·checks 비었음 → 「아직 측정 없음」 · 전체 출력 JSON 에 /\d+\s*%/ 없음
  13 KST 경계(UTC 15:30 = 다음 날 00:30) 일수
  14 띠 환불 세 문장 = pilot-plan.ts refundGuide 문장(파일 글자 읽어 비교)
  15 onboard입력검사: 모르는 dns · javascript: 주소 · 201자 · 2026-13-01 거부 / 정상 통과
- 회귀(그대로 통과): test-client-core.mjs · test-client-status.mjs · test-clients.mjs. test-client-core.mjs 에 단언 추가: 옛 config 에 onboard 가 있을 때 고치기 config 계산(남김 spread)과 바깥글config 결과에 onboard 가 그대로 남음.
- `academy/scripts/test-onboard-screen.mjs --live` (test-client-screen.mjs 모양: 로컬 next dev + 운영 DB + 새 chromium + /admin/enter?key=):
  - status 'test' 외부 고객 등록(도메인 geo-rose-nine.vercel.app — 남의 사이트 두드리지 않음) → 파일럿 시작 needs_build build → /onboard → 상황 폼 dns 우리 · blog 받음 저장 → data-state 단언(site 단계 세팅줄 해당없음 · blog 원장님 몫 · launch 원장님 몫)
  - 1440×900 · 390×844 스크린샷 → 스크래치 폴더(저장소에 남기지 않음). 각 폭에서 scrollWidth <= innerWidth 단언
  - cited(자사·리허설) /onboard 두 폭 스크린샷(실데이터)
  - 끝에 시험 고객 지우기(client-core 지우기) → 남은 행 0

## Failure modes
| 길 | 실제로 날 일 | 처리 | 보이나 |
|---|---|---|---|
| getPilot 안 표 없음(pilot_manual_checks 등) | 스키마 적용 전 | 이미 catch → 빈 목록 · 근거 「기록 없음」 | 보임 |
| crawl_hits·로그인 일감 읽기 실패 | 네트워크·권한 | "못읽음" → 「못 읽음」, 0 안 씀 (시험 3·10) | 보임 |
| config 동시 저장 | 고치기·바깥글고치기가 config 전체를 읽고-쓴다 | saveOnboard 는 jsonb_set 한 문장. 반대 방향 경합은 1인 관리자라 KG-54-3 | 드묾 → KG |
| 기준선 전에 사이트 개시 | 연 날을 일찍 넣음 | 띠 경고 (시험 4) | 보임 |
| 고객 무응답 | 질문 승인 안 옴 | 일수·재촉 글 + 기존 7일 원장 일감(company.mjs) (시험 6·7) | 보임 |
| 웹이 모르는 것(PC 에 비번 저장?) | 화면이 거짓 「됨」 | 원장 표시 날짜만 근거 · 로그인 일감이 우선 (시험 10) | 보임 |
| 잘못된 입력·javascript: 주소 | 폼 조작 | 검사 거부 (시험 15) · 렌더도 http(s)만 | 오류 한 줄 |
| 390 가로 넘침 | 긴 주소·보낼글 | overflow-wrap · 화면 시험 단언 | 화면 시험 |
| 코드 고객 | config 없음 | 안내 한 줄 · saveOnboard 거부 | 보임 |
| 파일럿 둘 이상 | 취소 뒤 새로 | 취소 아닌 것·리허설 아닌 것·최근 순 하나 | 보임 |

## Test map
| 새 가지 | 상태 |
|---|---|
| 단계 순서 none / setup·build / 파일럿 없음 | [GAP] → 1·2 |
| build 연 날 전후 세팅줄·crawl | [GAP] → 2·3 |
| 기준선 전 개시 경고 | [GAP] → 4 |
| dns 세 갈래 | [GAP] → 5 |
| 고객 기다림·재촉·30일 끝 날 | [GAP] → 6·7 |
| 취소·자사·리허설 | [GAP] → 8·9 · 화면 시험(cited) |
| 블로그 계정·로그인 일감 | [GAP] → 10 |
| 빙 ← gsc 의존 | [GAP] → 11 |
| 지어낸 숫자 없음·못 읽음 | [GAP] → 3·10·12 |
| KST 일수 | [TESTED] 며칠전(test-client-status) + 13 |
| 환불 문장 같음 | [GAP] → 14 |
| saveOnboard 검사·병합 | [GAP] → 15 · 화면 시험 저장 |
| 기존 체크리스트·사람 일감 | [TESTED] test-client-core · test-client-screen — 회귀로 다시 |
| 고치기·바깥글고치기가 onboard 보존 | [GAP] → test-client-core 단언 추가 |
| 두 폭 화면 | [GAP] → test-onboard-screen |

## Out of Scope (BUILD-LOG Known Gaps)
- KG-54-1 도메인 없는 고객 등록(구축인데 도메인 미정) — 지금은 열 도메인을 정해 넣는다
- KG-54-2 이 화면의 원장 몫을 /admin/ops 「오늘 하실 일」 일감으로 올리기 — 지금은 기존 일감(setup-*·파일럿 기한·늦은 착수)만
- KG-54-3 고치기·바깥글고치기의 config 통째 쓰기 경합
- KG-54-4 블로그 글 이관 도구 없음 — 이관 줄은 수동 상태
- KG-54-5 맞춤 계약(착수 + 월 관리 × 3, 7·30·60·90일 보고) 은 파일럿 행으로 담는다. 60·90일 줄 없음
- KG-54-6 서치어드바이저·빙 소유 확인 자동 판정 없음 — 원장 표시

## Acceptance
- `node academy/scripts/test-onboard-core.mjs` 전부 통과 · 회귀 test-client-core · test-client-status · test-clients 통과
- web: `node ./node_modules/typescript/bin/tsc --noEmit` 0 오류 · next build 성공 (npx 껍데기 쓰지 말 것 — 경로 & 함정)
- `node academy/scripts/test-onboard-screen.mjs --live` 통과 · 1440·390 스크린샷 4장(시험 고객·cited) 경로를 REVIEW-REQUEST 에 · 시험 고객 남은 행 0
- 화면 문구에 영문 상태값·로그 조각·% 없음 · 시험 고객 이름이 커밋에 없음
- 배포: web 은 main 푸시(먼저 gh auth switch --user leeledger) → 운영 /admin/clients/cited/onboard 200 확인
