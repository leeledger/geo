# Review Feedback — Step 28 (D19~D28)
Date: 2026-09-30
Ready for Builder: YES

## Must Fix
없음.

## Should Fix
- academy/measure-targets.mjs:96-103 (confidence: 9/10) — env 가 한 칸만 있으면 상한과 측정 몫이 엇갈린다. 직접 돌려 봤다: `측정상한(true, { CLAUDE_DAILY_MAX: "40" })` → `{ claude: 40, reserve: 42 }`. claude-code.mjs:88 `상한 - 한도.reserve` = -2 가 되고, 유료 날에는 초안·수리·감사가 전부 막힌다. 지금은 vars 가 비어 있어 살아 있는 문제는 아니다(REVIEW-REQUEST 확인). 고칠 길은 둘: `reserve = Math.min(reserve, claude)` 로 묶거나, CLAUDE_DAILY_MAX 가 env 에서 왔으면 reserve 기본값을 22 로 둔다. 적어도 BUILD-LOG 에 「vars 는 둘 다 넣는다」를 남긴다.
- web/app/api/lead/route.ts:64 (confidence: 7/10) — `await sendLeadAlert(...)` 가 폼 응답을 최대 5초 붙잡는다(AbortSignal.timeout(5000)). 한도는 있어서 폼이 멈추지는 않는다. Resend 가 느린 날에는 신청자가 5초를 기다린다. 이 Next 판에서 `after()`(next/server)가 되면 응답 뒤로 넘긴다. 안 되면 지금대로 둔다.
- research/paid-pilot-order-form.md:51 (confidence: 6/10) — 「(원장 2026-09-30)」은 내부 메모다. 이 절은 입금 전에 고객에게 서면으로 준다. 고객에게 나가는 글에서는 뺀다. 예전 줄의 「(… BUILD-LOG KG)」도 같은 종류였다.
- web/lib/lead-alert.ts:13 (confidence: 5/10) — 숫자가 1~3자리뿐인 연락처도 「(전화 안 남김)」으로 찍힌다. 남기긴 했는데 짧은 경우다. 문구만 「(연락처 확인 필요)」로 가르면 된다. 사소하다.

## Escalate to Architect
- D25 env 우선 규칙: 나중에 CLAUDE_DAILY_MAX 만 40 으로 넣으면 유료 날 두 배가 꺼지고, 위 첫 항목대로 다른 일까지 막힌다. 원장에게 「vars 는 둘 다, 아니면 둘 다 비움」을 알릴지 Arch 가 정한다.

## Cleared
- D25: 학원만 있는 날 40·22·60, 유료 날 60·42·120. 빈/공백 vars 는 없는 값으로 친다. 음수·소수 env 는 기본값으로 간다. `유료측정일` 은 q 가 던지거나 null 이면 false 라 작은 쪽으로 돌고 측정은 안 멈춘다. claude-code.mjs 는 count 가 실패해도 capRequired 규칙을 그대로 지킨다. 세 실행기가 모두 한 함수를 쓴다.
- D27: 저장이 성공한 뒤에만 보낸다. 키나 받는 주소가 없으면 건너뛴다. 5초 제한이 있고 던지지 않는다. 로그에는 status 나 e.message 만 찍히고 키·연락처는 안 찍힌다. 본문은 이름 첫 글자, 끝 4자리, /admin 링크뿐이고 이메일은 안 싣는다. 허니팟은 그 전에 끊는다.
- D20: `미\s?소\s?치\s?과` 가 「미소 치과」에는 걸리고 빈칸 둘에는 안 걸린다. 40자 최악 입력이 2ms 라 ReDoS 는 없다. `\s*\s?` 이 붙는 자리도 없다. clients.mjs 는 diff 가 없어 학원 정규식이 그대로다. 경쟁사 정규식도 같은 규칙이다(Arch 승인).
- D19 파라미터 SQL, D21 대기 종료코드, D22 `오늘 < 착수+60` ↔ SQL `>= kickoff_on + 60` 같은 날, 세 목록을 다 읽었을 때만 pilot 신호. D23 `fail()` 이 try 밖이라 redirect 가 삼켜지지 않고, slug 를 거절한다(Arch 승인). D24 vars 줄.
- 신청서 30일 환불 절(46-50)은 web/lib/services.ts:63-67 과 글자가 같다. web tsc 0. node --check 8개 통과.
