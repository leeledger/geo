# Build Log
*Owned by Architect. Updated by Builder after each step.*

---

## Current Status

**Active step:** 없음 — Step 1~8 배포 완료. 남은 것: 네이버 소유확인 캡차와 이관 35편(사람 일), Known Gaps 잔여분(KG-2·13·17·19). 주간 글쓰기는 `gemini-3.6-flash` 로 월 0원에 돈다(월 06:07 KST, 초안까지만 · 발행은 사람)
**Last cleared:** Step 0 — 2026-09-11 (설치 이전 작업 기록)
**Pending deploy:** NO

---

## Step History

### Step 0 — 설치 이전에 배포된 작업 (Three Man Team 없이 진행) — COMPLETE
*Date: 2026-09-11*

Richard 리뷰 없이 나간 작업이다. 다음에 이 영역을 만질 때 Richard 가 한 번 본다.

- 대시보드 「오늘 한 일」 — `web/lib/brief-core.mjs`, `web/lib/brief.ts`, `web/app/admin/ops/Brief.tsx`, `academy/scripts/daily-brief.mjs`, `.github/workflows/watch.yml` (커밋 e8e7208)
- 새 랜딩 — `web/app/page.tsx`, `HeroDemo`·`RecordTabs`·`PriceCalc`·`FlowSteps`·`Faq`, `landing.css` (커밋 78a9580)
- 케이스 리포트 재생성 — `web/public/case/academy.html` (커밋 20e3b03)
- 아이로그 2차 전달분 반영·배포 — 아이로그 저장소 75fed16 (proxy.ts 크롤러 기록, IndexNow 키, 이름 구분, FAQ, 제목)
- 아이로그 학원 운영 가이드 5편 + 요금·전달 방식 문구를 코드 사실에 맞춤 — 아이로그 저장소 75affa9, 사이티드 b261207

Decisions made:
- 가이드 요금·기능 문장의 출처는 `lib/guides.ts` 머리 주석의 파일들 (아이로그 저장소)

Reviewer findings: 없음 (리뷰 전)
Deploy: confirmed — 운영 주소에서 확인

### Step 1 (재작업) — 아이로그 공개 문구를 Richard 리뷰대로 코드 사실에 맞춤 — COMPLETE
*Date: 2026-09-11*

저장소 `C:\dev\자동피드백생성기`, 커밋 안 함. `git diff` 6 files +38 −34. `npm run build` 통과.

Files changed:
- `lib/guides.ts` — 44, 51, 59, 66, 75, 124, 153, 203, 213, 255-256, 275-276, 284, 298, 302, 348
- `components/seo/JsonLd.tsx` — 49-51, 125, 144-145
- `components/seo/Faq.tsx` — 18, 28
- `public/llms.txt` — 24, 27, 28, 32, 40, 62
- `app/page.tsx` — 230
- `proxy.ts` — 12, 14, 20-22, 42
- 사이티드 `deliverables/ilog/public/llms.txt`, `app/JsonLd.tsx`, `app/Faq.tsx` — 복사본 갱신(cmp 동일)

Decisions made:
- 무제한 패스 문장은 「예상 문제 출제와 다시 뽑기(1문항 20원)는 패스가 있어도 차감됩니다」 — 다시 뽑기도 `deductAiCreditForced` (`exams/route.ts:271`)
- 리포트 승인 조건은 카카오 공유에만 적음 — 이메일 발송 라우트에는 `is_approved` 검사가 없다
- 키패드는 자동 제출이 없어 「번호 4번, 확인 1번」 (`attendance-keypad/page.tsx:26-30,183`)
- 과목 이름은 삭제. 80자 미만이 되는 문단(`guides.ts` ai-class-report 둘째 문단)은 첫 문단에 합침
- proxy 매처는 이미지·영상 확장자만 제외, `.txt|.xml|.json` 은 남김 — llms.txt·robots.txt·sitemap.xml 크롤러 기록 유지. Arch 결정 요청(REVIEW-REQUEST Open Question 1)

Reviewer findings: 1차 Must Fix 6 → 재검토 통과(Step 1 is clear). Should Fix 3건(JsonLd 잔액 둘, guides:142 알림 선택 문장, guides:256 줄바꿈)은 Arch 가 배포 전 반영. 「코딩 학원에서 시작한 서비스」는 코드로 증명 못 해 삭제
Deploy: confirmed 2026-09-11 — 아이로그 커밋 0c1b6d4, `npx vercel --prod`. 운영에서 llms.txt 패스 차감 문장·청구 알림 0·홈 잔액 둘·가이드 이메일 본문 문장 확인, /auth/login 200

### Step 2 — [보안] 아이로그 공개 리포트를 링크 가진 사람만 열게 한다 (KG-6) — IN REVIEW
*Date: 2026-09-11*

저장소 `C:\dev\자동피드백생성기`, 커밋 안 함. `git diff` 4 files +78 −39 + 새 파일 1(60줄). `npm run build` 통과.

Files changed:
- `lib/reports/view-access.ts` — 새 파일 1-60. `checkReportViewAccess` → `'ok' | 'forbidden' | 'expired'`
- `app/api/reports/[id]/public/route.ts` — 5, 7-8, 45-62, 133-139
- `app/api/parent-portal/[academy]/[slug]/content/route.ts` — 281
- `app/reports/[id]/view/ReportViewClient.tsx` — 50-51, 61-67, 82
- `app/reports/[id]/view/page.tsx` — 3, 9, 12-25, 27-29, 34-36, 46-65, 68

Decisions made:
- 열람은 (a) 토큰 일치+만료 전 또는 (b) 포털 증명(포털 켜짐·같은 학생·승인). 토큰부터 보고 맞으면 포털 조회를 안 한다
- 410 은 토큰이 **맞았는데** 만료일 때만. 틀린 토큰은 행이 만료여도 403
- `token_expires_at` null + 토큰 일치는 기존대로 ok (Open Question 1)
- 응답 필드 제거는 route 안 `PRIVATE_REPORT_FIELDS` 필터 — 판단 함수는 행을 바꾸지 않는다
- 조건 불충족 메타데이터는 기존 catch 문구 「학습 리포트 - 아이 로그」 — 학원명도 뺌 (Open Question 3)
- robots noindex 는 generateMetadata 의 모든 반환에 (metadata export 와 같이 못 씀)
- 순수 로직은 Node strip-types + `@/lib/parent-auth` 스텁 로더로 실제 모듈 20건 확인, 파일 삭제

Reviewer findings: Richard — Must Fix 0, Step 2 is clear. Should Fix: 만료값 없는 토큰이 영구로 열림 → Arch 가 `view-access.ts:44` 에서 막음(만드는 코드 없음, 깨질 링크 0). 응답 denylist → KG-11. Escalate: 승인 전 리포트도 토큰 링크로 열림 → KG-12(원장 정책)
Deploy: confirmed 2026-09-11 — 아이로그 커밋 4ca23e8, `npx vercel --prod`. 운영에서 실제 리포트 id 로 토큰 없음 403 · 틀린 토큰 403 · 없는 id 404 확인 (응답 본문은 받지 않음)

### Step 3 — 아이로그 발송이 말과 돈이 맞게 한다 (KG-7, KG-8, KG-9) — IN REVIEW
*Date: 2026-09-12*

저장소 `C:\dev\자동피드백생성기`, 커밋 안 함. `git diff` 5 files +91 −85 + 새 파일 1(42줄). `npm run build` 통과. 실제 문자·DB·Solapi 호출 없음.

Files changed:
- `lib/services/message-cost.ts` — 새 파일 1-42. `getByteLength`·`unitCost`·`calculateCost` (import 없음, 클라이언트에서 써도 됨)
- `lib/services/message-service.ts` — 18, 20-21. 계산을 message-cost 에서 가져와 re-export (기존 import 경로 유지)
- `lib/agent/tools.ts` — 5, 598, 1668-1734 (`sendTuitionInvoice`), 1787-1852 (`sendSmsToParents`)
- `app/api/agent/chat/route.ts` — 6, 314, 318
- `app/api/tuition/invoices/[id]/send/route.ts` — 6-8, 32-35, 51-64
- `app/dashboard/settings/page.tsx` — 11, 767-768, 772-773

Decisions made:
- 단가는 새 파일 `message-cost.ts` 한 곳. 설정 페이지는 `'use client'` 라 db 를 끌고 오는 message-service 를 못 가져온다
- 두 도구 발신번호는 `getAcademyMessagingConfig().senderPhone` 만. 없으면 「발신번호가 없습니다. 설정에서 등록하세요.」
- 문자 여러 건 보내기: 성공 수·실패 수·차감 합계(`cost`)·실패 사유별 건수(`fail_reasons`). 한 건이 예외를 던져도 반복은 계속하고 「처리 중 오류」 실패로 센다 (원래 오류 문구는 안 보냄)
- 청구서 도구는 학원명을 config 의 `academyName` 에서 가져온다 — academies 조인과 `solapi_sender` 컬럼 참조 제거. 납부기한 날짜에 `timeZone: 'Asia/Seoul'`
- 비용 확인 문구는 `send_sms` 에도 붙임 (brief 는 312-313 만 지목)
- 수납 발송 라우트는 `status` 만 조회. `tuition_alimtalk_enabled`·`parent_phone` 은 안 쓰게 돼서 SELECT 에서 뺌
- `attendance-service.ts` 는 안 건드림 — 같은 상수·바이트 계산을 따로 갖고 있음 (KG-14)

Reviewer findings: Richard — Must Fix 2(여러 건 문자 결과에 차감액·사유 없음·전원 실패도 성공, 청구서 실패 시 JSON 원문), Should Fix 5. 재작업은 Bob 세션 한도로 중단 → Arch 가 마무리(REVIEW-REQUEST 참조). 리뷰어 한도 풀리면 diff 로 재검토
Deploy: confirmed 2026-09-12 — 아이로그 커밋 26de039, `npx vercel --prod`. 운영 `/` 200 · `/auth/login` 200. 실제 문자 발송 시험은 안 함(돈이 나간다) — 코드 경로·빌드·타입으로 확인

### Step 4 — 아이로그 랜딩 개편 이식 (원장 지시: 피드백 자동화·관리 편의) — COMPLETE
*Date: 2026-09-12*

시안 `design/ilog-landing/Main.dc.html`·`Mobile.dc.html` → 아이로그 커밋 9dcbf24.

Files changed:
- `app/page.tsx` — 전면 재작성(시안 구성). PWA 설치·iOS 안내·standalone 이동·스크롤 진행바 유지
- `app/features/page.tsx` — 첫 섹션 문구를 코드 사실로(KG-4 해소), 빈 데모 영상 3개 제거
- `components/features/FeatureSection.tsx` — `video` 선택적, 없으면 영상 칸을 안 그리고 1열로

Decisions made:
- 「평생 무료」 안 씀 (증명 불가한 영구 약속) → 「기본 관리 무료 · 학생 수 제한 없음」
- 별도 작업 트리(`C:\dev\ilog-step4`)는 Turbopack 이 node_modules 정션을 거부해 빌드 불가 → main 트리로 옮겨 마무리하고 worktree·브랜치 삭제
- 확인용 스크린샷은 등장 효과(whileInView) 때문에 빈 화면으로 찍힌다 → CSS 로 전부 보이게 덮어쓰고 촬영

Reviewer findings: Bob 이 이식 중 세션 한도로 중단 → Arch 가 마무리·자체 점검(1440·390 시안 대조, 가로 넘침 0, 빠진 구역 0, 특허·평생무료 0). 리뷰어 한도 풀리면 `git show 9dcbf24` 재검토
Deploy: confirmed 2026-09-12 — `npx vercel --prod`. 운영 홈 200, 4단계·요금 구역 확인, 특허 0건, 기능 페이지 「사진만 올리면」 0건

### Step 5 — [보안 2] 승인한 리포트만 토큰 발급 · 공개 응답 allowlist (KG-11, KG-12) — COMPLETE
*Date: 2026-09-12*

아이로그 커밋(아래 Deploy). Bob·Richard 는 세션 한도로 못 돌아 Arch 가 짓고 자체 점검했다.

Files changed:
- `app/api/reports/[id]/generate-token/route.ts` — SELECT 에 `fr.is_approved`, 권한 확인 뒤 승인 확인(미승인 403 「승인한 리포트만 공유할 수 있습니다.」)
- `app/api/reports/[id]/public/route.ts` — denylist → allowlist. 리포트 10개 필드 + 활동 9개 필드만. `pick()` 헬퍼

Decisions made:
- allowlist 기준은 보기 화면이 실제로 읽는 값 (`ReportViewClient.tsx` 를 grep: 이름·기간·요약·수업 횟수·활동·축·직전 축)
- `student_id`·`teacher_id`·`academy_id`·`pdf_path`·`sent_to_parent`·`teacher_edited` 는 응답에서 빠진다
- 열람 판단(view-access)의 토큰 경로는 그대로 — 발급을 막으면 새 링크가 안 생기고 기존 링크는 안 깨진다

Reviewer findings: (한도 풀리면 커밋 diff 재검토)
Deploy: confirmed 2026-09-12 — 아이로그 커밋 e7fa3db, `npx vercel --prod`. 운영에서 실제 리포트 id 로 토큰 없음 403 · 틀린 토큰 403 · 없는 id 404 (응답 본문은 받지 않음)

### Step 6 — 약관·결제 화면을 실제 요금 구조에 맞춤 (KG-1) — COMPLETE
*Date: 2026-09-12*

Files changed: `app/terms/page.tsx`(상단 개정 안내·제5조 목록·제6조 4항·제10조/제11조 정리·부칙), `components/billing/AiCreditCharge.tsx`(AI_COSTS 단가·환산, 「평생」 표기 제거, 이용권 설명에 예상 문제 별도 차감)

Decisions made:
- 무제한 패스에서 예상 문제 출제 제외는 의도된 정책으로 둔다 (`lib/ai/billing.ts:8-9` 주석) — 대신 화면·약관에 적는다
- 환불 조항은 근거가 없어 새로 만들지 않는다 → KG-17
- 약관 개정은 이용자에게 유리한 변경. 제3조 공지 절차대로 9.12 공지·9.19 시행으로 적었다

Reviewer findings: (한도 풀리면 커밋 diff 재검토)
Deploy: confirmed 2026-09-12 — 아이로그 커밋 dfe9bc0. 운영 `/terms` 200, 개정 안내 보임, 「종량제」·「납부를 지연」 0건

### Step 7 — 기출 분석을 Claude Vision 으로 · 실패 시 환불 (KG-16) · 에이전트 챗 모델 (KG-3) — COMPLETE
*Date: 2026-09-12*

Files changed:
- `lib/ai/claude-client.ts` — `analyzeExamPaper` 추가 (Claude Vision, 5장씩 배치, base64 앞부분으로 mime 판별, JSON 파싱·코드펜스 제거). 출력 모양은 기존 저장 코드와 동일
- `app/api/exams/route.ts` — 분석 호출을 claudeClient 로, 실패 시 `chargeAiCredit` 로 100P 환불 + `ai_analysis_status='failed'` + 원본 이미지 유지 + 사용자 문구(502)
- `lib/ai/groq-client.ts` — 기존 `analyzeExamPaper` 에 @deprecated
- `app/api/agent/chat/route.ts` — 기본 모델 `openai/gpt-oss-120b`, 허용 목록을 9.12 조회 결과로

Decisions made:
- Groq 모델 목록을 직접 조회해서 판단했다(비전 0개, llama-3.3·llama-3.1 없음). 추측하지 않는다
- 실패해도 원본 base64 를 지우지 않는다 — 지우면 재시도가 불가능해진다
- 실제 Claude 호출 시험은 하지 않았다(과금·저작권 이미지). 다음에 원장이 기출을 올리면 그때 확인한다

Reviewer findings: (한도 풀리면 커밋 diff 재검토)
Deploy: confirmed 2026-09-12 — 아이로그 커밋 1d18f79. 운영 `/` `/terms` `/guide` 200

### Step 8 — 발송 잔액 예약·환원 (KG-15) · 단가 단일화 (KG-14) — COMPLETE
*Date: 2026-09-12*

Files changed:
- `lib/services/message-service.ts` — 잔액 확인+차감을 한 쿼리(조건부 UPDATE ... RETURNING)로 예약, 실패 시 환원, 알림톡→문자 폴백은 차액만 반영
- `lib/services/attendance-service.ts` — 같은 방식으로 예약·환원(실패 분기와 catch 둘 다), 단가·바이트 계산을 `message-cost` 에서 import (로컬 상수 삭제)

Decisions made:
- 예약(선차감) 방식으로 간다 — 보내기 전에 깎고 못 보내면 돌려준다. 확인 후 차감은 동시 발송에서 음수가 된다
- 이미 보낸 뒤의 폴백 차액은 조건부로 막지 않는다(되돌릴 수 없다). 실패하면 로그만 남긴다
- 실제 발송 시험은 하지 않았다 — 문자 한 건이 곧 돈이다. 잔액 쿼리 6곳을 훑어 예약·환원 쌍을 확인했다

Reviewer findings: (한도 풀리면 커밋 diff 재검토)
Deploy: confirmed 2026-09-12 — 아이로그 커밋 65be615. 운영 `/` `/auth/login` `/guide/ai-class-report` 200

### 후속 — Richard 배포 후 검토의 Must Fix 3건 (돈 새는 길) — COMPLETE
*Date: 2026-09-12*

Richard 가 Step 3~8 을 배포 후 검토해 돈이 새는 경로 셋을 찾았다. 롤백은 권하지 않았다(되돌리면 KG-12·15·16 이 다시 열린다).

Files changed: `lib/services/attendance-service.ts`, `lib/services/message-service.ts`, `lib/repositories/message-repository.ts`, `app/api/exams/route.ts`, `lib/ai/claude-client.ts`, `app/api/reports/[id]/public/route.ts`, `app/reports/[id]/view/ReportViewClient.tsx`, `app/api/agent/chat/route.ts`

- MF1 출결: 잔액을 예약한 뒤 발신번호가 없으면 환원 없이 실패 → 발신번호 확인을 예약보다 앞으로. 미등록 학원은 등원마다 19원씩 잃고 있었다
- MF2 문자: 예약과 발송 사이의 로그 INSERT 가 던지면 잔액만 사라졌다(게다가 화면에는 「차감되지 않았습니다」) → 환원 후 실패 반환
- MF3 기출 분석: 무제한 패스 학원은 차감이 없는데 실패 시 100P 환불 → 없던 크레딧이 생겼다. 실제 차감된 경우에만 환불. 문항 0개도 실패 처리
- 그 밖(Should Fix): 잔액 부족 문구 최신값, 실패 이력 cost 0, 환원 금액은 reservedCost, 폴백 차액 음수 경고, PDF/정체불명 이미지 차단, 없는 리포트 id 도 403, AGENT_MODEL 환경변수 목록 검사

Decisions made:
- Groq 모델 목록은 코드에 두되 환경변수도 검사한다. 기동 시 `/models` 조회는 넣지 않는다(요청 지연·실패 시 동작 불명) — 대신 정찰에 「에이전트 챗 응답 실패」 규칙을 넣는 것을 다음 후보로
- `if (result)` 죽은 분기는 남긴다(항상 참이라 돈이 새지 않음). 다음에 이 파일을 만질 때 정리

Reviewer findings: Must Fix 3 + Should Fix 다수 → 반영. 남긴 것 2건은 위 Decisions
Deploy: confirmed 2026-09-12 — 아이로그 커밋 cfbe688. 운영에서 없는 리포트 id 403(이전 404), 홈·가이드 200

### 후속 — 아이로그 색인 알림과 죽은 분기 정리 — COMPLETE
*Date: 2026-09-12*

브리핑이 아이로그 노출 경쟁 0/6 · 브랜드 0/3 을 계속 찍는다. 글이 없어서가 아니라 색인이 안 됐다.
robots.txt 는 봇을 다 허용하고 사이트맵에 10쪽이 다 올라 있다 — 알리지를 않았다.

- IndexNow 로 10쪽 전부 알렸다. Bing 200 · Naver 200 (키 파일 확인 후 전송)
- 구글은 IndexNow 에 참여하지 않아 Search Console 경로로 따로 요청
- `lib/services/attendance-service.ts` — Richard 가 남긴 `if (result)` 죽은 분기 제거.
  `result` 는 바로 위에서 객체 리터럴로 만들어 항상 참이었다. 안쪽을 한 단 끌어올렸을 뿐 동작은 그대로다

Decisions made:
- **KG-2(체험 만료)는 구현하지 않고 남긴다.** 지금 만료 검사를 켜면 `trial_ends_at` 이 없는 기존 학원이
  한꺼번에 잠긴다. 쓰고 있는 학원을 말없이 막는 일이라 코드로 정할 일이 아니다 — 원장이 기준을 정하면 넣는다
- `tools/bing-webmaster-look.mjs` 는 이름과 달리 빙 웹마스터 지표를 보지 않는다. 사이트를 직접 열어 찍을 뿐이다.
  빙 색인 확인에 쓰지 말 것

---

### 후속 — 쓰는 일에 담당을 만들고, 무료 모델로 되는지 쟀다 — COMPLETE
*Date: 2026-09-12*

자동으로 도는 넷(정찰 06:37 · 노출측정 07:41 · 스냅샷 03:23 · 감시 3시간)은 전부 「재는 일」이었다.
「쓰는 일」에 담당이 없어서 사람이 멈추면 발행도 멈췄다.

사이트 글 자체는 안 끊겼다 — 9/9 발행, 공개 43편. 진짜 막힌 곳은 네이버였다.
이관된 게 8편, 안 된 게 35편. 그런데 정찰 8개 규칙에 이걸 보는 규칙이 없어 아무도 안 알리고 있었다.

- 정찰에 네이버 이관 규칙 추가. 최근 2주 글만 잡는다 — 재고 35편으로 매일 울면 무뎌진다 (`b3ce59f`)
- 주간 글쓰기 에이전트 `academy/scripts/write-draft.mjs` + `.github/workflows/write.yml` (월 06:07 KST) (`3570523`)
- 공급자 전환 — GROQ·ANTHROPIC 중 키가 있는 쪽으로 붙는다. `WRITER_PROVIDER`·`WRITER_MODEL`·`WRITER_MAX_TOKENS` (`647cf07`)
- 초안 검사 셋: `slop-check`(어휘) · `fact-check`(숫자·없는 설문) · `draft-peek`(본문 읽기) (`d8a0df0`, `0273223`)

Groq 무료 한도로 네 번 재봤다 (전부 0원):

| | gpt-oss ① | ② | ③ | qwen3.8-27b |
|---|---|---|---|---|
| 길이 (규칙 1,800~2,800) | 1,549자 | 1,247자 | 1,203자 | 4,255자 |
| 잰 적 없는 숫자 | 4개 | 0 | 1개 | 3개 |
| 없는 설문 인용 | 1곳 | 0 | 0 | 0 |
| 훈계조 | (규칙 전) | 4곳 | 1곳 | 2곳 |
| 본문에 지역 | 없음 | 없음 | 있음 | 있음 |
| 그 밖 | | | | 한자 `几名`·`转播`, 영어 `Instead`·`or` |

무료로 쓸 수 있는 다른 곳(Cerebras·OpenRouter `:free`·Together)은 전부 **같은 오픈웨이트 모델**을 얹은 것이라
공급자만 바꿔서는 결과가 안 바뀐다. 제미나이만 종류가 다르다 — 오픈웨이트가 아닌데 무료 한도가 있다.
그래서 제미나이만 따로 쟀다.

| | gemini-3.6-flash ① | ② (숫자를 뺀 뒤) |
|---|---|---|
| 길이 | **2,346자** | 1,689자 (111자 미달) |
| 잰 적 없는 숫자 | 0 | 0 |
| 한자·영어 | 0 | 0 |
| 훈계조 | 2곳 | **0곳** |
| 짜임새 검사 | 통과 | 길이만 걸림 |

`gemini-2.5-flash` 는 신규 사용자에게 닫혀 404 가 났고, **응답 본문이 `gemini-3.6-flash` 를 쓰라고 직접 알려줬다.**
오류를 200자에서 끊고 있어서 그 문장이 잘린 채 찍혔다 — 400자로 늘렸다.

①에서 마지막 문단이 「공개한 43편의 글에서… 크롤러가 누적 659회 방문하는 동안에도」였다.
프롬프트에 「확인된 숫자」로 넣어 준 것을 글 소재로 쓴 것이다. 학부모에게는 뜻이 없는 숫자다.
**쓸 수 있다고 주면 쓴다.** 공개 글 수·크롤러 방문 수를 프롬프트에서 아예 뺐더니 ②에서 사라졌다.

Decisions made:
- **Groq 무료 모델로는 발행 못 한다.** gpt-oss-120b 는 세 번 내리 1,200~1,500자에 머물러 규칙을 못 지키고
  내용이 「검색하면 아무나 쓸 수 있는 말」이다. qwen3.8-27b 는 짜임새는 낫지만 한자·영어를 섞고
  「부모님」을 「부장님」으로 쓴다. 둘 다 사람이 고치는 게 새로 쓰는 것보다 오래 걸린다
- **무료로 간다 — 제미나이다.** `gemini-3.6-flash` 가 규칙 안에 들어온 첫 초안을 썼다.
  한국어가 깨끗하고 송파·잠실·석촌동이 억지 없이 들어갔으며, 「목록 사이트가 상단을 먹는다」로 여는 도입이
  `who-wins` 가 찾은 자리와 같다. **고치는 게 새로 쓰는 것보다 빠른 첫 초안이다.** 월 0원
- 우선순위는 **anthropic → gemini → groq**. Groq 연결도 남긴다 — 키가 없을 때 죽지 않고 도는 길이다.
  저장소 변수 `WRITER_MODEL` 은 시험 후 삭제했다
- **제미나이 무료 한도는 입력이 구글 제품 개선에 쓰인다.** 학원 블로그 초안이라 지금은 문제없지만,
  **고객사 자료는 이 경로로 보내지 않는다.** 그때는 유료 한도나 Anthropic 으로 바꾼다
- **발행은 자동으로 하지 않는다.** 초안까지다 — CLAUDE.md 「사람만 할 수 있는 일 · 발행 전 사실 확인」
- 프롬프트에 규칙을 한 줄로 끼우면 흘려 넘긴다. 「지어내지 않는다」를 제 문단으로 떼고
  나쁜 예·좋은 예를 붙이자 잰 적 없는 숫자가 4개 → 0 으로 떨어졌다. 구멍을 남기면 채운다

함정으로 남길 것:
- **slop-check 는 어휘만 본다.** 「우리 지역 30개 학원 설문에서 응답자의 40%가」를 0곳으로 통과시켰다.
  숫자·짜임새·외국어 혼입은 각각 따로 봐야 한다
- **워크플로에서 slop-check 에 슬러그를 안 주면 발행된 글만 본다.** 초안은 `published=false` 라 빠진다.
  「11편 중 0편에서 걸림」이 방금 쓴 글 얘기인 줄 알기 딱 좋다
- **마크다운 본문을 JSON 문자열에 담게 시키면 진짜 줄바꿈이 들어와 파싱이 깨진다.** 모델 탓이 아니다
- **오류 본문을 끊어 찍으면 답을 잘라 먹는다.** 두 번 당했다 — 404 는 「gemini-3.6-flash 를 쓰라」고
  적어 보냈고, 429 는 한도 종류를 담아 보냈는데 둘 다 400자에서 잘렸다. 오류는 끝까지 읽는다
- **제미나이 검색 그라운딩은 무료 등급에서 별도의 작은 한도를 쓴다.** 07:44 검색 호출 429,
  **1분 뒤 07:45 검색 없는 호출은 성공**(2,583자). 같은 키·같은 모델이다. 분당 한도도 모델 일일
  한도도 아니고 그라운딩 전용이다. 구글은 429 본문에 quotaId 를 안 담아 주고, 공식 문서도
  숫자를 안 적고 AI Studio 대시보드로 넘긴다
- **그 한도를 태운 건 시험이었다.** 주간 작업은 일주일에 검색 한 번인데 30분 안에 두 번 던졌다.
  뉴스 모드는 시험용으로 돌리지 않는다 — 고칠 게 있으면 `--dry` 로 프롬프트만 본다

---

### 후속 — 커리큘럼 글 발행과 네이버 44편 정리 — COMPLETE
*Date: 2026-09-12*

원장 지시로 학원 커리큘럼 글을 쓰고 발행했다. 영상(스탠퍼드 CS 관련)을 근거로 쓰려 했으나
자막을 못 받았다 — timedtext 가 네 형식 모두 200 에 본문 0자, 외부 자막 서비스는 403·401.
그래서 **영상 내용은 한 줄도 안 썼다.** 대신 확인되는 것만 썼다(CS146S 공식 과목 설명, 사이트 llms.txt).

거를 뻔한 것 셋. 「1년 만에 커리큘럼 85% 변경」은 확인 불가였고(검색에는 전혀 다른 85% —
2026년 졸업생의 85%가 AI 를 썼다 — 가 나온다), 「손코딩 금지」는 2차 블로그만의 주장이었다.
그리고 `engineering.stanford.edu` 「Period of transition」은 **2012년 6월 14일 기사**다.
제목만 보고 썼으면 14년 된 글을 최신 소식으로 둔갑시킬 뻔했다.

- `koding-kurikyulleom-sunseo` 발행 · 도해 2장(five-stages · grading-shift) · 2,538자
- IndexNow(Bing·네이버 200) · 구글 색인 접수 확인(`gsc-done.json` 46개)
- **네이버 44편 전부 기록. 안 된 것 0편**

**내 진단이 틀렸다.** 「35편이 밀렸다」고 여러 번 보고했는데, 그중 32편은 **이미 네이버에 있는 글**이었다.
원래 네이버에서 사이트로 가져온 글이라 `source_url` 이 전부 `blog.naver.com/force11/...` 이고,
`naver_log_no` 만 비어 있었을 뿐이다. 그대로 올렸으면 같은 내용이 두 벌 올라가
네이버 검색에서 서로 갉아먹었다. 올리는 대신 주소에서 번호를 뽑아 기록했다.
실제로 새로 올린 건 4편뿐이다.

함정으로 남길 것:
- **`check-session` 은 서치어드바이저만 본다. 블로그 세션은 별개다.** 그 판정 하나만 믿고
  「네이버 로그아웃이라 발행 불가」라고 단정해 원장에게 **불필요한 재로그인을 두 번** 요청했다.
  실제로는 로그인이 살아 있었고 9월 10일에 이미 8편을 올린 적도 있었다.
  판정을 믿지 말고 `naver-blog-post --dry` 로 실제로 들어가 보는 게 진짜 시험이다
- **`naver-blog-post` 의 `IMGDIR` 이 `path.resolve`(cwd 기준)였다.** 이 도구는 `.browser-profile`
  때문에 저장소 루트에서 도는데, 그러면 `C:/dev/academy/...` 를 뒤진다. 더 나쁜 건 조용하다는 것 —
  「그림 없음, 건너뜀」 한 줄 찍고 **사진 0장짜리 글이 그대로 올라간다.** 네이버는 이미지가 없으면 안 읽힌다
- **발행 후 `naver_log_no` 를 적는 로직이 아예 없었다.** 사람이 손으로 적고 있었고,
  한 번 빠뜨리면 다음 이관 때 중복 발행된다. 적을 때만 풀을 새로 연다 —
  위쪽 풀은 글을 읽자마자 닫고, 브라우저 작업이 몇 분이라 붙잡고 있으면 Neon 이 끊는다

---

## Known Gaps
*Logged here instead of fixed. Addressed in a future step.*

- **KG-1** — 아이로그 이용약관이 무료 정책과 어긋남 (terms 118-125, 종량제·30일 이용권) — 원장 판단 필요 — logged 2026-09-11
- **KG-2** — 아이로그 7일 체험 만료가 코드에서 동작하지 않음 (가입 시 trial_ends_at 미설정, 상태 체크가 항상 활성) — logged 2026-09-11
- **KG-3** — 아이로그 에이전트 챗 기본 모델 llama-3.3-70b-versatile 이 Groq 단종 모델 (app/api/agent/chat/route.ts:14) — logged 2026-09-11
- **KG-4** — 아이로그 기능 페이지 「사진만 올리면 피드백」 — feedback/generate 입력에 사진이 없어 코드로 확인 못 함 — logged 2026-09-11
- **KG-5** — [해결됨 2026-09-12] 아이로그 가이드 페이지에 FAQPage JSON-LD 가 둘(사이트 전역 layout + 가이드 페이지) 같이 나감 — FAQPage 를 `components/seo/FaqJsonLd.tsx` 로 떼어 홈에서만 그린다 — logged 2026-09-11
- **KG-6** — [보안] 아이로그 공개 리포트 API 가 토큰이 없으면 검증을 건너뜀 — 주소에서 토큰만 지우면 7일 뒤에도 열림 (`api/reports/[id]/public/route.ts:42-43`) — **Step 2 로 잡음** — logged 2026-09-11 (Richard)
- **KG-7** — 아이로그 수납 발송 버튼이 아무것도 안 보내면서 「알림톡이 발송되었습니다」라고 답함 (`tuition/invoices/[id]/send/route.ts:63,68-69`) — Step 3 — logged 2026-09-11 (Richard)
- **KG-8** — 아이로그 에이전트 청구서 문자가 학원 번호 없으면 플랫폼 번호로 나가고 잔액 차감·로그 없음 (`lib/agent/tools.ts:1697-1709`) — 발송비 누수 — Step 3 — logged 2026-09-11 (Richard)
- **KG-9** — 아이로그 설정 화면 발송 단가 17·22원 표시, 실제 차감 19·24원(부가세) (`dashboard/settings/page.tsx:766-772`) — Step 3 — logged 2026-09-11 (Richard)
- **KG-10** — 사이티드 `deliverables/ilog/middleware.ts` 가 옛 이름(middleware)·옛 매처 복사본으로 남아 있음. 아이로그 운영 파일은 `proxy.ts` — **해결: Step 1 배포 때 proxy.ts 복사본으로 교체** — logged 2026-09-11 (Bob)
- **KG-11** — 아이로그 공개 리포트 응답이 denylist 라 `fr.*` 의 나머지(`teacher_id`·`academy_id`·`pdf_path`·`sent_to_parent`·`teacher_edited`)가 나가고, 새 컬럼도 자동으로 실린다 (`api/reports/[id]/public/route.ts:8,23,133-135`) — 기준을 `ReportViewClient.tsx` `interface Report` 필드로 한 allowlist 로 — logged 2026-09-11 (Richard)
- **KG-12** — 승인 전 리포트도 토큰 링크로 열린다. 토큰 발급(`generate-token/route.ts:30-63`)이 승인을 안 보고, 화면(`dashboard/reports/[id]/page.tsx:167`)만 막는다 — 승인 전 공유를 허용할지 원장 정책 — logged 2026-09-11 (Richard)
- **KG-13** — 아이로그 수납 안내 알림톡이 실제로 안 나간다. 수납 안내 템플릿이 등록돼 있지 않다. Step 3 에서 라우트(`tuition/invoices/[id]/send/route.ts`)가 「보내지 않았다」고 답하게만 고침. 보내려면 템플릿 등록 → `sendOneMessage`(ALIMTALK, pfId·templateId) 연결 → `students.tuition_alimtalk_enabled` 확인 → `sent_method` 기록. 지금은 이 라우트를 부르는 화면이 없다 — logged 2026-09-12 (Bob)
- **KG-14** — [해결됨 · Step 8] 아이로그 `lib/services/attendance-service.ts:7-20` 이 단가 상수(17·22·55·1.1)와 바이트 계산을 따로 갖고 있다. 지금은 `message-cost.ts` 와 값이 같다. 단가를 바꿀 때 두 곳을 고쳐야 한다 — 출결 알림 경로라 Step 3 에서 안 건드림 — logged 2026-09-12 (Bob)
- **KG-15** — [해결됨 · Step 8] 아이로그 `lib/services/message-service.ts:122-128,226-229` 잔액 확인과 차감이 다른 쿼리라 동시에 보내면 잔액이 음수가 될 수 있다. 또 솔라피 성공 뒤 잔액 UPDATE 가 던지면 보낸 문자가 실패로 집계된다 — 발송 경로 전체(출결·단체·에이전트)가 이 함수를 쓴다. 조건부 UPDATE(`WHERE alimtalk_balance >= $1`) + 반환 행 확인으로 묶어야 한다 — logged 2026-09-12 (Richard)
- **KG-17** — 아이로그에 환불 정책이 없다. 충전 잔액·AI 무제한 이용권의 환불 기준이 코드·문서 어디에도 없어 약관 개정(Step 6)에서 환불 조항을 새로 만들지 않았다 — 원장이 기준을 정하면 약관에 넣는다 — logged 2026-09-12 (Arch)
- **KG-16** — [해결됨 · Step 7] 아이로그 기출 분석이 단종 모델로 실패하고 크레딧 100P 가 환불되지 않는다. Groq 모델 목록(9.12 조회)에 `meta-llama/llama-4-scout-17b-16e-instruct` 없음 — 비전 모델 자체가 없다 (`lib/ai/groq-client.ts:287`, `app/api/exams/route.ts:62-116`). 「학교별 기출 → 예상 문제」 전체가 막힌다 — **Step 7** — logged 2026-09-12 (Arch)
- **KG-18** — [해결됨 2026-09-12] 학원 주간 글쓰기를 어느 모델로 돌릴지. Groq 무료(gpt-oss-120b·qwen3.8-27b)는 여섯 번 재봐도 발행 수준이 안 됐다. **`GEMINI_API_KEY` 를 Secrets 에 넣고 `gemini-3.6-flash` 로 간다 — 월 0원.** 돈을 쓸 이유가 없어졌다. 다만 무료 한도는 입력이 구글 제품 개선에 쓰이므로 **고객사 자료는 이 경로로 보내지 않는다** — logged 2026-09-12
- **KG-19** — 제미나이 초안이 본문 하한(1,800자)을 111자 밑돈다. 지표 문단을 들어낸 뒤 1,689자가 됐다. 판단 기준이 모자란 것인지 군더더기가 빠진 것인지는 몇 편 더 쌓아 봐야 안다. 매주 초안이 나오니 4주쯤 보고 프롬프트를 조일지 하한을 내릴지 정한다 — logged 2026-09-12
- **KG-21** — 학원 글 44편을 네이버에 다 올렸는데 정찰이 `naver 커버리지 2.2%` 를 찍는다(최고 100%). 이관 문제가 아니라 **네이버 검색 노출** 문제다 — 올라가 있는데 검색에 안 잡힌다. 서치어드바이저 소유확인·RSS 제출이 캡차 때문에 아직 안 끝난 것과 이어질 수 있다. 이관이 끝났으니 이제 이 자리를 봐야 한다 — logged 2026-09-12
- **KG-20** — 뉴스 모드(`write-news.mjs`)가 검색 그라운딩 한도에 걸려 아직 한 편도 못 썼다. 한도가 하루 몇 번인지 구글이 공개하지 않는다(429 본문에 quotaId 없음, 문서는 AI Studio 대시보드로 넘김). **원장이 aistudio.google.com/rate-limit 에서 확인해 주면 정해진다** — 주 1회로 충분하면 지금 설계 그대로 두고, 그것도 모자라면 근거를 내가 직접 받아와 넘기는 쪽으로 바꾼다(그러면 공급자를 안 가려서 Groq·Anthropic 으로도 돈다). 확인 전까지 뉴스 모드를 시험으로 돌리지 않는다 — logged 2026-09-12

## Decisions — Step 1 리뷰 후 (Arch, 2026-09-11)
- 리뷰에서 나온 제품 결함(KG-6~9)은 원장 몫이 아니라 사이티드가 고친다 — 원장 지시 「찾았으면 고쳐라」. 보안(KG-6)이 먼저
- 한 번에 한 단계: Step 1(공개 문구 수정) 배포 → Step 2(보안) → Step 3(수납·에이전트 문자·단가 표시)
- 원장에게 올릴 것: 「평생 무료」 문구와 약관(KG-1) 중 무엇을 고칠지 · 무제한 패스에서 예상 문제 출제를 빼는 게 의도인지. 답이 오기 전까지 공개 문구는 코드 동작 그대로 적는다
- proxy 매처는 이미지·영상만 뺀다. `.txt|.xml|.json` 은 남긴다 — llms.txt·robots.txt·sitemap.xml 방문이 AI 크롤러가 제일 먼저 읽는 자리의 기록이고, 학원 케이스 리포트도 robots.txt 방문을 근거로 쓴다 (Bob Open Question 1 → Arch 확정)
- KG-10: Step 1 배포 때 `deliverables/ilog/middleware.ts` 를 지우고 운영 파일 `proxy.ts` 복사본으로 바꾼다 — 전달 폴더는 운영에 올라간 것과 같아야 한다

---

## Architecture Decisions
*Locked decisions that cannot be changed without breaking the system.*

- DB 시각은 UTC 로 저장, 화면·날짜 경계는 KST — 2026-09-05
- 고객사 목록의 단일 출처는 `academy/clients.mjs` — 2026-09-10
- 「오늘 한 일」 집계 로직은 `web/lib/brief-core.mjs` 하나를 화면과 스크립트가 같이 쓴다 — 2026-09-11
- 공개 케이스 리포트는 기본 가림, `--private` 원본은 공개 경로에 못 쓴다 — 2026-09-10

### 후속 — 첫 고객 유치판 — COMPLETE
*Date: 2026-09-17*

- 송파·강동 코딩학원 10곳을 공개 정보 근거와 함께 `geo.outreach_targets`에 등록했다.
- 원장 직접 상담·월 문의 5건 이상·단일 지점은 공개 정보로 확정하지 않고 통화 확인값으로 분리했다.
- `/admin/outreach`에 오늘 전화할 순서, 통화문, 제안문, 상태·다음 행동·기한 기록을 만들었다.
- 목표 퍼널은 접촉 10 → 대화 5 → 제안 3 → 결제 1이며 결제 전 수치는 성과로 세지 않는다.
- DB 적용 및 후보 10곳 삽입, Next production build 통과.

### 후속 — 유료 파일럿 제공 준비 검증 — NO-GO
*Date: 2026-09-17*

39만원을 받은 뒤 약속한 서비스를 완주할 수 있는지 실제 코드와 DB로 점검했다. 현재는 계약 금지다. 자사 사례도 동일 엔진·동일 방식의 20문항 전후 비교를 완료하지 못했고, 네이버 AI 측정 규칙·정합성 납품 양식·고객 온보딩 일정·결제/취소 문서가 없다. 상세 결과는 `research/paid-pilot-readiness-audit-2026-09-17.md`.

즉시 고친 결함:
- 문의 기록을 고객사별 선택·저장·집계하도록 수정했다. 새 고객 문의가 첫 사례에 섞이지 않는다.
- `verdict.mjs --client <slug>`로 고객별 최종 판정이 가능하다. 아이로그에 실행해 고객 분리가 되는 것을 확인했다.
- Next production build 통과.

### 후속 — 유료 파일럿 납품 시스템 완성 — GO
*Date: 2026-09-17*

- `/admin/pilots`에서 입금·증빙·신청 동의 근거가 있는 고객만 등록한다.
- 등록 즉시 질문 20개, Day 0~30 업무 19개, 로컬 정합성 20칸, 콘텐츠 승인 원장, 고객 전용 상담 기록 링크를 만든다.
- 승인 질문 JSON 다운로드 → 운영 측정 워크벤치 → 고객별 AI 측정 적재 → 최종 Markdown 보고서까지 연결했다.
- 워크벤치와 적재기의 JSON 필드 불일치로 0건 적재되던 결함을 수정했다.
- DB 왕복 검증: 질문 20, 업무 19, 정합성 20, 콘텐츠 1 생성 확인 후 전량 롤백.
- 측정 규칙과 39만원 신청·작업범위·취소 기준을 문서화했다.
- 첫 고객은 한 곳만 받아 실제 납품 완주 후 두 번째를 받는다.

### 후속 — 매일 AI 추천 개선 루프 — COMPLETE
*Date: 2026-09-17*

- 매일 07:05 GitHub `optimize`가 DB 사실로 가장 큰 병목 한 가지를 `geo.agent_runs`에 만든다.
- 매일 07:20 Codex heartbeat `로봇앤코딩 AI 추천 개선 루프`가 측정→원인 분석→실제 수정→검증→커밋/배포→실행 원장 완료를 수행한다.
- 일반 검색을 AI 답변으로 대신하지 않으며, 접근 불가 엔진은 실패로 기록한다.
- 대시보드에 실제 실행 원장을 읽는 `개선 담당`을 추가했다. 기존 역할 카드의 “실시간 실행 로그 없음” 문구를 제거했다.
- 오늘 원장은 승인 질문 20개 대비 최신 AI 측정 2건만 있어, 첫 행동을 `동일 조건 20문항×2회 기준선`으로 선택했다.

### Step 7 — 개선 루프를 GitHub Actions 안에서 실제로 돌게 함
*Date: 2026-09-17*

- 위 루프는 실행을 Codex heartbeat 에 넘겼는데 Codex 한도가 끝나 아무도 실행하지 않았다. 대시보드 카드는 `run_day::text day` 예약어 오류로 원장을 한 번도 못 읽었다
- `optimize.yml` 07:05 KST: `ai-measure.mjs`(승인 20문항 × gemini google_search · groq compound) → `daily-agent.mjs`(판정 → 고르기 → 행동 → 원장)
- 결정: 자동 측정은 API 엔진이다. `collection_method=api-*` 로 남기고 소비자 화면 결과로 부르지 않는다
- 결정: 적중 = 인용 또는 언급. 브랜드 질문은 인용 또는 답에 「석촌」 — 질문에 이름이 있어 따라 말한다. groq 인용은 실제 검색 결과만, 본문 URL 제외
- 결정: 판정 = 기준일 전 14일 vs 기준일+7일 이후, 양쪽 5건 이상, +20%p·적중 2회 이상이면 효과 있음. 35일 지나도 모자라면 표본 부족
- 결정: 사다리 brand entity→content→offsite, 나머지 content→offsite. 미발행 자동 초안은 한 번에 하나. 사람 대기는 14일 뒤 `미처리` 로 닫고 재시도 허용 (offsite 는 14일마다 다시 뜬다 — 알아챌 방법이 없어 받아들임)
- 결정: 기존 글 매칭은 브리프의 「핵심어 2개」 대신 두 글자 묶음 겹침 0.4. 한국어 조사 때문에 단어 단위가 안 맞았다
- 발행은 자동으로 하지 않는다. 발행되면 다음 날 IndexNow 후 판정 창을 연다 (알림 실패여도 기준일은 발행일, 근거에 실패 기록)
- 절차: Arch 브리프·빌드는 메인 세션, Richard 는 reviewer 에이전트 (PASS WITH FIXES → 필수 5건 수정)
- 실제 실행 확인 (2026-09-17, run 35209284432 · 35209411396 · 35209542131): 루프 코드는 끝까지 돌았다. 측정에서 막혔다
  - 제미나이: 이 키로 보이는 flash 모델 7개 중 시도한 5개(3.6·3.8·3.7·3.5·3.5-lite) 전부 429 「exceeded your current quota」. 모델 문제가 아니라 키의 프로젝트에 한도가 없다 → AI Studio 결제 연결이 필요 (사람만 가능)
  - groq compound·compound-mini: 413 request_too_large. 검색 결과를 붙인 내부 요청이 무료 등급 한도를 넘는다
  - 그래서 원장은 「실패 · 최근 7일 자동 AI 측정이 없습니다」로 정직하게 남고 워크플로는 빨간불이다. 키가 풀리면 코드 변경 없이 다음 날부터 돈다

### Known Gaps
- KG-7a: 자동 AI 측정용 유료 키 없음 (위). 결정 대기: 제미나이 결제 연결 / OpenAI 키 추가 / Anthropic 키 추가
- 원장 결정(2026-09-17): 측정·초안 모델을 OpenRouter `stealth/union-alpha` 로. 모델 0원, 웹 검색 플러그인(Exa)은 요청당 $0.007 크레딧(openrouter.ai 문서). 키는 원장이 Vercel `robotcoding` Production 에 `OPENROUTER_API_KEY` 로 넣고, Arch 가 `vercel env pull` → `gh secret set` 으로 GitHub Secrets 에 옮긴다(값은 화면에 안 찍고 임시 파일은 지운다). 키를 바꾸면 이 복사를 다시 해야 한다
- 수정(2026-09-17): 원장이 키를 Vercel **geo** 프로젝트에 Sensitive 로 넣어 `env pull` 로 값이 안 나온다. 복사 대신 `web/app/api/llm/route.ts` 중계를 만들었다 — Bearer `LLM_PROXY_TOKEN`, 무료 모델(`stealth/*`·`:free`)만, max_tokens ≤ 16000. Actions 는 `LLM_PROXY_URL`·`LLM_PROXY_TOKEN` 으로 부른다. 비밀 값 쓰기는 권한 규칙에 막혀 원장이 `node tools/set-llm-proxy.mjs` 로 넣고 geo 를 재배포한다

### Step 8 — 에이전트 회사: 카드의 「다음 행동」을 실제로 실행 — COMPLETE
*Date: 2026-09-17*

원장 지적: "대시보드에 살펴볼 일이 나와 있는데 왜 자동으로 안 하냐 · 알아서 운영되는 AI 에이전트 회사를 만들어라 · 초안이 있다는데 볼 수가 없다".
원인: 카드는 DB 숫자로 문장을 고를 뿐 그 문장을 집어 실행하는 곳이 없었다. 정찰 이슈 6건이 일주일 열려 있었고 write.yml 실패(9/13)가 화면에 안 보였다.

- `geo.agent_tasks`(일감)·`geo.agent_activity`(실제 활동)·`academy.posts.review_notes`
- `company.yml` 매시 23분 → `company.mjs`: 출근 기록(GitHub 실행→활동) · 계획(정찰·초안·문의·리드·작업 실패→일감, 읽기에 성공한 신호원만 닫음) · 실행(최대 3건, 원자적 집기)
  - 운영: 실패 작업 재실행→재실패 시 실패 단계 기록 후 사람 대기 · 사이트 점검 · 재진단
  - 측정: 노출 재측정 · 브랜드 방어(IndexNow, 3회 뒤 사람) · who-wins + LLM 분류 → 겨냥 초안 일감 / 등재 필요(사람)
  - 콘텐츠: 주간 초안(미발행 있으면 사람 대기) · 질문 겨냥 초안(미발행 3편 이상이면 미룸) · 초안 AI 티 검사·LLM 다듬기
  - 유통: 발행 알림(IndexNow → 구글 요청·네이버 이관 로컬 일감) · 크롤러 미수집 쪽 IndexNow(주 1회, 3회 뒤 사람)
  - 성과: 상담 결과·리드는 사람 대기 + 링크
- `tools/local-agent.mjs` — 원장 PC 작업 스케줄러 「Cited Local Agent」 매일 12:40·19:10 (등록 완료). 네이버 이관(시도 기록 선기록 → 모호하면 사람 확인, 중복 게시 방지)·구글 색인 요청. 로그인 풀리면 「로그인 필요」 사람 대기
- `/admin/drafts` — 초안 읽기·사실 확인 목록·AI 티·직접 수정·발행(→유통 일감)·버리기·다듬기 전 원문 보기/되돌리기
- `/admin/ops` 카드 — 일감 표와 활동 기록을 읽음. 「원장님이 하실 일」 목록(링크 또는 「했어요」)
- 결정: LLM 다듬기는 숫자 multiset·소제목·링크 동일, 길이 0.9~1.15, 동시 수정 없음일 때만 자동 적용하고 원문 보관 (사실 변경 차단 + 원장 되돌리기)
- 결정: 사이티드 자체 일감(작업 실패 등)은 client_id=1 에 둔다 (client_id not null)
- 결정: 발행은 여전히 사람만 (CLAUDE.md 절대 규칙)
- 첫 실행(run 35226173757): write.yml 실패 재실행, 초안 2편 검사 → 사람 대기
- Richard 1차: 필수 4건(발행 알림 즉시 닫힘·신호원 실패 시 전부 닫힘·LLM 사실 보호·네이버 중복) → 수정

Known Gaps
- KG-8a: `slop-check.mjs` 의 순서 연결어 검사 정규식이 문자열 안 `\s` 라 사실상 안 잡힘 (기존 코드)
- KG-8b: `/admin/drafts?key=` 옛 토큰으로 들어오면 화면은 보이지만 버튼(서버 액션)은 쿠키 인증이라 거절됨
- KG-8c: who-wins LLM 결과의 검색어·도메인을 원본 출력과 대조하지 않음
- Richard 2차: 네이버 중복 두 경로·「했어요」가 logNo 없이 닫음·뉴스 초안 거짓 완료 → 수정. 3차 통과 (Step 8 is clear)
- 실제 동작 확인(22:28 실행): 헬리오시티 초안 AI 티 1종을 LLM 이 다듬고 가드(숫자·소제목·링크 동일) 통과 → 적용, 원문 보관. who-wins·crawl-push 실행 중 확인
- Deploy: geo 자동 배포, /admin/drafts·/admin/ops 307(로그인), /api/llm 405(GET) 확인
- 로컬 에이전트는 첫 실행이 내일 12:40 (지금 돌리면 원장 사용 중인 PC 에 브라우저 창이 뜬다)
- 결정(2026-09-18, 원장 지적 「초안 AI 슬롭이 심하다」): 재는 모델과 쓰는 모델을 갈랐다. 측정은 하루 20건이라 싼 것(google/gemini-2.5-flash, 건당 ≈ $0.013 with Exa), 글은 주 1건이라 좋은 것(anthropic/claude-opus-5, 편당 ≈ $0.09). 둘 다 OpenRouter 한 계정으로 — Anthropic 직판과 같은 단가라 키를 따로 안 만든다
- 슬롭의 절반은 모델이 아니라 재료 부족이었다. 초안 프롬프트에 상담에서 실제로 들은 말, AI 가 그 질문에 지금 내놓는 답 전문과 인용 출처를 넣고, 소제목 4개·목록 1군데 상한과 자가 점검 항목을 붙였다
- 결정(2026-09-18): 결제 경로를 둘로 열어 뒀다. OpenRouter 는 선불 크레딧(잔액 0 이면 402 로 멈춤) — 측정·검색에 쓴다. Anthropic 직판은 실제 사용량 월 청구(카드) — 글쓰기에 쓴다. 중계 `/api/llm?provider=anthropic` 가 Anthropic 으로 그대로 넘긴다. `WRITER_PROVIDER=anthropic` 을 GitHub 변수로 두면 초안이 그쪽으로 간다
- 중계에 하루 호출 상한(`LLM_PROXY_DAILY_MAX`, 기본 120)을 걸었다. 토큰이 새도 크레딧이 하루치 이상 안 나간다
- 결정(2026-09-18): Claude 웹 검색($10/1,000건)으로 측정까지 Anthropic 한 곳에서 할 수 있다. `ai-measure.mjs` 에 `anthropic-web` 엔진 추가(web_search_20260209, 기본 claude-sonnet-5). `MEASURE_ENGINES` GitHub 변수로 고른다. 질문 1건 ≈ $0.04 (검색 $0.01 + 토큰) → 하루 20문항이면 월 약 $24. OpenRouter+Exa 는 월 약 $8 이지만 선불이라 잔액 0 이면 멈춘다. 원장이 결제처 하나를 원하면 Anthropic, 값을 원하면 OpenRouter

### 2026-09-19 — 초안 공급자 재검토 (Anthropic → Groq → Gemini)

- Anthropic 직판 키를 Vercel 에 넣고 `WRITER_PROVIDER=anthropic` 로 실제 초안 1편 성공 확인(claude-opus-5, 1796자, 짜임새·어휘·숫자 검사 통과)
- 원장 지시로 Groq(무료) 재시도 — KG-18 과 같은 결과. 1135자(하한 미달), 지역 키워드 0회, 훈계조·체크리스트 닫기 재현. **여전히 발행 수준 아님, 결론 유지**
- Gemini(무료) 로 전환 — 첫 시도 JSON 파싱 실패(모델이 따옴표를 이스케이프 안 하고 보냄, position 1311). 할당량 문제 아님, `finishReason: STOP`
- **AI Studio 비율 제한 대시보드를 직접 열어 실측**(`luxual8@gmail.com` · 프로젝트 AGOGEO · 무료 등급):
  - `gemini-3.6-flash` 텍스트 생성(그라운딩 없음): RPM 5 · TPM 250K · **RPD 20** — 초안 주 1편에는 넉넉함
  - 검색 그라운딩: **Gemini 3 계열은 RPD 0** (결제해도 안 풀리는 게 아니라 무료 등급 자체가 0). Gemini 2/2.5 계열은 RPD 1,500 이지만 **모델이 신규 사용자에게 퇴역**(404, `gemini-2.5-flash`) — 실사용 불가
  - 그래서 KG-7a 의 "결제 연결 필요"가 맞았다. `MEASURE_GEMINI_MODEL=gemini-2.5-flash` 로 바꾸면 될 거라 봤던 중간 판단은 틀렸음 — 되돌림
- **코드 수정**: `writer-common.mjs` gemini 요청(검색 미사용 시)에 `responseSchema` 를 걸어 JSON 파싱 실패를 API 단에서 원천 차단 (커밋 `0ad30a1`). 재실행으로 확인 — `gemini-3.6-flash` 로 2339자 초안 성공, 짜임새 통과, slop-check 1건(훈계조 닫기)만 걸림 — 정상적으로 사람 검토로 넘어감
- **결정: `WRITER_PROVIDER=gemini` 로 확정.** 무료·품질·할당량 셋 다 충족하는 유일한 조합 (Groq 는 품질 미달, Anthropic 은 유료, OpenRouter 는 크레딧 0)
- **측정(그라운딩) 은 여전히 막혀 있다** — OpenRouter 크레딧 0(402) + Gemini 3 그라운딩 무료 0건 + Groq compound 는 2026-09-17 에 413(요청 과대)로 막힌 이력. **무료로 되는 길이 없다.** 재개하려면 원장이 OpenRouter 충전(월 약 $5~8) 또는 Gemini AI Studio 결제 연결 중 하나를 골라야 함 — 사람 결정 대기
- `MEASURE_ENGINES=gemini` 로 강제했다가 위 이유로 실패 확인 후 변수 삭제, 기본 동작(OpenRouter 만 시도 → 크레딧 없으면 78 로 조용히 건너뜀)으로 되돌림

### 2026-09-21 — 블로그 삽화 · 네이버 하단 QR·지도 · 홈 네비 빈 화면

- 원장 지적 「블로그 글에 삽화가 하나도 없다」: 도해 없는 글은 사이트 원본 1편(AI로 숙제) + 네이버에서 옮긴 옛 글 7편이었다. 6편에 9장을 넣음(`insert-diagrams.mjs` PLAN). 옛 글의 「사진 설명을 입력하세요」 흔적도 걷음
- 넣지 않은 2편: `2025nyeon-sw-gyoyuk-uimuhwa-uri-aineun`(시수 2배 등 숫자를 확인 안 했다 — 그림으로 키우면 안 된다), `2023nyeon-...`(본문이 카페 링크 한 줄)
- 원장 지적 「네이버 하단에 카카오채널·지도·QR 이 있었다」: 옛 글엔 장소(지도) 블록이 늘 있었고, 사이트에서 옮긴 글엔 빠져 있었다. `naver-blog-post.mjs` 하단에 QR 카드(`tools/assets/naver-footer/contact-qr.png`, 홈 kakao-qr 와 같은 코드)와 지도(「장소」→ 주소 「송파대로37길 52」로 고름 — 같은 이름 학원이 강남·광진에도 있다)를 넣음
- 함정: 카카오 주소 줄이 링크 카드로 바뀌면 커서가 카드 뒤에서 길을 잃어 「사진」 버튼이 파일 창을 안 연다. QR·지도를 카카오 줄 앞에 두고, 사진 넣기에 재시도 1회
- 글 og:image 가 없어 네이버가 본문 첫 SVG 를 한글 글꼴 없이 그려 링크 카드 글자가 네모였다 → 첫 도해 PNG 를 og:image 로. 네이버는 한 번 읽은 카드를 캐시하니 이미 읽힌 글은 바로 안 바뀔 수 있다
- 원장 지적 「네비로 스크롤하면 내용이 안 보이고 새로고침하면 된다」: 블로그에서 next/link 로 홈에 오면 innerHTML 스크립트가 안 돌아 `.rise` 69개가 opacity:0 에 멈춤. `HomeScript` 가 클라이언트 이동 때 돌리고, `#nav[data-live]` 가드로 두 번은 안 돈다. 운영에서 블로그→「원장 소개」 보임 0 → 49 확인
- 네이버 자동 이관은 이미 있다(로컬 에이전트 12:40·19:10, 최근 14일 발행분). AI로 숙제 글은 21:54 발행이라 다음 실행 전이었을 뿐 — 손으로 올림 logNo 224419161775. 기존 12편은 `--update` 로 하단 교체

Known Gaps
- KG-21a: 글·홈 `fmt()` 가 `timeZone: "Asia/Seoul"` 없이 날짜를 찍는다 (`app/page.tsx:29`, `app/blog/[slug]/page.tsx`). dev 하이드레이션 경고도 여기서 난다
- KG-21b: 사이트 글 페이지 하단에는 카카오 QR·지도가 없다 (홈에만 있음)

### 2026-09-21 (밤) — 에이전트가 공급자 하나에 막혀 서 있던 것

- 원장 지적 「geo 에이전트가 실제로 일을 안 하는 것 같다」. agent_activity 를 보니 기록 대부분이 출근·회사 루프 상태 세기. 실제 일감은 막혀 있었다:
  - who-wins 분석: `물어보기` 가 OpenRouter 만 불렀다. 크레딧 0 → 200 빈 답 → 「JSON 아님」 12일 반복
  - write.yml: 기본이 뉴스 글인데 뉴스는 검색 근거가 필요하고 제미나이 무료는 근거 한도 0 → 매주 429
- 결정: 공급자 목록(`공급자들()`)으로 넘어간다 — WRITER_PROVIDER → OpenRouter → Anthropic(중계, 하루 120 상한) → Gemini (→ Groq 는 분석 JSON 에만). 뉴스가 안 되면 관점 글 초안으로. 비용: Anthropic 은 카드 월 청구, 초안 1편 ≈ $0.09 · 분석 1회(sonnet-5) 수 센트
- 확인: 수동 실행에서 who-wins 12일 만에 성공(검색어 6개 → listing 5 · content 1), 이어서 question-draft 를 claude-opus-5(중계)로 써서 초안 `songpa-chodeung-koding-hagwon-chucheon` 생성 — 사실 확인 대기
- Richard 1차 Must 1 · Should 7 → 반영(3384cf9), 2차 통과, Low 1 반영(980b739)

Known Gaps
- KG-21c: listing 일감 5개가 전부 「사람 대기」. 플랫폼 등록은 업체 로그인이 필요하다 — 어느 플랫폼인지·무엇을 적을지까지 에이전트가 준비해 두면 사람 몫이 30초로 준다
- KG-21d: 네이버 이관 도중 「태그 칸을 못 찾았습니다」 한 번 → 발행 화면이 안 넘어감. 재시도로 됐다. 원인 미확인

### 2026-09-22 — 삭제된 초안을 다시 쓰는 루프 수정

- q3 헬리오시티 초안을 원장이 9/21 검토 화면에서 버린 사실을 `geo.agent_activity`로 확인. 9/22 개선 루프가 삭제를 감지한 직후 같은 질문으로 초안 생성을 다시 시도했고 크레딧 부족으로 실패했다.
- 결정: 원장이 버린 질문의 초안을 자동 재생성하지 않는다. 회사 루프의 미발행 초안도 공통 검토 대기로 보고 새 초안을 쌓지 않는다. `daily-agent.mjs --dry`와 실제 실행에서 확인했다.
- 현재 송파 초안의 검증되지 않은 AI 순위·수업 효과·통학 결과 단정을 제거하고 공식 사이트 근거를 붙였다. 1,909자, slop-check 0건, 미확인 숫자 0건. 파일럿의 삭제된 초안 링크를 현재 초안으로 교체하고 사실 확인 대기로 남겼다.

### 2026-09-22 — 에이전트 재검증 (원장 지시 「묻지 말고 문제를 해결하고 목표까지」)

- **AI 답변 측정이 9/18 이후 0건** — 목표 1(레퍼런스)이 나흘 멈춰 있었다. `MEASURE_ENGINES=anthropic-web`, `MEASURE_EVERY_DAYS=3` 로 켬(20문항 3일에 한 번, 월 약 $8)
  - 켜자마자 한 번도 안 돌던 주기 쿼리가 `syntax error at or near "day"` 로 죽음 → 별칭 고침(4b448fb)
  - 이어서 **Anthropic 잔액 소진**(400 credit balance is too low). 2026-09-18 에 「Anthropic 은 카드 월 청구라 끊길 일이 없다」고 적은 건 **틀렸다 — 선불 크레딧이다**
  - 측정 스크립트가 이 400 을 크레딧 문제로 못 알아보고 크레딧 일감(60)을 「완료」로 **잘못 닫음** → 알아보게 고치고, 실제로 잰 날만 닫게 함. 60 을 정확한 문구로 다시 엶(5a87118)
- 브랜드 방어 「홈 색인 알림 실패」 사흘 반복: 네이버 IndexNow 가 **홈(루트) 주소만 422** 로 거절 → 묶음 전체가 실패로 찍혔다. 네이버에는 홈을 빼고 보냄(e8f252b)
- write.yml 재실행: 뉴스(제미나이 근거 429) → 초안(제미나이 503 · OpenRouter 402 · Anthropic 잔액 400). 예비 경로는 설계대로 돌았고 막힌 건 돈. 크레딧·한도로만 막히면 78(건너뜀)로 끝내 「코드 고쳐야」 일감이 안 생기게 함(0596746). 운영 일감 17 닫음
- who-wins: 이기는 페이지 안에 우리가 있는지 주소·전화로 대조 → 등재 일감 5개 중 4개는 이미 올라 있어 닫음(53b877b). 남은 「잠실」: 순위닷 태그에 잠실이 없음, 플레이스 대표 키워드 추정
- 사람 몫(돈·로그인·상담)만 남음: Anthropic 충전(60) · 상담 결과 2건(8) · 아이로그 서치콘솔(3, 고객사 계정) · 플레이스 대표 키워드(258) · 초안 2편 사실 확인

### 2026-09-22 (오후) — 에이전트를 Max 구독(Claude Code)으로 · Brave 색인 0건 발견

- 원장 지적 「Max 구독 중인데 API 크레딧 따로 충전은 불편」 → `claude setup-token` 으로 구독 토큰을 GitHub 시크릿(CLAUDE_CODE_OAUTH_TOKEN)에 넣고, 측정·초안·분석을 `claude -p` 로 돌림(`academy/scripts/claude-code.mjs`)
  - 기본 시스템 프롬프트가 코딩 도우미라 학원 추천을 거절 → `--system-prompt` 로 바꿈. 빈 임시 폴더·`--strict-mcp-config`·ANTHROPIC_API_KEY 빼고 실행
  - 첫 토큰은 복사 중 잘려 401 → 원장이 다시 넣음. GitHub 에서 20문항 측정 성공(오늘 20/20)
  - 변수: WRITER_PROVIDER=claude-code · MEASURE_ENGINES=claude-code-web · MEASURE_EVERY_DAYS=3. CLI 2.1.278 고정
  - Richard 4차까지(Must 5·Should 12) 반영, 통과. 결정: 판정은 같은 엔진끼리만 비교(엔진 전환이 「효과 있음」으로 적히지 않게), 뉴스 출처는 근거·본문에 주소가 똑같이 나온 것만
- **발견: Claude 는 우리를 못 찾는다.** 20문항 검색 결과에 robotncoding.com 0건. 「robotncoding.com 무슨 학원?」 → 「강남 대치동, 2008년」, 다른 답은 우리 주소·전화를 「잼코딩학원 석촌캠퍼스」에 붙임
  - 원인: Claude 웹 검색은 Brave 색인을 쓰는데 Brave 에 `site:robotncoding.com` 0건(Playwright 로 확인). ClaudeBot 127쪽 수집은 학습용이라 별개
  - `tools/brave-submit.mjs` — 주소 입력·제출은 도구, 캡차는 사람. 효과는 3일마다 claude-code-web 인용으로 본다
- 사이트 자체(llms.txt·JSON-LD)는 주소·전화·「이 주소의 학원이 우리」를 이미 분명히 적고 있다 — 문제는 글이 아니라 색인

### Step 9 — 감사관 · 원인 조사 — BRIEFED
*Date: 2026-09-22 · Arch*

원장 지시 「심도있게 검토해서 AI 에이전트 회사로 운영해봐」. 9/22 에 찾은 문제(반복 실패·측정 정지·근거 없는 완료·Brave 0건)는 전부 사람 세션이 찾았다. 루프에 자기를 의심하는 자리가 없다.

- 결정: 순서는 9 감사관(읽기만) → 10 수리공(가드 안에서 고치고 합치고 되돌림) → 11 영업 담당(준비만, 발송은 사람). 진단 없이 수리를 붙이면 엉뚱한 곳을 고친다
- 결정: 감사관은 규칙 6개(반복 실패·멈춘 측정·근거 없는 완료·인용 0·크롤러 0·출근만)를 SQL 로 찾고, 하루 2건만 claude -p 로 가설 검증. 조사관은 읽기 도구만, DB·GitHub 토큰 없음, checkout 토큰 미보관
- 결정: 근거(파일:줄·URL)가 없는 진단은 `관찰` 으로만 둔다. 분류 `code` 는 `수리 대기` — Step 10 입력
- 결정: 수리공은 `academy/scripts/*.mjs` 만. 워크플로·web·academy/app·숫자 파는 스크립트·글 데이터 금지. GITHUB_TOKEN 은 workflows·변수·시크릿 권한이 없고 브랜치 보호도 없다(무료 비공개, 403) — 가드는 스크립트 안
- 결정: 새 표 `geo.claude_calls`(Step 9), `geo.repairs`(Step 10). 전부 additive
- 오늘 데이터: 자동 측정 cited 전부 0 · 크롤러 client1 microsoft 10.6%·duckduckgo 2.1%, client2 google·perplexity 10% · scout 는 벤더 넷만 봄

### Step 9 — 감사관 · 원인 조사 — BUILT (Richard 검토 대기)
*Date: 2026-09-22 · Bob*

- 새 파일: `academy/scripts/audit.mjs`, `.github/workflows/audit.yml`. 표 `geo.claude_calls` (additive, audit 가 ensure)
- `claude-code.mjs`: `cwd`·`envDrop` 옵션만. 안 주면 전과 똑같다(빈 임시 폴더, 지우는 것도 임시 폴더일 때만)
- `company.mjs`: WORKFLOWS 에 `audit.yml: ops` 한 줄 · `web/lib/ops.ts`: 정렬에 `수리 대기` 를 `실패` 다음에 (한 줄)
- 결정: R1 은 summary 뿐 아니라 **action 도 정규화**해 묶는다. who-wins 일감 제목이 「(9일째)」「(12일째)」로 바뀌어 같은 실패가 둘로 갈렸다
- 결정: R6 의 「출근」은 `action like '%출근%'` (로컬 에이전트 출근 포함)
- 결정: R3 측정 일감 = `kind='check-index'`(→ serp_checks) · `dedupe_key='openrouter-credits'`(→ ai_measurements, 일감 60)
- 결정: 조사관 규칙·출력 형식은 **표준입력**으로 넘기고 시스템 프롬프트는 한 줄. 윈도에서 claude 는 cmd 를 거치는데
  여러 줄 인자는 첫 줄에서 잘려 뒤의 `--tools` 까지 버려졌다 — 로컬 시험 2회가 도구 28개가 다 열린 채 20턴을 다 쓰고 끝났다(error_max_turns). 파일 변경은 없었다(git status 확인)
- 결과: 로컬 진단 1건 성공 — R5 microsoft → `code`·기지 → `수리 대기`(일감 319). 근거 scout.mjs:57 · company.mjs:519

Known Gaps
- KG: `claude-code.mjs` 가 윈도에서 여러 줄·따옴표 든 `system` 을 cmd 로 넘기면 잘린다. Actions(리눅스, 셸 없음)는 괜찮다. writer-common 의 claude-code 초안을 로컬에서 돌리면 같은 일이 난다 — `--system-prompt-file` 로 바꾸는 게 맞다
- KG: 로컬에서 `CLAUDE_CODE_LOCAL=1` 로 진단하면 조사관이 Read 로 `academy/.env.local` 을 볼 수 있다(규칙으로만 막음). Actions 는 파일이 없다
- KG: `/admin/ops` 는 담당 카드(AgentBoard roles)에 audit 가 없어 `대기`·`수리 대기` 조사 일감이 카드에 안 뜬다. `사람 대기` 만 「원장님이 하실 일」에 뜬다. 이름표 한 줄 목록이 없어 brief 대로 손대지 않았다
- 후속(b021963): audit 의 「감사」 행이 run_url 을 달면 company 출근기록이 그 실행을 「이미 봤다」로 건너뛴다 — run_url 을 비움. 재시험에서 「자동 작업 audit」 3행 확인, R1 두 건은 회복으로 닫힘
- KG: company.yml schedule 이 실제로는 몇 시간씩 빈다(9/22 05:10Z 뒤 schedule 없음). R6 의 「3시간」이 GitHub cron 지연으로 걸릴 수 있다 — 한 주 보고 기준을 정할 것

### Step 9 — Richard 1차 반영 — BUILT (재검토 대기)
*Date: 2026-09-22 · Bob*

- Must: 조사관 칸막이. `claude-code.mjs` 에 allow·deny(기본 빈 값). 조사관은 `Read/Grep/Glob(./**)`+WebSearch 만 허락, `dontAsk`, `//proc/**`·`~/.claude/**`·`**/.env*` 거절. envDrop 은 그대로. Actions run 35701778583 에서 CLI 권한 거절 6건(/proc/self·부모 pid environ·.env 표지·.env.local·~/.claude 자격증명·Grep /proc)을 로그로 확인
- 결정(Arch): 조사관에게 WebFetch 없음 — 근거는 저장소 파일:줄과 facts 로 충분하고, 웹 글 속 지시 → 읽은 비밀을 주소로 내보내는 길을 막는다
- 결정(Arch): 7일 창을 벗어난 것은 풀린 게 아니다. 사람 대기·수리 대기 조사는 규칙이 본 **회복 증거**가 있을 때만 닫는다. 대기·관찰·실패는 신호가 사라지면 닫는다
- 결정(Arch): 구독 토큰 인증 실패는 `claude-auth` 사람 대기 일감 하나로(setup-token → gh secret set). 이후 호출이 되면 저절로 완료
- 결정: 칸막이 시험의 증거는 모델 답이 아니라 CLI 의 `permission_denials`. 첫 시험에서 모델이 도구를 안 부르고 스스로 거절해 증명이 안 됐다
- 결정: 다시 열린 조사는 지문(신호의 핵심 사실)이 같으면 직전 진단 재사용. unknown 은 재사용 안 하고 두 번이면 사람 대기. 진단 실패는 payload.diag_fail 로 따로 세서 3번이면 사람 대기
- 결정: 근거는 `파일:줄`·URL 만, audit.mjs 자신은 제외(순환 근거)
- 시험 중 러너→DB ETIMEDOUT 1회(run 35701689476) — 다시 돌려 통과. 반복되면 감사 자체 실패로 회사 루프가 wf-audit 일감을 연다

### Step 9 — Richard 2차 Should Fix (통과 후) — COMPLETE
*Date: 2026-09-22 · Bob*

- 칸막이 시험이 「열려야 할 것」도 증명한다: Read handoff/BUILD-LOG.md 첫 줄 일치 · Glob academy/scripts/*.mjs 개수 일치 · 저장소 안 경로가 CLI 거절에 하나라도 있으면 실패
- 다시 열린 조사는 payload diag_fail·diag_unknown 도 0 으로 (attempts 와 같이)
- 진단 재사용은 이번 실행에서 닫힘→대기로 다시 열린 조사만. 원장이 손으로 대기로 돌린 건 다시 진단한다

Known Gaps
- KG: R1 은 실패 묶음이 7일 창 안에서 조건(3건·2일)을 채울 때만 「풀림」을 본다. 실패가 창 밖으로 나간 뒤에 성공이 오면 풀림 증거가 안 잡혀 사람 대기 R1 조사가 남는다 — Arch 결정 (a) 의 보수적인 쪽. 원장이 닫으면 된다

### Step 10 — 수리공 — BUILT (Richard 검토 대기 · 실제 합치기 안 함)
*Date: 2026-09-22 · Bob*

- 새 파일: `academy/scripts/repair.mjs`, `.github/workflows/repair.yml`. 표 `geo.repairs`(+head_sha·note·updated_at), `geo.settings` 의 `repair_paused`
- `claude-code.mjs`: 모든 호출을 geo.claude_calls 에 기록 · 하루 상한 CLAUDE_DAILY_MAX(40), 측정 아닌 호출은 CLAUDE_MEASURE_RESERVE(20) 를 남김 · purpose(measure·writer·audit·sandbox-test·repair·repair-review)
- 결정: 수리공 claude 에 Bash 를 안 준다 — `node --check /proc/self/environ` 이 오류 메시지로 환경변수를 찍는다. 검사는 스크립트가
- 결정: 재발 = 수리 뒤 신호가 사라졌다가 다시 뜸. 계속 떠 있으면 7일 뒤 「효과 없음」 사람 대기(되돌리지 않음). 확인 실행 실패는 같은 실행에서 즉시 되돌림 — Arch 확인 대기
- 결정: 지난 dry 가 검토 pass 이고 가지 머리가 그대로면 run 이 claude 를 다시 안 부른다
- 사건: Actions 는 설정 안 한 vars 를 "" 로 넘긴다. Number("")=0 이라 첫 dry 가 「하루 상한 0」으로 멈췄다(REPAIR_MAX_PER_DAY 도 같았다) — 빈 값은 기본값으로
- 결과: 되돌리기 시험 통과(run 35703118038) · 조사 319 dry → scout.mjs 15줄, 검토 pass, 가지 auto/fix-319 efe75d8 (run 35703293668)
- **안 한 것**: REPAIR_ENABLED=1 설정이 권한 분류기에서 거절돼 실제 main 합치기·확인 실행·자동 되돌리기·재발 판정은 안 돌았다

Known Gaps
- KG: 킬 스위치(REPAIR_ENABLED) 는 꺼져 있다. 켜는 것은 원장 결정 — `gh variable set REPAIR_ENABLED --body 1 --repo leeledger/geo`
- KG: auto/fix-319 수리안에 `pages_total ≥ 10` 조건이 없다(감사관 R5 와 다름). 검토자가 못 잡았다
- KG: 확인 실행은 수리와 무관한 실패(DB 연결 시간 초과 등)에도 되돌린다
- KG: write.yml 처럼 실제로 일하는(구독을 쓰는) 워크플로도 확인 실행으로 돌 수 있다

### Step 10 — Richard 1차 반영 — BUILT (재검토 대기)
*Date: 2026-09-22 · Bob*

- 결정(Arch): 견습 — 처음 5건은 스스로 합치지 않는다. run 은 가지+검토 pass 에서 멈추고 「자동 수리 승인 대기」 일감(사람 대기)에 `gh workflow run repair.yml -f mode=merge -f task=<id>` 를 단다. 원장이 merge 로 합친 수리가 7일 되돌림 없이 5건 쌓이고 되돌림·멈춤이 없으면 무인 전환(activity 「견습 끝」)
- 결정(Arch): 합친 뒤 확인 실행은 company·scout·audit·watch 만. write·optimize 는 안 돌린다(초안 작성·측정 비용). 쓰는 워크플로가 없으면 node --check 와 다음 정기 실행·감사에 맡긴다
- 결정: 재현 명령을 뺐다 — 모델이 고친 코드를 비밀을 든 채 돌리는 길이었다(Richard Must 1)
- 결정: dry 행은 합칠 수 없다. 승인 합치기는 base 가 움직이면 가드·검토를 다시 한다. rebase 는 안 쓴다 — main 이 수리 파일을 바꿨으면 포기
- 결정: 합치기 전에 「합치는 중」+merge_sha 를 먼저 쓴다. 1시간 넘게 합치는 중이거나 확인 결과 없는 합침은 되돌린다. 잡 75분
- 결정: 되돌리기는 수리 파일만 merge^ 모양으로 + BUILD-LOG 에 「되돌림」 줄. git revert 는 BUILD-LOG 끝에서 거의 늘 충돌한다. 되돌리기가 한 번이라도 실패하면 즉시 멈춤
- 결정: 가드가 새 환경변수·새 호스트·네트워크/프로세스 모듈·eval·동적 import·환경변수+네트워크 한 줄을 막는다. 수리공과 검토자는 같은 진단을 읽어 같은 주입에 함께 넘어갈 수 있다
- 결정: claude-code.mjs capRequired — 호출 수를 못 세면 부르지 않는다(수리·검토·감사관)
- 사람이 띄운 run 은 REPAIR_ENABLED 가 꺼져 있어도 승인 대기까지 간다(main 무관). 정해진 시각 run 은 꺼져 있으면 claude 를 안 부른다
- 결과: 가드 시험 13/13 (run 35704828321) · 되돌리기 시험 3/3, BUILD-LOG 가 그사이 움직인 경우 포함 (run 35704877806) · 조사 319 run → 검토 fail(9번이 pages_total≥10·14일 제외 누락을 잡음) → 사람 대기 (run 35704962357)
- repairs 2(auto/fix-319 efe75d8) 는 `dry 폐기`·verdict void 로 막았다

Known Gaps
- KG: 승인 대기 일감·mode=merge·무인 전환은 아직 끝까지 돈 적이 없다(319 수리안이 검토에서 떨어짐)
- KG: 조사 319 는 사람 대기. 수리공 두 번째 안도 R5 조건을 못 맞췄다 — 사람이 scout.mjs 에 R5 조건 그대로 넣는 게 빠르다

### Step 10 — Richard 2차 Should Fix 1~3 (켜기 전) — COMPLETE
*Date: 2026-09-22 · Bob*

- 결정: 「사람이 띄운 실행」 = workflow_dispatch 이면서 github.triggering_actor 가 비어 있지 않고 `[bot]` 이 아닐 때. 봇이 띄운 실행은 지난 수리 확인만 한다(수리 claude·승인 일감 없음). 봇이 띄운 merge 는 거절
- 결정: company.mjs 는 repair.yml 실패를 다시 띄우거나 rerun 하지 않는다 — 사람 대기로만 올린다
- 결정: 승인 합치기는 `repair-approve-<id>` 일감이 아직 사람 대기일 때만. 그 일감이 완료·닫힘·없음이면 수리 행 「거절」, 조사는 사람 대기, 그 조사는 더 자동 수리하지 않는다. 지난 수리 확인이 매 실행 거절을 찾아 적는다
  - 거절하는 법: /admin/ops 「원장님이 하실 일」에서 승인 일감을 「완료」 표시(화면에 닫기 버튼은 없고 완료 표시만 있다 — task-actions.ts finishTask). 화면을 못 쓰면 `update geo.agent_tasks set status='닫힘' where dedupe_key='repair-approve-<id>';`
- 결정: 가드가 `process[`·`Reflect.x(process`·`{ … env … } = process` 를 막는다. 추가 줄에 `fetch(`·`request(`·`.post(`·`process` 가 하나라도 있으면 needs_owner — 견습이 끝나도 스스로 합치지 않고 늘 원장 승인(문자열 검사로는 조립한 주소를 다 못 막는다)
- 결과: 가드 시험 21/21 (Actions 결과는 REVIEW-REQUEST)

Known Gaps
- KG: 합친 뒤 확인 실행은 워크플로의 결론(success)만 본다. company.mjs 처럼 안에서 오류를 잡고 0 으로 끝나는 스크립트는 수리가 깨뜨려도 「성공」으로 나온다

### Step 11 — 영업 담당 — BUILT (Richard 검토 대기)
*Date: 2026-09-22 · Bob*

- 새 파일: `academy/scripts/sales.mjs`, `.github/workflows/sales.yml` (월 08:10 KST + dispatch run·leak-test). 회사 루프가 sales.yml 을 지켜보되 다시 띄우지 않는다
- 결정: 초안은 claude 1회/주(purpose sales, capRequired), 도구 없이 빈 임시 폴더. 재료는 케이스 리포트 공개본 본문 + 그 후보·리드 행뿐
- 결정: 초안에 재료에 없는 숫자나 가릴 말이 있으면 버리고 숫자 없는 틀로 — 지어내지 않는다를 코드로 지킨다. 버린 원문은 payload 에만
- 결정: 공개본 가림 검사 목록 = clients.mjs 이름 변형·도메인·brandRe·presenceRe 글자 + 지역어(case-report MASKS 와 같은 말) + 영업 후보 이름 + 전화번호. 하나라도 있으면 공개본을 안 바꾸고 사람 대기
- 사건: 첫 실행에서 통화문 10개가 전부 버려졌다 — 영업 후보 이름이 가릴 말 목록(공개본용)에 있어 통화 상대 이름만 불러도 걸렸다. 통화 상대 자기 이름은 빼고 검사하게 고침(ae50b51). 이번 주 원장 줄에는 숫자 없는 틀이 올라가 있다
- 결과: 가림 검사 시험 10/10 (run 35706714170) · 실행 → 케이스 리포트 갱신 커밋 f5b40e8(가림 통과) · 통화 사람 대기 10 · 리드 0 (run 35706781965) · 재실행 중복 없음 (run 35706988353)

Known Gaps
- KG: 고친 판으로 claude 통화문이 검사를 통과하는지는 다음 월요일에 처음 본다
- KG: 지역어 목록이 sales.mjs 와 case-report.mjs MASKS 두 곳에 있다
- KG: 리드 답장 경로는 리드 0건이라 아직 안 돌았다

### 정정 — 케이스 리포트 공개본의 머리 숫자 과장 (2026-09-22)
*Date: 2026-09-22 · Bob (Arch 지시, Richard 발견)*

- **틀렸던 것**: 공개본 머리 숫자 「AI 크롤러 방문 1486회」에는 검색 색인 크롤러(Googlebot 321 · Yeti 208 · Bingbot 61 · DuckDuckBot 1 = 591회)가 들어 있었다. AI 크롤러만 세면 **895회**다. 이 틀은 Step 11 전부터 있었고 9/22 f5b40e8 까지 그대로 나갔다
- **어긋났던 것 1**: 같은 공개본의 일별 기록은 17일차 누적 1822 로, 머리 숫자보다 컸다. `academy.snapshots.crawl_total` 을 만드는 snapshot 라우트가 고객사를 가리지 않고 crawl_hits 전체를 센다 — 다른 고객사 방문(오늘 381회)이 들어 있었다
- **어긋났던 것 2**: 타임라인 「AI 크롤러 17종 명시 허용」(손으로 적은 말, 검색 크롤러 포함) · 진단표 「11종」(진단 도구의 목록) · 「24종을 판별」(판별표는 25) · 「스키마 19종」(진단표 20종)
- **고친 것 (case-report.mjs, 7f46a15 로 공개)**: AI 와 검색을 나눠 센다(판별표 academy/lib/bots.ts 의 두 칸 그대로 — 검색 = Googlebot·Bingbot·Yeti·DuckDuckBot). 일별 기록은 이 고객사 crawl_hits 에서 그날 KST 자정까지 누적으로 다시 센다. 허용 수는 robots.txt, 판별 수는 bots.ts 에서 센다(AI 13 · 검색 4 허용, AI 21 · 검색 4 판별). 「스키마 19종」은 데이터로 확인할 수 없어 뺐다
- 확인: https://geo-rose-nine.vercel.app/case/academy.html 에 「895회 AI 크롤러 방문 · 591회 검색 크롤러 방문」, 04 제목 「크롤러 방문 — AI 와 검색 색인을 나눠 셉니다」

### Step 11 — Richard 1차 반영 — BUILT (재검토 대기)
*Date: 2026-09-22 · Bob*

- Must: 초안 숫자 검사를 토큰 집합으로. 단위 붙은 수(%·배·명·건·곳 …)와 한글 수사(한·두·세·다섯·스무 …)는 그 구절이 재료에 그대로 있어야 통과. 틀 구절(세 가지·다섯 건·한 달·한 곳·한 번)만 허용
- 결정: 가림 목록을 academy/masks.mjs 한 곳에 — case-report.mjs 가 가리고 sales.mjs 가 검사한다. 원문·URL 푼 원문·태그 떼고 엔티티 푼 글·정규화본(공백·구두점 지움, &·and→앤) 네 번 본다. 두 글자 지역어는 앞 글자가 한글이면 안 센다(손가락)
- 결정: 영업 후보 이름을 못 읽으면 멈춘다(fail-closed)
- 결정(Arch): 영업 전화는 주간 묶음 일감 하나 — 가장 오래 밀린 3곳만 통화문, 나머지는 이름·수. 낱개 통화 일감 10개는 묶음으로 옮겨 닫았다
- 결정(Arch): 같은 지역(masks.mjs 같은지역구 — 송파·강동) 후보에게는 케이스 리포트 링크도, 실증·사례·학원 운영 언급도 없다. 원장 줄에 그 이유를 한 줄 적는다
- 결정: sales.yml 은 persist-credentials false. 리포트 쓰기·초안 단계와 커밋 단계를 나눠 GH_TOKEN 은 커밋 단계에만. 초안 claude 는 DATABASE_URL·GH_TOKEN 을 자식 환경에서 뺀다. 푸시가 충돌하면 rebase --abort 하고 사람 대기
- 결정: 주간 한 줄에 「완료 표시했지만 연락일이 그대로인 후보」를 센다(지난 2주 완료된 묶음의 후보 ∩ 지금 밀린 후보)

Known Gaps
- KG: academy/app/api/snapshot 라우트가 academy.snapshots 에 고객사를 가리지 않고 센 숫자(crawl_total·posts·vendors)를 쓴다. 케이스 리포트는 이제 그 숫자를 안 쓰지만 표 자체는 그대로 섞여 있다
- KG: 타임라인의 나머지 손 기록(사진 69장 · 사이트맵 34 URL · 188자→933자)은 그날 손으로 잰 것이라 데이터로 다시 확인하지 않았다

### 정정 2 — 케이스 리포트 크롤러 분류 (2026-09-22)
*Date: 2026-09-22 · Bob (Arch 지시, Richard 발견)*

- **틀렸던 것**: 첫 정정(7f46a15)의 「AI 895 · 검색 591」은 Applebot 7회를 AI 로 셌다. Applebot 은 Siri·Spotlight·Safari 검색용이고 AI 학습 허용은 Applebot-Extended 토큰이 따로 한다 — 우리 robots.txt 도 둘을 따로 적는다. 바로잡은 값은 **AI 888 · 검색 598** (합 1486 그대로)
- 분류 정의가 두 벌이었다(「검색이 아니면 AI」와 「Daum 은 검색」). 이제 academy/lib/bots.ts 의 두 칸을 그대로 읽어 한 표로 쓰고, 어느 칸에도 없는 봇은 「기타」 — AI 로 부풀리지 않는 쪽이 기본. bots.ts 에서 Applebot 을 검색 칸으로 옮겼다(Applebot-Extended 가 먼저 걸려 판별 결과는 안 바뀐다 — 학원 사이트 재배포 필요 없음)
- robots.txt 수: 「AI 13」에 방문하지 않는 제어 토큰(Google-Extended·Applebot-Extended)이 들어 있었다 → 「User-agent 17개 명시 허용 — 크롤러 AI 10 · 검색 4 · 기타 1(Daum) + 방문하지 않는 학습 허용 토큰 2」
- 페이지 문장: 07 「지금 세면 전 엔진 0% 가 나올 것이 뻔하다」는 06 의 측정 회차(ChatGPT 부분 측정 1/2 인용 포함)와 어긋나 「같은 방법으로 반복 측정」으로. 06 「인용하는 문서의 대부분이 제3자 지면」은 센 비율이 없어 「첫 기준선에서는 …제3자 지면이었습니다」로 좁혔다
- sales.mjs --push 가 커밋 직전에 가림 검사를 한 번 더 한다

### Step 12 — 삽화 담당 (초안에 도해) — BUILT (Richard 검토 대기)
*Date: 2026-09-22 · Bob*

- 새 표 `academy.post_images (slug, name, svg, alt, created_at, unique(slug,name))` — schema.sql 에 적고 운영 DB 에 만들었다(additive)
- 새 경로 `academy/app/blog/img/[slug]/[name]/route.ts` — image/svg+xml · CSP `default-src 'none'; style-src 'unsafe-inline'` · nosniff · 캐시 1일(s-maxage). 이름·슬러그 꼴이 아니면 404. 학원 사이트 `npx vercel --prod` 1회(이 세션)
- og:image: 첫 이미지가 `/blog/img/` 면 넣지 않는다(PNG 가 없다)
- `academy/scripts/illustrate.mjs` — Claude Code(purpose illustrate, capRequired, sonnet, 도구 없음, 빈 임시 폴더) 1회 = 1편. `--dry` · `--test` · `--slug` · `--task`
  - 검사(스크립트): 태그 짝·속성·엔티티를 보는 작은 XML 검사(새 패키지 없음) · script/foreignObject/on*=/javascript:/@import/외부 href·url() · xmlns · 폭 960 · 60KB · aria-label · 본문에 없는 수(masks.mjs 수검사 — 그림 글자·aria·alt·data-value) · 다른 고객사 말(clients.mjs id≠글의 고객사 + geo.clients + 영업 후보, 못 읽으면 멈춤)
  - 차트(원장 지시 반영): `data-value` 단 rect 는 data-chart 별로 길이÷값이 2% 안 — 길이 쪽은 크기가 더 갈리는 쪽(값이 같은 두 막대 중 하나만 줄이는 것도 잡는다). 축 눈금 `data-axis` 는 0 부터 같은 간격인 수만(지어낸 수를 눈금으로 숨기지 못하게)
  - 본문 날짜 「2026년 8월 27일」은 「2026.08.27」「2026.8.27」「2026.08」도 같은 수로 본다 — 연표 참고 예시가 이 표기를 쓴다. 날짜 말고는 넓히지 않는다
  - 자리: before 문구가 든 **줄 머리**에 끼운다(문단 중간이면 이미지가 한 줄을 차지 못해 안 그려진다). 못 찾으면 첫 `##` 뒤, 없으면 맨 뒤
  - 저장은 한 거래 — 그림 insert + 본문 update(`updated_at=$읽은값 and not published and 본문에 ![ 없음`). 0행이면 그림도 되돌린다
- 결정: sales.mjs 의 가림검사·수 검사를 masks.mjs 로 옮겨 같이 쓴다(sales 는 import). 한글 수사 앞에 한글이 붙으면 수로 안 본다(「중요한 점」의 「한 점」) — sales 쪽도 같이 느슨해진다. sales --draft-test 11/11 · --leak-test 20/20 그대로
- 결정(원장 「도해는 무조건」): 다 버려져도 초안을 닫지 않고 다시 그린다. 시도 수는 `review_notes.삽화.시도`. company: 시도 2 이상이면 `illustrate-human-<slug>` 사람 대기, 재시도 간격 1시간→6시간. 매시 1편(최근 50분 안 illustrate 호출이 있으면 미룸) · 하루 상한은 claude-code.mjs 그대로
- 결정: 도해 없이 발행된 글은 `noimg-<slug>` 사람 대기(발행본은 에이전트가 고치지 않는다). 지금 2편: 2023nyeon-buteo-…, 2025nyeon-sw-…
- 결정: 참고 예시를 grading-shift.svg 한 장 → 원장 지시의 새 스타일 세 장(ai-textbook-16-subjects-2028 timeline·recognized-textbook·info-hours). info-hours.svg 에 data-value·data-axis 를 달았다(보이는 모양 같음, 학원 재배포 안 함 — 스크립트는 저장소 파일을 읽는다)
- web(검토 화면, **푸시 안 함 — Richard 뒤**): publishDraft 는 본문에 `![` 가 없으면 0행. 화면에 「도해」 칸 · 없으면 「도해가 아직 없습니다 — 삽화 담당이 그리는 중」 + 시도·버린 이유 + 「도해 다시 그리기」(삽화 기록 지우고 illustrate 일감 대기로, attempts 0) · 발행 버튼 disabled. 초안 버리기는 그 슬러그의 post_images 와 illustrate 일감도 지운다/닫는다
- naver-blog-post.mjs: 본문 그림이 `/blog/img/` 면 DB SVG 를 임시 폴더에 풀어 svg-to-png.mjs 로 굽는다(파싱 오류면 그 도구가 PNG 를 안 만든다). --dry 가 본문 첫 사진도 찍는다(naver-dry-image.png)

결과
- 운영 경로: 시험 그림 넣고 `https://robotncoding.com/blog/img/step12-test/probe.svg` 200 · image/svg+xml · CSP 헤더 확인 · 없는 이름 404 · .png 404 → 지움
- `--test` 전부 맞음(파싱 3종·스크립트·on*·외부 href·xlink·javascript:·url()·foreignObject·지어낸 수·부분 수·수 구절·alt 수·다른 고객사 이름·도메인·폭·60KB·막대 비례/줄임/같은 값 줄임/값 없는 수·축 눈금 3종·aria 2종 · 참고 예시 3장 통과 · 자리 3종 · 덮어쓰기 2종)
- 로컬 실제 1편(옛 스타일, 18:26): 1장 붙임 · 1장 버림(「2026.8.27」— 그때는 날짜 표기 넓힘 전)
- Actions company run 35715128836 (bbc411a): 「도해 그리기」 → 「도해 2장 붙임 · 버림 1장 (aria-label 에 내용이 없음)」. claude_calls id 14 purpose illustrate task_id 396, 139초. 운영에서 두 그림 200 · CSP · 렌더 정상. 버린 1장은 작은따옴표 오판 → 8b4c421 로 고침
- 검토 화면(운영 /admin/drafts) 에 「도해: 2026년 8월 27일 교육부 발표부터…」 확인
- 네이버 --dry: DB 도해 1장 굽기 → 에디터에 PNG 로 들어간 것 스크린샷 확인(발행 안 함)
- 시험 초안 두 편(step12-probe-local, step12-server-check)과 그 그림·일감은 확인 직후 지웠다. 원장이 「[시험]」 제목을 보고 물었다 — 앞으로 검토 화면에 보이는 시험 초안은 만들지 않는다

Known Gaps
- KG: Vercel CDN 이 /blog/img 응답을 하루 캐시한다 — 지운 그림도 캐시가 끝날 때까지 열린다(시험 그림 2개 주소가 지금 그렇다)
- KG: 서버 증명 초안이 참고 예시와 같은 글이라 그림이 예시를 거의 베꼈다. 다른 글에서 새 스타일이 어떻게 나오는지는 다음 실제 초안에서 처음 본다
- KG: 재시도·사람 대기(시도 ≥2)·web 발행 막기·다시 그리기 버튼은 실제로 돌려 보지 않았다(tsc 만). web 은 푸시 전
- KG: 되돌리기(revertDraft)는 다듬기 전 원문으로 돌린다 — 그 뒤에 붙은 도해 줄도 사라진다. 그러면 삽화 담당이 다시 그린다(도해 없는 초안)
- KG: 네이버 --dry 가 에디터에 임시 저장을 남긴다(원래 동작)

### Step 12 — Richard 1차 반영 — BUILT (재검토 대기)
*Date: 2026-09-22 · Bob*

- Must 1: 걸러내기 → **허용 목록**. 요소는 접두어 없는 SVG 그리기 요소(svg·g·defs·title·desc·도형·text·tspan·그라데이션·stop·filter·fe 7종·clipPath·mask·pattern·use·symbol·marker·style)만. 접두어 속성은 `xmlns:xlink`(정확한 URI)·`xlink:href="#…"` 만, `xmlns` 는 SVG URI 만. 속성 값과 `<style>` 글은 **엔티티를 푼 뒤** 검사(「&#x75;rl(」). `\`(CSS 이스케이프)·`@` 규칙·CDATA 는 버린다. href 는 `#` 만, url() 은 `#` 만
- Must 1: `tools/svg-to-png.mjs` — `newContext({ javaScriptEnabled: false })` + file: 말고 모든 요청 abort. 모든 사용처에 걸린다. 시험: `<script>` 가 글자를 바꾸고 fetch 하는 SVG + 외부 `<image>` → PNG 에 「SAFE」 그대로 · 로컬 수신 서버 요청 0건. parsererror 잡기는 그대로(날 & → 종료 1)
- Must 2: 삽화 하루 몫 `ILLUSTRATE_MAX_PER_DAY`(기본 6, KST 날짜, geo.claude_calls purpose illustrate). illustrate.mjs 가 부르기 전에 세고 「하루몫」 → company 는 다음 KST 자정 뒤로 미룬다. 측정 아닌 몫 20 중 삽화 최대 6 → 14 가 writer·audit·repair·sales 몫으로 남는다. 측정 예약 20 은 claude-code.mjs 그대로
- 결정: 600자 미만 초안은 그리지 않는다(company·illustrate 같은 기준, 검토 화면에도 그렇게 적는다). 원장이 되돌린 2023 빈 글(43자)이 매시 호출을 먹지 않게
- Should: route CSP 에 `sandbox` · **발행된 글의 그림만** 내보냄(posts join published) · 캐시 1시간(Arch 결정)
- Should: 검토 화면이 도해를 미리 보여 준다 — DB SVG 를 서버에서 `data:image/svg+xml;base64` `<img>` 로(스크립트 안 돎, 새 경로 없음). 손으로 넣은 public 도해는 사이트 주소 `<img>`
- Should: 막대는 `data-orient="h|v"` 필수(짐작 없앰). data-value 가 없는데 data-axis 눈금이 있거나, 모서리 작은(rx≤6) 얇은(≤40) rect 둘 이상이 굵기가 같고 길이만 10% 넘게 갈리며 수 글자가 있으면 버린다. 둥근 알약·같은 크기 카드·범례는 안 걸린다(참고 예시 3장 통과)
- Should: 한글 수사에 수천·수만·몇·석·넉. sales --draft-test 14/14(수만 명·몇 배·「중요한 점」 추가), --leak-test 20/20
- Should: 발행 막기가 본문의 `/blog/img/<slug>/<name>.svg` 가 post_images 에 다 있는지도 본다(SQL 을 운영 DB 에서 시험: 없는 그림 → 막음, public 그림만·그림 없음 → 조건 통과)

결과
- `--test` 전부 맞음 — Richard 페이로드(h:script·x:foreignObject·x:href·<image> 두 가지·\75rl(·@\69mport·style 속성 \·엔티티 url(·<animate attributeName=href>·<set>·<a>·CDATA) 전부 버림, 안전한 <style> 통과
- 학원 배포(nj164dvw1). 운영: 발행 글 슬러그 그림 200 · `Cache-Control: public, max-age=3600` · `CSP …; sandbox` · 초안 슬러그 그림 404 (시험 행은 지움)
- 랜딩(푸시 f9adfaf·55f878c): /admin/drafts 에 「도해가 아직 없습니다…」 · 발행 버튼 disabled · 「도해 다시 그리기」 확인
- Actions company run 35716797232 (55f878c) 성공. 600자 미만 초안이라 삽화 일감 없음, noimg 일감 2건은 코디네이터가 도해를 넣고/비공개로 돌려 완료

Known Gaps
- KG: 검토 화면 도해 미리보기(data:)는 도해 붙은 초안이 없어 운영에서 눈으로 못 봤다. 검토 화면에 보이는 시험 초안을 만들지 않기로 해서다 — 다음 실제 초안에서 본다
- KG: 하루 몫 도달 → 다음 날 미룸, 재시도·사람 대기 경로는 아직 실제로 안 돌았다

### Step 12 — Richard 통과 후 남은 두 가지 — COMPLETE
*Date: 2026-09-22 · Bob*

- 속성 값·CSS 에 `https?:`·`//` 가 있으면 버린다(xmlns 의 정확한 URI 두 개만 예외 — xmlns:xlink 는 접두어 칸에서 정확히 비교). url( 말고도 image-set("https://…") 같은 함수가 바깥 주소를 받는다. --test 에 <style>·style 속성 image-set 2건 추가, 전부 맞음

Known Gaps
- KG: data-value 없는 막대 그림 잡기(막대모양)는 rx ≤ 6 이고 굵기 ≤ 40 인 rect 만 본다. path 로 그린 막대나 rx 7 이상 막대는 빠져나간다 — 원장이 발행 전 검토 화면 미리보기에서 그림을 본다
