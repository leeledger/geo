# Review Request — Step 3
*Written by Builder. Read by Reviewer.*
Date: 2026-09-12
Ready for Review: YES

저장소 `C:\dev\자동피드백생성기`. 커밋 안 함. `git diff --stat`: 5 files +91 −85, 새 파일 1개 (`lib/services/message-cost.ts`, 42줄).
`npm run build` 통과. 실제 문자·알림톡·DB·Solapi 호출은 하지 않았다. 확인은 빌드와 코드 경로만.

## Files Changed

- `lib/services/message-cost.ts:1-42` (새 파일) — `getByteLength`·`unitCost(channel)`·`calculateCost` 를 옮겨 둔 곳. import 가 없어서 `'use client'` 설정 페이지에서도 쓸 수 있다. 계산식은 원래 `message-service.ts:35-45` 와 같다: `Math.round(base * 1.1)`, 90바이트 넘으면 LMS. 그래서 17→19, 22→24, 55→61
- `lib/services/message-service.ts:18,20-21` — 상수·함수 선언을 지우고 `message-cost` 에서 import 한 뒤 `calculateCost`·`getByteLength` 를 re-export 한다. `app/api/messages/send/route.ts:5` 의 import 경로는 그대로 쓸 수 있다
- `lib/agent/tools.ts:5` — `sendSMS` import 를 `sendOneMessage, getAcademyMessagingConfig` 로 바꿈
- `lib/agent/tools.ts:598` — `sendTuitionInvoice` 에 `context.userId` 를 넘김 (`senderId` 로 들어간다. `messages/send/route.ts:143` 과 같은 방식)
- `lib/agent/tools.ts:1668-1735` — `sendTuitionInvoice`: `solapi_sender`·`process.env.SOLAPI_SENDER` 폴백 삭제. 발신번호는 `getAcademyMessagingConfig().senderPhone`(1697-1700) 하나. 발송은 `sendOneMessage`(1704-1715, `messageType:'tuition'`, `channel:'SMS'`, `studentId`, `recipientName`, `variables:{}`). `!sent.success` 면 사유와 `success:0, fail:1, cost:'0원'` 을 돌려준다(1717-1724). 성공하면 `sent.channel` 과 `cost` 를 넣는다. academies 조인은 빼고 학원명은 config 의 `academyName` 에서 가져온다
- `lib/agent/tools.ts:1787-1852` — `sendSmsToParents`: 발신번호 확인은 위와 같다(1791-1794). 반복마다 `sendOneMessage` 를 부르고(1821-1832, `messageType:'notice'`), `sent.success` 로만 센다(1833-1836). 실패하면 `sent.error`(예: 「잔액 부족」) 사유별로 건수를 모은다(1843). 응답에는 `success`·`fail`·`cost`(차감 합계)가 들어가고, 실패가 있으면 `fail_reasons` 도 들어간다
- `app/api/agent/chat/route.ts:6,314,318` — 확인 문구에 「발송 잔액에서 건당 24원(긴 문자 61원)이 빠집니다.」를 붙임. 숫자는 `unitCost('SMS')`·`unitCost('LMS')` 에서 온다
- `app/api/tuition/invoices/[id]/send/route.ts:6-8` — 머리 주석을 「알림톡 실발송은 아직 없다」로 고침
- `app/api/tuition/invoices/[id]/send/route.ts:32-35` — SELECT 를 `status` 하나로 줄임. 알림톡 판단용 컬럼은 이제 쓰지 않는다
- `app/api/tuition/invoices/[id]/send/route.ts:51-64` — `sent_method = 'manual'` 을 고정값으로 넣음. TODO 삭제. 응답은 Decision 문구 그대로, `alimtalkSent: false`
- `app/dashboard/settings/page.tsx:11,767-768,772-773` — 건수는 `alimtalkBalance / unitCost('ALIMTALK'|'SMS')` 로 계산. 표기는 「(부가세 포함 19원)」「(부가세 포함 24원)」. 799-800 의 「VAT 별도」 문구는 brief 대로 남겨 둠

## Definition of Done

- [x] 두 에이전트 도구에 `process.env.SOLAPI_SENDER` 와 직접 `sendSMS` 호출이 없다. `tools.ts` 에서 `sendSMS|SOLAPI_SENDER|solapi_sender` 를 grep 하면 0건. 발송은 `tools.ts:1704`, `:1821` 의 `sendOneMessage` 두 곳뿐
- [x] 발송 결과 수는 `sendOneMessage().success` 로 센다: `tools.ts:1717`(청구서), `:1833-1836`(여러 건)
- [x] 수납 발송 응답에 「발송되었습니다」가 없다: `route.ts:62-63`
- [x] 설정 화면 건수는 19·24원 기준이다: `settings/page.tsx:767-768,772-773` → `message-cost.ts` 의 `unitCost`
- [x] `npm run build` 통과

## Open Questions

1. **수납 화면에는 발송 버튼이 없다.** 앱·컴포넌트·lib 어디에도 `tuition/invoices/.../send` 를 부르는 fetch 가 없다(grep 결과). `alimtalkSent`·`message` 를 읽는 클라이언트 코드도 없다. 그래서 Build Order 4 에서 고친 화면 문구는 없다. KG-7 의 「버튼」은 API 응답만 해당되는 것 같다
2. **`send_sms` 확인 문구에도 비용을 붙였다.** brief 는 `route.ts:312-313`(청구서)만 지목했다. 여러 건 문자도 이제 잔액에서 빠지니 같이 알렸다. 빼야 하면 한 줄이다
3. **`sendSmsToParents` 반복 중 예외 처리.** `sendOneMessage` 가 던지면(db 오류 등) 「처리 중 오류」 실패로 세고 다음 학생으로 넘어간다. 원래 오류 문구는 응답에 넣지 않는다. 드문 경우가 하나 있다. Solapi 성공 뒤 잔액 UPDATE 에서 던지면 문자는 나갔는데 실패로 센다. 이건 `sendOneMessage` 안의 문제라 손대지 않았다
4. **발송 간격 대기가 없다.** `processBatch` 는 건마다 50ms 쉰다(`message-service.ts` 벌크 반복). 에이전트 반복은 원래도 대기가 없었고, Decisions 에 없어서 넣지 않았다. rate limit 에 걸리면 이제 실패로 정직하게 세진다
5. **납부기한 날짜에 `timeZone: 'Asia/Seoul'` 을 붙였다**(`tools.ts:1702`). CLAUDE.md 함정 「DB 시각은 UTC」를 따른 것이다. brief 에는 없던 변경이다
6. **`sendOneMessage` 의 `fillVariables` 는 글자 그대로의 `\n`(백슬래시+n)을 줄바꿈으로 바꾼다.** 에이전트가 넘긴 문구에 그 두 글자가 있으면 줄바꿈이 된다. `/api/messages/send` 도 똑같이 동작한다

## Out of Scope (logged in BUILD-LOG)

- KG-13 — 수납 안내 알림톡 실제 발송 (템플릿 등록 필요, 지금은 부르는 화면 없음)
- KG-14 — `attendance-service.ts:7-20` 에 단가 상수와 바이트 계산이 따로 있다. 값은 같다
