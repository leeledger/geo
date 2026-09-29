# Review Request — Step 28 (재점검 잔여 D19~D24)
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

## Out of Scope (logged in BUILD-LOG)
- KG-28-1 이미 저장된 외부 고객 answer_pattern 은 옛 규칙 — 다시 저장 필요
- KG-28-2 D23 오류 뒤 폼 입력값은 되살리지 않는다
