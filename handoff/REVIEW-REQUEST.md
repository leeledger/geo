# Review Request — Step 12 (삽화 담당) · Richard 1차 반영
Date: 2026-09-22
Ready for Review: YES

## Files Changed
- academy/scripts/illustrate.mjs:66-99 — 허용 요소 목록 · 엔티티 풀기 · 주소검사(\·javascript:·url(#만)) · 속성검사(접두어 속성 허용 2개만)
- academy/scripts/illustrate.mjs:100-161 — XML검사가 읽으면서 허용 목록을 본다(요소·속성·<style> 글·CDATA)
- academy/scripts/illustrate.mjs:203-245 — 막대모양(data-value 없는 막대 그림 잡기) · 막대검사(data-orient 필수)
- academy/scripts/illustrate.mjs:44,436-442 — 하루 몫 ILLUSTRATE_MAX_PER_DAY(기본 6, KST)
- academy/scripts/illustrate.mjs:540-567 — --test 에 페이로드·막대 사례
- academy/scripts/company.mjs:204,284,535 — 다음 KST 자정 · 600자 이상만 · 「하루몫」 → 내일로
- tools/svg-to-png.mjs:38-44 — JS 끔 · file: 말고 요청 끊음
- academy/app/blog/img/[slug]/[name]/route.ts:12-49 — 발행 글 그림만 · CSP sandbox · 캐시 1시간
- academy/masks.mjs:113 — 한글 수사 수천·수만·몇·석·넉
- academy/scripts/sales.mjs:288-290 — --draft-test 3건
- academy/public/blog/ai-textbook-16-subjects-2028/info-hours.svg — data-orient="h"
- web/lib/drafts.ts:13-14,39-43,50 — 초안 도해 SVG 를 같이 읽음
- web/app/admin/drafts/page.tsx:48-49,68-85,158-163,178 — data: <img> 미리보기 · 600자 미만 안내
- web/lib/draft-actions.ts:57-64 — 발행 막기: /blog/img 참조가 post_images 에 다 있어야

## Open Questions
- <style> 을 허용했다(\·@·CDATA·# 아닌 url( 는 버림). 아예 빼는 쪽이 나은지
- 막대모양 기준(rx≤6·굵기≤40·길이 차 10%·수 글자) — 흐름 알약·카드와 겹치지 않게 잡았다. 빠져나갈 모양이 남았는지
- 600자 미만 초안은 그리지 않는다 — 원장이 비공개로 돌린 빈 글 대책. 기준값이 맞는지

## Out of Scope (logged in BUILD-LOG)
- 미리보기(data:)·하루 몫 도달·재시도 경로 실제 미실행
