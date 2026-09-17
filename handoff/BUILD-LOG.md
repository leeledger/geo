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
