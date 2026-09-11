# Build Log
*Owned by Architect. Updated by Builder after each step.*

---

## Current Status

**Active step:** 1 — Step 0 아이로그 공개 문구 사후 리뷰 (Richard)
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

---

## Known Gaps
*Logged here instead of fixed. Addressed in a future step.*

- **KG-1** — 아이로그 이용약관이 무료 정책과 어긋남 (terms 118-125, 종량제·30일 이용권) — 원장 판단 필요 — logged 2026-09-11
- **KG-2** — 아이로그 7일 체험 만료가 코드에서 동작하지 않음 (가입 시 trial_ends_at 미설정, 상태 체크가 항상 활성) — logged 2026-09-11
- **KG-3** — 아이로그 에이전트 챗 기본 모델 llama-3.3-70b-versatile 이 Groq 단종 모델 (app/api/agent/chat/route.ts:14) — logged 2026-09-11
- **KG-4** — 아이로그 기능 페이지 「사진만 올리면 피드백」 — feedback/generate 입력에 사진이 없어 코드로 확인 못 함 — logged 2026-09-11
- **KG-5** — 아이로그 가이드 페이지에 FAQPage JSON-LD 가 둘(사이트 전역 layout + 가이드 페이지) 같이 나감 — 영향 작음 — logged 2026-09-11

---

## Architecture Decisions
*Locked decisions that cannot be changed without breaking the system.*

- DB 시각은 UTC 로 저장, 화면·날짜 경계는 KST — 2026-09-05
- 고객사 목록의 단일 출처는 `academy/clients.mjs` — 2026-09-10
- 「오늘 한 일」 집계 로직은 `web/lib/brief-core.mjs` 하나를 화면과 스크립트가 같이 쓴다 — 2026-09-11
- 공개 케이스 리포트는 기본 가림, `--private` 원본은 공개 경로에 못 쓴다 — 2026-09-10
