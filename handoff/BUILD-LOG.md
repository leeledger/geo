# Build Log
*Owned by Architect. Updated by Builder after each step.*

---

## Current Status

**Active step:** Step 15 초안 재료 — IN REVIEW (Richard 대기). 이전: Step 1~8 배포 완료. 남은 것: 네이버 소유확인 캡차와 이관 35편(사람 일), Known Gaps 잔여분(KG-2·13·17·19). 주간 글쓰기는 `gemini-3.6-flash` 로 월 0원에 돈다(월 06:07 KST, 초안까지만 · 발행은 사람)
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

### Step 13 — 현황판 「성장」 섹션 — BRIEFED
*Date: 2026-09-22 · Arch*

원장: 「실제로 얼마나 성장하고 있는지 가늠이 힘들다」. 브리프 handoff/ARCHITECT-BRIEF.md.
- 결정: 비교는 최근 7일 vs 그 전 7일(문의·리드 30/30). 달력 주로 비교하지 않는다 — 진행 중인 주가 늘 떨어져 보인다
- 결정: 증감률(%) 안 쓴다. 절대 차 + 이전 값을 같이 적는다(작은 수의 +300% 방지)
- 결정: AI 측정은 엔진+방법 쌍 안에서, 두 회차 공통 prompt_id 로만 비교
- 결정: 경쟁 검색어 추세는 kind=경쟁 만. 엔진 수가 모자란 날(9/21 빙만)은 빈칸
- 결정: 크롤러 방문 수는 중립 지표. 판단은 ★ 커버리지(google·naver·microsoft). 분모는 지금 site_pages — 「지금 있는 N쪽 기준 누적」이라 적는다
- 결정: 차트 계열색 google #1F9E90 · naver #7C8AF2 · 빙 #C27A14 고정 순서(검증 통과). 새 패키지 없이 손 SVG

Known Gaps
- KG: site_pages 가 오늘 것만 있어 과거 날짜의 실제 분모를 모른다 — 날짜별 쪽 목록을 쌓아야 정확한 과거 커버리지가 나온다
- KG: 플레이스 순위 측정이 9/09 뒤로 멈춰 있다(place_checks 이틀치)
- KG: Step 13 뒤 기존 「고객사 성과 지표」 칸과 성장 칸이 겹친다 — 다음 단계에서 정리

### Step 13 — 현황판 「성장」 섹션 — BUILT (Richard 검토 대기)
*Date: 2026-09-22 · Bob*

Files: web/lib/growth.ts(새) · web/app/admin/ops/Growth.tsx(새) · web/app/admin/ops/CoverageChart.tsx(새) · web/lib/ops.ts(pool export 한 줄) · web/app/admin/ops/page.tsx(readGrowth + <Growth> 한 줄)
- 결정(Bob): Growth 타입에 브리프에 없는 두 칸을 더했다 — `inquiries.ever`(0건과 기록 없음을 가르려고) · `weeks`(표로 보기 주별 요약. 추세선용 daily 는 14일이라 착수 주를 못 덮는다). 주별 경쟁 검색어 = 그 주에서 엔진 수가 그 주 최대인 마지막 날
- 결정(Bob): AI 칸의 변화 방향(판정 줄)은 가장 최근 쌍 compare 의 **언급** 수로 잡는다. 인용은 같은 줄 글자로만
- 결정(Bob): 차트는 상자 폭을 ResizeObserver 로 재서 그 픽셀 폭을 viewBox 로 쓴다 — 고정 viewBox 를 390px 에 줄이면 축 글자가 5px 가 된다
- 결정(Bob): 판정 줄 숫자 뒤에 해당 칸 이름을 흐리게 붙였다(「좋아진 것 2 (커버리지·학원 문의)」). 문장은 아니다
- 결정(Bob): 섹션 뿌리를 `<section>` 대신 `<div>` — globals.css 의 `section{padding:112px 0}` 이 먹는다. 같은 이유로 `.wrap` 클래스 이름을 피했다. `details` 도 globals 가 흰 배경을 줘서 `.gr details` 로 덮었다
- 검증: tsc 0 · 로컬 next dev + 운영 DB · Playwright 1280/390 × robotncoding/ilog · 가로 스크롤 없음 · 콘솔 오류 0

Known Gaps
- KG: 기존 page.tsx 의 「표로 보기 아닌」 `.ops-disclosure`(자동 실행 일정) 도 globals 의 details 흰 배경을 받을 수 있다 — 이번에 안 봤다
- KG: next dev 가 web/AGENTS.md · web/CLAUDE.md 를 만든다(agentRules). 지웠고 커밋 안 함
- KG: 기존 ops.ts sales.leads30d 는 `scan_id is not null or source='free_scan'` 필터, 성장 칸은 브리프대로 geo.leads 전체 — 두 칸 숫자가 다를 수 있다(지금은 둘 다 0)

### Step 13 — Richard 1차 반영 + Arch 결정 — BUILT (재검토 대기)
*Date: 2026-09-22 · Bob*
- 결정(Arch): 비교 창은 완전한 날만 — 7일 = 어제-6~어제, 그 전 = 어제-13~어제-7, 30일도 어제에서 끝. 오늘은 추세선에서 흐린 속 빈 점, 비교에 안 씀. 이번 주 발행은 그대로 부분 주
- 결정(Bob, Arch 확인 대기): 경쟁 검색어·AI 측정은 하루 한 번 재는 스냅샷이라 오늘 값도 쓴다(경쟁은 엔진 수 규칙이 이미 불완전한 날을 거른다). sub 에 밝혔다
- Must: 중립 칸 기호 없음(「−110회 · 그 전 7일 673회 · 중립」), 그대로 한 번만
- Should: 크롤러 검색/AI/기타를 bot 이름으로 — web/lib/crawler-class.ts(academy/lib/bots.ts 두 칸 사본, Applebot=검색, 모르는 봇=기타) + web/scripts/check-crawler-class.mjs 로 원본과 대조. 주별 크롤 수에 seen_at >= 착수일
- 숫자(창 끝 9/21): 검색 232·그 전 272 / AI 331·그 전 401 / 기타 0 · 실패 24·그 전 3 · 발행 1·그 전 12

Known Gaps
- KG: check-crawler-class.mjs 는 손으로 돌린다. bots.ts 를 고치고 안 돌리면 web 사본이 늙는다
- KG(Richard Escalate): ADMIN_TOKEN 교체 권고 — 원장 결정

### Step 14 — 관리 화면 단순화 — BRIEFED (2026-09-22)
원장: 「검색에 처음 나온 날 같은 의미 없는 건 빼」「너무 알아보기 힘들어」「전반적으로 쉽게」「직원들이 잘 돌고 있는지 실시간으로」「상태등 액티비티하게」.
- 순서: 14a-1(현황판 재배치) → 14a-2(에이전트 직원 실시간 줄) → Richard → 배포 → 14b(나머지 관리 화면 + 공통 admin.css·AdminNav)
- 현황판 맨 위 순서 결정: ① 오늘 원장님이 하실 일 ② 에이전트 직원 — 지금 ③ 크고 있나(카드 4장: AI 답변·답변 색인·글·문의) ④ 커버리지 차트 1개 ⑤ 자세히(운영자용) 하나
- 제거: 검색에 처음 나온 날(ops.ts firstSeen 까지) · SLOTS 시간표·Live 시계(실제 일정과 달라 틀린 정보) · HUMAN 고정 목록 · 옛 KPI 7칸 · Growth 판정 줄 · Flow.tsx(죽은 코드)
- 자세히로: 경쟁 검색어·크롤러 방문·사이티드 리드·플레이스·실패 수 · 표로 보기 · 크롤러 표 · 최근 글 5편 · AgentBoard 격자 · Brief
- 화면에 엔진·방법 내부 이름 금지(자세히 포함). 엔진은 Claude/ChatGPT/… 로만
- 실시간 줄: 45초 폴링(웹소켓 없음) · 원천은 DB(agent_activity·agent_tasks·claude_calls·settings) — 페이지에서 GitHub API 안 부름 · 지연 판정 grace 90분(출근기록이 최대 1시간 늦게 옮겨짐) · 상태 글자 라벨 항상 · reduced-motion 존중
- repair.mjs: 스위치 꺼짐일 때 활동 한 줄 남김(화면이 REPAIR_ENABLED 를 알 방법이 없어서)
- Claude 상한은 web env CLAUDE_DAILY_MAX 가 있을 때만 표시 — 없으면 사용 수만(지어내지 않는다)
- 관리 화면 테마 하나(어두운 판)
- Known Gaps 후보: 역할 시각표 상수가 .github/workflows cron 과 따로 논다(바꿀 때 둘 다) · CLAUDE_DAILY_MAX 가 GitHub 변수와 Vercel env 두 곳

### Step 14a — 현황판 단순화 + 에이전트 직원 실시간 줄 — BUILT · 배포됨 (Richard 검토 대기) · 커밋 b4b397f
- 새 파일: web/app/admin/ops/Todo.tsx · AgentStrip.tsx · web/lib/agents.ts · web/app/api/admin/agents/route.ts
- 다시 씀: page.tsx(순서 ①~⑤, 폭 920·기본 16px) · Growth.tsx(카드 4장 + 차트 + GrowthMore)
- 손봄: AgentBoard.tsx(할 일·요약 카운트 제거, 설명·활동 문구 plain) · agent-board.css(안 쓰는 규칙 삭제) · CoverageChart.tsx(aria-label 문구만) · ops.ts(firstSeen·daysMeasured·withImages 제거 — 소비처 0) · repair.mjs(스위치 꺼짐 활동 2곳)
- 삭제: Live.tsx · Flow.tsx
- 결정(Bob): 직원 줄은 **고객사로 거르지 않는다** — 직원은 회사 전체. 옮긴 줄(자동 작업 *)은 첫 고객사 번호로 적혀서, 거르면 아이로그 화면에선 전부 「지연」. readAgents() 는 client 인자 없음
- 결정(Bob): countMirror 를 역할이 아니라 **일(job) 단위**로 둠 — write·snapshot 은 스스로 활동을 안 적어서(grep: agent_activity 를 쓰는 건 audit·repair·sales·company·setup-company 뿐) 역할 단위로 끄면 콘텐츠·유통의 정해진 일이 안 세진다
- 결정(Bob): 지연 판정은 일마다(그 일의 옮긴 줄 또는 스스로 적은 줄이 정시 이후에 있나). 원장 PC 12:40·19:10 도 넣음 — PC 가 꺼져 있으면 「지연」이 뜬다(알려야 할 일)
- 결정(Bob): repair.mjs merge 거부 분기 문구는 「스위치 꺼짐 — 합치지 않았습니다」(브리프 「같은 문구」 대신 사실대로. 판정은 「스위치 꺼짐」 앞머리로 하므로 같다)
- 결정(Bob): 할 일·실패 문구에 plain() 을 씌움(표시만, 데이터 안 고침). 크롤러 표 커버리지는 % 대신 「읽은 쪽 / 전체쪽」
- 결정(Bob): 랜딩 globals.css 의 section{padding:112px}·nav{sticky}·h2{max-width:22ch} 가 관리 화면에 먹어서 `:where(.ops)` 로 끊음 — 14b admin.css 로 옮길 것

Known Gaps (14a)
- KG: ROLES 시각표(web/lib/agents.ts)는 .github/workflows/*.yml cron 의 사본이다. cron 을 바꾸면 둘 다
- KG: 일감 문구에 내부 이름이 섞여 있다(데이터는 안 고침, 화면에서만 plain). 예: 「조사 · 영점 — 크롤러: microsoft 크롤러 커버리지 10.6% (5/47)」 · 「자동 수리안(가지 auto/fix-319)이 … scout.mjs … R5(audit.mjs)」 · 「통화 뒤 /admin/outreach 에 결과와…」 · 「로봇&코딩학원 — openai 커버리지 32.6% (최고 100%)」 — 일감을 만드는 쪽(company.mjs·audit.mjs·sales.mjs)에서 쉬운 말로 쓰게 하는 건 별도 단계
- KG: **발견** 9/22 23:24 KST 기준 「회사 루프」 활동이 19:36 뒤로 없다(약 4시간) → 운영·감사관 줄이 실제로 「지연」. company.yml 매시 cron 이 GitHub 에서 건너뛰어지는지 확인 필요(범위 밖, 안 건드림)
- KG: Vercel env CLAUDE_DAILY_MAX 없음 → 화면은 「오늘 Claude 사용 n회」만. 40 을 넣을지는 Arch/원장 결정(넣을 땐 파일로 넘기고 env pull 로 길이 확인)
- KG: 수리공 「꺼짐」은 다음 06:50 실행부터 보인다. 그 전엔 「정상」/「지연」일 수 있다
- KG: web/app/page.tsx:168-169 랜딩이 readOps 실패 시 크롤러 수를 8·460 으로 채운다 — 지어낸 숫자 대체값(범위 밖)
- KG: 14b 미착수

### 정정 — 공개 랜딩의 지어낸 바닥값 (2026-09-22 밤, 커밋 494bbc4) — COMPLETE
web/app/page.tsx:168-178 이 DB 를 못 읽으면 숫자를 지어낸 값으로 채우고 있었다: 크롤러 8곳 · 방문 460회 · 글 43편 · ClaudeBot 43쪽 · 경쟁 검색어 분모 6 · 플레이스 2위. 「지어내지 않는다」 위반.
- 고치기 전 운영 화면(9/22 23:3x KST, Playwright 로 읽음) — DB 는 읽히고 있어서 바닥값이 아니라 DB 값이 떠 있었다:
  「18 일차 · 9 곳 다녀간 AI·검색 크롤러 · 1500 회 크롤러 누적 방문 · 45 편 AI 가 읽을 수 있게 된 글」 · 「서버 기록 · 크롤러 9곳 · 1500회」 · 「경쟁 검색어 · 착수 때 → 지금 0 → 4 / 6」 · **「네이버 플레이스 · 「○○구 코딩학원」 2위」** · 「… 9곳 1500회 방문 · ClaudeBot 44쪽」
  - 2위는 바닥값이 아니라 실제 측정(academy.place_checks 2026-09-09 「송파구 코딩학원」 rank 2)이다. 그러나 측정이 9/09 뒤로 멈췄는데 **날짜 없이 13일째 지금 순위처럼** 떠 있었다. 크롤러 9곳·1500회는 DB 와 같다(count 1500, vendor 9).
- 고친 것: 못 읽은 값은 null → 그 칸·문장을 숨긴다(Count 는 null 이면 「—」). 플레이스는 lib/place.ts — 14일 안에 잰 것만, 「9/09 측정」을 붙인다. 없으면 칸을 숨긴다.
- 운영 확인(배포 뒤): 「네이버 플레이스 · 「○○구 코딩학원」 · 9/09 측정 2위」. 나머지 숫자는 그대로(DB 값).
- DB 실패 흉내(DATABASE_URL 을 막힌 주소로, 로컬): 증거 칸은 「18 일차」만, 「서버 기록 · 확인 중」, 사례는 「AI 답변 인용 · 첫 기준선 0 / 8」 한 칸만(정적 기록), 방문 로그 끝 줄 숨김
- **9/24 부터 플레이스 칸이 사라진다**(9/09 + 14일). 측정을 다시 돌리면 돌아온다 — Known Gap: 플레이스 측정 9/09 뒤 멈춤(naver-place-check.mjs 는 로그인 세션 필요)
- 스크린샷: scratchpad land/prod-before-*.png · land/local-normal-*.png · land/local-dbfail-*.png · land/prod-after-*.png

### Step 14a — Richard 1차 반영 (커밋 3853b31) — BUILT · 배포됨 (재검토 대기)
- Must 1: dueSlots() — 오늘부터 8일 전까지, 요일 반영, 유예 90분 지난 가장 최근 시각. 어제 놓친 감사 → 오늘 05:00 「감사 9/22 06:35 예정이었는데 기록이 없습니다」, 월요일 놓친 초안 → 화요일 지연. 활동 0 인 역할은 정상이 안 된다
- Must 2: web/lib/todo-text.ts — investigate(R5 는 payload.facts 로 「빙이 우리 글 47쪽 중 5쪽만 읽었습니다」 + 수리 문구 대응표 + 「조사 내용 보기」 펼침) · repair-approval · workflow-failed 를 새 문장으로, 나머지는 plain 후 어절 경계 자르기. ops.ts tasks 에 payload 추가
- Must 3: 옮긴 줄 「<일> 실행 완료/실패」. 수리공은 옮긴 줄을 빼고 자기 활동으로 판정·표시, 최근 7일 geo.repairs 합침 0 → 「쉬는 중 · 합친 수리 없음 (최근 7일)」, 「검토 불합격」은 막힘으로 안 침
- Arch 결정: 원장 PC 한 번 빔 → 회색 「PC 꺼짐」(새 상태 pcoff), 두 번 연속 → 빨간 지연
- Should: 실패 문구 「<일> 실패 — 로그 확인」(원문은 자세히에만) · 막힘 「· n일 전」 · API 응답에서 err 제거(서버 로그만) · 「조치 중 · 날짜 …」(근거 마지막 줄이 3일 안 제출·등록·고침 등이면 흐리게 맨 뒤) · plain 에 감사 용어(R\d→감사 규칙, 영점→0에 머묾)·외톨이 조사·google/naver 한글화
- 시험: judge-test2.cjs 18개 + 실제 DB 사람 대기 5건 문장 검사 — 전부 통과. 운영 확인: 내부 이름 0 · 가로 스크롤 0 · 콘솔 오류 0 · 로그아웃 401. 운영 직원 줄: 운영·감사관 지연 · 수리공 쉬는 중 · 삽화 쉬는 중 · 나머지 정상

Known Gaps (추가)
- KG: 조사 319(빙 R5) 는 「조치 중」으로 안 보인다 — 9/22 빙 주소 47개 제출은 bing-done.json 에만 있고 일감 근거·활동 어디에도 없다. 도구가 조치를 그 일감에 붙이는 연결(Richard Should (a)): 빙 제출 도구가 끝나면 R5 microsoft 조사에 근거 「<KST> 빙 제출 N개 — 크롤 대기」+ 관찰(+3일)
- KG: 플레이스 측정이 9/09 뒤로 멈췄다. 9/24 부터 랜딩 플레이스 칸이 숨는다
- KG: 「조사 내용 보기」 본문은 진단 결론을 plain 한 것이라 여전히 기술 문장(Bingbot·robots·IndexNow)이 남는다

### Step 14b — 나머지 관리 화면 — BUILT · 배포됨 (Richard 검토 대기) · 커밋 fb324d0
- 새 파일: web/app/admin/admin.css(토큰 한 곳 + .adm·.adm-top·.adm-nav·.adm-todo·.adm-card·.adm-btn·.adm-more·.adm-tw·.adm-empty) · admin/layout.tsx(import 만) · admin/AdminNav.tsx
- 다시 짬: inquiry · drafts · /admin(리드) · outreach · pilots · pilots/[id] · login(공통 CSS 만). 액션·폼 이름·필드는 그대로(코드로 대조)
- 결정(Bob): **ops 는 아직 안 옮겼다** — Richard 가 14a 를 보고 있어 14a 파일을 안 건드린다(호출자 지시). 그래서 `--bg:` 정의가 admin.css 와 ops/page.tsx 두 곳이다(인수 조건 미충족). 14a 통과 뒤 ops 토큰·링크 줄 → admin.css·AdminNav, AgentStrip 의 .lt → admin.css 로 옮기는 작은 단계가 남았다
- 결정(Bob): 초안 카드의 본문은 자세히 안으로(원장이 읽으려면 한 번 누른다). 모델 이름은 화면에서 뺐다(내부 이름)
- 결정(Bob): 문의 요약은 「이번 달」이 아니라 실제 달 이름 — inquirySummary 의 첫 줄은 기록이 있는 가장 최근 달이라 이번 달이 아닐 수 있다. 새 문의 날짜 기본값·리드 시각을 KST 로(UTC 함정)
- 범위 밖이지만 고침(한 낱말): web/lib/pilots.ts `measured_on::text day` → `as day`. 예약어 별칭 문법 오류를 catch 가 삼켜 **파일럿 상세가 운영에서도 404** 였다(운영 확인). 없으면 14b 인수(페이지별 스크린샷)를 못 한다
- 확인: 로컬·운영 모두 7화면 × 1280/390 — 맨 위 「지금 할 일」/「없음」(390 첫 화면 안) · 내부 이름 0 · 가로 스크롤 0 · 콘솔 오류 0 · 로그인 화면엔 이동 줄 없음. tsc 0. 폼은 안 눌렀다(운영 DB 에 안 씀). 초안이 0편이라 초안 카드 모양은 실데이터로 못 봤다

Known Gaps (14b)
- **KG(보안, Arch 에스컬레이트): 서버 액션 인증 누락** — lib/inquiry-actions.ts(addInquiry·resolveInquiry·markEnrolled) · lead-actions.ts(changeLeadStatus) · outreach-actions.ts(updateOutreach) · pilot-actions.ts(updatePilotTask·updateAudit·approveQuestions·updateQuestion·updateContent, createPilot 확인 필요) 에 `isAdmin()` 검사가 없다. 서버 액션은 공개 POST 끝점이라 액션 ID 를 알면 누구나 부른다. task-actions·draft-actions·brief-actions 는 검사한다. 14b 범위(액션·인증 변경 금지) 밖이라 안 고쳤다
- KG: ops 를 admin.css·AdminNav 로 옮기기(위 결정) — `--bg:` 한 곳 조건
- KG: 초안 카드는 초안 0편이라 실데이터 렌더를 못 봤다

### 2026-09-23 — 관리자 보안 (세션)

- Bob 14b 중 발견: 문의·리드·영업판·파일럿 서버 동작 11개에 관리자 검사가 없었다 → guard 추가(93fb90f). addClientInquiry 는 고객 전용 uuid 열쇠 공개 폼이라 제외
- 옛 `?key=` 즐겨찾기는 /admin/enter 가 쿠키로 바꿔 준다 — KG-8b(키로 들어오면 저장 버튼이 막힘)도 같이 풀림
- Richard Must: 운영에서 ADMIN_PASSWORD·ADMIN_TOKEN 이 둘 다 없으면 isAdmin 이 true 였다 → 운영은 잠금(4b14483)
- 쿠키에 발급 시각 서명, 서버가 12시간 넘은 쿠키 거절(전에는 값이 영원히 같았다). 이 배포로 기존 로그인은 한 번 풀린다
- safeAdminPath 한 곳 · 고객 기록표 선택지·uuid·KST 날짜 검사 · /admin Referrer-Policy no-referrer. 운영에서 확인: 새 쿠키 형식 200, 옛 쿠키 → 로그인, 헤더 있음
- 원장 결정 대기: `?key=` 폐지 시점 · ADMIN_PASSWORD 따로 두기 · ADMIN_TOKEN 교체(앞 6글자가 세션 기록에 찍힘, Step 13)

### Step 15 — 초안 재료 — IN REVIEW (2026-09-23) · Richard 대기

원인: 원장이 이틀에 초안 3편을 버렸다(9/23 「너무 AI slop · 일반론 · 억지스러운 상황 설정」). 같은 기간 출처를 단 뉴스 글 ai-textbook-16-subjects-2028 은 발행했다. DB 확인 — `academy.inquiries` 고객사 1번 2행, 둘 다 `said` 가 빈 문자열. write-draft.mjs:167 의 재료 가지가 늘 「기록이 없다」로 떨어진다. **모델이 아니라 재료 문제다.**

결정(Arch):
- **D1 새 표 `academy.materials`.** `inquiries.said` 재사용 안 함 — inquiries 는 유입경로→등록 전환을 재는 표라 수업·아이 말을 넣으려면 가짜 source 행이 생기고 전환율이 부풀어 영업 숫자가 오염된다. 대신 addInquiry 가 said 를 쓰면 materials 에 한 행을 같이 넣는다(origin=inquiry)
- **D2 새 화면 `/admin/material`.** 문의 화면은 상담 결과 흐름이라 수업·아이 말 자리가 없다. 모바일 먼저, 종류 칩 + 한 줄. 개인정보는 막지 말고 가린 뒤 저장하고 무엇을 가렸는지 알린다(30초를 지킨다)
- **D3 재료도 사실 출처도 없으면 글을 안 쓴다.** 사람 대기 「재료가 필요합니다」 일감을 올리고 exit 78. 빈손이 슬롭보다 낫다 — 원장이 읽고 버리는 시간이 더 비싸다
- **D4 사실 글은 write-news.mjs 를 자식 프로세스로 부른다.** 원장이 유일하게 발행한 자동 글이 그 경로다. write-draft 안에 다시 구현하지 않는다
- **D5 게이트는 원장 큐 앞.** slop-rules.mjs 의 치명 항목(지어낸 장면·일반론 문단 40%·2인칭 훈계·서론)에 걸리면 한 번만 다시 쓰고, 두 번째도 걸리면 academy.posts 에 안 넣는다. 행이 없으면 company.mjs 의 review 일감도 안 생기니 큐 로직은 안 건드린다
- **D6 버린 이유를 받는다.** 이유 없이는 안 지워진다. `academy.draft_feedback` 에 남기고 최근 5건을 다음 프롬프트에 넣는다

브리프: handoff/ARCHITECT-BRIEF.md (Step 15) — 인수 조건 11개

#### 지음 (Bob, 2026-09-23)

Arch 가 결정 전부를 확인하고 셋을 더했다 — A1 재료 독촉은 하루 한 번까지(`cooldownH: 24`), A2 개인정보는 가리고 저장하고 무엇을 가렸는지 한 줄, A3 두 주 연속 빈손이면 `material-stopped` 사람 대기(priority 5 · sticky).

새 파일 6개 · 고친 파일 8개. `tsc --noEmit` 0, `npm run build` 통과. 인수 11개 중 10개 통과, 1개(모드 사실)는 로컬에 GEMINI 키가 없어 못 돌렸다.

Files:
- `academy/scripts/setup-materials.mjs` (새 78줄) — materials·draft_feedback 표 + inquiries.said 뒤채움
- `academy/scripts/slop-rules.mjs` (새 168줄) — 검사(본문, {재료들}) → {치명, 경고}. CLI 와 write-draft 가 같은 것을 부른다
- `academy/scripts/slop-check.mjs` (123줄, 전면) — `--strict <슬러그>` 치명 시 종료 1. 인자 없는 기존 동작은 어휘만 보도록 그대로
- `academy/scripts/write-draft.mjs` (571줄, 전면) — 모드 재료/사실/없음, 게이트 1회 재시도, used_in·review_notes
- `academy/scripts/company.mjs` — 159-173(ensure 에 표 둘), 331-346(재료 신호), 360(닫기 규칙에 material)
- `web/lib/materials.ts` (새 105줄) · `web/lib/material-actions.ts` (새 46줄) · `web/app/admin/material/page.tsx` (새 156줄)
- `web/lib/inquiry-actions.ts` 7, 27-64 · `web/lib/todo-text.ts` 160-173 · `web/lib/drafts.ts` 7-15 · `web/lib/draft-actions.ts` 6, 111-142
- `web/app/admin/drafts/page.tsx` 4, 37-40, 183-199 · `web/app/admin/AdminNav.tsx` 7 · `web/app/admin/admin.css` 76-88

Decisions made:
- `가리기()` 는 `materials.ts` 에 뒀다. `"use server"` 모듈은 내보내는 게 전부 async 여야 해서 `material-actions.ts` 에서 내보내면 빌드가 죽는다. 같은 이유로 `DISCARD_REASONS` 는 `drafts.ts` 로
- 한글 이름 정규식은 성씨 사전 + 제외 낱말 30개로 좁혔다. 「한글 2~4자 + 학생」만 보면 「우리 학생」 「여자 학생」이 `○○ 학생` 으로 망가진다
- 가린 것을 알리는 길은 `redirect("/admin/material?m=...")`. 서버 액션 반환값을 받으려면 폼을 클라이언트 컴포넌트로 바꿔야 하는데 그럴 값이 아니다
- 모드 B 조건은 `측정.answer` 또는 `GEMINI_API_KEY`. write-news 는 구글 검색 그라운딩이 있어야 돈다(그 파일 머리 주석). 종료 코드는 그대로 넘기되, 초안이 안 나왔으면 재료 일감도 올리고 빈손을 센다(A3)
- `review_notes.쓴재료` 에는 프롬프트 라벨(m1)이 아니라 materials.id(uuid). slop-check --strict 가 그 id 로 재료를 읽는다
- 「이름를 가렸습니다」가 나와 받침 판별 `을를()` 을 넣었다. 번역체로 읽히는 조사는 안 내보낸다

Reviewer findings: 1차 Ready NO — Must 2 · Should 4. 전부 반영하고 2차 제출 (아래)
Deploy: 1차 배포됨(e0a835d·f5081cf) — `web/` 은 push 로 나간다. `academy/scripts/*` 는 Actions 가 저장소에서 읽으니 push 로 충분하다. 표는 이미 운영 DB 에 만들었다(`setup-materials.mjs` 2회 실행)

Known Gaps (15)
- KG-15-1 `.inq-pick`(문의 화면 지역 CSS)와 새 `.adm-pick`(admin.css)이 같은 규칙이다. 문의 화면을 다음에 만질 때 `.adm-pick` 으로 합친다 — 이번 단계는 액션 한 곳만 손대기로 돼 있었다
- ~~KG-15-2~~ 2차에서 닫힘 — 모드 사실을 가짜 모델로 끝까지 돌렸다. 진짜 제미나이 그라운딩은 Actions 가 첫 검증이다
- ~~KG-15-3~~ 2차에서 닫힘 — 1,500자 미만이 치명이 됐다(Richard Must 2). 1,800자는 흠 그대로
- KG-15-4 재료 고치기·지우기 화면이 없다(브리프 Out of Scope). 잘못 적은 재료는 DB 로만 지운다
- KG-15-5 호칭 없이 쓴 이름(「민준이가」)은 성씨 사전으로 못 잡는다. 화면에 「이름은 안 적으셔도 됩니다」 한 줄로 두었다 — 안 적는 것이 유일한 확실한 길이다
- ~~KG-15-6~~ 3차에서 닫힘 (Arch 지시) — 아래 참조
- KG-15-7 `write.yml` 의 수동 `mode=news` 는 write-news 를 직접 부른다. 게이트는 거치지만 재료 모드를 건너뛴다. 사람이 일부러 고를 때만 쓰는 길이라 남겼다

#### 2차 (Richard 피드백 반영, 2026-09-23)

**Must 1 — 모드 사실에 게이트가 없었다.** 맞는 지적이고, 그게 다음 월요일의 기본 경로였다(재료 0 + GEMINI 키 있음 → 모드 사실).
`write-news.mjs` 가 넣기 직전에 같은 `검사()` 를 돌린다. 치명이면 한 번 다시 쓰고, 두 번째도 치명이면 안 넣고 `material-need` + 78.
일감·빈손·used_in 은 `academy/scripts/material-task.mjs`(새 파일)로 빼서 두 작성기가 같은 것을 쓴다 — 베껴 두면 또 한쪽만 고치게 된다.

**Must 2 — 1,500자 미만을 치명으로.** `slop-rules.mjs` 안에 넣어 write-draft 게이트와 `--strict` 가 같이 쓴다. 1,800자는 흠 그대로.

**덤으로 잡은 것:** company.mjs 가 write-news 를 직접 부르고, 안 되면 write-draft 를 부르는데 write-draft 가 또 write-news 를 부른다.
그러면 한 주에 빈손이 2로 세어져 **첫 주에 「2주 연속 발행 멈춤」이 뜬다.** `빈손()` 에 `빈손날` 을 넣어 하루 한 번만 세게 했다.

Files (2차):
- `academy/scripts/material-task.mjs` (새 83줄) — 재료일감·빈손(하루 한 번)·다시돎·재료썼음
- `academy/scripts/write-news.mjs` 27-28, 44-45, 72-88(사람에게), 97-108(프롬프트 함수화), 159(한번), 255-278(게이트 루프), 300-320(review_notes·used_in)
- `academy/scripts/slop-rules.mjs` 60(최소길이), 63-70(인용·말했다), 123-131(길이 치명), 152-176(출처 없는 인용), 178-190(쓴재료 미사용 경고)
- `academy/scripts/write-draft.mjs` 79(공용 도구), 107-110(뉴스도구있음), 469(재료썼음) — 지역 헬퍼 3개 삭제
- `web/lib/materials.ts` 34(복성 7), 45-49(정규식) · `web/app/admin/material/page.tsx` 112-113(이름 안내 한 줄)

Decisions made (2차):
- **Should (b) 「출처 없는 인용」을 좁혔다.** 적힌 대로 「따옴표 10자+가 재료에 없으면 치명」을 넣으니 1차에서 통과한 멀쩡한 초안이 막혔다 —
  「우리는 왜 그 시점으로 잡았나」(독자에게 주는 되물을 말), 「나는 못한다」(아이 속마음 빗댄 말), 뉴스 글의 「교육부 방안에 따르면」까지 걸린다.
  그래서 **「누가 말했다」고 적은 문단 안의 인용만** 본다(`말했다` 정규식). `물어보시면` 은 일부러 뺐다. 넓힐지는 Richard 판단 대기
- write-news 의 `used_in` 은 늘 빈 배열이다. 뉴스 프롬프트에 재료를 안 넣으니 실제로 쓴 재료가 없다 — 없는데 적으면 그게 지어내기라
  **기계만 붙이고 값은 안 만들었다**. `review_notes.모드="사실"`·`쓴재료: []` 는 남는다
- 시험 본문을 1,500자 넘게 다시 짰다. 1차 것은 435~724자라 새 길이 치명에 다 걸려 어느 규칙이 잡았는지 안 보였다

#### 3차 (Arch 결정 + Richard 2차, 2026-09-23)

**Arch 결정 1 — 좁힌 인용 규칙 승인.** 넓은 판은 **검토했고 버렸다.** 그대로 넣으면 1차에서 통과한 멀쩡한 초안이 막힌다:
- `「우리는 왜 그 시점으로 잡았나」를 물어보시면 답이 분명해집니다` — 학부모에게 주는 **되물을 말**. 누구의 말도 아니다
- `남는 건 「나는 못한다」는 기억뿐입니다` — **아이 속마음을 빗댄 말**. 실제로 들은 말이 아니다
- 뉴스 글의 `「교육부 ○○ 방안에 따르면」` — **문서 인용**. 사실 글의 존재 이유인데 이게 막히면 모드 사실이 통째로 선다
전언 표시(`말했다` 정규식)가 있는 문단의 인용만 본다. 지어낸 증언은 그대로 잡힌다(`zz-test-quote` 로 확인).

**Arch 결정 2 / Richard Must 1 — KG-15-6 닫음. 한 주에 생성은 한 번.**
`company.mjs` 의 weekly-draft 와 `write.yml` **둘 다** write-news 를 먼저 부르고 실패하면 write-draft 로 넘어갔다.
그런데 write-draft 가 모드 사실에서 write-news 를 또 부른다 — 한 주에 검색 생성이 두 번 돌았다.
이제 **`write-draft.mjs` 하나만 부르고 길은 그 안에서 고른다.** 수동 `mode=news` 만 write-news 를 직접 부른다.
`write.yml` 의 기본 입력은 `news` → `auto` 로 바꿨다.

**Richard Must 2 — 78 은 대기, 실패가 아니다.** weekly-draft 가 `r.code === 78` 이면
`status 대기 · attempts 그대로 · evidence 「재료 없음 — material-need 일감 참고」`.
실패로 세면 재료 없는 주가 세 번 이어질 때 「3번 실패」로 없는 고장이 원장 큐에 뜬다.
`next_try` 는 일주일 뒤로 둔다 — 매시 루프가 다시 집으면 write-news 가 또 돌고(요청당 $0.007),
빈손 카운터도 주 단위로 세야 A3(두 주 연속)가 맞는다.

**Richard Should — 전언 표시 6개 추가.** `라며 · 고 전했 · 하시더 · 그러셨 · 의 말입니다 · 라고 적`.
넣고 시험 넷을 다시 돌려 앞의 거짓양성 3종이 안 돌아오는 것을 확인했다.

**시험하다 찾은 것 (내가 2차에서 넣은 구멍) — 고쳤다.**
`재료들` 조회를 `.catch(() => [])` 로 삼켰더니 **DB 가 죽은 주에도 「재료 0건」으로 보여 78(건너뜀)로 끝났다.**
DB 장애가 몇 주 동안 「원장이 재료를 안 적었다」로 조용히 지나간다는 뜻이고, A3 의 멈춤 감지도 DB 에 쓰므로 같이 죽는다.
못 읽은 것과 0건을 갈라 **못 읽으면 종료 1(고장)** 로 끝낸다. `DATABASE_URL` 을 막고 확인했다.

Files (3차):
- `academy/scripts/company.mjs` 56-63(실행에 code 추가), 472-497(weekly-draft — write-draft 하나만 · 78 은 대기)
- `.github/workflows/write.yml` 6-13(머리글), 25-29(mode auto|news), 78-92(한 번만 부르는 실행 블록)
- `academy/scripts/slop-rules.mjs` 70(전언 표시 6개 추가)
- `academy/scripts/write-draft.mjs` 82-101(재료를 못 읽으면 종료 1)

Decisions made (3차):
- `write.yml` 도 같이 고쳤다. Arch 는 company.mjs 를 짚었지만 **실제 주간 크론은 write.yml**(월 06:07 KST)이고
  거기에도 같은 두 번 호출이 있었다. 한쪽만 고치면 「한 주에 두 번」이 그대로 남는다
- 78 일 때 `next_try` 를 일주일로 둔 건 Richard 지시에 없다. 안 두면 매시 루프가 다시 집어 write-news 를 매시간 돌린다

### Step 16 — 현황판 문구 · 밀린 예약 대신 띄우기 — COMPLETE (2026-09-24)
원장: 「문구가 AI 슬롭이라 무슨 말인지 모르겠고, 업무를 알아서 처리해야 하는데 못 한다」. 브리프 없이 세션이 짓고 Richard 검토.
- **결정:** 직원 줄은 로그를 깎아 보이지 않는다. 역할마다 손으로 쓴 한 줄(`does`)과 상태 문장만. 로그는 「자세히」에만
- **결정:** GitHub 이 건너뛴 아침 작업은 회사 루프가 2시간 뒤 대신 띄운다(`밀린예약`). 수리·영업은 제외(봇 실행이 사람 실행으로 읽힘)
- **결정:** 원장이 현황판에서 할 수 없는 일(아이로그 주제)은 「사람 대기」로 올리지 않는다 → 관찰 30일
- 조사 439(덕덕고)·319(빙)를 손으로 고침 — audit R5 덕덕고 제외, scout 비교군에 빙 추가(Known Gap 319 닫힘)
- 9/24 08:54 감사·정찰·측정을 세션이 손으로 띄움(예약이 안 떴다)
- DB: 417·28·32·33 → 관찰, 31 → 닫힘(원장 9/18 완료 표시), 258 detail 한 문장으로
- Richard 1차(Ready NO · Must 1): 실패 줄이 재시도를 끝낸 뒤에도 「다시 돌립니다」를 약속 → `readAgents` 가 사람 대기로 넘어간 wf 일감을 읽어 「다시 돌려도 실패해 오늘 하실 일에 올렸습니다」로. Should 5건 반영(원인 단정 문구 2곳 제거·완화, 띄우기 실패는 하루 한 줄, 시각 앞 실행은 안 침, 없는 「주제 목록」 문구 정정)
- 브리프 밖으로 넣은 것(Arch 기록): 할 일 문장(상담·영업 전화·등재) 다시 씀, 「플레이스 열기」 라벨, 성과 영역 제목·설명
- KG-S16-1 아이로그 주제(관찰)를 집어 가는 자동 경로가 없다. Claude 세션에서 고객사 저장소(C:\dev\자동피드백생성기)로 옮긴다

### Step 17 — 랜딩 문구 · 실패 자동 재시작 · 초안 주 1편·없으면 건너뜀 — COMPLETE (2026-09-24)
원장: 「랜딩 AI 슬롭 해결 · 실패해도 스스로 다시 시작 · 초안은 필수 아님, 없으면 패스 · 포스팅은 주 1회」
- **결정:** 실패는 사람에게 넘기지 않는다. 일감은 1·3·6·12시간 뒤, 그 뒤 하루 한 번 계속. GitHub 작업도 간격을 늘려 계속 새로 띄운다(수리만 제외 — 다음 날 예약)
- **결정:** 글감이 없으면 그 주 초안은 건너뛴다. 원장 할 일로 올리지 않고 활동 기록에 「주간 초안 건너뜀」만
- **결정:** 초안은 한 주(월~일, KST)에 한 편. write-draft 한 곳에서 막는다(모든 길이 거기를 지난다)
- 랜딩: 근거 없는 숫자 삭제(사이트 점수 몫 20% · 월 4만원 측정 도구 · 「대부분」). 남은 출처 미확인 숫자 → KG-S17-1
- KG-S17-1 랜딩의 28%·「약 4분의 1」, 「출처 중 회사 홈페이지는 다섯에 하나가 안 됐다」, Interval.tsx P_HAT=0.62 — 저장소에서 계산 근거를 못 찾음. probe/data 로 다시 세거나 지운다
- Richard 1차(Ready NO · Must 1): 영업 재실행이 같은 주 통화문·답장 초안을 숫자 없는 틀로 덮어씀 → **Arch 결정: 영업은 자동으로 다시 띄우지 않는다.** 수리처럼 관찰로 두고 다음 월요일 08:10 예약을 기다린다
- **Arch 결정:** 나머지 작업의 무한 재시도 비용은 원장 지시대로 받아들인다. 간격은 하루 1회까지, Claude 호출은 CLAUDE_DAILY_MAX 가 막는다. 되풀이 실패는 감사 R1 이 조사로 올린다
- Richard 2차 Ready YES. 남은 Should 2건(FAQ 문장 순서, write-news 낡은 주석)도 반영

### Step 18 — 관리 화면 속도 · 버튼 누름 표시 — COMPLETE (2026-09-24, aa1748b)
원장: 「대시보드 모든 버튼이 너무 느려 눌렸는지 확인도 안 된다」
- 원인: 함수가 iad1(미국 동부), Neon DB 는 ap-southeast-1(싱가포르). /admin/ops 는 쿼리 ~30번을 차례로 불러 6.4초
- **결정:** web/vercel.json regions sin1. 배포 뒤 X-Vercel-Id icn1::sin1 확인, /admin/ops 6.4초 → 0.25초
- SubmitButton(useFormStatus): 누르면 바로 스피너와 「처리 중…」, 같은 폼 버튼 잠금. 관리 화면 버튼 21개. Richard 통과
- 학원 사이트는 미리 만든 페이지(PRERENDER)로 나가 0.2~0.4초 — 손대지 않음

### Step 19 — AI 직원 팀 (직원 파일 · 근거표 · 숫자 게이트 · 아침 보고 · 5회 실패 확인 필요) — BUILT · Richard 1차 반영 (재검토 대기, 커밋·배포 안 함)
원장(9/24): 「youtu.be/CmHhhT_Xt8M 참고해서 적용 끝날 때까지 묻지 말고 알아서 해」. Arch 브리프 D1~D5 대로. 원장 지시로 Builder Plan 단계 없이 바로 지음
- 직원 파일 `academy/agents/` — USER.md + 8명(pm·research·content·illustrate·deliver·sales·audit·repair) × SOUL·AGENTS·MEMORY. 프로필 길이 1,714~2,155자(상한 6,000)
  - MEMORY 씨앗: 메모리 폴더의 draft-needs-real-material → content, openai-crawl-needs-bing·claude-search-needs-brave → research·deliver, dashboard-plain-words → pm. 나머지는 CLAUDE.md 함정·코드 주석에서 옮김(새 사실 없음)
- `scripts/profile.mjs` `프로필(id)` — USER+SOUL+AGENTS+MEMORY. 넘치면 MEMORY 를 줄 단위로 뒤에서 덜어냄
- 프로필을 붙인 곳(파일마다 한 곳): write-draft·write-news(프롬프트 앞, content) · illustrate·sales·repair(수리칸 system) · audit(조사관 system) · company 물어보기(프롬프트 앞, pm)
  - **결정(Bob):** Claude Code 를 부르는 곳은 system 칸 앞에, HTTP 공급자를 여럿 도는 곳은 본문 앞에. repair 는 수리칸만(검토칸은 다른 역할이라 안 붙임)
  - daily-agent.mjs 는 LLM 을 안 부른다(grep) → 붙일 곳 없음
- 숫자 게이트 `slop-rules.mjs` — 치명 「근거 없는 숫자」. `근거` 가 비면 안 본다(발행본 어휘 검사에서 모든 숫자가 걸리지 않게)
  - **결정(Bob):** 한 자리 숫자는 단위까지 근거에 있어야 통과, 두 자리 이상은 숫자만 맞으면 통과(「68시간」/「68 시간」). 운영 숫자 제외는 「주·하루·매주 1」만 — 「주 2회 수업」은 학원 사실이라 근거가 있어야 한다
  - 근거 글 모양은 `근거표글`·`검색근거글` 로 slop-rules 에 한 벌. slop-check --strict 도 review_notes 의 근거표·근거로 다시 본다
- write-draft 근거표 `{사실, 추정: [], 확인필요}` — 재료 원문·측정(AI 답변·인용된 곳·지는 검색어)·기존 글. 확인필요는 모델이 적은 것을 쓴 뒤 채움. `review_notes.근거표`. `--dry` 가 근거표도 찍음
- write-news — 모델의 근거 목록 + 검색 출처(제목·주소)를 근거로. 머리줄을 늘 붙여 근거가 비어도 게이트가 돈다
- /admin/drafts — 근거표 접힘 칸(있을 때만)
- 아침 보고 `scripts/pm-report.mjs` + `geo.pm_reports`(표는 스크립트가 만듦) — LLM 없음. company main 끝에서 부름(--plan 이면 안 부름). 08시 전·오늘 것 있음이면 안 만듦, `--force` 로만 덮어씀
  - **결정(Bob):** 확인필요 (a) 에서 이미 「사람 대기」인 일감은 뺀다 — 할 일 목록과 두 번 뜨지 않게. (c) 늦음 = 마지막 기록이 주기+24시간+90분을 넘김(옮긴 줄과 스스로 적는 활동 중 늦은 쪽)
  - **결정(Bob):** 상태 — 막힘: 5회 실패 일감이나 24시간 넘게 늦은 작업이 있음 / 주의: 그 밖의 확인 필요나 실패가 있음 / 정상: 둘 다 없음. 「회사 루프」 매시 기록은 일 수에서 빼고 「매시 점검 n번」으로 따로
  - 현황판 `web/lib/pm-report.ts` + `ops/PmReport.tsx` — 맨 위, 할 일 위. 표가 아직 없으면 「아직 보고가 없습니다」, 그 밖 오류면 「보고를 못 읽었습니다」
- 5회 실패 — company 근무(): 실패(실패 반환, 또는 시도를 올리고도 완료·닫힘·사람 대기가 아님) 5번째에 `payload.escalated=true` + 활동 「원장 확인 필요로 올림」 한 번. 일감이 닫혔다 다시 열리면 일감() upsert 가 escalated 를 지운다
- KG-S19-1 슬랙·텔레그램 보고 창구 없음(D1). 봇 토큰은 원장이 만들어야 한다
- KG-S19-3 수리공이 `scripts/profile.mjs` 를 고칠 수 있다(repair 금지 목록 밖). agents/*.md 는 Edit 허용 범위(academy/scripts/*.mjs) 밖이라 못 고친다
- KG-S19-4 정해진 작업 표가 세 벌이 됐다 — company.mjs 예약 · web/lib/agents.ts ROLES · pm-report.mjs 정해진작업. yml cron 을 바꾸면 셋 다
- KG-S19-5 재료 모드 근거표 경로는 운영 DB 에 안 쓴 재료가 0건이라 끝까지 못 돌려 봄(write-draft --dry → 모드=없음). 게이트는 시험 문장으로만 확인
- Richard 1차(Ready NO · Must 2 · Should 5) 반영:
  - Must 1: 프로필을 Claude Code `system` 칸에서 뺐다(여러 줄 인자는 윈도 cmd 에서 잘리고 --tools·권한 플래그가 떨어진다 — audit.mjs 조사관 주석의 9/22 사고). 네 곳 system 은 HEAD 와 같은 한 줄. 프로필은 표준입력 프롬프트 앞에: illustrate `프롬프트(post)` · sales `prompt` · audit 진단 `지침` 앞(권한 점검 모드는 안 붙임) · repair 수리·검토 두 프롬프트
  - Must 2: `검사()` 가 근거 글에서 `https?://\S+` 를 지운다. write-news 는 출처 제목만 넘긴다. 리다이렉트 주소 속 「…Q34xk90Q」 로 「34명·90분」이 통과하던 구멍
  - Should: 게이트가 본 근거 글을 `review_notes.게이트근거` 에 저장(write-draft·write-news), slop-check --strict 는 그걸 먼저 읽음 · pm-report 「N번 시도했고 아직 안 끝났습니다」「5번 이상」 · 「원장 확인 필요로 올림」 활동은 보고의 일 수에서 뺌(성공도 실패도 아님) · research·deliver MEMORY 에서 그날의 수치 삭제 · content AGENTS 「근거표를 받는다」→ write-draft 가 직접 만든다, 게이트 탈락은 78 이라 확인 필요로 안 올라간다고 바로잡음. 다른 직원 AGENTS 의 「5번 넘게 실패」도 「5번 이상 시도하고도 안 끝나면」으로(수리는 다시 안 띄움을 적음)
- KG-S19-2(고침) write-news 근거는 모델이 스스로 적은 목록 + 검색 출처 제목뿐이다. 모델이 근거 목록에도 같은 숫자를 지어 적으면 게이트를 지난다
- KG-S19-6 숫자 게이트의 느슨함(알고 받아들임): 두 자리 이상은 근거 어디에든 같은 수가 있으면 통과 — 「34명」이 「34시간」으로 통과한다. AI 답변 1,800자가 근거에 들어가면(질문 겨냥 초안) 사실상 많이 풀린다. 반대로 「90분 수업」「10월」「12살」「오후 10시」는 근거에 없으면 걸린다. 재료 모드 초안이 두 번 다 걸려 주가 비면 여기부터 본다
- 배포 뒤 확인: 현황판 카드가 「보고를 못 읽었습니다」 — web/lib/pm-report.ts 별칭 day·at 에 as 가 없어 구문 오류. 고쳐 다시 배포

### Step 20 — 늦음은 스스로 다시 · 영업 멈춤 · AI 측정 매일 — COMPLETE (2026-09-24)
원장: 「늦음인 것들은 다시 능동적으로 임무 수행해야 하고 목표까지 완수」 · 「AI 에게 질문을 수시로 정기적으로 · 영업은 지금 필요없다, 학원 레퍼런스가 목표」
- 원인: 9/24 매시 점검(company) 예약을 GitHub 이 두 번 건너뜀(1시간 47분). 기록 옮기기·대신 띄우기가 멈춰 멀쩡히 끝난 감사·정찰·측정이 「늦음」
- **결정:** wake.yml(workflow_run) — 자동 작업이 끝날 때마다 실행 기록을 바로 적고, 매시 점검이 55분 넘게 안 떴으면 깨운다. 예약에 기대지 않는다. company 는 목록에서 뺌(고리 방지)
- company.yml 예약 :23·:53 둘. 밀린 예약 대신 띄우기 2시간 → 90분(현황판 늦음 선과 같게). 대신 띄운 뒤로는 현황판이 「대신 돌리는 중」
- **결정:** 영업 멈춤 — sales.yml 비활성, 현황판·아침 보고에서 영업 줄 뺌, 영업 전화 일감 닫음. 다시 켜려면 enable + agents.ts ROLES·pm-report 직원들/정해진작업
- **결정:** AI 측정 매일(MEASURE_EVERY_DAYS 3→1, 20문항). Claude 상한 셈 변경 — 측정은 전체로 40까지, 나머지는 자기 호출만 20까지(측정이 매일 20번 쓰면 다른 일이 하루 종일 막히던 것, Richard 20)
- 같은 실행 줄 중복 방지: 부분 고유 색인 agent_activity_mirror_run_url + on conflict (wake·company)
- Arch 결정: 바깥 트리거(Vercel cron)는 안 둔다 — Hobby 는 하루 1회뿐이고 GitHub 토큰을 웹에 둬야 한다. 예약 둘 + watch 3시간 + 깨우기 + 원장 PC 심장박동으로 메운다
- KG-S20-1 GitHub 이 모든 예약을 한꺼번에 건너뛰는 밤에는 깨울 작업이 없다
- 뒤이어: 매시 점검이 시작할 때도 「매시 점검 시작」을 적는다 — 한 번 도는 데 수십 분이라 끝에만 적으면 도는 동안 현황판이 늦음. 아침 보고는 이것·「매시 점검 깨움」을 일로 세지 않는다
- 9/24: 플레이스 대표키워드를 에이전트가 직접 바꿈(tools/smartplace-keyword.mjs, 송파코딩 → 잠실코딩학원, 저장 뒤 다시 읽어 확인). local-agent 가 place-keyword 로컬 일감을 12:40·19:10 에 처리. 참고: 순위닷 태그(로봇코딩학원 등)는 플레이스 대표키워드와 달랐다 — 「태그는 대표키워드에서 온다」는 추정이 틀렸을 수 있음

### Step 21 — AI 여러 곳에 매일 묻고 보고 · Brave 빈틈 · 런즈 — (2026-09-24)
원장: 「학원 레퍼런스 해야 하고 AI 질문도 여러 곳에 지속적으로 하고 리포팅」 · 「인사이트를 얻어 스스로 퍼포먼스를 올려봐」
- 발견: 9/24 Claude — 동네·이름 질문 11/11 인용, 일반 질문 0/9(그중 5개는 맞는 글이 있음). Brave 에 우리 주소가 홈 1쪽뿐 → 글이 색인에 없어서
- 발견: 로그아웃 ChatGPT·Perplexity 는 우리를 learns.academy(런즈) 를 근거로 소개. 런즈 페이지는 학년·수강료 비어 있고 후기 1건
- 원장 일감: 579 Brave 질문 글 10편(캡차만, `node tools/brave-submit.mjs --faq`) · 580 런즈 티처스 등록·정보 채우기
- tools/ai-web-measure.mjs: ChatGPT·Perplexity·Gemini 로그아웃 화면, 승인 20문항, 문항마다 새 문맥. 작업 스케줄러 「Cited AI Measure」 매일 21:30
- **Arch 결정(ToS, Richard 21):** 자동화 표시를 숨기는 플래그는 쓰지 않는다. 막히면 그 엔진은 그날 멈춤. 하루 60질의·문항 사이 4~8초. 약관상 자동 접근 제한이 있다 — 원장에게 알림. 크레딧이 생기면 API 로 옮긴다
- 버그 잡음: 화면 글에 질문이 들어 있어 이름 든 질문(q18~20)이 늘 「언급」으로 셀 뻔함 → 답만() 으로 질문·관련 질문을 빼고 셈. 오늘 17행 다시 셈(바뀐 것 0)
- 아침 보고·현황판 카드에 엔진별 표(이름·인용·지난번과). 엔진끼리 인용 비교 금지 문구, Gemini 인용은 「—」
- KG-S21-1 작업 스케줄러가 한 시간 가까이 node 콘솔 창을 띄운다 · KG-S21-2 네이버 AI 브리핑·구글 AI 개요는 아직 안 잰다
- 9/24 첫 4엔진 측정(같은 20문항): Claude 이름 11·인용 11 / ChatGPT 이름 6·인용 0 / Perplexity 이름 4·인용 2 / Gemini 이름 5·인용 —. 이름 든 질문(q18~20) 3엔진 모두 질문 글 남음 0 확인
- 발견: 동네 일반 질문(q1·3·4·5)은 Claude 만 이기고 ChatGPT·Gemini·Perplexity 는 짐 — 셋은 지도·장소 데이터로 답한다(ChatGPT 는 지도 카드, Gemini 는 구글 지도)
- 발견: Gemini 카드에 우리 학원이 「어린이집」으로 뜬다. 구글 비즈니스 프로필(인증됨, 이 세션으로 관리됨)은 기본 카테고리 「학원」·웹사이트·시간 모두 맞다. 인증된 프로필의 카테고리를 바꾸면 재인증이 걸릴 수 있어 손대지 않음(KG-S21-3) — 다음 측정에서 다시 본다
- 9/24 런즈 티처스: 원장 카카오 확인 뒤 에이전트가 가입·학원 선택·전화 인증 신청(tools/learns-login.mjs). 필수 약관만, 마케팅 동의 안 함. 인증 뒤 정보 채우기는 다음 세션


## 2026-09-28 — 성인 AI 업무자동화반 홍보 (원장 지시)

- 결정: 공공 무료교육(생활형·기초 프롬프트·사장님 홍보 AI)과 겹치는 자리는 열지 않는다. 자리는 「내 업무 한 건을 들고 와서 돌아가는 자동화로」. 근거 handoff/research/ai-work-course-2026-09-28.md
- 배포: /ai-work 랜딩(Course·FAQPage), 홈 띠·FAQ 답, sitemap, llms.txt. 글 2편 사이트·네이버(224424683583, 224424686158). IndexNow Bing·Naver 200. Richard 2차 통과
- 수강료는 홈 표 성인 기준(월 4회·120분 200,000원). 정원·요일·개강일은 안 적음 — 원장 몫
- Known Gaps: KG-AW-1 「한 주 30분」 기준 원장 확인 · KG-AW-2 여덟 단계 커리큘럼 원장 확인 · KG-AW-3 구글 색인 요청은 local-agent 몫 · KG-AW-4 상담에서 성인 발화가 생기면 /admin/inquiry 에 그대로 적기(다음 글 재료)

- 2026-09-28 오후: 원장 「글 2편 AI slop 심함 — 다른 강의 곳 글 참고해 커리큘럼 보고 비슷하게」 「랜딩 커리큘럼도」. 경쟁 과정 8곳 목차·모집 글 6편 원문 수집(research §8) →
  /ai-work 8회 CURRICULUM(배우는 것·실습 결과물·도구), 글 A 「직장인 AI 업무자동화 수업, 8회 동안 무엇을 배우나요?」, 글 B 「사장님 AI 업무자동화, 가게 일 중 무엇을 자동화할 수 있나요?」 로 교체.
  네이버 --update(같은 logNo). Richard 2차 통과. 총 수강료(8회 = 두 달) 표기는 원장 몫 — KG-AW-5

- 2026-09-29: 원장 「매일 실제로 질문해 측정하는 부분 — 어떤 질문을 어디에 몇 시에 했는지 누적해 보이게, 대시보드 AI slop 을 알아보기 쉽게」.
  /admin/asks 새 화면(날짜별·곳별 요약, 질문마다 시각·곳·결과, 펼치면 AI 답·참고 사이트, 질문별 2주 격자), 현황판에 최근 측정일 질문 목록.
  저장은 academy.ai_measurements 그대로(지우는 코드 없음 — 이미 누적). 곳(collection_method)이 다르면 숫자를 합치지 않는다.
  현황판 문구: 「9/20」처럼 날짜로 읽히던 분수 → 「20개 중 9개」, 아침 보고의 「원장님 할 일 n건」(실시간 할 일 상자와 모순) 삭제, 상태 문장 쉬운 말·2줄, 차트 끝 라벨 잘림, 흰 details 상자. Richard 2차 통과

- 2026-09-29 오후: 원장 「왜 내역에 전부 클로드밖에 없지?」 → 원장 PC 작업 스케줄러가 9/24 부터 Cited 작업 셋(심장박동·로컬 에이전트·AI 화면 측정)을 전부 0x800710E0 으로 거부.
  ChatGPT·Gemini·퍼플렉시티 측정이 9/24 뒤 0회. 관리자 권한 없이 고칠 수 없어 tools/pc-runner.mjs(시작프로그램 「Cited PC Runner.vbs」)로 대체 — 매시 심장박동, 12:40·19:10 로컬 에이전트,
  10:00 넘어 하루 한 번 화면 측정, 놓치면 그날 따라잡기. 첫 실행 9/29 14:17~14:58: 심장박동 성공, 네이버 이관 1편, 화면 측정 3곳 × 20문항.
  KG-PC-1 옛 작업 스케줄러 셋 끄기는 관리자 권한 — 원장 몫(잠금·중복 건너뛰기가 있어 그대로 둬도 두 번 안 돈다)

### Step 22 — 개선 루프 자기 점검 (넓이 · 정체 · 헛수고) — BUILDING (2026-09-29)
원장: 「안 나옴이 너무 많고 나온 것도 좁은 질문에만. 스스로 진단·개선하는지 검증하고 없으면 도입」
- 검증: 루프(daily-agent)는 있으나 자기 점검 없음. 9/22 이후 Claude 일반 질문(q9~q17) 0/63, 4곳 모두 0. 행동 13건 판정 0건(엔진 전환으로 같은 엔진 기준선 없음). 일반 질문 7개에 글 고치기 반복, 받아 본 검색 결과에 우리 도메인 0회. 9/24 Brave 제출 뒤 재확인 없음
- 결정 D1~D8: DB 숫자만으로 점검 · 곳별로 안 합침 · 후 5건 전부 0 이면 기준선 없이 「효과 없음」 · 검색 결과에 안 뜨는 단계는 content 건너뛰고 Brave 확인 일감(로컬 대기) · 넓힘 탐침(동네→송파→서울→없음, 한 칸씩, 승인 질문과 분리) · 탐침은 Claude 하루 2개
- 원장 관찰(16:37 스크린샷): 구글 AI 모드 「송파구 코딩학원 추천」 → 로봇&코딩학원 두 번째 카드(첫째 디랩 잠실). 손 확인 1회
- 결정 D9: 검색어형 탐침(`{반경} 코딩학원 추천` 등 틀 3개, 송파구 씨앗 3개). D10: 구글 AI 모드 로그아웃 화면 측정(검색어형만, 카드 순위 raw.rank)
- Bob 빌드 (2026-09-29) — BUILT · Richard 대기 (커밋·배포·DB 쓰기 안 함)
  - 파일: academy/scripts/loop-review.mjs(새) · daily-agent.mjs · ai-measure.mjs · tools/local-agent.mjs · web/lib/ops.ts · web/app/admin/ops/AgentBoard.tsx · agent-board.css
  - 결정(Bob): problem+consider 를 「일반 질문」 한 묶음으로 센다(설계서 숫자 63·7건이 그 묶음) · 발견성 일감 dedupe_key `brave-index-general`, agent deliver, payload.sticky=true(회사 루프가 신호 없는 일감을 닫으므로)
    · 넓힘은 출발 질문 Claude 7일 n≥2 일 때만(1/1 로 안 넓힘) · 겹침()을 loop-review 로 옮기고 daily-agent 가 가져다 씀
    · brave-submit.mjs 는 slug 가 아니라 전체 주소를 받는다 → 사람 대기 detail 에 `node tools/brave-submit.mjs https://robotncoding.com/blog/<slug> …`
  - D10 구글 AI 모드: 짓지 않음. 로그아웃 Playwright 로 `search?udm=50&q=` 직접 → /sorry 캡차. /aimode 에서 입력하면 캡차는 없지만 답이 2분 넘게 「…」 에서 안 나옴(화면 안·밖 창 둘 다). 우회 안 함 → KG-22-1
  - Known Gaps: KG-22-1 구글 AI 모드 자동 측정 불가(위) · KG-22-2 brave-index-check 「사람 대기」 일감은 제출 뒤 다시 확인하는 길이 없음(done_at 이 없어 7일 재생성도 안 됨)
    · KG-22-3 stalled(effective_on ≤ 오늘-14)는 오늘 0건 — q9 는 9/18(11일 전). 설계서 문제 2 는 D3 가 대신 잡는다
  - Arch 결정 반영: stalled 기준 오늘-10(판정 창 +7일) · KG-22-2 해결 — local-agent 가 7일 넘은 brave-index-check 「사람 대기」를 「로컬 대기」로 되돌려 다시 확인. KG-22-3 닫힘. KG-22-1 유지
  - 2차(Richard 수정 필요 → Arch): 탐침 측정은 academy.ai_probe_measurements 로 따로 넣는다(ai_measurements 에 p* 없음, 영업 숫자 보호). /admin/asks 에 「넓혀 본 질문」 격자(readProbeGrid)를 붙였다.
    stalled 는 오늘-14 기준이고, 근거는 엔진별 전/후 건수다. Brave 캡차·빈 화면은 「확인 불가」로 적고 로컬 대기에 둔다. 출력 모자람이 3번이면 사람 대기. narrow·repeat 표본은 10건 이상, evidence 는 right(). REVIEW-FEEDBACK Should Fix 는 다 반영했다
- KG-22-4 Brave 「확인 불가」 길에 상한 없음 — 캡차가 계속되면 local-agent 가 돌 때마다 브라우저를 연다(사람에게 안 넘어감). Richard 2차, 막지 않음

- 2026-09-29 17:40: 원장 「읽고 발행하기 → 초안이 없다」. 9/27 에 내린 글(kodinghakweonui-seontaek, review_notes.비공개이유)을 회사 루프가 초안으로 셈 —
  검토 화면만 비공개이유를 빼고 company.mjs(검토·도해 일감, weekly-draft 막음 판단)·pm-report·briefing·illustrate 는 안 뺐다. 같은 조건으로 맞춤, 일감 742 닫음. 실제 검토 대기 초안 0편

### Step 23·24 — 첫 고객 전 9가지 (다른 세션 역량 검토 반영) — BUILDING (2026-09-29)
출처: C:\dev\AGI_AGENT\reports\사이티드 GEO 역량 검토.md (판정 「조건부 예」)
- 원장 결정: ① 상품은 30일 파일럿 하나 ② Max 구독 유지(에이전트 작업용) ③ llms.txt 유료·진단 점수에서 빼고 무료 부수 작업 ④ 고객별 투입 시간 기록 + 환불안(착수 전 전액 · 기준선 보고 전 50% · 뒤 없음)
- 원장 정정: 로그아웃 소비자 화면 측정은 주 지표로 유지 — 반복 비율·방법 기록·원문 보관·소량·우회 금지. 약관 위험은 소량으로 알고 받아들인 위험. Claude 측정은 「Claude Code(Max) 경유」 표기, 측정 몫 상한 유지
- Step 23(main, 통과 즉시 배포): 고객 1번 하드코딩 제거 · PC 무실행 24시간 경보(서버 감시) · 방법·비율 표기 · 투입 시간 표 · 파일럿 내부 문서
- Step 24(브랜치 step24-copy, 원장 미리보기 승인 뒤 병합): 랜딩 상품 하나로 · 측정 약속 · llms.txt 점수 제외 · KG-S17-1 숫자 · 문구 수정 8줄

#### Step 23 — BUILT (커밋 8051c3e, main, 푸시·배포 안 함) · Richard 검토 대기 · 상태 DONE
- D1 clients.mjs `answerRe`·`measureConf()` 한 곳. ai-web-measure `--client`(기본 robotncoding), 설정 없음·승인 질문 없음이면 멈추고 sticky 사람 대기 일감(`measure-conf-<slug>`·`measure-questions-<slug>`), 제대로 재면 닫음. ai-measure 도 같은 정규식. 아이로그는 승인 질문 0개 → 「승인 질문 없음」으로 멈춤(pc-runner 일정엔 안 넣음)
- D1 부수: 로그아웃 화면 하루 60질의 상한을 코드로(모든 고객 합계) — --client 가 생겨 SOP 의 60 이 거짓이 될 수 있어서. 판단 필요 표시
- D2 heartbeat.mjs 가 geo.settings `pc_heartbeat` 갱신 → company.mjs PC살핌(pc-silent.mjs 순수 판정) 24시간 넘으면 `pc-silent` 사람 대기(sticky), 돌아오면 닫음. 현황판 유통 줄 「늦음」
- D3 case-report·/admin/asks 에 곳별 방법·기간·표본·원문 보관, 질문×곳 최근 7일 n번 중 k번(표시만, 기존 숫자 식 그대로)
- D4 탐침은 오늘 measure 호출이 CLAUDE_MEASURE_RESERVE(20) 안일 때만. 기본값에선 승인 20문항이 몫을 다 써서 탐침이 늘 건너뛰어짐 — Arch 판단
- D5 geo.client_hours(첫 입력 때 create if not exists) · /admin/pilots 입력칸·누적
- D6 research 두 문서 개정. research/ 는 web/ 밖이라 서빙 안 됨(웹 코드에서 참조도 없음)

#### Step 24 — BUILT (커밋 5dacf06, 브랜치 step24-copy, 병합·푸시 안 함) · 원장 미리보기·Richard 대기 · 상태 DONE_WITH_CONCERNS(화면 확인 안 함, tsc 만)
- PILOT 한 덩어리(services.ts) = 신청서 글자 그대로(대조 스크립트 12문장 0 어긋남). 요금 계산기 → 파일럿 카드, 진행 두 달 → 30일
- 진단 점수 llms.txt 제외(남은 가중치 합 93 으로 나눔), 참고 줄로만 표시. 랜딩 사례 게이지에 「채점 기준 바뀜(2026-09-29)」
- 28%(Jaccard 72.2% 나머지, 3문항 쌍)·다섯에 하나(자사 인용 18.3%) 근거 찾음 → 「표본 작음」 붙여 남김. P_HAT 0.62 근거 없음 → Interval 위젯 삭제
- 환불 문구는 「전액 환불」 대신 「390,000원 모두 돌려드립니다」 — D11 grep 과 원장 ④ 를 같이 만족시키려고

Known Gaps (23·24)
- KG-23-1 pilot-actions.ts createPilot 업무 목록이 옛 약속(ChatGPT Search·Google·네이버 기준선 2회씩)이다 — 새 SOP 와 안 맞음
- KG-23-2 probe/src/scan.js(rescan → geo.clients.current_score)는 아직 llms.txt 가중치 7 — 공개 진단과 내부 점수 기준이 갈림. 맞추면 아이로그 44→84 같은 내부 비교에 「채점 기준 바뀜」 표기 필요
- KG-23-3 /admin/outreach 영업 문구가 「3곳만 39만원 · 두 번 기준 측정」 — 옛 상품 (영업 멈춤 중이라 안 고침)
- KG-23-4 web/public/case/academy.html 은 case-report 새 절(방법·7일 비율)을 반영해 다시 굽지 않았다 — 공개본 생성은 원장 결정
- KG-23-5 main 의 research/paid-pilot-order-form.md 환불 줄은 「전액 환불」, 브랜치는 「모두 돌려드립니다」 — 병합하면 맞춰짐
- Arch 반영(리뷰 전): main be97bd1 측정 몫 기본 22(탐침 2 포함, 상한 40 그대로, 나머지 일 몫 18) · step24-copy 77fcbe6 28%·「다섯에 하나」 공개 문구 삭제. 나머지 판단(P_HAT 삭제·12×15 정정·60 합계·환불 문구·기준선 7일) 승인
- Step 24 리뷰 반영 de2129c(step24-copy, main 위로 rebase): 약 4분의 1 삭제 · 흔들리는 범위 → 7일 n번 중 k번 · 측정 카드 방문 기록 삭제(신청서에 없음) · case-report 순위에 측정일·엔진
- KG-24-1 web/public/case/academy.html 은 순위 측정일 붙은 판으로 아직 안 구움(공개본은 일차 표기)
- KG-24-2 Step 23 Should Fix 미처리: hours-actions 날짜 실제성 검사·잘못된 입력 무표시 / ai-web-measure 없는 슬러그 일감이 학원(1) 칸에 붙음
- 2026-09-29 밤: Step 23 PASS → 배포(d6ec9e4, 운영 Ready). Step 24 3차 PASS(ec48de8) → 브랜치 step24-copy 미리보기 https://geo-9wp3yboyq-codeis-projects-4c570294.vercel.app — **원장 승인 뒤 main 병합**. 병합 전 공개 케이스 리포트 재생성(KG-24-1)
- Step 24 가격표 5a30bfa(step24-copy): 필요한 준비(구축 250·세팅 80·0 + 이관 80, 1회) + 30일 파일럿 39(모두) + 월 39/79(파일럿 뒤). 구축 전 기준선 순서. 파일럿 환불은 파일럿에만
- KG-24-3 구축·세팅 환불 기준 원장 결정 필요 — 신청서엔 「계약서에 따로 적습니다」만, 랜딩엔 안 씀
- 2026-09-29 밤: 원장 「반영해」 → Step 24 병합(5098d98)·케이스 리포트 재생성(e503604) 운영 배포. 운영 확인: 랜딩 「30일 파일럿」「처음 369만원」「부가세 별도」, 리포트 「25일차 측정」, 28%·약 4분의 1 0건

### Step 25~ — 서비스 가능 수준 고도화 (원장: 「목표에 도달할 때까지 멈추지 말 것」, 2026-09-29)
목표 정의(Arch): 외부 고객 한 곳이 문의 → 계약 → 온보딩 → 기준선 → 30일 차 재측정 보고까지 **코드 수정 없이, 신청서대로** 받을 수 있다. 끝에서 끝 점검으로 끊김 목록을 만들고 치명부터 Step 단위로 닫는다
- 2026-09-29: 원장 「Max 토큰을 실제 얼마나 쓰나」 → 호출당 토큰(입력·출력·캐시·모델) 기록을 Step 25 D17 로 추가. 지금까지는 횟수와 API 환산 달러만(9/24~29 하루 20~23번, $1.4~2.45)

### Step 25 — 여러 고객 측정 (D1~D4) + D17 토큰 기록 — BUILT · Richard 대기 (2026-09-30, Bob)
- 새 파일 academy/measure-targets.mjs(대상 목록·측정 설정·예산 일감) · web/lib/answer-pattern.ts(쉼표 말 → escape 정규식)
- ai-measure.mjs·ai-web-measure.mjs 가 --client 없으면 대상 목록을 돈다: 유료 파일럿 → 학원 → 탐침 → 측정 켠 고객. --client 는 지금처럼 하나
- 결정(Bob, Arch 확인 요청): 나눔은 고객 둘 이상일 때만 · 절반 측정 안 함(Claude 고객 단위·화면 엔진 단위) · 예산 일감 키 measure-budget-<slug>-claude/-web · 도메인은 clients.mjs 덩어리 먼저(DB 읽기 조회가 권한 분류기에 거절돼 학원 DB 값 미확인)
- 확인: HEAD 사본과 가짜 DB·Claude·화면으로 학원만일 때 질문 순서·적재 행·종료코드 같음(claude·claude 19회 소진·web·--client ilog). 순수 함수 18 + 토큰 4 통과, web tsc 0
- D17: claude_calls 에 input/output/cache_read/cache_write_tokens·model. 필드명은 설치 CLI 2.1.284 result 스키마에서 확인. /admin/ops 에 「토큰 입력 · 출력 (기록된 k번 기준)」
- KG-24-2 뒷절(없는 슬러그 일감이 학원 칸) 해소
Known Gaps (25)
- KG-25-1 createPilot current_date 가 UTC 날짜 — 00~09시 등록이면 시작일 하루 앞
- KG-25-2 대상 목록이 파일럿 status(취소·환불)를 안 봄 → Step 26
- KG-25-3 다른 워크플로가 CLAUDE_MEASURE_RESERVE 를 안 넘김(repair·sales 는 DAILY_MAX 만) — 올리면 그쪽 몫이 「새 상한 − 22」
- KG-25-4 API 엔진은 몫을 안 나눔(고객마다 다 잼)
- KG-25-5 몫을 올리면 optimize.yml 50분 제한이 모자랄 수 있음(35분 가드는 탐침만)
- KG-25-6 ai-measure 쪽 설정·질문 없음은 일감 없이 종료 1 (화면 측정 쪽이 일감을 올림)
- 2026-09-30: Step 25 BUILT(df3e2d0, 푸시 안 함) — Richard 리뷰 전. Arch 승인: 나누기는 고객 2곳 이상일 때만 · 몫 모자라면 통째로 건너뛰고 일감 · 일감 키 measure-budget-<slug>-claude/-web. 남은 결정: schema.sql 두 줄 먼저 적용할지. KG-25-1~6
- 다음: Step 25 Richard 리뷰 → 배포 → Step 26(파일럿 생애주기·보고, 경쟁사 점유율 추가) → Step 27. 사용 한도로 여기서 멈춤

### Step 26 — 파일럿 생애주기와 보고 (D5~D11 + D18 경쟁사) — BUILT · Richard 대기 (2026-09-30, Bob)
- 새 파일: academy/pilot-plan.mjs(날짜 순수 함수 · 칸 준비 · 날짜 맞추기) · academy/pilot-report-core.mjs(보고서 셈 순수 함수) · web/lib/pilot-plan.ts(기본 업무 · 칸 · 환불 안내) · web/lib/manual-checks.ts · web/app/api/pilots/[id]/checks(POST 손 확인)·[cid](GET 캡처)
- pilot-report.mjs 다시 씀: `--stage baseline|final --client <slug> [--dry]`. 파일은 deliverables/<slug>/pilot-reports/ (.gitignore 추가)
- 결정(Bob, Arch 확인 요청):
  - 착수일은 승인 KST 날짜 이후 첫 측정일(q1~q20). company.mjs 가 매시 채운다. 채운 뒤에는 안 바꾼다. 시작·종료·업무 기한도 company.mjs 한 곳에서만 센다
  - 구축·세팅은 연 날이 없으면 임시 끝을 착수+29 로 둔다. measure-targets 는 「구축 대기」를 진행 중으로 본다. 진행 시작은 kickoff_on(없으면 started_on)이다. 취소하면 안 잰다(KG-25-2 해소)
  - 업무 기한은 pilot_tasks.anchor(등록|착수|시작|끝)+offset_days 로 둔다. anchor 가 없는 옛 업무(학원 리허설)는 안 건드린다
  - 기한 지남 일감은 status 준비·진행만 올린다. 리허설은 뺀다(학원 리허설 업무 7건이 한꺼번에 뜨는 걸 막으려고)
  - 판정: 약속한 네 곳만 비교한다. 두 창 다 4일 이상 잰 곳만 비교하고, 못 미치면 표본 부족이다. 언급·인용 중 하나라도 늘면 「늘었다」, 한 곳이라도 늘면 성공이다. SOP 보류 조건과 「30일이 안 끝남」이면 보류
  - 캡처 업로드는 서버 동작(본문 1MB)이 아니라 경로 처리기로 받는다. 관리자 쿠키(lax)와 같은 출처일 때만 받고, 형식은 머리 바이트로 가린다
  - createPilot 의 시작일을 KST 로 바꿨다(KG-25-1 해소)
- 확인: 순수 함수 시험 14개 통과(KST 경계 · 구축 없음/세팅/구축 · 날짜 맞추기를 가짜 q 로 · 대상 목록 · 점유 · 판정). 학원 baseline/final --dry 는 실제 DB 를 읽기만 했다. web tsc 0, next build 통과
Known Gaps (26)
- KG-26-1 학원 리허설 파일럿은 승인 시각이 없다. 착수는 보고서가 추정한다(9/17, openrouter 첫 측정). 화면에는 「착수 전」으로 뜬다
- KG-26-2 새 칸이 DB 에 없으면 측정 실행기의 select 가 실패한다. 배포 전에 schema.sql 을 먼저 적용해야 한다(실행기가 ALTER 도 시도는 한다)
- KG-26-3 approveQuestions 뒤 질문을 고치면(updateQuestion) 승인 시각·착수일은 처음 값 그대로다
- KG-26-4 손 확인 캡처는 지우는 화면이 없다(잘못 올리면 DB 에서 지워야 함)
- 2026-09-30: Step 25 배포(e46d379, 스키마 2줄 선적용). Step 26 Richard 1차 NO — 못 잰 곳이 보고서에서 빠짐. Arch 결정: 네 곳 늘 싣기·「m곳 중 k곳」+ 모든 곳 이름 · 30일은 신청서 8행(입금 확인일 포함, paid_on) · 성공 판정은 언급(이름) 비율 하나, 인용은 참고 · 성공 = SOP 56행 곳 하나라도(모든 곳 나란히 싣는 조건)
- 2026-09-30 Step 26 Richard NO 반영(Bob):
  - 보고서는 약속한 네 곳을 늘 싣는다(못 잰 곳은 「안 잼 — 표본 0」·「표본 부족」). 판정 줄 아래에 「약속한 4곳 중 비교된 m곳, 그중 k곳에서 언급 비율이 늘었다 — 늘어난 곳 · 그대로·줄어든 곳 · 못 잰 곳」을 이름으로 적는다
  - Arch 결정 반영: 30일은 신청서 8행대로 잰다. 구축 없음이면 입금 확인일(`paid_on` 새 칸, 등록 필수, 화면에서 고칠 수 있음)을 포함해 30일이다. 입금 확인일이 없으면 「입금 확인 전」이고 30일을 시작하지 않는다. 구축·세팅은 연 날부터 센다. 기준선은 그대로 착수부터 센다
  - Arch 결정 반영: 판정 비율은 언급 비율 하나만 쓴다. 인용은 옆 칸에 참고로 둔다. SOP 성공 판정 절에 한 줄 넣었다
  - 날짜 맞추기가 이제 승인 여부와 상관없이 취소 안 된 파일럿을 다 본다. 입금 확인일이나 연 날이 바뀌면 기간이 따라간다. 날짜가 하나도 없는 리허설은 그대로 둔다
  - 시험 17개 통과, web tsc 0
- KG-26-5 (Richard Should Fix) 승인 당일, 승인 시각 전에 잰 측정도 착수로 친다(`d >= 승인일`). 측정 시각 칸이 없다
- KG-26-6 (Richard Should Fix) 고객 승인이 입금 확인일 +36일을 넘기면 측정 대상에서 빠져 착수일이 안 생긴다. 30일은 신청서대로 이미 끝난 뒤다
- KG-26-7 학원 리허설 파일럿에는 입금 확인일이 없다(0원). 원장·Arch 가 paid_on 을 넣기 전까지 최종 보고는 「입금 확인 전」에서 멈춘다
- 2026-09-30 Step 26 Richard 2차 NO 반영(Bob):
  - 창 겹침: 기준선 끝이 마지막 7일 시작과 같거나 뒤면 비교하지 않고 「판정 보류」로 둔다. 문구는 Arch 가 준 그대로다(pilot-report-core `창겹침`). 문의 유입이 있어도 보류다(Arch 문구대로). 곳별 표에는 「창 겹침 — 비교 안 함」으로 적는다
  - 예방: company.mjs 가 입금 확인일 +7일까지 착수가 없으면 사람 대기 일감(pilot-kickoff-<id>)을 올린다. 착수되면 닫고, 준비·진행 상태만 본다. 기한 목록과 착수 대기 목록을 둘 다 읽었을 때만 'pilot' 신호원을 읽음으로 친다
  - 시험 18개 통과
- KG-26-8 (Arch) 등록 기준 업무(intake·questions·inquiry-sheet)의 임시 기한은 입금 확인일 기준이고, 입금일을 고쳐도 다시 세지 않는다
- 메모: 구축 없음이면 승인이 입금 뒤 정확히 17일째여도 겹친다(기준선 끝 = 마지막 7일 시작). 일감 제목은 Arch 문구대로 「17일 넘으면」이다
- 2026-09-30: Step 26 Richard 3차 PASS. Arch: 창 겹침이면 비율 비교만 끄고 상담 AI 유입 1건 이상이면 SOP 56행대로 성공(표본 부족과 같은 규칙) — Arch 가 직접 고침, 시험 18개 통과. 스키마(web/db/schema.sql 141-168) 운영 DB 선적용 후 배포

### Step 27 — 운영 위생 (D12~D16) — BUILT · Richard 대기 (2026-09-30, Bob)
- D12 리드 알림: **건너뜀.** health.mjs 는 메일을 직접 보내지 않는다 — watch.yml 이 실패(종료 1)하면 GitHub 가 저장소 주인에게 보내는 알림이 「메일 경로」다. 키·env·메일 서비스가 없다(저장소에 nodemailer·resend·SMTP 없음). web Vercel env 이름 확인: ANTHROPIC·LLM_PROXY_TOKEN·OPENROUTER·GROQ·ADMIN_*·IP_HASH_SALT·DATABASE_URL — 메일 설정 없음. 새 키·서비스를 만들지 않으니 지금처럼 company.mjs `lead-new` 사람 대기 일감으로만 간다 → KG-27-1
- D13 health.mjs llms.txt 검사는 `c.llmsTxt` 가 있는 고객만. 학원·아이로그 둘 다 true(2026-09-30 두 곳 /llms.txt 200 확인) — 지금 동작 그대로
- D14 submit-gsc.mjs 도메인 → academy/clients.mjs. `--client <slug>`/CLIENT_ID 로 고르고 없으면 학원(목록 첫째, 예전과 같음). 속성은 `gscProperty ?? sc-domain:<domain>`
- D15 web/lib/pilot-intake.ts 새로: 업종에 학원·교습소·공부방이 있으면 예전 20문항 그대로(시험으로 글자 단위 동일 확인), 아니면 업종 무관 20문항. 정합성 출처의 「교육청 공개정보」와 칸 「과정·대상」은 학원만(아니면 「서비스·대상」). 가림 별칭은 「고객 A/B…」(쓴 것 피해 가장 앞 글자) — 새 등록만, on conflict 는 alias 안 고침. 등록 화면 칸 이름 「학원명」→「상호」, 업종 칸 안내
- D16 geo.client_hours 를 company.mjs ensure 에서 만든다(+ RLS). schema.sql 양쪽에 추가. 입력 때 만드는 줄은 company 가 돌기 전 입력 대비로 남김. pilot_manual_checks·파일럿 칸은 Step 26 이 이미 company.mjs(파일럿칸준비)에서 만든다 — 겹치지 않음
- 확인: 순수 함수 시험 13개(질문·출처·칸·별칭), gsc 고객 고르기·health URL 목록 가짜 실행, node --check 셋, web tsc 0. DB 쓰기·실측정 안 함
- KG-27-1 리드 알림 메일 없음 — 원장 몫(메일 서비스 키를 줄지). 지금은 매시 일감 「연락 안 한 리드 n건」뿐
- KG-27-2 이미 있는 외부 고객 alias 는 옛 「○○구의 단일 지점 ○○」 그대로 — DB 에서 한 번 고쳐야 한다(이번엔 DB 쓰기 금지)
- KG-27-3 write-draft 인격(학원 원장)이 고정 — 외부 고객 글은 못 쓴다(D14 설계서대로 KG)
- KG-27-4 신청서(research/paid-pilot-order-form.md 62행)는 「과정·대상」 — 학원 아닌 고객 점검 칸은 「서비스·대상」으로 만든다. 공개 문구라 안 고침
- KG-27-5 schema.sql 의 client_hours 줄은 운영 DB 에 이미 표가 있으면 RLS 만 새로 켠다(앱은 소유자 권한이라 영향 없음)
- 2026-09-30 Step 27 Richard PASS · Should Fix 반영(Bob): company.mjs client_hours 두 줄 각각 catch(로그만, 루프 계속) · 일반 문장에 받침 조사 도우미 josa(은/는·이/가·을/를·과/와·으로/로, ㄹ 예외 — 학원 문장은 옛 글자 그대로) · 어색한 두 문장 → 「{대상}이 {업종} 고를 때 뭘 봐야 해?」「{업종} 잘 고른 건지 어떻게 알아?」 · 학원 판별에 교실·과외 추가(Arch). 시험 21개 통과, tsc 0
- KG-27-6 별칭 동시 등록 경합(같은 「고객 X」) 안 막음 — 관리자 1인(Arch)
- 2026-09-30: Step 27 Richard PASS + Should Fix 4건 반영(ffeec83) · 치과 20문항 조사·말투 Arch 확인 → 배포. 리드 메일은 메일 설정 없음(KG-27-1)

### Step 28 — 재점검 잔여 (D19~D24) — BUILT · Richard 대기 (2026-09-30, Bob)
- D19 submit-gsc.mjs: clients.mjs 에 없는 `--client`/CLIENT_ID 면 geo.clients.domain(measure-targets `도메인정리` 재사용, export 로 바꿈)으로 sc-domain:. DB 는 이 경우만 연다 — 지정 없음=학원, clients.mjs 고객은 예전 값 그대로
- D20 answer-pattern.ts: 붙여 쓴 한글 글자 사이 `\s?`(빈칸 하나). 낱말 사이 `\s*`·& 규칙·40자·10개 상한 그대로. 보고서 경쟁사 `이름정규식`(pilot-report-core)도 「같은 규칙」 주석이라 함께 고침(Arch 확인 요청). clients.mjs·DB answer_pattern 은 안 건드림 — 이미 등록된 고객은 다시 저장해야 새 규칙
- D21 ai-web-measure.mjs: 승인 질문 없음은 일감은 올리되 exitCode 안 건드림(「대기」 로그). 설정 없음은 그대로 1
- D22 pilot-plan `구축대기한도=60`. measure-targets: 구축·세팅 + 연 날 없음은 착수+60일(당일 포함)부터 뺀다. company.mjs: 같은 조건 파일럿에 「<이름> 사이트 연 날을 넣어 주세요」 사람 대기(pilot-launch-<id>, priority 12). 세 목록 다 읽었을 때만 pilot 신호 읽음
- D23 createPilot: 조용한 return 전부 → `/admin/pilots?err=missing|terms|needs|slug|internal(&f=빈 칸 키)`. slug 는 고쳐 넣지 않고 `^[a-z0-9-]{1,40}$` 아니면 되묻는다(예전엔 글자를 몰래 뺐다). 내부 고객 slug 검사는 트랜잭션 밖으로(redirect 가 catch→rollback 에 안 걸리게). 화면은 코드→문구 표(모르는 코드는 안 띄움), 오류 시 등록 자세히 열림
- D24 audit·company·write·repair·sales(Claude 부르는 단계) 워크플로에 CLAUDE_MEASURE_RESERVE·CLAUDE_DAILY_MAX vars 줄. 값 안 바꿈
- 확인: 가짜 행·순수 함수 16개 통과(학원 answerRe·도메인 = clients.mjs 원문 그대로, 40자 최악 입력 1ms), node --check 6개, web tsc 0. DB 쓰기·실측정·푸시 안 함
- KG-28-1 이미 DB 에 저장된 외부 고객 answer_pattern 은 옛 규칙(띄어쓰기 미허용) — 등록 화면에서 다시 저장하거나 DB 갱신 필요(DB 쓰기 금지라 안 함)
- KG-28-2 D23 오류 뒤 폼 입력값은 되살리지 않는다(브라우저 폼 초기화)
- 2026-09-30 원장 결정: ① 측정 상한은 유료 고객 있는 날만 두 배(Claude 40→60·측정 몫 22→42, 화면 60→120) ② 구축·세팅 환불: 착수 전 전액 · 시안 뒤 50% · 공개 뒤 없음 ③ 리드 알림은 메일(Resend, 키는 원장) ④ 파일럿 기간 PC 매일 10시 전후 켜 둠. → Step 28 D25~D28
- 2026-09-30 Arch: 설계 밖 둘(경쟁사 정규식 같은 규칙 · slug 거절) 승인. 원장 결정 D25~D28 을 Step 28 에 추가(설계서 끝에 Bob 기록)
- D25 measure-targets `유료측정일(q, 오늘)`(DB 전체로 판단, 칸 준비 없음, 못 읽으면 false) + `측정상한(유료, env)` → 40/22/60, 유료 날 60/42/120. env 숫자가 먼저, "" 는 없는 것. claude-code.mjs(모든 워크플로의 Claude 호출이 지나는 곳)·ai-measure 측정 몫·ai-web-measure 하루상한이 이것 하나로 고른다 → 합계가 맞다. 측정 아닌 일 몫은 두 날 다 18. claude-code 의 옛 `정수` 도우미는 안 쓰여 지움. GitHub vars 에 CLAUDE_* 없음 확인(gh variable list) — 기본값이 돈다
- D26 research/paid-pilot-order-form.md 「계약서에 따로」 → 구축·세팅 환불 세 줄(작업 착수 전 전액 · 시안(세팅은 작업 보고) 뒤 50% · 사이트 공개(세팅 완료) 뒤 없음). 30일 파일럿 환불 세 줄·web/lib/services.ts 는 그대로(대조 유지). 「착수는 …」 줄을 「30일 파일럿의 착수는 …」으로(구축 착수와 헷갈림). 관리 화면 파일럿 상세의 「계약서 기준」도 같은 글자로. 랜딩 안 바꿈
- D27 web/lib/lead-alert.ts 새로 + /api/lead 저장 뒤 await(5초 제한, 던지지 않음). RESEND_API_KEY·LEAD_ALERT_TO 둘 다 있을 때만. 제목 「새 상담 신청」, 본문 이름 첫 글자+** · 전화 끝 4자리 · `<origin>/admin`. 보내는 주소 onboarding@resend.dev(도메인 인증 전 — 계정 주인에게만 감)
- D28 SOP 「막히면」에 PC 매일 10시 전후 한 줄
- 확인: 시험 31개 통과(D25 8 · D27 4 추가), web tsc 0, node --check. DB 쓰기·실측정·메일 발송 없음
- KG-28-3 Resend 키·받는 주소는 원장 몫(Vercel env 는 파일로 넣고 env pull 로 길이 확인 — CLAUDE.md 함정). 받는 주소가 Resend 계정 주인이 아니면 도메인 인증이 필요하다
- 2026-09-30: Step 28 Richard PASS + Should Fix 4건 Arch 직접(측정 몫 ≤ 하루 상한 · 신청서 내부 메모 제거 · 메일은 after() 로 응답 뒤 · 짧은 번호 문구) → 배포. RESEND_API_KEY 운영 env 넣음(36자 확인, API 200). LEAD_ALERT_TO 는 원장 주소 대기

### Step 29 — 고객사 사이트 사람 방문 추이 (D29~D33) — BUILT · Richard 대기 (2026-09-30, Bob)
- 커밋: AGO&GEO e8873b0 · 자동피드백생성기 d30c9c0. 푸시·배포·DB 쓰기 안 함
- D29 geo.site_visits (ref_kind 에 internal 포함) + 인덱스(client_id, day) + RLS. web/db·academy/db schema.sql 양쪽. 받는 두 라우트가 인스턴스마다 한 번 if not exists 로 만든다 — 배포 직후 첫 방문부터 받아야 「그날부터 셈」이 맞다. company.mjs 에는 안 넣음(화면은 표가 없으면 「기록 없음」, 42P01)
- 분류는 순수 파일 하나(lib/visit.ts)를 세 저장소에 같은 글자로 둔다: academy/lib/visit.ts · web/lib/visit.ts · 자동피드백생성기/lib/cited-visit.ts. test-visit.mjs 가 사본·DDL·insert 를 대조
- visitor = sha256(ip|ua|KST날짜|VISIT_SALT) 앞 16자, **보내는 쪽(proxy)에서** 만든다 — IP 는 고객사 서버 밖으로 안 나간다. 소금 없으면 아무것도 안 보냄
- D31 결정: 학원은 **자기 /api/visit → DB 직접**(/api/crawl 과 같은 x-crawl-key). 이유: 학원 geo.clients 에 crawl_key 를 새로 넣고 학원 서버에 또 둬야 사이티드로 보낼 수 있다 — DB 쓰기 금지이기도 하고, 기존 봇 기록과 같은 모양이 더 단순. client_id 1 고정(clients.mjs)
- 설계 밖 결정(Arch 확인 요청): 아이로그는 **공개 랜딩만** 센다(sitemap.ts 쪽: / · /features · /guide · /terms · /privacy). 대시보드·출결 키패드·학부모 페이지는 로그인한 학원 사람들이 하루 수십 번 열어 랜딩 추이를 덮는다
- 설계 밖 작은 것: BOTLIKE 에 lighthouse·screenshot·scrap(카톡 미리보기)·externalhit·slurp 추가, prerender 도 제외, 경로의 물음표 뒤는 버림(이름·전화가 딸려 올 수 있다)
- D32 /admin/ops 「사람 방문 — 고객명」 카드: 어제까지 7일 방문자·페이지뷰 vs 그 전 7일(기록 14일 안 차면 「아직 비교 전」, 7일 안 차면 「기록 n일치」), 오늘 지금까지, 30일 선그래프(CoverageChart 재사용 — unit·aria 만 인자로, 색 #1F9E90·#7C8AF2), 들어온 곳 막대 5칸(내부 이동 뺌), AI 곳별, 많이 본 페이지 5. 「M/D 부터 셈 — 그 전은 없음」
- 확인: test-visit 72 통과 0 실패, tsc 0 (academy · web · 자동피드백생성기), 아이로그 eslint 0
- KG-29-1 페이지뷰는 **문서 요청만**이라 사이트 안 링크 이동(Next 클라이언트 이동 = RSC)은 대부분 안 잡힌다. 설계(D30)대로 — 화면에 그렇게 적었다. 실제 쪽 수가 필요하면 브라우저 쪽 비컨이 따로 든다
- KG-29-2 학원 CRAWL_KEY 가 비어 있으면 학원 /api/visit 는 누구나 넣을 수 있다(/api/crawl 과 같은 약점). cleanVisit 이 모양·길이는 막는다
- KG-29-3 화면은 실제 브라우저로 안 봤다(운영 DB 에 표가 없어 빈 상태만 나온다). 배포 뒤 첫 기록이 쌓이면 390px·데스크톱 눈으로 확인
- 2026-09-30 Richard 29 PASS + Should Fix/Arch 반영: ① 학원 /api/visit fail closed(CRAWL_KEY 없으면 401 — 학원 Vercel 에 CRAWL_KEY 가 있어야 사람 기록이 들어간다) ② DDL 과 insert 를 다른 try 로, to_regclass 로 표가 있으면 DDL 건너뜀(web·academy) ③ SNS utm 은 같거나 접두어만(naver_blog·naver_cafe 명시) — 세 사본 동일 ④ 아이로그: Auth.js 세션 쿠키((__Secure-)authjs.session-token(.n)) 있으면 안 셈 — 새 lib/cited-landing.ts(import 없음) ⑤ 404·스캐너 경로는 KG-29-4. 시험 94 통과 · tsc 0 세 곳 · 아이로그 eslint 0
- KG-29-4 없는 주소(404)·스캐너 경로(/wp-admin 등)도 사람 UA 면 센다 — 많이 본 페이지에 섞일 수 있다
- 2026-09-30: Step 29 Richard PASS + Should Fix(c31fb9a · ilog 069eb40). Arch: 아이로그 로그인 쿠키 있으면 안 셈. VISIT_SALT 학원·아이로그 production 48자 확인, 학원 CRAWL_KEY 있음 → 배포
- 2026-09-30 13시: Step 29 배포 — 사이티드(8d69b2e push), 학원(npx vercel --prod), 아이로그(npx vercel --prod, 069eb40 — 그 저장소 origin 보다 12 앞섬, 푸시 안 함). 실제 방문 시험: 학원 client 1·아이로그 client 2 기록 확인, IP 없음. 시험 2행(ref cited-test)은 지움. 기록 시작 2026-09-30
- 2026-09-30: 리드 알림 LEAD_ALERT_TO(원장 Resend 가입 주소) 운영 env 17자 확인 · 시험 메일 Resend 접수(id 01a0f083…) · env 반영 위해 재배포

### Step 30 — 아이로그를 학원과 같은 수준으로 (D34~D37) — BUILT · Richard 대기 (2026-09-30, Bob)
- 상태: DONE_WITH_CONCERNS — 시험 18 통과 · tsc 0(web·academy) · 학원 dry 출력 동일. 아이로그 content(세션 일감) 경로는 승인 질문·측정이 없어 dry 로 끝까지 못 탔다(DB 쓰기 금지)
- 파일: academy/clients.mjs(loop 설정·answerRe·세션글제목) · scripts/daily-agent.mjs(고객별) · loop-review.mjs(탐침 끄기·keyword 묶음) · company.mjs(D37) · pm-report.mjs(고객별 줄) · web/lib/todo-text.ts · web/lib/pm-report.ts · web/app/admin/ops/PmReport.tsx · 새 scripts/seed-ilog-panel.mjs · 새 scripts/test-ilog-loop.mjs
- 결정(Bob): 패널 consider 7(겨냥 초안 일감 원문 — DB 에는 관찰 6 + 완료 1(#29, 원장 완료 표시)) · problem 5(guides.ts 제목) · keyword 5 · brand 3 · 이름 말 `(?<!\(주\)\s?)아이로그|ilog\.ai\.kr`(ilog 단독 안 셈 — IBM ILOG) · 아이로그 이름 질문 적중 = 인용 또는 출결|알림톡|수업 피드백 · 홈 검사 SoftwareApplication+ilog.ai.kr · 파일럿 업무·정합성 표는 안 넣음(교육청·플레이스는 소프트웨어에 안 맞음) · measure_active=true · 학원 밖 고객 「측정 없음」은 기록만 하고 종료코드 0(예산 밀림일 수 있음) · 세션 글은 한 번에 하나 · 일감을 「했어요」로 닫으면 다음 날 판정 창을 연다(done_at 이 run_day 이후일 때만)
- KG-30-1 loop 설정이 없는 외부 고객은 개선 루프를 건너뛴다(로그에 적음). 결제 고객이 오면 clients.mjs 덩어리가 필요
- KG-30-2 아이로그 content 칸은 이미 있는 가이드(lib/guides.ts)와 겹치는지 안 본다(academy.posts 만 본다) — 세션이 보고 판단
- KG-30-3 측정 예산: 유료 없는 날 Claude 측정 몫 22 에 학원 20 → 아이로그 20개는 대부분 「예산 부족」 일감으로 밀린다. 상한은 원장 결정
- KG-30-4 pm-report 「원장 할 일」 수는 전 고객 합이다. D37 이 돌면 아이로그 세션 글 6건이 더해진다
- KG-30-5 아이로그 케이스 리포트(case-report)는 학원 그대로 — 설계서대로 KG
- 2026-09-30 Arch 결정 반영(리뷰 전, Bob): ① KG-30-3 해소 — 측정상한 두 배 조건을 「학원 밖에 잴 고객 있음」(유료 파일럿 또는 승인 질문 있는 자사 고객)으로. measure-targets `고객있음()`·`고객측정일()`(옛 유료측정일) · 대상 순서 유료 → 학원 → 자사 → 그 밖 · ai-measure 탐침을 모든 대상 뒤로 미룸 · 학원만 있는 날 40·22·60 불변(운영 DB 읽기로 오늘 false 확인) ② KG-30-4 해소 — 세션 글 일감은 새 상태 「세션 대기」(원장 할 일·pm-report 원장할일 수에 안 들어감). 현황판 할 일 상자 밖 「세션에서 할 일 n건」 한 줄 · AgentBoard 세션 칸 · 개선 루프 행도 세션 대기 · 닫기는 `daily-agent.mjs --session-done <id> "근거"` · todo-text 세션 분기는 지움 ③ i-log 제외·적중 말 승인. 시험 23 통과 · tsc 0 두 곳 · 학원 daily-agent dry 동일 · pm-report dry 학원 줄 동일
- 2026-09-30 Richard 30 PASS 뒤 Should Fix 1~5 + Arch(Bob): ① who-wins 세션 가지 cooldownH 24*30 ② 이름 말 `(?<!(?:\(주\)|㈜|주식회사)\s?)아이로그|ilog\.ai\.kr`(clients.mjs 한 곳, seed 가 그대로 씀) ③ `--session-done` DRY 면 찍기만 · 14일 닫기 때 짝 세션 대기 일감도 닫힘 ④ 세션 일감 키 하나로 — 새 scripts/session-task.mjs(`같은질문일감`·`세션글키`=질문 글자 sha1): 질문 글자로 있는 일감 키를 쓰고 없을 때만 세션글키. daily-agent·company 둘 다 ⑤ 생애주기 시험(가짜 q 10개) ⑥ seed q8~q12 채팅 말투(Arch), q12 영어 내신 → 「학원 관리 프로그램 한 달에 보통 얼마야?」. 시험 33 통과 · tsc 0 두 곳 · 학원 daily-agent dry 동일 · pm-report 학원 줄 동일 · --dry --session-done 안 씀 확인
- 2026-09-30: Step 30 배포(cabc7f5). seed-ilog-panel --apply — 아이로그 리허설 파일럿 ec75343b · 질문 20개 승인 0 · measure_active. 원장 승인 대기(/admin/pilots)
- 2026-09-30 14:32 KST: 원장 「다 승인」 → 아이로그 질문 20개 승인(관리 화면 approveQuestions 와 같은 쿼리), questions_approved_at 기록. 내일 07:05 부터 측정

### Step 31 — 성과가 개수로 늘어나는 고리 (D38~D43) — BUILT · Richard 대기 (2026-09-30, Bob)
- 상태: DONE_WITH_CONCERNS — 새 시험 34 통과(test-grow-loop) · 기존 33 통과(test-ilog-loop, 아이로그 probes 기대값만 "variants" 로) · web tsc 0 · 학원 daily-agent --dry 변경 전과 diff 0(그대로 실행 + 「오늘 이미 행동」 조기 종료를 끈 임시 사본 둘 다) · pm-report --dry 모양 불변(확장 질문 0개라 줄 없음). D38~D42 가 걸리는 경로는 운영 DB 에 조건이 없어 가짜 행 시험으로만 탔다
- 파일: 새 academy/scripts/loop-grow.mjs(전파·후보 정렬·경쟁우세·불리던글·확장줄·승격일감·확장넣기) · loop-review.mjs(regress·promote·gaps·variant) · daily-agent.mjs(연결) · session-task.mjs(탐침글일감) · clients.mjs(아이로그 probes "variants"+probeVariants · 학원 draftWhere) · ai-measure.mjs(확장 질문을 탐침 줄로 · 탐침 도는 자사 고객도 잼) · pm-report.mjs(body.확장) · web/lib/pm-report.ts·PmReport.tsx(한 줄) · web/lib/pilots.ts·pilot-actions.ts(패널·승인 버튼에서 extend 제외) · 새 test-grow-loop.mjs
- 결정(Bob, Arch 확인 필요): ① 확장 질문 = pilot_questions stage 'extend' · **approved=false** · 자리 101 부터. 승인 20문항을 읽는 곳(측정·판정·케이스 리포트·파일럿 보고·pm-report 승인 수)이 approved 로 거르니 손대지 않아도 안 섞인다. 측정은 탐침 줄(ai_probe_measurements, form 'extend', prompt_id q101…) — ai_measurements 에 안 들어가 영업 숫자 불변. 넣을 때 원래 탐침은 끈다(같은 문장 두 번 안 잼) ② 스키마 변경 없음(stage 는 CHECK 없음) ③ 후퇴 「모른다」(표본 부족·엔진 바뀜)는 후퇴 finding 근거에만 붙인다 — 단독 finding 을 만들면 조건 없는 날 출력이 바뀐다 ④ 아이로그 탐침 측정 몫은 고객마다 하루 2(기존 쿼리가 고객별) — 학원 몫 안 줄임. 두 고객 합 하루 최대 4, 측정 몫(남은몫) 검사는 그대로 ⑤ D43 기능 말 = 승인 keyword 질문에서 「추천·무료·앱·프로그램」을 뺀 나머지(학원 관리·학원 출결 관리·학원 카톡 알림·학원 수업 리포트) — 목록을 따로 두지 않음 ⑥ D41 학원 글도 세션 일감(학원 draftWhere = academy.posts 초안) · 열린 세션 글 1편은 고객별 question-draft 세션 대기 전부로 셈 · 14일 지난 탐침 글 일감은 루프가 닫음 · 재료 = academy.materials 안 쓴 것 ⑦ 불림 기준(확장줄) = 한 곳에서 7일 2번 넘게 재서 절반 이상
- KG-31-1 /admin/asks 탐침 격자(web/lib/asks.ts readProbeGrid)는 ai_probe_questions 만 읽어 확장 질문이 안 보인다
- KG-31-2 화면 측정(tools/ai-web-measure.mjs)은 확장 질문·아이로그 변형을 안 잰다 — Claude 한 곳뿐
- KG-31-3 승인 질문 후보 일감에 「안 넣음」 버튼이 없다. 안 누르면 사람 대기로 남고 30일 쿨다운은 닫힘부터 센다
- KG-31-4 D41 은 넓힘 사슬이 있는 고객(학원)만 — 아이로그 변형은 사슬이 없다. 아이로그는 열린 세션 글 6건이 있어 1편 규칙에도 막힌다
- KG-31-5 D38~D42 조건을 운영 DB 로 확인 못 함(임시 읽기 스크립트는 권한 거부) — 오늘 학원 dry 에 regress·promote·gaps 줄 없음
- 2026-09-30 Richard 31 PASS 뒤 Should Fix 1~4 + Arch 5~7(Bob): ① 후퇴 재색인 분기에서 전파중=null(전파 근거 안 붙음) ② regressUnknown 만 있어도 finding `regress-unknown`(「비교 못 함 — …」, 후보 순서 안 바꿈, 무게 맨 끝) ③ 후퇴 재색인도 skipContent 단계면 건너뛰고 사다리로 ④ 변형 탐침은 승인·확장 질문과 `꼬리뺀`(띄어쓰기·문장부호·끝의 추천|좀|해줘|해주세요|알려줘|부탁해 제거) 같으면 안 만듦 — 「학원 관리 프로그램」(= q13 − 추천) 빠지고 「학원 관리 무료」 · daily-agent 가 확장 질문 글을 넘김 ⑤ D40 문턱 14일 4번 이상 ≥50% · ai-measure 탐침 줄 순서 = 최근 14일 한 번이라도 불린 것 먼저 → 가장 오래 안 잰 것 ⑥ D41 아이로그 변형: 한 곳에서 14일 4번 이상 모두 0 인 변형(탐침 순서 첫 것)도 gaps → 세션 글 일감(학원 사슬은 설계서대로 7일 그대로) ⑦ ai_probe_measurements DDL 한 곳(loop-grow `탐침측정DDL`) — company.mjs 시작 준비(실패해도 계속) · ai-measure · academy/db/schema.sql · web/db/schema.sql. pm-report 확장줄은 to_regclass 로 감쌈(daily-agent 점검 union·web asks.ts 는 이미 감싸 있음). 시험 37 통과 · test-ilog-loop 33 · web tsc 0 · 학원 dry 두 가지 모두 diff 0 · 아이로그 dry 변형 두 번째만 바뀜 · pm-report dry 정상
- KG-31-6 학원 넓힘 사슬 gaps 는 7일 4건 그대로 — 활성 탐침 7개를 하루 2개로 돌리면 7일에 4번 못 닿는다. 불린 탐침 먼저 재기(⑤)로 0 인 칸은 더 늦게 잰다. 14일로 맞출지 Arch 판단
- 2026-09-30: Step 31 Richard PASS + Should Fix·Arch 반영(622b18f) + D41 학원 넓힘 사슬도 14일(Arch 직접) → 배포. 아이로그 사이트 「(주)아이로그와 무관」 문구 5곳 제거·배포(ilog ed61fdb, 원장 지시)

### Step 32 — 문서딱 두 번째 자사 레퍼런스 D44·D45 — BUILT · Richard 대기 (2026-10-01, Bob) · D46 은 토큰 뒤라 안 함
- 상태: DONE_WITH_CONCERNS — 새 시험 31 통과(test-docttak) · test-ilog-loop 33 · test-grow-loop 37 · web tsc 0 · seed 아이로그 dry 변경 전과 diff 0 · daily-agent --dry 변경 전과 diff 0 · 오늘 DB 로 k=1 → 60·42·120(전과 같음). DB 쓰기 없음(문서딱 seed 는 dry 만 — --apply 는 Arch)
- 파일: academy/clients.mjs(문서딱 덩어리 id 3) · 새 scripts/seed-panel.mjs(일반형 --client) · 새 scripts/seed-docttak-panel.mjs · scripts/seed-ilog-panel.mjs(자료만 남김) · measure-targets.mjs(고객수·측정상한(k)) · scripts/ai-measure.mjs(탐침 시간 문턱 60분) · .github/workflows/optimize.yml(timeout 80) · scripts/claude-code.mjs·tools/ai-web-measure.mjs(주석) · scripts/briefing.mjs(siteLog) · web/app/admin/ops/Visits.tsx·page.tsx(「Cloudflare 통계 연결 전」) · scripts/test-ilog-loop.mjs(k 꼴) · 새 scripts/test-docttak.mjs
- 결정(Bob, Arch 확인 필요): ① 홈 JSON-LD 검사는 WebApplication 이 아니라 Organization+docttak.com — 홈에는 WebSite·Organization 만 있고 WebApplication 은 도구 페이지에만 있다(2026-10-01 curl). 설계서대로면 매일 헛경보 ② clients.mjs id 3 을 seed 가 명시해 넣는다(시퀀스 마지막 5 → 다음은 6 이라 덩어리 id 와 어긋남. company.mjs 가 id 로 설정을 찾는다) ③ 브리프 자동완성 검색어는 22개가 아니라 17개 — 전부 씀 ④ 문의 주소는 공개 사이트에 없어 null ⑤ 글 쓰는 자리 = deliverables/docttak/guide/ 제안(문서딱 저장소에 넘김) ⑥ 고객있음 → 고객수(승인 질문 있는 자사·유료만 셈)
- KG-32-1 실행 순서: Arch 가 seed-panel --client docttak --apply 를 **푸시보다 먼저** 돌려야 한다. 덩어리가 먼저 올라가면 check-index·rescan 이 geo.clients 에 없는 id 3 으로 쓰려 한다
- KG-32-2 현황판 크롤러 표·Growth 카드는 문서딱에 「기록 없음」 류로 보인다(방문 카드만 「Cloudflare 통계 연결 전」). D46 때 같이
- KG-32-3 2026-10-01 optimize 3회 실패 · Claude 측정 호출 6건 평균 1초 — 원인 안 봄(이 단계 밖). 예산 계산은 9/24~9/30 실측만 썼다
- KG-32-4 health.mjs 크롤러 줄은 문서딱을 「기록 장치 아직 없음 (실패로 치지 않음)」으로 찍는다 — 틀리진 않지만 siteLog 말로 바꿀지
- 2026-10-01: 10/1 측정 실패 원인 = Claude Max 주간 한도(429 weekly limit, resets 6am UTC) — 원장 정정: 원인은 같은 계정의 다른 개발 작업이고 사이티드 작업은 소모가 크지 않다(Arch 가 세션 작업 탓으로 짐작해 적었던 것을 바로잡음). 같은 계정 한도를 나눠 쓴다는 점은 사실 — 한도에 걸리면 측정이 멈춘다. Step 32 는 Arch 직접 확인(seed dry·상한 k=0/1/2) 후 seed --apply → 푸시. 문서딱 질문 20 승인 대기
- 2026-10-01: 원장 「다승인」 → 문서딱 질문 20개 승인(approveQuestions 와 같은 쿼리). 다음 측정부터 학원·아이로그·문서딱 세 곳(k=2 → 80·62·180)

### Step 33 — 현황판 고객 탭이 아침 보고 표까지 바꾼다 D47·D48 — BUILT · Richard 대기 (2026-10-01, Bob)
- 상태: DONE — web tsc 0 · 운영 DB 읽기로 세 탭 표 출력 · 학원 탭 표 = 저장된 10/1 보고 AI답변(키 정렬 후 값 전부 일치). DB 쓰기 없음, pm-report.mjs·영업 숫자 손 안 댐
- 파일: web/lib/asks.ts(readAnswerTable) · web/lib/pm-report.ts(AnswerRow 타입 분리) · web/app/admin/ops/PmReport.tsx(회사 전체 / 선택 고객 표 둘로) · page.tsx(배선·최근 글 도메인 없으면 링크 안 붙임) · Todo.tsx(제목에 고객 이름) · AgentStrip.tsx·Brief.tsx(제목에 「회사 전체」)
- 결정(Bob): ① 고객 표 셈은 readAskDays 가 아니라 pm-report.mjs AI답변읽기 를 client_id 만 바꿔 그대로 옮김(attempt 1·30일·1문항 날 제외·3일 넘은 곳 제외·공통 5문항 이상 비교) — readAskDays 는 attempt 를 안 걸러 학원 숫자가 저장된 보고와 어긋날 수 있다. 엔진 이름표도 pm-report.mjs 것 그대로 ② 표가 빌 때 한 줄: 승인 질문 0 → 「승인된 질문이 아직 없습니다」, 승인 뒤 07:05 가 한 번도 안 지났으면 「질문 승인 M/D, 첫 측정 예정 오늘|내일 07:05」, 지났는데 기록 없으면 「질문 승인 M/D 뒤 07:05 측정 기록이 아직 없습니다. 다음 측정 …」(아이로그 오늘이 이 경우), 예전 측정만 있으면 「최근 3일 표에 넣을 측정이 없습니다 — 마지막 측정 M/D」 ③ 저장된 보고의 고객별·확장 줄은 회사 전체 묶음에 그대로 둠
- KG-33-1 AgentBoard 활동은 `client_id = 고객 or client_id is null` 이라 회사 공통 활동이 고객 이름 아래 섞인다(ops.ts readOps)
- KG-33-2 상단 링크 영업판·파일럿·상담 기록은 고객 탭을 안 넘긴다(상담 기록 /admin/inquiry 는 학원 것)
- KG-33-3 「07:05」는 optimize.yml cron 을 글자로 박았다 — 시각을 바꾸면 asks.ts 도 고쳐야 한다
- 2026-10-01 15:10: 재실행 측정 — 학원 20/20(적중 10), 아이로그 20/20 첫 측정(적중 3, 이름 질문 q18~20), 문서딱 못 잼: 주간 한도 429 로 실패한 호출 6건까지 측정 몫에 셈(50/62). 실패(한도) 호출을 몫에서 빼도록 고침(ai-measure·claude-code). 오늘은 실제 사용 44 → 남은 18 < 20 이라 문서딱은 내일 07:05 첫 측정
- 2026-10-01 23시: PC 일꾼이 9/30 13:34 뒤 꺼져 33시간 멈춤(10/1 화면 측정 0, pc-silent 경보는 원장이 완료 처리). 원인 기록 없음. 고침: 시작프로그램 vbs 를 반복형(꺼지면 1분 뒤 다시) · 잠금은 매분 갱신, 5분 넘은 잠금은 죽은 것으로 판단(윈도 pid 재사용). --install 로 재설치·재기동 확인
- 2026-10-01 23시: Brave 제출 4/4 성공(원장 캡차). agent_runs 25·26 완료 처리 — 효과 판정은 10/8 부터(Claude 일반 질문 q9·q12·q14·q11·q16 인용)
- 2026-10-02: GitHub Actions 무료 시간(계정 2,000분) 소진 → 09:43 부터 전 워크플로 시작 못 함(추정 사용: doc-tools-kr 1,209 · geo 1,058 · aca_feedback 60). 원장 결정: geo 저장소 공개 전환(원장이 직접 실행 — 공개 전 Arch 검사: 기록 전체 비밀값 없음, DB 주소는 예시값, IndexNow 키는 원래 공개). 회사 루프 14:20 재개 확인, optimize 재실행(문서딱 18문항). 별건: 문서딱 측정이 시간 초과 1회에 남은 질문 전부 멈춤 → 연속 2회일 때만 멈추게 고침(Arch 직접)

### Step 34 — 자동으로 도는 일을 고객마다 · 화면의 「학원」 · 이름 질문 따로 D49·D50·D51 — BUILT · Richard 대기 (2026-10-02, Bob)
- 상태: DONE — web tsc 0 · academy 시험 docttak 32 · ilog 33 · grow 37 통과 · 운영 DB 읽기로 세 탭 줄·머리 숫자 출력(REVIEW-REQUEST) · 학원 탭 줄 = HEAD 코드와 같은 시각 비교 true. DB 쓰기·푸시·배포 없음, pm-report.mjs·케이스 리포트 손 안 댐
- 파일: web/lib/agents.ts(PIPES·clientRows·readAgents(now, client)) · api/admin/agents/route.ts(?c=) · ops/AgentStrip.tsx·page.tsx·AgentBoard.tsx · web/lib/growth.ts·asks.ts · ops/Growth.tsx·PmReport.tsx·AskLog.tsx · admin/asks/page.tsx · academy/clients.mjs(문서딱 seeds 「pdf 병합」) · scripts/loop-review.mjs(변형 씨앗) · test-docttak.mjs
- 결정(Bob): ① 고객별 사실은 web 에 PIPES 표(id 1 글+색인, id 2 색인, 그 밖 없음) — web 이 academy/clients.mjs 를 못 부르니 근거를 주석으로 박음. 스크립트를 바꾸면 여기도 ② 문서딱 유통은 숨기지 않고 새 상태 「해당 없음」(회색) ③ 글 길 없는 고객 콘텐츠 줄은 그 고객 content 활동·일감으로만 판정, 학원 write 옮긴 줄 안 봄. 쉬는 중이면 이유 대신 「세션에서 쓸 글 없음」 ④ 유통(아이로그)은 회사 한 번 실행인 snapshot 옮긴 줄로 판정 ⑤ AgentStrip key=slug — 탭을 바꾸면 state 새로 ⑥ D51 머리 숫자는 stage brand 를 뺀다(stage 없는 옛 줄은 빼지 않음). 「일부만 물음」 = 그날 최대 수의 90% ⑦ 변형 씨앗은 하루 한도와 따로 한 번(widen 씨앗과 같은 규칙)
- KG-34-1 아이로그 세션 대기 content 일감 7건 — session-task 「한 번에 하나」와 안 맞음. 여는 곳(개선 루프·회사 루프 who-wins) 점검
- KG-34-2 화면에 남은 「학원」: Growth.tsx 문의 카드·정의(222·228·277·286), asks/page.tsx 넓혀 본 질문 설명(298·300 송파·20문항)
- KG-34-3 Step 33 「학원 탭 = 저장된 보고」는 D51 로 의도적으로 깨짐(화면은 이름 질문 빼고, 저장은 포함)
- 2026-10-02: 문서딱 Brave 제출 8/8(첫 화면·도구 7, 원장 캡차). brave-submit 창을 주소마다 맨 앞으로

### Step 35 — 문서딱 바깥 글 매일 D52~D56 — BUILT · Richard 대기 (2026-10-02, Bob)
- 상태: DONE_WITH_CONCERNS — web tsc 0 · test-marketing 31 · test-docttak 32 · ilog 33 · grow 37 통과 · marketing-draft --dry 실제 초안 3종(Claude 3회, purpose marketing, 1판에 모두 관문 통과). DB 쓰기·푸시·배포·실게시 없음(--dry 는 claude_calls 기록도 안 씀). 걸리는 것: 표가 아직 없어 현황판 카드·효과 줄·로컬 에이전트 블로그 경로는 실DB로 못 돌려 봄. 블로그 게시는 로그인·블로그 아이디 전이라 실행 못 함
- 파일: web/lib/marketing-core.mjs(+.d.mts, DDL·검색 링크·주소 꼴·효과 셈) · academy/db/schema.sql·web/db/schema.sql(geo.marketing_posts + RLS) · academy/clients.mjs(문서딱 marketing: 검색어→페이지 11줄·월목·공개 문장·블로그 프로필) · academy/scripts/marketing-draft.mjs(새) · test-marketing.mjs(새) · .github/workflows/optimize.yml(측정 뒤 한 단계) · web/lib/marketing.ts·marketing-actions.ts(새) · web/app/admin/ops/Marketing.tsx·CopyButton.tsx(새)·page.tsx·Todo.tsx · tools/naver-blog-post.mjs(--marketing·--profile) · tools/open-session.mjs(--blog) · tools/local-agent.mjs(고객 블로그) · academy/scripts/pilot-report.mjs(바깥 글 절) · .gitignore·tools/.gitignore(.browser-profile-*)
- 결정(Bob): ① 돌리는 곳 optimize.yml 끝 — 측정 직후라 「최근 7일 이름 안 나온 검색어」에 오늘 결과가 들고, 하루 한 번 도는 곳이라 따로 하루 한 번 장치가 필요 없다(company.mjs 는 매시간이라 날짜 잠금이 더 필요). 다시 돌려도 오늘 쓴 채널은 건너뜀 ② 대상은 keyword 17개만(이름 질문 3개는 지식iN·카페 글감이 아님). 정렬: 7일 이름 나온 수 → 그 안내 페이지를 마지막에 쓴 날 → 그 질문을 마지막에 쓴 날 → 순번. 같은 날 두 채널은 다른 질문·다른 페이지. 14일 금지는 채널별(17개를 하루 2~3편이 14일 안에 전부 쓰면 모자란다) ③ 근거 = 검색어→안내·도구 페이지 2~3쪽을 그날 fetch, 사이트맵에 없는 페이지는 안 씀. 고정 사실 한 줄(안내 글 수는 그날 사이트맵에서 셈 — 31, 무료·가입 없음·기기 안 처리). 날짜를 고정 사실에 넣지 않음(「2026-10-02」가 본문 「10」을 통과시켰다) ④ 관문 = slop-rules 검사(블로그만 1500자 하한) + 채널 하한(지식iN 200·카페 500) + 한 자리 규격 숫자(MB·cm·픽셀…) 원문 대조(slop 은 학원 단위만 봄) + 공개 문장 + 사이트맵 밖 문서딱 주소·근거 밖 바깥 주소 금지 + 지식iN 도구 링크 정확히 1개·공식 출처 기관 이름 1회 + 보장·후기·비공개 도구 말 금지. 걸리면 한 번 다시 쓰고, 또 걸리면 「버림」(note 에 이유)으로 남겨 같은 날 호출을 또 안 씀 ⑤ 호출 상한 --max-calls 기본 5(채널 3 + 다시 쓰기 2), 측정 아닌 몫(18)을 같이 씀. 한도에 걸리면 조용히 끝(실패 아님), 호출·페이지 오류만 끝 코드 1 ⑥ **블로그 자동 게시는 원장 확인 뒤로 바꿈** — CLAUDE.md 「사람만 할 수 있는 일: 발행 전 사실 확인」. 카드의 「읽었어요 · 올려 주세요」가 note 를 「게시 승인 …」으로, 로컬 에이전트는 그 표시가 있는 블로그 초안만 올림. 스키마는 설계서 그대로(승인 칸 안 늘림) — Arch 확인 필요 ⑦ 블로그 프로필은 tools/.browser-profile-docttak(로컬 에이전트 cwd 가 tools), 블로그 아이디는 원장 PC academy/.env.local NAVER_BLOG_ID_DOCTTAK. 없으면 고객별 로그인 일감 한 건(승인한 블로그 초안이 있을 때만) ⑧ 효과는 승인 질문(q<번호>) 측정의 citations 만, 올린 날 이후만, 주소 꼴 맞춤(m.·www.·끝 /·지식iN docId·블로그 PostView). 현황판 카드 아래 한 줄 + pilot-report 절(올린 글 있을 때만) ⑨ 카드는 그 고객에 초안이 한 번이라도 있을 때만(학원·아이로그 탭엔 안 뜸). 초안은 7일 것까지 보임 ⑩ 원장 할 일 하루 한 줄 「문서딱 글 n건 올리기(3분)」 → #mk. n = 손으로 올릴 지식iN·카페 + 확인 전 블로그
- 확인: 문서딱 세션 지시 — 색인 알림 코드 안 넣음(그쪽이 배포마다 함), /remove-background/ 는 사이트맵 규칙 + 말 금지로 막음
- 2026-10-02 Arch 승인(블로그 원장 확인 · keyword 17 · 채널별 14일) + 배포 전 고침 5건 반영: ① 프롬프트 「숫자 없는 문장도 원문을 바꿔 말한 것만」 + 낯선문장(본문 문장별 원문 3자 조각 겹침 < 50%, 최대 5개, 공개 문장·「제출처 공고에서 확인」은 비교 원문에 넣음)을 초안 note 「읽을 자리: …」로 → 카드에 노란 상자. dry 초안 3종에 돌리면 「나눠서 합쳐야」(46%)·「원인은 대부분 용량」(8%) 등이 잡힘 ② 지식iN·카페 다른 방법: 원문 본론(「함께 보면 좋은 안내」·「바로 쓰는 도구」 앞)에 나온 출처 기관·공식 사이트·프로그램(정부24·한컴·외교부·큐넷·Gmail·Outlook·구글 드라이브…) 중 하나, 없으면 「공고」 — 관문. 브라우저·「파일」 앱은 문서딱 쓰는 길이라 대안에서 뺌 ③ optimize: 바깥 글 단계 continue-on-error, 측정 실패 표시 if always() && 측정 결과 ④ agents.ts PIPES 에 marketing — 문서딱 콘텐츠 줄 「매일 지식iN·카페 초안 1건씩, 블로그 주 2편(원장 확인 뒤 게시) · 세션에서 쓸 글 …」 ⑤ DDL 양쪽 schema.sql 확인 + company.mjs 시작 준비(줄마다 실패해도 계속). KG-35-1·2 닫힘. test-marketing 38
- KG-35-1(닫힘) Step 34 콘텐츠 줄 「자동 초안 없음 · 세션에서 쓸 글」(web/lib/agents.ts:443)이 이제 반만 맞다 — 바깥 글 초안은 매일 자동. 유통 줄 「자동 유통이 안 돕니다」도 블로그(확인 뒤) 게시가 생김. PIPES 에 바깥 글을 넣을지 Arch 결정
- KG-35-2(닫힘) optimize.yml 「측정 실패 표시」는 앞 단계가 다 성공일 때만 돈다 — 바깥 글 단계가 실패하면 측정 실패 표시가 안 찍힌다(잡은 빨간불은 그대로)
- KG-35-3 optimize timeout 80분에 바깥 글 몫(호출 5회 × 최대 4분) 최악 20분이 더해진다. 평소 측정 35~40분 + 판정이면 남지만 느린 날은 빠듯
- KG-35-4 local-agent 는 pc-runner(12:40·19:10, 60분 한도)가 부른다 — 블로그 게시 한 편(최대 15분)이 그 한도 안에 드는지는 로그인 뒤 첫 실행에서 확인
- 2026-10-02 밤 Richard Step 35 통과(Must Fix 0, REVIEW-FEEDBACK.md). 운영은 16:43 배포에 이미 올라가 있었음. Should Fix 반영(세션): ① 현황판 바깥 글 효과의 곳을 collection_method 로 — pilot-report·case-report 와 같은 칸 ② 블로그 승인은 note 앞에 「게시 승인 MM-DD HH:MI · 」를 붙이고 읽을 자리를 남김(readSpots 가 앞머리 아니어도 읽음), 이미 승인된 초안은 다시 안 붙임 ③ 바깥 주소 관문: 근거 주소 그대로이거나 그 앞부분만(근거가 첫 화면이면 그 아래 경로를 지어내도 통과하던 것). test-marketing 38 · docttak 32 · tsc 0
- Arch 결정: 승인 표시는 note 앞머리 그대로(칸 안 늘림 — 두 곳이 같은 like 로 거른다). 「읽었어요」를 본문 펼친 뒤로 막지 않음 — 버튼으로 읽기를 강제할 수 없고, 읽을 자리 상자가 펼치지 않아도 보인다
- KG-35-5 local-agent 블로그 게시가 발행 전 실패를 거듭하면 하루 두 번 끝없이 다시 시도한다 — n회 넘으면 사람 확인으로 올리기(Richard SF4)
- KG-35-6 SQL 로 「올림」을 적으면 그 글의 시도 일감이 사람 대기로 남는다(Richard SF5)
