# Review Feedback — Step 8 에이전트 회사 (3차, HEAD 59face4)
Date: 2026-09-17
Ready for Builder: YES

## Must Fix
없음.

## Should Fix
- `web/lib/task-actions.ts` resolveNaverAttempt — 「올라가 있음」을 번호 없이 누르면 조용히 return 한다. 원장은 저장된 줄 안다. 일감 상태는 그대로라 안전하다. 화면에 「글 번호를 넣어야 합니다」를 띄우거나 input 에 `required pattern` 을 단다.
- 이전 차수의 남은 권고: review 에서 `notes.원문` 을 본문 update 와 같은 문장에서 저장, revertDraft 버튼 옆 경고 문구.

## Escalate to Architect
없음.

## Cleared
2차 필수 3건을 확인했다.
- 발행 클릭 직전 표지와 timeout 은 사람 대기로 간다. 멈춘 naver-attempt 는 3시간 뒤 사람 대기로 간다.
- finishTask 는 naver-attempt 를 제외한다. resolveNaverAttempt 는 guard 를 거치고 logNo 를 필수로 받는다. 기존 값을 덮지 않는다.
- write-news 는 `returning slug` 로 저장을 확인한 뒤에만 DRAFT_SLUG 를 찍는다.
1차 필수 1~4 와 합쳐 Step 8 을 통과시킨다.
