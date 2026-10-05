# Architect Brief — Step 36 · 문서딱 구글·빙 색인을 매일 · 문서딱 성장 리포트를 우리 DB·현황판으로

(Step 25~35 설계서는 git 이력에 있다. 2026-10-05 고쳐 씀: 화면 CSV 긁기 안(gsc-perf-probe)은 버렸다 — 문서딱 저장소가 이미 서비스 계정·Cloudflare 토큰으로 주간 리포트를 낸다. 결정은 BUILD-LOG 「2026-10-05 — Step 36 G2 재결정」.)

## Goal

원장 지시(2026-10-05) 「문서딱 트래픽이 모이게, 말하지 않아도 에이전트를 운영」. 이 Step 뒤로 ① 문서딱도 학원처럼 매일 구글 색인 요청·빙 주소 제출이 PC 에서 돌고 ② 문서딱 저장소(leeledger/doc-tools-kr, 공개)의 주간 성장 리포트(A-5 서치콘솔·Cloudflare)와 새 안내 페이지 후보(A-6)를 우리가 읽어 DB 에 쌓고, 현황판 문서딱 탭·pilot-report 에 「잰 숫자, 주 단위, 출처·기간과 함께」 싣는다. 새 키·토큰 없음. 문서딱 코드 안 고침.

## Flow

```
doc-tools-kr (우리가 안 고침)
  ops-weekly.yml 월 09:23 KST
   ├ growth.mjs  → reports/growth/YYYY-WW.md  (main 커밋, 끝에 growth-data JSON 주석)
   └ opportunities.mjs → 이슈 label ops:opportunity (제목 「새 안내 페이지 후보 YYYY-WW: N개」, 매주 갱신)

우리 GitHub Actions (매일 한 번, 8번 자리)
  growth-import.mjs --client docttak
   ├ GET api.github.com/repos/leeledger/doc-tools-kr/contents/reports/growth  (목록)
   ├ 없는 주만 raw.githubusercontent.com/.../reports/growth/YYYY-WW.md
   │    ├ growth-data JSON → 합계(7·28일 서치콘솔, Cloudflare)   ← 꼭
   │    └ 마크다운 표 3개(쿼리 7·28일, 페이지 28일)              ← 머리줄 맞을 때만
   ├ GET .../issues?labels=ops:opportunity&state=open → 제목·주소·본문
   └ geo.growth_reports upsert (client_id, week)  → agent_activity

PC pc-runner 12:40·19:10 local-agent.mjs
   구글 색인: for c of gsc:true → submit-gsc.mjs --all --client c   (학원 먼저, 고객당 20분)
   빙 제출 : for c of gsc:true → bing-submit-urls.mjs --client c   「등록 안 됨」 → 사람 대기 1건

web /admin/ops?c=docttak → 「문서딱 주간 성장 (문서딱 저장소 리포트)」 카드
pilot-report --client docttak → 행 있을 때만 절
```

## Build Order

### A. 문서딱 색인 (G1 — 바뀌지 않음)

1. `academy/clients.mjs` — 학원·문서딱 덩어리에 `gsc: true`. 아이로그는 안 넣는다.
2. `tools/bing-submit-urls.mjs` — `--client <slug>`(selectClients), `SITE = https://${domain}/`. 인자 없으면 학원 그대로. 먼저 `--look --client docttak` 를 돌려 화면 글자 60줄 원문을 REVIEW-REQUEST 에. 「등록 안 됨」 정규식은 **그 원문으로만**(추측 금지). 등록 안 됨 → `빙 웹마스터에 등록 안 됨` 찍고 exitCode 0.
3. `tools/local-agent.mjs:262-288` — 구글·빙을 `CLIENTS.filter(c => c.gsc)` 로(고르기 함수로 빼서 시험). 학원 → 문서딱. submit-gsc 고객당 timeout 20분. 활동 줄 clientId = 그 고객. 빙 미등록 → `사람 대기` dedupe `bing-site-<slug>`: 「빙 웹마스터에 {이름} 추가 — 구글 서치콘솔 가져오기 동의 한 번(node tools/bing-import.mjs 가 창을 엽니다)」. 등록되면 닫음.
4. `tools/pc-runner.mjs:35` local-agent `limitMin` 60 → 90. 근거를 REVIEW-REQUEST 에.
- **Flag:** pc-runner 가 작업을 차례로 도는지 코드로 확인(같은 `.browser-profile` 동시 열기 금지). ai-web-measure 10:00·180분과 겹침 포함.

### B. 문서딱 성장 리포트 읽기 (G2)

5. `academy/clients.mjs` 문서딱에 `growthReports: { repo: "leeledger/doc-tools-kr", dir: "reports/growth", opportunityLabel: "ops:opportunity" }`. siteLog 를 「Cloudflare 주간 합계는 문서딱 성장 리포트(봇 포함)」로 — Visits.tsx 문서딱 문구·briefing.mjs 도 같은 뜻으로(「연결 전」 지움).
6. 새 `web/lib/growth-core.mjs` (+`.d.mts`, marketing-core 모양):
   - `GROWTH_DDL`: `geo.growth_reports(client_id int not null, week text not null, generated date, source_url text not null, gsc jsonb, gsc_queries7 jsonb, gsc_queries28 jsonb, gsc_pages28 jsonb, cf jsonb, notes text, opportunity jsonb, fetched_at timestamptz not null default now(), primary key (client_id, week))` + RLS. 양쪽 schema.sql · company.mjs 시작 준비(실패해도 계속).
   - `parseGrowthReport(md)` — 리포트 끝 growth-data 주석(doc-tools-kr scripts/ops/lib/report.mjs 의 MARK 정규식 그대로) JSON 이 없거나 깨지면 던진다. gsc·cf 는 JSON 값 **그대로**(우리가 다시 셈하지 않는다, null 이면 null). 표 3개는 `### 상위 쿼리 (7일)`·`### 상위 쿼리 (28일)`·`### 상위 페이지 (28일)` 제목 아래 머리줄이 renderReport 의 rowsTable 머리 그대로일 때만 읽음 — 아니면 그 칸 null(합계는 살림). 쉼표 숫자·「12.5%」·순위 「-」(null)·「(데이터 없음)」 줄 → 빈 배열. 표 값은 리포트가 반올림한 값이라고 주석에. 「> 」 메모 줄은 notes 로.
   - `parseOpportunityIssue(issue)` — 제목 「새 안내 페이지 후보 YYYY-WW: N개」에서 주·건수, html_url, updated_at, 본문 두 표(노출 많은데 클릭 적은 쿼리 / 안내 페이지가 없는 쿼리)의 행. 모양이 다르면 건수 null·주소는 살림.
   - `weeksToFetch(listed, stored, max = 8)` — 목록에 있고 DB 에 없는 주. 있는 주는 다시 안 받음(커밋된 리포트는 안 바뀐다). opportunity 는 매번 최신 이슈를 그 주 행에 갱신.
7. 새 `academy/scripts/growth-import.mjs [--client slug] [--dry]` — growthReports 있는 고객만. `GITHUB_TOKEN` 이 있으면 Authorization 헤더(Actions 기본 토큰, 공개 저장소 읽기 한도용 — 새 키 아님), 없으면 무인증. `--dry` 는 표준출력만. 끝에 `geo.agent_activity`(agent 'measure', action 「문서딱 성장 리포트」, 받은 주·실패).
   - 목록 404·403(한도) → 실패 줄, 다음 날 다시. JSON 없음 → 그 주 안 씀 + 실패 줄(원문 앞 200자). 리포트 0개(첫 정기 실행 10-12 전) → 실패 아님, 「아직 리포트 없음」.
8. 돌리는 자리: DB 를 이미 여는 **매일 한 번** 워크플로(snapshot.yml 1순위 — Bob 확인) 끝에 `continue-on-error: true` 한 단계. 이유를 REVIEW-REQUEST 에. Claude 호출 없음.

### C. 보이기

9. 새 `web/lib/growth-reports.ts readGrowthReports(clientId)` + `web/app/admin/ops/GrowthReport.tsx`(기존 Growth.tsx 와 다른 파일), 행이 있는 고객 탭만(지금 문서딱). 제목 「문서딱 주간 성장 (문서딱 저장소 리포트)」.
   - 주별 줄: 주 · 서치콘솔 7일 클릭·노출·CTR·평균 순위(기간 날짜 그대로) · Cloudflare 7일 요청·페이지뷰·일별 순방문자 합. 그래프는 주 2개 이상일 때만, Visits.tsx 모양(새 라이브러리 금지).
   - 최신 주: 쿼리 28일 상위 10 · 페이지 28일 상위 5(리포트 표 그대로).
   - 「문서딱 세션에 넘길 제안 n건 → 이슈 열기」(A-6 이슈 건수·링크·갱신 날짜). 0 이면 「0건(노출 기준 미달)」. 보여만 준다 — 우리가 제안을 만들지 않는다.
   - 꼬리 두 줄 고정: 「Cloudflare 요청·페이지뷰는 봇을 포함합니다. 순방문자는 하루 단위 합이라 같은 사람이 여러 번 셉니다.」 「구글 숫자는 3일 늦게 확정됩니다 · 출처: github.com/leeledger/doc-tools-kr reports/growth」. 「방문자」라는 말을 쓰지 않는다.
   - 행 없음: 「첫 리포트 전 — 문서딱 저장소가 매주 월 09:23 에 냅니다」. 최신 리포트가 9일 넘게 없으면 빨간 줄 「리포트 멈춤 — 마지막 YYYY-WW」(없는 주를 0 으로 채우지 않는다).
10. `academy/scripts/pilot-report.mjs` — 그 고객 행이 있을 때만 절 「구글 검색·서버 통계 (문서딱 성장 리포트)」: 기간 안 주별 서치콘솔 7일·Cloudflare 7일, 출처 줄, 위 꼬리 두 줄. 머리 숫자·기존 절 불변. case-report(학원) 손 안 댐.

## Failure modes

| 길 | 운영에서 날 일 | 처리 | 보이나 |
|---|---|---|---|
| 리포트 모양 | 문서딱이 표·JSON 표지를 바꿈 | JSON 없으면 그 주 안 씀+실패 줄 · 표 머리 다르면 표만 null · 시험 | 카드 「리포트 멈춤」 / 표 빈 칸 |
| 리포트 안 나옴 | ops-weekly 실패·비밀값 만료 | 없는 주는 빈 칸(0 아님) · 9일 빨간 줄 | 카드 |
| 비밀값 빠짐 | 리포트 gsc: null + 메모 | null 그대로, 메모를 카드에 | 메모 원문 |
| GitHub 한도 | 무인증 60회/시 | Actions 토큰 헤더 · 하루 1회 · 실패 줄 | 활동 줄 |
| 봇 섞인 숫자 | Cloudflare 요청을 방문으로 읽음 | 꼬리 줄 고정 · 「방문자」 금지 | 문구 |
| 이슈 모양 | 제목 꼴이 바뀜 | 건수 null·링크만 · 시험 | 「건수 못 읽음 — 이슈 열기」 |
| 빙 미등록·헛판정 | 문서딱이 빙에 없음 / 추측 정규식 | --look 원문으로만 · 시험 | 할 일 1줄 |
| local-agent 길어짐 | 두 고객 색인 + 블로그 | 고객당 20분 · 한도 90 | pc-runner 로그 |
| 학원 회귀 | 인자 없는 호출이 학원을 안 돎 | 기본 학원 · 시험 | — |

시험 없음 + 처리 없음 + 조용함 인 칸 없음.

## Test map

새 `academy/scripts/test-growth-import.mjs` (네트워크·DB 없음). 재료는 **doc-tools-kr origin/main 의 renderReport·opportunities issueBody 가 실제로 내는 모양**을 코드에서 읽어 고정(꾸며 쓰지 않음). 첫 실 리포트(10-12)가 나오면 그 파일로 바꾼다:
- JSON 있음/없음/깨짐 · gsc null · cf null `[GAP→짓는다]`
- 표 3개 정상 · 「(데이터 없음)」 · 순위 「-」 · 쉼표 숫자 · 머리 바뀜 → 표 null·합계 유지 · 쿼리 안 이스케이프된 세로줄 `[GAP→짓는다]`
- 이슈 제목 정상·꼴 다름 · 본문 두 표 `[GAP→짓는다]`
- weeksToFetch: 빈 DB · 이어 받기 · 최대 8 `[GAP→짓는다]`
- 빙 「등록 안 됨」 정규식: --look 원문 맞음 · 학원 등록 화면 글자 안 맞음 `[GAP→짓는다]`
- local-agent 고객 목록: gsc:true 만, 학원 먼저 `[GAP→짓는다]`

회귀 (Acceptance):
- `submit-gsc.mjs --all` 인자 없음 = 학원 `[TESTED — 코드 불변]` · `bing-submit-urls.mjs` 인자 없음 = robotncoding.com `[GAP→시험]`
- pilot-report 문서딱 dry: 행 없을 때 diff 0 `[GAP→dry 비교]`
- 현황판 학원·아이로그 탭: 새 카드 안 뜸 · Visits 학원·아이로그 문구 불변 `[GAP→tsc+읽기 출력]`
- test-marketing 38 · docttak 32 · ilog 33 · grow 37 `[TESTED]` · web tsc 0

## Out of Scope (나오면 BUILD-LOG Known Gaps)

- 학원·아이로그 서치콘솔 수집(KG-36-6) · 화면 CSV 긁기 · 우리 쪽 새 키·서비스 계정
- 우리가 수요 제안을 따로 만드는 것(옛 Step 37 안 — A-6 와 겹쳐 접음) · marketing-draft 검색어 고르기 변경
- doc-tools-kr 코드 — 바라는 것은 deliverables/docttak/2026-10-05-growth-data-proposal.md 로만 · 빙 검색 실적 · pm-report·health 줄
- IndexNow(문서딱 배포가 보냄 — 결정됨)

## Acceptance

- REVIEW-REQUEST 에 빙 --look 원문 · `growth-import.mjs --client docttak --dry` 실제 출력(10-12 전이면 「아직 리포트 없음」 + 이슈 읽기 결과).
- 시험·회귀 전부 통과 · tsc 0.
- 운영 DB 첫 쓰기·푸시·배포는 Arch. Bob 은 안 함.
- 원장 할 일 새 줄: 빙 미등록일 때 1줄뿐. Cloudflare 토큰 일(D46)은 지운다 — 문서딱 저장소에 이미 있다.
