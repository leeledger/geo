# Review Request — Step 28 (재점검 잔여 D19~D24 + 원장 결정 D25~D28)
Date: 2026-09-30
Ready for Review: YES
Status: DONE

## Files Changed
- tools/submit-gsc.mjs:19,24-28,31-63 — clients.mjs 에 없는 `--client`/CLIENT_ID 면 geo.clients.domain 으로 대체(D19). 지정 없음=학원(CLIENTS[0]), DB 는 대체할 때만 연다
- academy/measure-targets.mjs:15,29 — `도메인정리` export(submit-gsc 재사용), 구축대기한도 import
- academy/measure-targets.mjs:58,65 — 구축·세팅 + 연 날 없음은 착수+60일(당일)부터 측정 대상에서 뺀다(D22)
- academy/pilot-plan.mjs:24-29 — `구축대기한도 = 60` 한 곳에서 정의
- academy/scripts/company.mjs:38,392-409 — 착수+60일 넘은 연 날 없는 구축·세팅 파일럿 → 사람 대기 `pilot-launch-<id>` 「<이름> 사이트 연 날을 넣어 주세요」. 세 목록 다 읽혔을 때만 pilot 신호 읽음
- web/lib/answer-pattern.ts:8-25 — 붙여 쓴 한글 글자 사이 `\s?`(D20). 낱말 사이 `\s*`·&·40자·10개 그대로
- academy/pilot-report-core.mjs:57-68 — 보고서 경쟁사 `이름정규식`도 같은 규칙(주석이 「answer-pattern.ts 와 같은 규칙」이라 맞춤)
- tools/ai-web-measure.mjs:191-194,222 — 승인 질문 없음은 일감만 올리고 exitCode 안 건드림(D21, ai-measure 와 같은 「대기」)
- web/lib/pilot-actions.ts:29-44 — createPilot 조용한 return → `redirect(/admin/pilots?err=…&f=…)`(D23). slug 는 `^[a-z0-9-]{1,40}$` 아니면 되묻는다. 내부 고객 검사는 트랜잭션 밖
- web/app/admin/pilots/page.tsx:57-73,78-80,157-161 — err 코드 → 사람 말 한 줄, 오류면 등록 자세히 열림
- .github/workflows/{audit,company,write,repair,sales}.yml — CLAUDE_MEASURE_RESERVE·CLAUDE_DAILY_MAX vars 줄(D24, optimize.yml 과 같은 줄, 값 불변)

## 확인 (DB 쓰기·실측정·푸시 없음)
- 가짜 행·순수 함수 16개 통과: 「미소치과」↔「미소 치과」, 빈칸 둘은 안 걸림, & 규칙·점 escape·i 그대로, 40자 최악 입력 1ms, 41자 null, 경쟁사 정규식 동일 규칙, 착수+59일 잰다/+60일 뺀다/연 날 넣으면 다시 잰다, 학원 항상 잰다
- 학원 이름 판별 그대로: `측정설정` 결과 answerRe = clients.mjs 원문 `(?<!똑똑한\s?)(로봇\s?(&|&amp;|앤|and)\s?코딩)|robotncoding`, 도메인 = clients.mjs 값. clients.mjs diff 없음
- node --check 6개 · web `node ./node_modules/typescript/bin/tsc --noEmit` 0

## Open Questions
- D20 을 보고서 경쟁사 정규식(pilot-report-core)에도 적용했다 — 설계서는 answer-pattern 조립만 말했지만 두 곳이 「같은 규칙」이라 한쪽만 바꾸면 주석이 거짓이 된다. 경쟁사 숫자가 띄어쓰기 변형만큼 늘 수 있다(학원은 경쟁사 미설정이라 영향 없음)
- D23 slug: 예전엔 허용 안 되는 글자를 몰래 뺐다. 이제 거절하고 되묻는다 — 의도대로인지
- D22 경계: 착수+60일 당일부터 제외(`오늘 < 착수+60`), SQL 도 `>= kickoff_on + 60` 로 같은 날 일감

## D25~D28 (원장 결정 추가, Arch 2026-09-30) — DONE

### Files Changed
- academy/measure-targets.mjs:83-104 — `유료측정일(q, 오늘)`(DB 전체로 「유료 파일럿이 오늘 측정 대상」, 칸 준비 없음, 못 읽으면 false) · `측정상한(유료, env)` 40/22/60 ↔ 유료 날 60/42/120, env 숫자 먼저·"" 는 없음(D25)
- academy/scripts/claude-code.mjs:23-24,39,84-88 — 하루 상한·측정 몫을 위 둘로 고른다. 모든 워크플로(repair·sales·write·audit·company·optimize)의 Claude 호출이 여기를 지나 합계가 한 규칙. 안 쓰이게 된 `정수` 도우미 지움
- academy/scripts/ai-measure.mjs:22,231-232 — 측정 몫(탐침·고객 나눔)도 같은 함수
- tools/ai-web-measure.mjs:32,230-232 — 화면 하루 상한을 main 안에서 같은 함수로(맨 위 상수 지움)
- research/paid-pilot-order-form.md:51-57 — 「계약서에 따로」 → 구축·세팅 환불 세 줄(D26). 30일 파일럿 환불 절·web/lib/services.ts 글자 그대로. 「착수는…」 → 「30일 파일럿의 착수는…」
- web/app/admin/pilots/[id]/page.tsx:198 — 관리 화면 「계약서 기준」을 같은 기준 글자로(랜딩 아님)
- web/lib/lead-alert.ts (새) · web/app/api/lead/route.ts:3,63-64 — 저장 성공 뒤 Resend 한 통(D27). 키·받는 주소 둘 다 있을 때만, 5초 제한, 던지지 않음. 본문은 이름 첫 글자+** · 전화 끝 4자리 · `<origin>/admin`
- research/pilot-measurement-sop.md:33 — 파일럿 기간 PC 매일 10시 전후 켜 둠(D28)

### 확인
- 시험 31개 통과(D25: 두 날 값·빈 vars·env 우선·측정 아닌 몫 18 유지·유료/0원/DB 실패 · D27: 가림·빈 값·키 없음 안 보냄·실패 안 던짐) · web tsc 0 · node --check
- 학원만 있는 날은 40/22/60 — 지금과 같다. `gh variable list` 에 CLAUDE_*·WEB_MEASURE_* 없음, academy/.env.local 에도 없음 → 기본값이 돈다

### Open Questions
- D25: env(GitHub vars)를 넣으면 두 배 규칙보다 먼저다(지시대로). 나중에 vars 를 40 으로 넣으면 유료 날에도 40 — 원장이 알아야 한다
- D25: claude-code.mjs 가 호출마다 고객 목록 select 한 번을 더 한다(하루 수십 번). 캐시는 안 했다 — 날이 바뀌거나 파일럿이 새로 들어오는 경우를 단순하게 맞추려고
- D26: 구축 쪽은 「구축·세팅 작업 착수 전」으로 적어 30일 파일럿 착수(질문 승인 뒤 첫 측정)와 갈랐다. 원장 말 「착수 전」의 뜻이 맞는지
- D27: 보내는 주소가 onboarding@resend.dev 로 고정 — Resend 계정 주인 주소로만 간다. LEAD_ALERT_TO 가 다른 주소면 도메인 인증 + from 변경이 필요(KG-28-3)

## Out of Scope (logged in BUILD-LOG)
- KG-28-1 이미 저장된 외부 고객 answer_pattern 은 옛 규칙 — 다시 저장 필요
- KG-28-2 D23 오류 뒤 폼 입력값은 되살리지 않는다
- KG-28-3 Resend 키·받는 주소 원장 몫(env 는 파일로 넣고 길이 확인)
