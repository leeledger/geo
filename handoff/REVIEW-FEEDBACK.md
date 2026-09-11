# Review Feedback — Step 1 (재검토)
*Written by Reviewer. Read by Builder and Architect.*
Date: 2026-09-11
Ready for Builder: YES

모든 경로는 `C:\dev\자동피드백생성기\` 기준. `git diff` 기준(6 files).

## Must Fix
없음. 지난 Must Fix 6건 전부 해소 — 새 문장마다 코드 줄 재대조.
- MF1 무제한 패스 차감 여섯 곳 — `lib/ai/billing.ts:8`, `exams/route.ts:148,270-271`
- MF2 이메일 본문·카카오 7일 — `email-template.ts` href/<a/token 0건, `send/route.ts:200,207`, `dashboard/reports/[id]/page.tsx:183`
- MF3 발신번호 문장 삭제 — `SenderIdRegister.tsx:215,264`
- MF4 청구 알림 삭제 — `tuition/invoices/[id]/send/route.ts:53-63`
- MF5 카카오 채널 버튼 — `ParentPortalClient.tsx:314,316,344`
- MF6 등원·하원 동시 발송 — `attendance-service.ts:122,162-164`, `keypad/check/route.ts:79`, `dashboard/attendance/page.tsx:239`

## Should Fix (Arch 가 배포 전에 반영함)
- `components/seo/JsonLd.tsx:105` 잔액 둘 누락 → 「발송 잔액과 AI 크레딧은 따로 충전합니다」 추가 ✔
- `lib/guides.ts:142` 「어떤 알림을 보낼지」 → 「알림톡으로 보낼지 문자로 보낼지 정하고 비교하세요」 ✔
- `lib/guides.ts:256` 닫는 `],` 줄바꿈 ✔
- REVIEW-REQUEST 의 KG-10 서술 불일치 → 배포 커밋에 `deliverables/ilog/proxy.ts` 포함 ✔

## Escalate to Architect → Arch 결정
- 매처 `.txt|.xml|.json` 유지 — Richard 도 Bob 이 옳다고 봄. 확정 (BUILD-LOG)
- 「코딩 학원에서 시작한 서비스」(`guides.ts:59`, `llms.txt:62`) — 코드로 증명 불가 → 문장 삭제 ✔
- 「평생 무료」·약관 종량제, 무제한 패스 출제 제외 의도 — 원장 결정 대기. KG-6~9 는 Step 2·3

## Cleared
Must Fix 6건 새 문장, Should Fix 2~7, proxy.ts(IP 첫 값, 이미지·영상 제외, api 제외, 인증 무관), 고친 문단 9개 126~199자, 전달 폴더 복사본 cmp 동일. 빌드는 Bob 통과 + Arch 배포 전 재빌드.

Step 1 is clear.
