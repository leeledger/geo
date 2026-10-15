# ARCHITECT-BRIEF — Step 48: 사이티드 랜딩에 홍보 영상 넣기

원장 지시(2026-10-15): 「사이티드 랜딩페이지에 영상을 임베드해」
이전 브리프: handoff/research/ARCHITECT-BRIEF-step47.md

## 무엇을

45초 홍보 영상을 랜딩에 넣는다. 유튜브 채널이 없어(학원 채널에 사이티드 광고를 올리지 않는다) **직접 호스팅**한다.

- 파일(이미 준비됨, 손대지 않는다)
  - `web/public/media/cited-promo.mp4` — 1920×1080 · 30fps · H.264/AAC · faststart · 4.4MB · 45초
  - `web/public/media/cited-promo-poster.jpg` — 1280×720, 「AI는 이름을 두세 개만 부릅니다」 장면
- 원본·출처: `academy/public/youtube/motion/cited-promo.html` (문구·숫자는 llms.txt·랜딩과 같은 근거, Step 47 D122 반영)

## 어디에

`#geo` 섹션(page.tsx:251) **바로 위**, 히어로 다음에 새 섹션 `id="film"`.
- 배경: 히어로가 `lp-deep`, #geo 가 `lp-white` → 사이 섹션은 `lp-ground`(인접 배경 다르게, D132 유지). verify 의 배경 교차 검사가 통과해야 한다.
- 라벨 `45초로 보기` · 제목 「사이티드가 하는 일을 45초로」 · 부제 한 줄: 「소리가 있습니다. 숫자는 아래 본문과 같은 측정에서 나왔습니다.」
  (CLAUDE.md 글 규칙. 과장 없음)

## 어떻게 (D135–D138)

- D135 `<video controls playsInline preload="none" poster=... >` + `<source type="video/mp4">`. **자동재생 안 함** — 소리 있는 광고가 저절로 켜지면 신뢰가 깎이고, preload=none 이라 첫 화면 무게(LCP)에 영향 없음.
  `width/height` 속성 1920/1080 + CSS `aspect-ratio:16/9; width:100%; height:auto` 로 레이아웃 밀림(CLS) 0.
- D136 대체 텍스트: video 안에 「영상을 재생할 수 없으면 <a href=mp4>파일로 보기</a>」. 영상 아래 접힌 `<details>` 「영상 속 문장 그대로 보기」 — 장면별 문구 7줄(HTML 원본에서 그대로 옮김). AI·검색 봇과 소리 못 듣는 사람이 같은 내용을 읽는다(GEO).
- D137 JSON-LD `VideoObject` 를 기존 랜딩 JSON-LD 배열(또는 @graph)에 추가: name, description, thumbnailUrl(절대 주소, SITE_URL 기준 lib/site.ts), contentUrl, uploadDate `2026-10-15`, duration `PT45S`, inLanguage `ko`, publisher → 기존 Organization @id 참조. 새 주소 상수 만들지 말고 site.ts 사용.
- D138 클라이언트 컴포넌트 불필요 — 서버 컴포넌트 마크업만. 새 의존성 없음. 영상 위 커스텀 재생 버튼 없음(브라우저 기본 컨트롤).

## 하지 말 것
- mp4·poster 재인코딩/교체 금지. 다른 섹션 문구 변경 금지. 히어로 수정 금지.

## 검증 (Bob)
1. `handoff/research/step47/verify.mjs` 를 복사해 `handoff/research/step48/verify.mjs` 로 늘린다. 기존 74개 그대로 통과 + 추가:
   - #film 존재, video preload="none", autoplay 없음, poster 200, mp4 200 & `content-type: video/mp4`, Range 요청 206
   - JSON-LD 파싱 → VideoObject 하나, contentUrl/thumbnailUrl 이 SITE_URL 로 시작
   - details 문구 7줄
   - 인접 배경 교차 유지, 1440·390 가로 스크롤 없음
2. 스크린샷 1440·390: #film 영역(재생 전 포스터).
3. tsc `node ./node_modules/typescript/bin/tsc --noEmit`, `npm run build`.
4. 커밋·배포 안 함. REVIEW-REQUEST.md 작성.

## 배포
web 은 main 푸시로 자동 배포(Step 47 확인). Richard 통과 후 Arch(메인)가 푸시하고 https://cited.kr 에서 영상 200·재생 확인.
