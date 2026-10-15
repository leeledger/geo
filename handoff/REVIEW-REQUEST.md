# Review Request — Step 46 (홈 히어로 모션)
Date: 2026-10-15
Ready for Review: YES
Status: DONE — 시험 35 PASS · 0 FAIL, tsc 통과. 배포 안 함

## Files Changed
- academy/public/style.css:785-825 — 새 절 「히어로 모션 (Step 46)」. 밖에는 `.hero h1,.hero .sub{word-break:keep-all}` 한 줄, 나머지는 전부 `@media (prefers-reduced-motion:no-preference)` 안: h1 clip·blur·translate 등장(opacity 없음) · `.hl::after` scaleX 쓸기 · eyebrow/sub/CTA blur-up(60ms 계단, 1.47s 에 끝) · 에디터 줄 등장(.ln/.on/.typed) · `.qa-frame::before` 앰버 테두리 clip 으로 그리기 · `.end.glow` · 에디터 단일 transform(perspective+translateY(var(--rise))+rotateX/Y) · `.settled`/`.calm` transition
- academy/content/home.html:1168-1289 — `<script>` 안, rise 블록 뒤 삽입 hunk 1개(원래 줄 수정 0). 줄 래핑(+textContent 대조·원복, `.ln` 가드) → `.typing` → `.in`(MutationObserver) 뒤 110ms 간격 `.on` → 질문/답 마지막 줄에서 `.framed` → +600ms `.glow`, `.in`+6s `.typed`. 깊이: pointermove(passive, rAF 1회) → --rx/--ry ±6deg · 캔버스 ±8px · 글 칼럼 ∓4px (pointer:fine ≥921 만). 스크롤: IO 로 히어로 보일 때만 → `.wrap` opacity/scale/translate, 캔버스 0 -30p px. <921 은 스크롤 아웃 없음(D121)

## 시험 — 서버: `next build && next start` (localhost:3046, DB 붙음)
- 단정 로그: handoff/research/step46/assertions.txt (35 PASS · 0 FAIL) — 시험 스크립트 handoff/research/step46/verify.mjs (`node verify.mjs http://localhost:3046/ <step46 폴더>`, playwright 는 tools/node_modules)
- hunk 범위·tsc: handoff/research/step46/diff-hunks.txt — `@@ -1167,0 +1168,122 @@` 하나, `<script>`(1144-1408) 안. `node ./node_modules/typescript/bin/tsc --noEmit` 통과
- 바꾸기 전 글자: handoff/research/step46/text-before.json (dev 서버·옛 HTML, 운영 robotncoding.com 과 같음 확인). 바꾼 뒤 1440·390·reduce 4s 에서 `.hero` innerText·`code` textContent 동일
- 스크린샷 (handoff/research/step46/)
  - 1440-0.3s.png · 1440-1.5s.png · 1440-4s.png
  - 390-0.3s.png · 390-1.5s.png · 390-4s.png
  - 1440-4s-reduce.png (reduce) · 1440-4s-nojs.png (JS 끔)
  - 390-editor-typing.png · 390-editor-done.png (모바일은 에디터가 첫 화면 아래라 내려서 찍음)
- 시각 기준은 first-contentful-paint(로컬 서버는 첫 페인트까지 약 1초). 0.3s 장은 hydration 긴 작업에 실시간 캡처가 밀려, hm- CSS 애니를 첫 프레임에 멈추고 300ms 로 감은 프레임이다 — h1 clip 81% 열림·blur 1.5px. 단 그 장의 에디터는 JS 가 실제 시간대로 진행된 상태라 실제 0.3s 보다 앞서 보인다

## Open Questions
- `.qa` → `.qa-frame` 로 바꿨다. 기존 FAQ `.qa`(style.css:246, margin-top 32px·테두리·overflow hidden)와 겹쳐 에디터에 빈칸이 생겼다(B46-1)
- 6초 안전장치를 `.in` 기준으로 옮겼다(B46-2). 등장 fill-mode 는 backwards(B46-3). 기울기 .15s transition 은 `.settled`(.in+750ms) 뒤(B46-4). 브리프와 다른 세 곳 — 맞는지 봐 달라
- D121 반영: <921 스크롤 흐림 끔. 390 에서 에디터를 화면 가운데 두면 실효 opacity 1 (assertions.txt). 390-editor-done.png 다시 찍음
- 에디터는 `.in` 뒤에도 `perspective(1000px)` 가 붙은 3D transform 이라 합성 레이어로 올라간다. 스크린샷에선 글자 흐림이 안 보였다

## Out of Scope (logged in BUILD-LOG)
- KG-46-1 `.rise` JS 없으면 opacity 0 (기존)
- KG-46-2 dev 서버 hydration 경고(data-live·time dateTime) 기존. 운영 빌드 0건
- KG-46-4 next dev 는 home.html 을 재시작해야 다시 읽는다
