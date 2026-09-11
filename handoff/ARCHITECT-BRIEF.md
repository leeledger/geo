# Architect Brief
*Written by Architect. Read by Builder and Reviewer. Overwrite each step.*

---

## Step 3 — 아이로그 발송이 말과 돈이 맞게 한다 (KG-7, KG-8, KG-9)

저장소: `C:\dev\자동피드백생성기`.

### 지금 문제 (Arch 확인, 2026-09-11)
- **KG-8 에이전트 문자 두 개가 잔액을 안 빼고, 플랫폼 번호로 나간다**
  - `lib/agent/tools.ts:1668-1716` `sendTuitionInvoice` — `a.solapi_sender || process.env.SOLAPI_SENDER` 로 발신, `sendSMS` 직접 호출, 차감·로그 없음
  - `lib/agent/tools.ts:1768-1818` `sendSmsToParents` — 같은 구조. 게다가 `sendSMS` 는 실패해도 던지지 않고 `{ success:false }` 를 돌려주는데(`lib/services/message-service.ts:235-241` 참고) try/catch 로만 세서 실패도 「성공」으로 센다
  - 정상 경로는 이미 있다: `sendOneMessage(input)` (`lib/services/message-service.ts:141-267`) — 잔액 확인·로그·차감·실패 처리를 다 한다. 발신번호는 `getAcademyMessagingConfig(academyId).senderPhone` (`:375-410`, 컬럼 `alimtalk_sender_phone`)
- **KG-7 수납 발송 버튼이 안 보내면서 보냈다고 답한다**
  - `app/api/tuition/invoices/[id]/send/route.ts:53-72` — 상태만 `sent`, `sent_method` 는 `'alimtalk'` 로 기록, 응답 「수납 안내 알림톡이 발송되었습니다.」, `alimtalkSent: true`. 실제 발송 코드는 `:63` TODO
  - 수납 안내용 알림톡 템플릿이 없어서 지금은 보낼 수 없다
- **KG-9 설정 화면 건수 계산만 부가세 전 단가**
  - `app/dashboard/settings/page.tsx:766-772` — `alimtalkBalance / 17`, `/ 22`, 「(17원)」「(22원)」. 실제 차감은 19·24원(`message-service.ts:35-45`, `attendance-service.ts:213`)
  - 같은 파일 `:799-800` 과 `app/dashboard/attendance/charge/page.tsx:238-240` 의 「건당 17원 (VAT 별도)」는 맞는 말이라 두고 간다

### Decisions
- 에이전트 두 도구는 `sendOneMessage` 로 보낸다. 채널 `'SMS'`(바이트가 넘으면 서비스가 LMS 로 계산), 발신번호는 `getAcademyMessagingConfig` 의 `senderPhone` 만. **`process.env.SOLAPI_SENDER` 폴백은 없앤다** — 학원 번호가 없으면 「발신번호가 없습니다. 설정에서 등록하세요」 오류
- 결과는 `sendOneMessage` 의 `success` 로 센다. 응답에 성공·실패 수와 차감 금액 합계를 넣는다. 잔액 부족은 실패로 세고 이유를 보여 준다
- `messageType` 은 청구서 `'tuition'`, 일반 `'notice'`. `studentId`·`recipientName` 을 채운다. `templateBody` 에 완성된 문장을 넣고 `variables: {}`
- 수납 발송 라우트는 **보내지 않는 것을 정직하게 말한다.** `sent_method = 'manual'`, 응답 「수납 안내 상태로 바꿨습니다. 알림톡 자동 발송은 아직 지원하지 않으니 학부모 연락은 따로 해 주세요.」, `alimtalkSent: false`. 실제 발송 구현은 템플릿 등록이 필요해 이번 범위 밖(Known Gaps)
- 설정 화면 건수는 19·24원으로 나누고 「(부가세 포함 19원)」「(부가세 포함 24원)」. 숫자는 `calculateCost` 와 같은 식에서 오게 — 상수를 새로 흩뿌리지 않는다(가능하면 `message-service.ts` 에서 export 된 계산을 쓴다. 클라이언트 번들에 db import 가 딸려 오면 안 되니, 안 되면 한 곳에 상수 파일을 만든다)
- 에이전트 확인 문구(`app/api/agent/chat/route.ts:312-313`)에 「발송 잔액에서 건당 24원(긴 문자 61원)이 빠집니다」를 붙인다

### Build Order
1. `lib/agent/tools.ts` — `sendTuitionInvoice`, `sendSmsToParents` 를 `sendOneMessage` 경유로
2. `app/api/agent/chat/route.ts:312-313` — 확인 문구에 비용
3. `app/api/tuition/invoices/[id]/send/route.ts` — 정직한 응답, `sent_method`
4. 수납 화면이 `alimtalkSent`·`message` 를 어떻게 쓰는지 grep 해서 문구가 어긋나지 않게
5. `app/dashboard/settings/page.tsx:766-772` — 건수·단가 표기
6. `npm run build`

### Flags
- Flag: `sendOneMessage` 는 알림톡이면 `pfId`·`templateId` 가 필요하다. 이번엔 SMS 만 쓴다
- Flag: 에이전트 도구는 확인을 거친 뒤 실행되는 쓰기 도구다. 확인 흐름은 바꾸지 않는다
- Flag: DB 스키마를 바꾸지 않는다
- Flag: 학부모에게 실제 문자를 보내는 테스트를 하지 않는다. 빌드와 코드 경로로만 확인

### Definition of Done
- [ ] 두 에이전트 도구에 `process.env.SOLAPI_SENDER`·직접 `sendSMS` 호출이 없다
- [ ] 발송 결과 수가 `sendOneMessage().success` 기준이다
- [ ] 수납 발송 응답이 「발송되었습니다」라고 하지 않는다
- [ ] 설정 화면 건수가 19·24원 기준이다
- [ ] `npm run build` 성공

### Known Gaps 로 넘길 것
- 수납 안내 알림톡 실제 발송 (템플릿 등록 필요)
