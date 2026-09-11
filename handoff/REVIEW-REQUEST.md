# Review Request — Step 1
*Written by Builder. Read by Reviewer.*

Ready for Review: YES

---

## What Was Built

Step 0 에서 리뷰 없이 배포한 아이로그(ilog.ai.kr) 공개 문구의 사후 리뷰다. 저장소는 `C:\dev\자동피드백생성기` (커밋 75fed16, 75affa9).
학원 운영 가이드 5편(`/guide`)을 새로 만들었고, 홈 FAQ·JSON-LD·llms.txt 의 요금·전달 방식 문장을 코드 사실에 맞게 고쳤다.
이 문장들은 AI 답변에 그대로 인용된다. **가장 중요한 검사는 문장 하나하나가 아이로그 코드와 맞는지다.** 틀린 요금·기능이 하나라도 있으면 Must Fix.

## Files Changed

모든 경로는 `C:\dev\자동피드백생성기\` 기준.

| File | Lines | Change |
|---|---|---|
| `lib/guides.ts` | 전체 | 가이드 5편 본문. 머리 주석에 사실 출처 파일 목록 |
| `components/seo/Faq.tsx` | 14-45 | 홈 FAQ 5개 답 — 알림 건당 유료, 리포트는 선생님이 카톡 공유·이메일 |
| `components/seo/JsonLd.tsx` | 17-175 | description·offers·featureList·FAQ 답을 코드 사실로 |
| `public/llms.txt` | 전체 | 요금표·기능·가입·맞지 않는 경우·가이드 링크 |
| `app/page.tsx` | 230, 296, 436-437 | 출결 알림 문구, 리포트 전달 문구, 「96%」 → 「50원 / AI 수업 피드백 1건」 |
| `app/features/page.tsx` | 94, 111, 193 | 「3초만에」「평균 8초」 제거, 가입 승인 문구 |
| `app/layout.tsx` | 20-27 | 메타 제목·설명 |
| `app/guide/[slug]/page.tsx`, `app/guide/page.tsx`, `components/guide/*` | 전체 | 가이드 화면·JSON-LD(Article·FAQPage·BreadcrumbList) |
| `proxy.ts`, `lib/cited-bots.ts` | 전체 | AI 크롤러 방문 기록 (봇일 때만, CITED_CRAWL_KEY 없으면 무동작) |

사실 대조에 쓸 코드 (가이드 머리 주석과 같음):
- 요금·크레딧: `lib/ai/credit-costs.ts`, `components/billing/AiCreditCharge.tsx`, `app/dashboard/billing/page.tsx`
- 출결·발송비: `lib/services/attendance-service.ts`, `app/attendance-keypad/page.tsx`, `app/api/attendance/keypad/check/route.ts`
- 리포트: `app/api/feedback/generate/route.ts`, `lib/ai/groq-client.ts`, `app/dashboard/reports/[id]/page.tsx`, `app/api/reports/[id]/generate-token/route.ts`
- 시험: `app/api/exams/route.ts`, `lib/ai/exam-postprocess.ts`, `lib/exams/pdf-generator.tsx`
- 가입: `app/api/auth/register/route.ts`, `auth.ts`

## Open Questions

- 가이드의 계산 예시(학생 50명·22일 → 알림톡 41,800원, 피드백 240건 12,000원 등)는 코드 단가로 계산한 것이다. 산수와 전제가 맞는지
- 「결석을 따로 표시해 알리지 않습니다」「QR 없음」「학부모 온라인 결제 없음」 — 없다는 주장이 코드와 맞는지
- 「충전한 뒤의 출결부터 다시 발송」 — 잔액 부족 시 동작
- 「리포트 링크는 만든 뒤 7일」 — 토큰 생성 시점 기준인지
- proxy.ts matcher 가 인증·API 경로에 영향이 없는지

## Known Gaps Logged

KG-1~KG-5 (handoff/BUILD-LOG.md)
