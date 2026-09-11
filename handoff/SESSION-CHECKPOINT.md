# Session Checkpoint — 2026-09-11
*Read this before reading anything else. If it covers current state, skip BUILD-LOG.*

---

## Where We Stopped

Three Man Team v1.3.0 을 이 저장소에 막 설치했다. 오늘 배포한 것은 대시보드 「오늘 한 일」, 새 랜딩, 아이로그 2차 전달분 반영과 학원 운영 가이드 5편.
다음 행동: 원장의 다음 요청을 Arch 로 받는다. 비자명한 작업은 brief → Bob → Richard 순서로 돈다.

---

## What Was Decided This Session

- 배포 게이트는 상시 승인 — 원장이 「물어보지 말고 알아서 해」로 정했다. Richard 통과 + 운영 주소 확인이면 배포, 보고는 결과와 함께 (ARCHITECT.md)
- 아이로그 소스는 `C:\dev\자동피드백생성기`, 배포는 `npx vercel --prod --yes`. 사이티드가 직접 고치고 배포한다
- 고객사 사실은 고객사 코드에서 확인한다 — 아이로그 홈 문구(알림 무료·리포트 자동 발송·96%)가 코드와 달랐다
- 「오늘 한 일」 마감 기본 18:00, 세는 로직은 `web/lib/brief-core.mjs` 하나

---

## Still Open

- 아이로그 이용약관(app/terms/page.tsx:118-125)이 「학생 수 기반 종량제·30일 이용권」이라 무료 정책과 어긋난다 — 원장 판단 필요 (법적 문서라 임의 수정 안 함)
- Bing 웹마스터: 두 사이트 모두 이미 추가돼 있다(로그인 세션 .browser-profile). robotncoding.com 은 9/5 사이트맵 제출·9/10 크롤 성공(45개), 색인 대기. **ilog.ai.kr 은 사이트맵 0** → Step 1 배포 후 `tools/bing-submit-sitemap.mjs https://ilog.ai.kr/`
- 아이로그 네이버 서치어드바이저 확인 — 아직 안 봄
- 정찰 이슈 #1~#5 열림 (커버리지 2건은 엔진 색인 대기, 브랜드 2건, 아이로그 크롤러 기록은 설치 완료 — 실제 봇 방문 대기)

---

## Resume Prompt

Copy and paste this to resume:

---

You are Arch on 사이티드(Cited) · AGO&GEO.
Read handoff/SESSION-CHECKPOINT.md, then ARCHITECT.md.
Confirm where we stopped and what the next action is. Then wait.

---

## Version Check
version_notified: v1.3.0
