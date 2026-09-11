# Review Request — Step 3 (재작업)
*Bob 이 짓다가 세션 한도로 중단 → Arch 가 마무리. Read by Reviewer.*

Ready for Review: YES — 배포는 끝났다(커밋 26de039). 리뷰어 한도가 풀리면 `git show 26de039` 로 다시 본다.

저장소 `C:\dev\자동피드백생성기`. `npx tsc --noEmit -p .` 0건, `npm run build` 통과, 운영 200.

## Must Fix 1 — 여러 건 문자 결과가 원장 화면에 안 보이던 것
`lib/agent/tools.ts` `sendSmsToParents`
- 실패 사유를 둘로만 묶는다: `sent.error === '잔액 부족' ? '잔액 부족' : '발송 실패'` — 솔라피·네트워크 오류 원문이 화면에 안 나간다
- 결과 한 줄에 차감액과 사유별 건수: 「SMS 발송 결과: 3명 성공, 2명 실패(잔액 부족 2) · 발송 잔액에서 72원 차감」
- `successCount === 0` 이면 `result` 대신 `error` → 화면·학습 기록이 실패로 남는다 (`app/api/agent/chat/route.ts` `success = !parsed.error`)

## Must Fix 2 — 청구서 문자 실패 시 JSON 원문 노출
- `app/api/agent/chat/route.ts` 확인 응답: `parsed.result || parsed.message || parsed.error || toolResult`
- `lib/agent/tools.ts` `sendTuitionInvoice`
  - `sendOneMessage` 를 try/catch 로 감싸 던지는 오류는 「처리 중 오류」로 (원문 노출 금지)
  - 실패: 「○○ 학생 청구서 문자를 보내지 못했습니다 — 발송 잔액이 부족합니다. 발송 잔액은 차감되지 않았습니다.」
  - 성공: 「… 발송 완료 (번호) · 발송 잔액에서 24원 차감」

## Should Fix (전부 반영)
- `lib/repositories/message-repository.ts` — `MESSAGE_TYPES.TUITION = 'tuition'`
- `app/dashboard/messages/history/page.tsx` — `tuition` 라벨 「수납」 + 필터 항목
- `app/dashboard/settings/page.tsx` — 「건당 61원」 3곳을 `unitCost('LMS')` 로
- KG-15(잔액 확인·차감 경쟁 조건)는 기록만 — 발송 경로 전체에 걸린 문제라 따로 잡는다

## Arch 결정 반영
- `send_sms` 확인 문구에 인원·최대 총액: 「받는 사람 12명 · 발송 잔액에서 건당 24원(90바이트 넘으면 61원) — 최대 732원」
- 세는 쿼리는 실제 발송과 같은 조건(`academy_id` 바인딩, `is_active`, `parent_phone` 있음, `student_ids` 있으면 `= ANY`). `buildConfirmMessage` 는 async, 호출부에서 `await`. 쿼리가 실패하면 0명으로 보고 인원 문구만 생략(확인은 막지 않는다)

## Arch 자체 점검
- `sendSMS`·`SOLAPI_SENDER` 직접 호출 0건(grep), 발신번호는 `getAcademyMessagingConfig().senderPhone` 만
- 집계는 `sendOneMessage().success`, 합계는 성공 건 `cost` 만
- 확인·발송 쿼리 모두 `academy_id` 파라미터 바인딩
- 배포 후 운영 `/` 200, `/auth/login` 200 (실제 문자 발송 시험은 하지 않았다 — 돈이 나간다)

## Open
- 에이전트 대량 발송에 건당 대기(50ms)가 없다. `processBatch` 에는 있다 — 필요하면 다음 단계
