# Architect Brief
*Written by Architect. Read by Builder and Reviewer. Overwrite each step.*

---

## Step 5 — [보안 2] 승인한 리포트만 공유되고, 공개 응답은 보기 화면이 쓰는 필드만 (KG-11, KG-12)

저장소: `C:\dev\자동피드백생성기` (아이로그, main 작업 트리).

### 지금 문제 (Arch 확인, 2026-09-12)
- **KG-12** `app/api/reports/[id]/generate-token/route.ts:31-63` — 작성자·원장·반 담당만 확인하고 `is_approved` 를 안 본다. 화면(`app/dashboard/reports/[id]/page.tsx:167`)은 승인 전 공유를 막는데 API 로 부르면 발급된다
- **KG-11** `app/api/reports/[id]/public/route.ts:18-31,133-139` — `fr.*` 를 가져와 세 필드만 빼고(denylist) 나머지(`teacher_id`·`academy_id`·`pdf_path`·`sent_to_parent`·`teacher_edited` 등)를 그대로 보낸다. 컬럼이 늘면 자동으로 공개된다

### Decisions (원장 위임으로 Arch 결정, 2026-09-12)
- 토큰 발급은 **승인한 리포트만**. 조건은 content route 와 같은 `CAST(is_approved AS text) IN ('1','t','true')`. 아니면 403 `{ error: '승인한 리포트만 공유할 수 있습니다.' }`. 이미 발급된 유효 토큰 재사용 분기도 승인 확인 뒤에 둔다
- 열람(`lib/reports/view-access.ts`)의 토큰 경로는 이번에 바꾸지 않는다 — 발급을 막으면 새로 생기지 않고, 이미 나간 링크를 깨지 않는다
- 공개 응답은 **allowlist**. 기준은 보기 화면 `app/reports/[id]/view/ReportViewClient.tsx:30-45` `interface Report` 가 쓰는 필드: `id, student_id, student_name, student_grade, teacher_name, period_start, period_end, report_type, summary, academy_name, activities, activity_count, axes, prev_axes`. 이 밖에 보기 화면이 실제로 읽는 필드가 있으면(grep `report\.`) 목록에 넣고 요청서에 적는다
- `activities` 항목도 보기 화면 `interface Activity`(18-28) 필드로 좁힌다 — `group_id` 등 내부 값은 뺀다(보기 화면이 안 쓰면)
- `PRIVATE_REPORT_FIELDS` denylist 는 지운다 (allowlist 하나로)
- SQL 은 그대로 둬도 되지만, 응답을 만드는 곳에서 allowlist 로만 조립한다

### Build Order
1. `generate-token/route.ts` — SELECT 에 `fr.is_approved`, 권한 확인 뒤 승인 확인
2. 보기 화면이 읽는 필드 grep → allowlist 확정
3. `public/route.ts` — allowlist 로 응답 조립, activities 도 좁힘
4. `npm run build`

### Flags
- Flag: 대시보드 공유 버튼 흐름(`dashboard/reports/[id]/page.tsx:160-190`)이 403 을 받았을 때 사용자에게 뜻이 통하는 문구가 뜨는지 확인 (화면이 이미 승인 전엔 막으니 보통 안 온다)
- Flag: PDF·다운로드 라우트(인증 필요)는 건드리지 않는다
- Flag: 실제 데이터 호출·DB 스키마 변경·커밋·푸시·배포 금지

### Definition of Done
- [ ] 미승인 리포트에 토큰 발급 403 (코드 경로), 승인 리포트는 기존대로
- [ ] 공개 응답 키가 allowlist 뿐 (activities 항목 포함)
- [ ] 보기 화면이 쓰는 필드가 빠지지 않음 (grep 근거)
- [ ] `npm run build` 성공
