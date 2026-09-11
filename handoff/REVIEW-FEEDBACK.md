# Review Feedback — Step 3
*Written by Reviewer. Read by Builder and Architect.*
Date: 2026-09-12
Ready for Builder: NO

모든 경로는 `C:\dev\자동피드백생성기\` 기준.

## Must Fix
1. `lib/agent/tools.ts:1846-1853`, `app/api/agent/chat/route.ts:469-471` — 여러 명 문자 발송 뒤 원장 화면에는 `parsed.result` 한 줄만 보인다(`route.ts:470`, `components/agent/AgentWidget.tsx:184`). `result` 에 성공·실패 수만 있고 차감 합계(`cost`)·실패 사유(`fail_reasons`)는 안 보인다. 전원 실패해도 `error` 키가 없어 `success = !parsed.error` 가 true → 화면 success, 학습 기록 「성공」(`route.ts:496-497`).
   - 고치기: `result` 한 줄에 차감 합계와 사유별 건수. 예 「SMS 발송 결과: 3명 성공, 2명 실패(잔액 부족 2) · 잔액에서 72원 차감」. `successCount === 0` 이면 `error` 도 넣는다
2. `lib/agent/tools.ts:1717-1724`, `app/api/agent/chat/route.ts:470` — 청구서 문자 실패 시 `result` 가 없어 채팅창에 JSON 원문. 성공 시에도 차감액이 한 줄에 없다
   - 고치기: `route.ts:470` → `parsed.result || parsed.message || parsed.error || toolResult`. 성공 `result` 에 「잔액에서 N원 차감」

## Should Fix (전부 반영 — Arch 결정)
- `tools.ts:1704-1715` `sendTuitionInvoice` — `sendOneMessage` 가 던지는 오류를 try/catch 로 감싸 「처리 중 오류」로 (원문 노출 금지)
- `tools.ts:1839` — 실패 사유가 `sendSMS` 원문 오류 문자열일 수 있다. 「잔액 부족」 외 사유는 「발송 실패」로 묶는다
- `lib/repositories/message-repository.ts:11-20`, `app/dashboard/messages/history/page.tsx:285,388` — messageType `'tuition'` 을 enum 상수(`TUITION`)와 라벨 「수납」에 추가
- `app/dashboard/settings/page.tsx:877,922,967` — 「건당 61원」 하드코딩 → `unitCost('LMS')`
- `lib/services/message-service.ts:122-128,226-229` 잔액 확인·차감 경쟁 조건, Solapi 성공 후 UPDATE 예외 시 실패 집계 → **KG-15 로 BUILD-LOG 에만 기록** (이번에 고치지 않음)

## Escalate to Architect → Arch 결정 (원장 위임, 2026-09-12)
- 여러 건 문자 확인 문구에 비용 붙인 것(`route.ts:318`, Bob Open Q2) → **승인**. 사실이고 돈이 나가는 확인이다
- 확인 문구에 받는 사람 수·최대 총액 → **넣는다.** `student_ids` 가 있으면 그 수, 없으면 같은 조건(학원 범위 · 재원 · 학부모 번호 있음, `tools.ts:1797-1802` 과 같은 WHERE)으로 수를 센 뒤 「N명 · 최대 N×61원(짧으면 N×24원)」. 대상 조회는 확인 문구 만들 때 한 번만, academy_id 범위로
- 청구서 확인 문구는 1명이라 「건당 24원(긴 문자 61원)」 그대로

## Cleared
발송 경로(`sendOneMessage` 만, 폴백 없음), 성공 기준 집계·합계, 학원 범위 쿼리, 납부기한 KST, `message-cost.ts`(import 0, 계산식 원본과 동일, Solapi LMS 판정과 일치, re-export 로 기존 import 동작), 수납 발송 라우트(`manual`, `alimtalkSent:false`, 호출하는 화면 없음), 설정 화면 19·24원, 확인 문구 단가, `tsc --noEmit` 오류 0.
