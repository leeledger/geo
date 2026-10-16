# Review Feedback — D162 (서비스 머리 문단 삭제 · 제작/세팅을 진행 1단계로 통합)
Date: 2026-10-16
Ready for Builder: YES

## Must Fix
없음.

## Should Fix
- web/app/FlowSteps.tsx:18 (confidence: 7/10) — 「새 사이트를 연 날(세팅을 마친 날)부터」 에서 「또는」이 빠졌다. 이대로면 괄호가 「새 사이트를 연 날」의 바꿔 말하기처럼 읽힌다(세팅만 하는 곳은 새 사이트를 열지 않는다). 원본 research/paid-pilot-order-form.md:21 · web/lib/services.ts:51 은 「(또는 세팅을 마친 날)」. — 「또는」을 넣어 원문과 맞춘다.

## Escalate to Architect
없음.

## Appendix (참고, 조치 불요)
- 렌더 순서상 「30일 파일럿」「기술 세팅」의 실제 첫 등장은 #film 의 접힌 「영상 속 문장 그대로 보기」(page.tsx:84-85 FILM_LINES)다. 영상 원문 그대로라는 약속이 있어 거기 풀이를 붙이지 않는 게 맞다. 펼친 본문 기준 첫 등장은 #services 카드가 맞다.

## 확인한 것
1. 「파일럿을 끝낸 곳에만 안내합니다」 — FlowSteps.tsx:36(진행 4단계)에 그대로 살아 있다. #price(page.tsx:559)에도 「월 구독은 파일럿 뒤에 정합니다」.
2. 1단계 p2 순서(첫 7일 측정 → 제작/세팅 → 연 날부터 30일 → 전후) = order-form 「순서」. 「쓸 만한 홈페이지가 있으면 새로 만들지 않습니다」는 삭제된 머리 문단에서 옮긴 문장. 지어낸 내용 없음.
3. 풀이 각 1회: 「(한 달 시범 계약)」은 page.tsx:517 한 곳, 「(AI가 읽게 손봄)」은 page.tsx:510 한 곳. 카드 순서 01 측정 → 02 기술 세팅이라 01 카드 안에 「기술 세팅」이 먼저 나오지 않는다.
4. .replace 매치: SERVICES[0].terms[0] = { k:"비용", v:START }, START = 「30일 파일럿 39만원으로 시작 · …」(services.ts:72). termLine 은 비용이면 값만 내므로 「30일 파일럿」이 문자열에 있다 — 치환된다.
5. 글 규칙: 서론·빈 강조·흐린 어미·숫자 회피 없음. 문단 길이 80~400자 안.
- tsc --noEmit: 통과(exit 0). `"p2" in f` 좁히기 문제없음, .lp-flow-panel p 스타일이 둘째 문단에도 걸린다.

## Cleared
page.tsx · FlowSteps.tsx · landing.css diff 검토 — 빠진 주장 없음, 순서는 주문서와 맞고, 풀이는 첫 등장에 한 번, 타입 통과. 위 한 글자 수정만 권한다.
