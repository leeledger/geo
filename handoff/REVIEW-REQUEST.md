# Review Request — Step 2
*Written by Builder. Read by Reviewer.*
Date: 2026-09-11
Ready for Review: YES

저장소 `C:\dev\자동피드백생성기` (아이로그). 커밋 안 함.
`git diff --stat` (내 파일만): 4 files +78 −39, 새 파일 `lib/reports/view-access.ts` 60줄 (untracked).
같은 시각 Arch 가 고치는 `app/page.tsx`·`app/features/page.tsx`·`lib/guides.ts`·`components/seo/*`·`public/llms.txt` 는 이 요청에 없다.

## Files Changed
- `lib/reports/view-access.ts:1-60` (새 파일) — `checkReportViewAccess(report, { token, academy, slug })` → `'ok' | 'forbidden' | 'expired'`. API 와 메타데이터가 같이 쓰는 한 개의 판단 함수
  - `:23-29` `tokenMatches` — 문자열 아닌/빈 `view_token` 이면 false, Buffer 길이 먼저 비교 후 `crypto.timingSafeEqual` (길이 달라도 안 던짐)
  - `:32-34` `isApproved` — `String(value)` 가 `'1'|'t'|'true'`. content route:257 `CAST(is_approved AS text) IN (...)` 와 같은 판정
  - `:42-46` (a) 토큰 일치 + 만료 전이면 ok, 일치했는데 만료면 `tokenExpired` 표시
  - `:49-57` (b) academy·slug 둘 다 있으면 `findStudentByPortalSlug(academy, slug)` → `portalEnabled` && `studentId === report.student_id` && 승인
  - `:59` 둘 다 아니면 토큰이 맞았고 만료였을 때만 `'expired'`, 나머지 `'forbidden'`
- `app/api/reports/[id]/public/route.ts:5` — view-access import
- `app/api/reports/[id]/public/route.ts:7-8` — 응답에서 뺄 필드 `view_token`·`token_expires_at`·`ai_raw_response`
- `app/api/reports/[id]/public/route.ts:45-62` — 「토큰 있을 때만 검증」을 `checkReportViewAccess` 로 교체. expired → 410(기존 문구), forbidden → 403 `링크가 올바르지 않거나 만료되었습니다.`. 404(없는 id)는 앞 `:36-41` 그대로
- `app/api/reports/[id]/public/route.ts:133-139` — `report` 에서 비공개 필드를 걸러 `publicReport` 로 응답
- `app/api/parent-portal/[academy]/[slug]/content/route.ts:281` — 포털 리포트 목록 `view_url` 에 `?academy=…&slug=…` (encodeURIComponent)
- `app/reports/[id]/view/ReportViewClient.tsx:50-51,61-67,82` — URL 의 token·academy·slug 를 `URLSearchParams` 로 API 에 전달, 의존성 배열에 추가. 토큰도 이제 인코딩됨(hex 라 값 변화 없음)
- `app/reports/[id]/view/page.tsx:9` — Props 에 `searchParams`
- `app/reports/[id]/view/page.tsx:12-20` — `ROBOTS = { index: false, follow: false }`, 조건 불충족·조회 실패 시 `GENERIC_METADATA`(「학습 리포트 - 아이 로그」, 학생·학원 이름 없음)
- `app/reports/[id]/view/page.tsx:22-25` — 쿼리 값이 배열이면 첫 값 (`URLSearchParams.get` 과 같은 동작)
- `app/reports/[id]/view/page.tsx:34-36,46-54` — 메타데이터 쿼리에 `is_approved`·`view_token`·`token_expires_at` 추가, 같은 `checkReportViewAccess` 로 판단, ok 가 아니면 generic
- `app/reports/[id]/view/page.tsx:56-65,68` — ok 일 때만 학생 이름·학원명 제목, 모든 반환에 robots noindex

## Definition of Done
- [x] **토큰·포털 증명 둘 다 없으면 403** — `view-access.ts:42` 토큰 없음 → 건너뜀, `:49` academy/slug 없음 → 건너뜀, `:59` `'forbidden'` → `route.ts:57-61` 403
- [x] **틀린 토큰 403** — `view-access.ts:27`/`:28` 불일치 → `:59` forbidden → `route.ts:57-61`
- [x] **만료 토큰 410** — `view-access.ts:45-46` → `:59` expired → `route.ts:51-55`
- [x] **올바른 토큰 200** — `view-access.ts:45` ok → `route.ts` 나머지 흐름 그대로 200
- [x] **응답에 `view_token`·`token_expires_at`·`ai_raw_response` 없음** — `route.ts:8,133-139`. 보기 화면은 이 필드를 안 쓴다 (`app/reports/[id]/view` grep 0건)
- [x] **포털 목록 링크에 academy·slug** — `content/route.ts:281` → `ReportViewClient.tsx:61-67` 가 API 로 넘김
- [x] **다른 학생의 slug 로는 403** — `view-access.ts:52` `studentId !== report.student_id` → forbidden
- [x] **메타데이터가 조건 없이 학생 이름을 안 냄** — `page.tsx:47,54` → `GENERIC_METADATA`, 이름은 `:56-57` (ok 이후)에서만
- [x] **robots noindex** — `page.tsx:12,19,64` (generic·ok·catch 전부 `ROBOTS`)
- [x] **`npm run build` 성공** — 라우트 표 끝까지 출력, `ƒ /reports/[id]/view` 포함. Arch 의 동시 수정분이 섞인 작업 트리 기준
- [x] **REVIEW-REQUEST·BUILD-LOG** — 이 파일, BUILD-LOG Step 2

## 순수 로직 확인 (DB 없음, 파일 삭제함)
Node 22 `--experimental-strip-types` 로 **실제** `lib/reports/view-access.ts` 를 불러오고, 로더 훅으로 `@/lib/parent-auth` 만 스텁으로 바꿔 20건 확인 — 전부 통과:
토큰·포털 없음 forbidden / 틀린 토큰(같은 길이·다른 길이, 안 던짐) forbidden / 맞는 토큰 미래 만료(Date·ISO 문자열) ok / 맞는 토큰 지난 만료 expired / 리포트에 view_token 없음 forbidden / 틀린 토큰+만료 행 forbidden / 만료 토큰+유효 포털 ok / 포털 같은 학생 승인 1·true·'t' ok / 다른 학생 slug forbidden / 포털 꺼짐 forbidden / slug 없음(null) forbidden / 미승인 0·null forbidden / academy 만 있고 slug 없음 forbidden / 조회 인자 순서 (academy, slug), 토큰이 맞으면 포털 조회 안 함.
실제 학생 데이터·운영 DB 호출 없음.

## Open Questions
1. **`token_expires_at` 이 null 인데 토큰이 맞으면 ok** — 기존 동작(`expiresAt && …`)을 그대로 뒀다. brief (a) 는 「만료가 지나지 않음」이라 null 을 어떻게 볼지 명시가 없다. `generate-token:92` 는 항상 둘 다 넣고 cron 은 둘 다 지우니 정상 흐름에선 안 나온다. 막아야 하면 `view-access.ts:45` 한 줄
2. **토큰 경로는 승인 여부를 안 본다** — 기존 동작 그대로. brief 는 승인 조건을 포털 경로(b)에만 걸었다. 대시보드 공유 버튼이 미승인 리포트에도 토큰을 내는지는 확인 안 함
3. **generic 메타데이터에서 학원명도 뺐다** — brief 는 「학생 이름 없이 『학습 리포트』」, 문제 설명엔 학원명도 새는 항목으로 적혀 있어 기존 catch 문구 「학습 리포트 - 아이 로그」를 썼다
4. **만료 토큰이 410 인 건 cron 이 지우기 전까지만** — `cron/daily-usage/route.ts:102-104` 가 만료 즉시 `view_token` 을 null 로 만든다. 그 뒤 같은 링크는 토큰 불일치로 403. 기존에도 같았다(불일치 403). DoD 「만료 토큰 410」은 코드 경로 기준으로 충족
5. **`fr.*` 의 나머지 필드는 그대로 나간다** — `pdf_path`·`teacher_id`·`sent_to_parent`·`teacher_edited`·`growth_analysis` 등. brief 는 세 필드만 빼라고 했다. `pdf_path` 가 저장소 경로를 드러내는지는 안 봤다 — 필요하면 다음 단계에서 허용 목록 방식으로
6. 만료 토큰 + 유효한 포털 증명은 ok 로 둔다 — 「둘 중 하나」 해석. 포털 목록 링크엔 토큰이 없어 실제로 겹칠 일은 드묾

## Out of Scope (logged in BUILD-LOG)
- 없음 (위 Open Questions 5 는 Arch 판단 후 KG 로 올릴지 결정)
