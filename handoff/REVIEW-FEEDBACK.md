# Review Feedback — Step 48 (사이티드 랜딩 45초 영상)
Date: 2026-10-15
Ready for Builder: YES

Verdict: PASS — blocking issue 없음.

## Must Fix
없음.

## Should Fix
1. web/public/media/ (git status `?? public/media/`) (confidence: 9/10) — mp4·poster 가 아직 추적되지 않는다. 커밋 때 `web/page.tsx`·`landing.css` 만 올리면 운영에서 영상·포스터가 404 가 된다(CLAUDE.md 함정: 「본문에 이미지 태그는 떴는데 파일이 404」). — Arch 가 커밋할 때 `git add web/public/media/cited-promo.mp4 web/public/media/cited-promo-poster.jpg` 를 함께 넣고, 배포 뒤 https://cited.kr/media/cited-promo.mp4 200·206 을 확인한다.
2. web/app/page.tsx:134 description · :286 부제 (confidence: 5/10, verify this) — 「영상 속 숫자는 이 페이지 본문과 같은 측정에서 나왔습니다」. 0원·39만원은 측정이 아니라 가격이고, 「학부모 질문 6개 전부 미노출」은 page.tsx 정적 본문에는 없고 llms.txt(route.ts:38)에 있다(사례 절이 DB 에서 그리면 본문에 있을 수 있다). 거짓은 아니나 「같은 근거」가 더 정확하다. 부제는 브리프 원문 그대로라 Bob 잘못은 아님 — 고칠지 Arch 판단. 고치지 않아도 배포 가능.

## Escalate to Architect
- 위 Should Fix 2 문구(브리프가 정한 부제) — 바꿀지는 Arch 결정.

## Cleared
- 자동재생 없음, `preload="none"`, poster 만 먼저 받음 → LCP 영향 없음. 클라이언트 컴포넌트·새 의존성 없음(D138).
- CLS: `width=1920 height=1080` 속성 + `.lp-film{width:100%;height:auto;aspect-ratio:16/9}` — 자리를 먼저 잡는다.
- details 7줄을 cited-promo.html S0–S7 과 한 줄씩 대조: 문구·숫자(34곳·15회·80점/0개·3/15·19점/9개·8/15·6개·188→933·32편·20개·0원·39만원·30일) 전부 일치, 지어낸 숫자 없음. D122 「첫 적용 · 사이티드 대표가 운영하는 학원」 그대로. S1·S2 의 시각 요소 라벨(A 학원·NOT FOUND·「검색 · 링크 열 개」)은 빠졌으나 문장이 아니라 그림이라 허용.
- VideoObject: `BASE = SITE_URL`(page.tsx:39, lib/site.ts) 기준 절대 contentUrl·thumbnailUrl, uploadDate·PT45S·ko·publisher → `#org`(page.tsx:91 에 정의됨). 유효. description 두 문장은 짧고 빈 강조·흐림·과장 없음 — CLAUDE.md 글 규칙 통과.
- 다른 절: diff 는 순수 추가(page.tsx +58, landing.css +11). 히어로·다른 섹션 문구 변경 없음.
- 스크린샷 1440·390·details 펼침 확인: 포스터 표시, 가로 넘침 없음, keep-all 줄바꿈 정상, 인접 배경 교차 유지. verify 94 PASS.
