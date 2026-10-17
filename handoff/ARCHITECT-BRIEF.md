# Architect Brief — Step 56

사이트 없는 고객도 잰다 · Step 55 리뷰 Should Fix 3 · 키 파일만 빠지면 고객에게 안 묻는다.
결정 D238~D245 (BUILD-LOG). Step 55 브리프: handoff/research/ARCHITECT-BRIEF-step55.md
원장: 「왜이리 오래걸려」 — 가장 작은 변경. 새 파일·새 화면·리팩터 없음.

## Goal
domain 없는 고객(id 18 같은 블로그만·사이트 없음)이 이름 판별 말만으로 AI 답변 측정에 들어가고, 링크 인용 칸은 어디서든 0 이 아니라 「해당없음」으로 나온다. 자동 세팅의 질문 단계·매시 고리·멈춘 판이 실제 상태를 말한다.

## 흐름
```
측정대상(measure-targets) ─ 측정설정(row)
   answerRe 없음 ............ null (안 잼, 지금처럼)
   answerRe 있음 · domain 없음 → { ..., domain: null }   ← 새로 잰다
        │
        ▼
 ai-measure / ai-web-measure / import-ai-measurements
   mentioned = answerRe.test(답)
   cited     = 인용판정(citations, domain)  → domain 없으면 null (false 아님)
        │  insert (cited 칸 not null 을 푼다)
        ▼
 화면·리포트: 고객 domain 없음 → 링크 칸 「해당없음(사이트 없음)」, 숫자 안 씀
```
```
자동이어하기: rows → filter(다음단계 || 멈춘단계) → [새] 빼기(checkPlatform 없음 && 다음=사이트 && 갈래=플랫폼 && 안 멈춤) → sort → slice(3)
고객 화면:   멈춘단계(auto, now) 있음 → 판에 그 단계 넘김 → autoStep 1번 → 「원장」 → 다음 null · 다시 보기 멈춤
             5초 다시 보기 = 도는중 이고 임대 90초 안일 때만
```

## Build Order

### 56a 측정 대상 — academy/measure-targets.mjs
- `측정설정`: `if (!answerRe) return null`. domain 은 `도메인정리` 결과가 빈 글자면 `null`. 주석 「둘 다 있어야」 고침
- 새 export `인용판정(citations, domain)` — `!domain` → `null`. 아니면 지금 식(`d === domain || d.endsWith("." + domain)`). 빈 글자 domain 도 null (KG-55-13 닫음)
- Flag: `덩어리?.domain` 이 코드 3곳에서 오는 길은 그대로. 학원·아이로그·문서딱 값이 바뀌면 안 된다(회귀 단언)

### 56b 적는 곳 — cited 를 null 로
- `academy/scripts/ai-measure.mjs` 260 · `tools/ai-web-measure.mjs` 305 · `academy/scripts/import-ai-measurements.mjs` 51·69 → 전부 `인용판정`. import 의 `endsWith(client.domain)` 은 domain null·빈 글자에서 지금 잘못 돈다
- ai-web-measure 317 `if (cited) cite++` 는 그대로(null 은 안 셈). 로그 기호도 그대로(null → ○/·)
- 칸: ai-measure.mjs create table 바로 뒤, import-ai-measurements.mjs create 바로 뒤에 두 줄씩
  `alter table academy.ai_measurements alter column cited drop not null`
  `alter table if exists academy.ai_probe_measurements alter column cited drop not null`
  default false 는 둔다. 기존 행 안 바뀐다(메타데이터만, 되풀이해도 무해)
- Flag: loop-grow.mjs create 는 안 건드린다(이미 있는 표엔 무효)

### 56c 읽는 곳 — 0 대신 해당없음
- web/lib/asks.ts 에 `export const 링크없음 = (domain?: string | null) => !domain` 하나. 아래가 링크 숫자 자리를 「해당없음(사이트 없음)」으로
  - web/app/admin/asks/page.tsx 90 · 201
  - web/app/admin/ops/AskLog.tsx 48
  - web/app/admin/ops/PmReport.tsx 70 (`a.링크없음` 갈래 옆에)
  - web/app/admin/ops/Growth.tsx 178 — 고른 고객 기준이면 같은 처리, 학원 고정이면 그대로. Bob 이 확인해 REVIEW-REQUEST 에 적는다
  - web/app/admin/pilots/[id]/page.tsx 93(`x.pilot.domain` 없으면 「사이트 없음」) · 215(「인용 해당없음」)
- academy/scripts/pilot-report.mjs 111 문장과 인용 숫자 → domain 없으면 「인용: 해당없음(사이트 없음)」
- 안 고침(학원 고정 `client_id = 1`/HOUSE): case-report.mjs · pm-report.mjs · web/lib/ops.ts 310. grep 으로 확인만
- SQL 안 고침: `filter (where cited)`·`bool_or(cited)`·`mentioned or cited` 는 null 을 거짓으로 친다 → 이름 숫자는 그대로 맞다

### 56d domain 없는 고객이 사이트 일을 만들지 않게
- academy/scripts/daily-agent.mjs: `c.domain` 없으면 홈 fetch(114)·홈 JSON-LD 판정(473·479)·색인알림 건너뜀. 일감·「응답 없음」 기록 안 만듦. 측정·판정 행은 그대로
- academy/scripts/company.mjs 「site-check」(689): `!c.domain` → `{ status: "완료", evidence: "사이트 없음 — 해당없음" }`
- Flag: 다른 `https://${c.domain}`(546·939)은 학원 고정이라 안 고친다

### 56e 질문 단계 — web/lib/auto-setup-core.mjs 질문() (555~569)
- 패널 만들기 전에 `select count(*)::int n from geo.pilot_questions where pilot_id = $1`. n>0 → `{ 상태: "됨", 말: "질문이 이미 n개 있습니다 — 넣지 않았습니다" }`, measure_active 안 건드림
- n=0 → insert 마다 `returning id`, 들어간 줄 수를 센다. 0 → `원장`「질문을 넣지 못했습니다」. 1~19 → `원장`(실제 수). 20 → measure_active = true, 말은 실제 수로

### 56f 매시 고리 굶음 — 자동이어하기 (651~657)
- `deps.checkPlatform` 없으면 slice 전에 `다음단계(...) === "사이트" && 단계갈래(r) === "플랫폼"` 이고 멈춘 행이 아닌 것을 뺀다

### 56g 멈춘 판 — auto-setup-core · [slug]/page.tsx 124 · AutoSetupPanel.tsx
- 고리 안의 `멈춘` 식을 `export function 멈춘단계(auto, now)` → 단계 이름 | null 로 꺼낸다. 자동이어하기가 이것을 쓴다(동작 같음)
- page.tsx: `다음={다음단계(...) ?? 멈춘단계(auto, new Date(지금))}`. 판은 지금처럼 autoStep 한 번 → 자동한걸음이 「시간 초과 3번」 → 원장
- 판 5초 다시 보기: 도는중 임대가 90초 안일 때만. page 에서 `살아있음` boolean 하나를 넘긴다(판줄에 at 을 더하지 않는다)

### 56h 키 파일만 빠짐 — web/lib/client-core.mjs 체크리스트 (808~823)
- 빠진칸이 「IndexNow 키 파일」 하나뿐이면 dns 와 상관없이 send 줄 = `상태: 기다림`, 사람말 「키 파일만 빠졌습니다 — 고객에게 묻지 않습니다. 접근 권한이 있으면 우리가 올리고, 없으면 원장·Claude 세션 몫(고칠 것)」, `고칠것: 글`, 보낼글 없음
- 일감계획 기존 규칙(우리가 고치는 send = 닫힘)으로 열린 setup-send 가 닫힌다 — 새 코드 없음

## Failure modes
| 길 | 실제 실패 | 처리 | 사용자에게 |
|---|---|---|---|
| domain null 측정 | 인용판정을 안 거친 적는 곳이 false 로 적음 → 가짜 0 | 56b 세 곳 · grep 확인 · 시험 | 막음(조용한 거짓을 시험으로) |
| cited not null 남은 표 | null insert 실패 → 그 문항 빠짐 | alter 두 줄 · 기존 오류 로그 | 측정 로그 오류(시끄러움) |
| 화면 null domain | `https://null` 주소·0 표시 | 56c 링크없음 갈래 | 「해당없음」 |
| daily-agent | 홈 fetch 실패가 「응답 없음」 일감 | 56d 건너뜀 | 없음 |
| 질문 경합 | 0줄 넣고 「20개 넣음」 | 56e 실제 수 | 원장 일감 |
| 멈춘 판 | autoStep 오류 | 기존 set멈춤 | 「다시 시도」 |
| 키 파일만 | 아무도 안 올림 | 고칠것이 고객 화면에 남음(KG-55-7) | 원장 화면 기다림 |

## Test map
- 측정설정: domain null + 판별 말 → conf.domain null [GAP → test-clients] · 판별 말 없음 → null [TESTED] · 코드 3곳 domain 그대로 [TESTED + 회귀 단언]
- 인용판정: null · "" · 일치 · 하위도메인 · 불일치 [GAP → test-clients]
- 대상고르기: domain null 고객이 측정 묶음에 conf 있음 [GAP → test-clients]
- 질문 단계: 이미 3개 → 됨·measure_active 그대로 / 0줄 → 원장 / 20줄 → measure_active [GAP → test-auto-setup-core]
- 고리: 플랫폼 대기 3곳 + 보통 1곳, max 3 → 보통 1곳이 돈다 · 멈춘 플랫폼 행은 안 빠진다 [GAP → test-auto-setup-core]
- 멈춘단계: 시도 3·임대 지남 → 단계 / 시도 2 → null / 임대 안 지남 → null [GAP → test-auto-setup-core]
- 키 파일만 → 보낼글 undefined · 열기에 setup-send 없음 · 닫기에 있음 / 키 파일 + robots → 지금처럼 보낼글 [GAP → test-client-core] · 금지어 0 [TESTED test-client-copy 회귀]
- 화면 문구 · daily-agent·company·pilot-report 한 줄 가드 — tsc·build + Richard diff [GAP 허용, 순수 갈래 한 줄]

## Out of Scope
- KG-55-7 고칠것 → Claude 세션 일감 · KG-55-11 흔함 기준
- KG-56-1 블로그 주소 경로로 인용 세기(blog.naver.com/<id>) — domain 없는 고객 인용은 이번엔 해당없음
- 학원 고정 리포트(case-report·pm-report·ops.ts)
- 실측 측정(돈 쓰는 길, ai-measure 에 dry 없음). Arch 가 배포 뒤 읽기만: `측정대상` 에 id 18 conf 가 null 아님

## Acceptance
- academy/scripts: test-clients · test-auto-setup-core · test-client-core · test-client-copy · test-client-status · test-onboard-core · test-new-client · test-docttak · test-ilog-loop 전부 0 실패
- web: `node ./node_modules/typescript/bin/tsc --noEmit` 0 · `next build` 통과 (npx tsc 금지 — 경로 `&`)
- grep: 인용 식(`endsWith(\`.${`)이 measure-targets 인용판정 밖에 없음
- REVIEW-REQUEST.md: 바뀐 파일·줄, Growth.tsx 판단
