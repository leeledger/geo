# Architect Brief — Step 4 (별도 작업 트리)
*Written by Architect. Read by Builder and Reviewer.*
*Step 3 이 같은 저장소의 main 작업 트리에서 돌고 있어서, Step 4 는 따로 뗀 작업 트리에서 한다.*

---

## Step 4 — 아이로그 랜딩을 개편 시안대로 옮긴다 (원장 지시: 피드백 자동화·관리 편의 강조)

**작업 위치: `C:\dev\ilog-step4`** (git worktree, 브랜치 `step4-landing`, `node_modules` 는 본 저장소와 연결).
본 저장소 `C:\dev\자동피드백생성기` 는 건드리지 않는다 — 거기서는 Step 3 이 돌고 있다.
시안(단일 출처): `C:\dev\AGO&GEO\design\ilog-landing\Main.dc.html`(데스크톱 1440) · `Mobile.dc.html`(390).

### Decisions
- `app/page.tsx` 의 **화면 구성만** 시안으로 바꾼다. 아래 동작은 그대로 남긴다:
  - PWA: standalone 이면 `/auth/login` 으로 보냄, `beforeinstallprompt`·`appinstalled`, iOS 설치 안내 모달(`showIOSGuide`), 모바일/데스크톱 판별
  - 히어로 기본 버튼은 지금처럼 `handleInstallClick` (모바일은 「앱 설치하고 시작하기」 + 「웹으로 계속하기」). 데스크톱 문구는 시안의 「무료로 시작하기」
  - 스크롤 진행 막대·등장 효과는 유지하거나 줄인다 (과한 움직임 금지)
  - `components/seo/Faq.tsx` 는 페이지에 그대로 둔다 (요금 구역 뒤, 가이드 구역 앞)
- 문구는 **시안 그대로**. 새 주장·숫자·후기·사용자 수 금지. 시안 속 학생 이름·예시 문장·키패드 숫자는 제품 화면 예시라 그대로 둔다
- 「평생 무료」는 쓰지 않는다 (Arch 결정 2026-09-12 — 증명할 수 없는 영구 약속. 「기본 관리 무료 · 학생 수 제한 없음」으로 쓴다)
- 스타일은 Tailwind. 시안의 인라인 값(#0A0D14, #11141D, #1A1F2B, #07090F, #4F46E5, #6366F1, rounded-[32px] 등)을 임의값 클래스로. 폰트는 layout 의 Noto Sans KR
- 아이콘은 `lucide-react` 로 바꿔도 된다 (뜻이 같게)
- 가이드 카드 3개는 실제 `/guide/<slug>` (`lib/guides.ts`). 네비 「학원 운영 가이드(/guide)」「기능 자세히 보기(/features)」「로그인(/auth/login)」「무료로 시작(/auth/register)」 실제 링크
- 반응형: 1440 은 Main, 390 은 Mobile 시안. 중간 폭은 자연스럽게 접힘. 가로 스크롤 금지. 한글 `word-keep-all`
- **기능 페이지(`app/features/page.tsx`) 첫 섹션 문구 (KG-4)** — 「사진만 올리면 학부모용 피드백이 자동으로 완성」「사진을 업로드만 하면 끝」은 코드와 다르다. AI 는 사진을 보지 않고 태그·메모로 쓴다(`app/api/upload/route.ts` 는 기록만 만든다, `lib/ai/groq-client.ts:94` `generateFeedback` 입력에 사진 없음). 랜딩 4단계(사진 올리기 → 태그·메모 → AI 한두 문장 → 고쳐서 확정)와 같은 사실로. `public/videos/features/*`·`public/images/features/*` 는 비어 있다(.gitkeep) — 깨진 영상이 보이면 영상 블록을 숨긴다(포스터 없는 빈 상자도 숨김)
- 사이트 전역 FAQPage 가 가이드 페이지에 중복으로 나가는 KG-5 는 이번 범위 밖

### Build Order
1. 시안 두 파일에서 구역 목록: 네비 · 히어로(+피드백 작성 목업) · 피드백 자동화 4단계 · 리포트/학생 페이지(+레이더 목업) · 학원 관리(키패드 큰 카드 + 4카드) · 요금 3열 · [Faq] · 가이드 3카드 · 마지막 CTA · 푸터
2. `app/page.tsx` 재작성 (동작 보존)
3. `app/features/page.tsx` 첫 섹션 문구·빈 영상 처리
4. `npm run build` (작업 트리 `C:\dev\ilog-step4` 에서)
5. `npx next start -p 3200` 후 1440·390 스크린샷으로 시안과 대조. Playwright 는 `C:\dev\AGO&GEO\tools` 에 설치돼 있다(스크립트를 그 폴더에 임시로 두고 끝나면 지운다). 가로 넘침 0, 콘솔 오류 0. 서버는 끝나면 끈다

### Flags
- Flag: 문구를 다듬고 싶으면 REVIEW-REQUEST Open Questions 에 적는다
- Flag: 특허 문구 금지 (원장 지시)
- Flag: 커밋은 브랜치 `step4-landing` 에 해도 된다(리뷰가 diff 를 보기 쉽게). 푸시·배포는 하지 않는다
- Flag: 리뷰 요청서는 `C:\dev\AGO&GEO\handoff\REVIEW-REQUEST.step4.md` 에 쓴다 (Step 3 과 파일이 겹치지 않게). BUILD-LOG 는 건드리지 않고 요청서 끝에 BUILD-LOG 에 넣을 줄을 적어 둔다

### Definition of Done
- [ ] 1440·390 스크린샷이 시안 구역 순서·문구와 일치 (스크린샷 경로를 요청서에)
- [ ] PWA 설치·iOS 안내·standalone 이동 코드가 남아 있음
- [ ] 가로 넘침 0, 콘솔 오류 0
- [ ] 기능 페이지에 「사진만 올리면」류 문구 없음, 빈 영상이 깨져 보이지 않음
- [ ] `npm run build` 성공
