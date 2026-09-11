# Review Feedback — Steps 3~8 (배포 후 검토)
*Written by Reviewer. Read by Builder and Architect.*
Date: 2026-09-12
Ready for Builder: NO → **Must Fix 3건은 같은 날 반영·배포함 (Arch)**

롤백은 권하지 않는다. 되돌리면 KG-12(미승인 리포트 토큰 발급)·KG-15(잔액 음수)·KG-16(크레딧만 빠지는 기출 분석)이 도로 열린다.

## Must Fix → 반영 완료
1. `lib/services/attendance-service.ts` — 잔액 예약 뒤 발신번호가 없으면 환원 없이 실패. 발신번호 미등록 학원은 등원마다 19원씩 잃는다 → **발신번호 확인을 예약보다 앞으로** ✔
2. `lib/services/message-service.ts` — 예약과 솔라피 호출 사이의 `MessageRepository.insert` 가 던지면 환원·로그 없이 잔액만 사라진다. 게다가 청구서 도구는 「차감되지 않았습니다」라고 답한다 → **insert 를 try/catch 로 감싸 환원 후 실패 반환** ✔
3. `app/api/exams/route.ts` — 차감은 `deductAiCredit`(무제한 학원은 차감 안 함), 환불은 무조건 100P → 무제한 패스 학원에 없던 크레딧이 생긴다 → **실제 차감된 경우에만 환불**(`isUnlimited` 확인) ✔

## Should Fix → 반영
- 잔액 부족 문구를 예약 실패 후 다시 읽은 값으로 ✔
- 발송 실패 시 이력 cost 0 (출결·단체 양쪽, `updateAfterSend` 에 cost 파라미터 추가) ✔
- 환원 금액은 `reservedCost` 사용 (폴백에서 `cost` 가 바뀐다) ✔
- 폴백 차액으로 잔액이 음수가 되면 경고 로그 ✔
- 없는 리포트 id 도 403 (존재 여부 노출 차단) ✔
- `ReportViewClient` 의 `student_id` 필드 선언 제거 (allowlist 에서 빠졌다) ✔
- `claude-client` mime 판별이 PDF 를 jpeg 로 보내던 것 → 명확한 오류로 막음 ✔
- 기출 분석 결과 문항 0개면 실패로 보고 환불 ✔

## Should Fix → 남김
- `lib/services/attendance-service.ts` `if (result)` 죽은 분기 — 항상 참이라 돈이 새지 않는다. 다음에 이 파일을 만질 때 정리
- 랜딩의 AI 단가 표기(「50원」 vs 코드 단위 P) — 충전 보너스가 붙으면 실지불이 더 낮다. 한 줄 주석을 붙일지 검토

## Escalate to Architect → Arch 결정
- **Groq 모델 목록을 코드에 박는 문제** → 지금은 박아 두되, `AGENT_MODEL` 환경변수도 허용 목록 검사를 거치게 했다(환경변수에 단종 모델이 들어가면 폴백까지 죽던 것). 기동 시 `/models` 조회는 넣지 않았다 — 매 요청 지연·호출 실패 시 동작이 불분명해진다. 대신 모델이 죽으면 챗이 멈추므로, 정찰(scout)에 「에이전트 챗 응답 실패」 규칙을 넣는 것을 다음 후보로 남긴다
- **KG-17 환불 정책** — 사람이 요청하는 환불(충전 잔액·이용권 중도 해지) 기준은 여전히 없다. 원장이 정해야 약관에 넣는다

## Cleared
- Step 5 — 토큰 발급 승인 확인, 판정식 일치, 길이 확인 + `timingSafeEqual`, 만료값 없는 토큰 차단, allowlist 가 보기 화면·PDF 출력부가 쓰는 필드를 모두 포함
- Step 6 — 약관의 「예상 문제·재출제는 이용권과 무관하게 차감」이 코드(`deductAiCreditForced`)와 일치, 재출제 20P 일치, 「평생」 제거·KST 표기
- Step 3 — 설정 화면 19·24·61원이 `message-cost` 계산과 일치, 수납 발송이 「보냈다」고 하지 않음, 플랫폼 발신번호 폴백 제거
- Step 4 — 랜딩 숫자 전부 출처 있음(unitCost·credit-costs·AiCreditCharge), 지어낸 숫자 0건, 특허·「평생 무료」 0건
- Step 8 — 조건부 UPDATE + RETURNING 으로 동시 발송에 음수 없음. 충전·관리자 경로는 무관
