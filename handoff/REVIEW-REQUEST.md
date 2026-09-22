# Review Request — Step 12 (삽화 담당)
Date: 2026-09-22
Ready for Review: YES

## Files Changed
- academy/app/blog/img/[slug]/[name]/route.ts:1-41 — DB SVG 를 image/svg+xml 로, CSP·nosniff·캐시 1일, 꼴 안 맞으면 404 (운영 배포됨)
- academy/app/blog/[slug]/page.tsx:22-26 — /blog/img 도해면 og:image 를 넣지 않음 (운영 배포됨)
- academy/db/schema.sql:30-40 — academy.post_images
- academy/scripts/illustrate.mjs:64-114 — 작은 XML 검사(태그 짝·속성·엔티티·뿌리 svg)
- academy/scripts/illustrate.mjs:121-230 — 그림 글자 추출(축 눈금 제외) · 축검사 · 막대검사(길이 쪽 고르기, 2%) · 한장검사
- academy/scripts/illustrate.mjs:232-285 — 재료로(날짜 점 표기) · 끼우기(줄 머리) · 저장(한 거래, updated_at 조건)
- academy/scripts/illustrate.mjs:287-352 — 새 스타일 참고 세 장 + 프롬프트
- academy/scripts/illustrate.mjs:354-435 — 가릴 말(fail-closed) · 대상(시도 적은 것부터) · 그리기(ILLUSTRATE= 한 줄)
- academy/scripts/illustrate.mjs:437-552 — --dry · --test (DB 는 되돌리는 거래 안에서만)
- academy/scripts/company.mjs:279-299 — illustrate 일감 · 시도 ≥2 사람 대기 · 도해 없이 발행된 글 사람 대기
- academy/scripts/company.mjs:325 — illustrate-·noimg- 일감도 초안 신호로 닫음
- academy/scripts/company.mjs:516-540 — 실행기: 매시 1편 문, 결과별 상태(다버림은 대기로 다시)
- academy/masks.mjs:44-126 — 가림검사·고객사말·수검사 (sales.mjs 에서 옮김, 한글 수사 앞 한글 제외)
- academy/scripts/sales.mjs:31,70-92 — masks.mjs 를 import
- academy/public/blog/ai-textbook-16-subjects-2028/info-hours.svg:34-50 — data-value·data-axis (보이는 모양 같음)
- tools/naver-blog-post.mjs:78-80,95-107,126 — /blog/img 도해를 DB 에서 받아 임시 폴더에서 PNG 로
- tools/naver-blog-post.mjs:463-470 — --dry 가 본문 첫 사진도 찍음
- web/lib/draft-actions.ts:49-63 — 본문에 ![ 없으면 발행 0행 (**푸시 안 함**)
- web/lib/draft-actions.ts:82-104 — requeueIllustrate (**푸시 안 함**)
- web/lib/draft-actions.ts:112-119 — 초안 버리기가 그림·illustrate 일감도 정리 (**푸시 안 함**)
- web/app/admin/drafts/page.tsx:57,116-118,139-151,178-180 — 도해 칸 · 다시 그리기 · 발행 버튼 막기 (**푸시 안 함**)
- web/lib/drafts.ts:11 — notes.삽화 타입 (**푸시 안 함**)

## Open Questions
- 막대검사: 길이 쪽을 「크기가 더 크게 갈리는 쪽」으로 고른다. 가로 막대 두 계열(높이 16·20)에서 맞는지, 속일 길이 남았는지
- 축 눈금은 data-axis 를 단 text 만 숫자 검사에서 빠진다. 0 부터 같은 간격만 허락 — 충분히 좁은가
- 재료로: 날짜 점 표기만 넓혔다. 다른 표기(「1학기」→「1H」 등)는 버린다 — 의도대로
- 수검사의 한글 수사 앞 한글 제외는 sales 초안 검사도 느슨하게 한다(「…한 번」이 「한번」으로 안 잡힘). 괜찮은가
- web 은 git push = 랜딩 배포다. 통과하면 푸시해 주세요 (지금 작업 트리에만 있고 커밋 안 함)
- CDN 하루 캐시 — 지운 그림이 하루 동안 열린다. 캐시를 줄일지

## Out of Scope (logged in BUILD-LOG)
- CDN 캐시로 지운 그림이 하루 열림 · revertDraft 가 도해 줄도 되돌림 · 네이버 --dry 임시 저장 · 재시도/사람 대기/web 경로 실제 미실행
