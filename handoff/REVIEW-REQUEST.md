# Review Request — Step 48 (사이티드 랜딩 45초 영상)
Date: 2026-10-15
Ready for Review: YES
Status: DONE

## Files Changed
- web/app/page.tsx:67-85 — `FILM`(mp4·poster 경로·제목)과 `FILM_LINES`(cited-promo.html 장면 문구 7줄) 상수
- web/app/page.tsx:130-141 — JSON-LD @graph 에 VideoObject(@id #film, SITE_URL 기준 contentUrl·thumbnailUrl, PT45S, ko, publisher → #org)
- web/app/page.tsx:281-307 — 히어로 다음 `<section id="film" className="lp-sec lp-ground">`: 라벨·제목·부제, `<video controls playsInline preload="none" poster width=1920 height=1080>` + source + 대체 링크, 접힌 `<details>` 7줄
- web/app/landing.css:254-264 — `.lp-film`(width 100%·aspect-ratio 16/9·둥근 모서리) · `.lp-film-text`(details 안 목록 여백, 전역 details 는 p 에만 패딩을 줘서 ol 에 맞춤) · 600px 이하
- handoff/research/step48/verify.mjs — step47 복사 + #film 단정 20개, 절 순서·keep-all·스크린샷 목록에 film 추가 (robots-before.txt 도 복사)

## 검증
- verify.mjs 94 PASS · 0 FAIL → handoff/research/step48/assertions.txt (빌드 env `NEXT_PUBLIC_ALLOW_INDEX=true`, :3048, DB 붙음)
- 인접 배경: hero(10,26,51) › film(244,247,251) › geo(255,255,255) 다름. 1440·390 가로 넘침 없음
- tsc 0 · npm run build 성공
- 스크린샷: handoff/research/step48/1440-film.png · 390-film.png (재생 전 포스터) · 390-film-details-open.png (details 펼침)

## Open Questions
- details 1줄: S0(질문 입력)과 S1(이름 두세 개)을 한 줄로 묶어 7줄을 맞췄다. 원본 장면은 S0~S7 8개다. 다르게 나누길 원하면 FILM_LINES 만 고치면 된다
- details 문구는 원본의 줄바꿈(<br>)을 마침표 뒤 공백으로, 작은 글씨(<small>)는 괄호로 옮겼다. 글자 자체는 바꾸지 않았다(원본 구절 12개·숫자 전부 대조 단정)
- VideoObject description 은 새로 쓴 한 문장(「사이티드(Cited)가 하는 일을 45초로 정리한 영상입니다. 영상 속 숫자는 이 페이지 본문과 같은 측정에서 나왔습니다.」). 브리프에 글자가 없어 부제와 같은 근거로 적었다

## Out of Scope (logged in BUILD-LOG)
- Step 47 로그의 빌드 env 「ALLOW_INDEX=true」는 실제로 `NEXT_PUBLIC_ALLOW_INDEX` — 함정으로 기록만
