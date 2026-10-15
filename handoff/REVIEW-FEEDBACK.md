# Review Feedback — Step 46 (홈 히어로 모션)
Date: 2026-10-15
Ready for Builder: YES
Verdict: PASS

## Must Fix
없음.

## Should Fix
1. academy/content/home.html:1286 (confidence: 8/10) — `window.addEventListener("scroll", onHeroScroll, { passive: true })` 는 떼지 않는다. 블로그→홈 클라이언트 이동마다 새 IIFE 가 돌아 window 에 scroll 리스너가 하나씩 쌓인다. 옛 리스너는 떨어진 `hero` 를 쥐고, IO 가 제거 시 isIntersecting=false 를 안 주는 브라우저에선 매 스크롤 `ask()`→`paint()` 가 떨어진 노드에 스타일을 쓴다.
   - 새로 생긴 문제는 아니다: 같은 IIFE 의 nav `onScroll`(1292)과 캔버스 `resize`(1503)가 이미 같은 방식으로 쌓이고, V8 클로저는 IIFE 문맥 하나를 공유하므로 이번 변경으로 추가로 붙잡히는 메모리는 사실상 0. 그래서 막지 않는다.
   - 고치는 법(2줄): onHeroScroll 첫 줄에 `if (!hero.isConnected) { window.removeEventListener("scroll", onHeroScroll); return; }`. 기존 두 리스너는 Step 밖 → KG 로 적는다(예: KG-46-5 「홈 스크립트의 window 리스너가 클라이언트 이동마다 쌓인다 — nav onScroll·canvas resize·hero scroll」).
2. handoff/research/step46/verify.mjs (confidence: 7/10) — 클라이언트 이동(홈→블로그→홈) 경로를 안 잰다. 이중 실행 방지는 구조로 맞다(#nav 가 home.html 안에 있어 매번 새 DOM, data-live 가드 1149 + `.ln` 가드 1183). 그래도 브리프 Failure modes 표의 한 줄이니 단정 하나 추가 권장: 홈→/blog→홈 뒤 `.hero .editor code .ln` 개수가 처음과 같고 `.qa-frame` 1개.
3. academy/content/home.html:1258 (confidence: 5/10, 정보) — pointermove 마다 `hero.getBoundingClientRect()` 를 이벤트 안에서 읽는다. 값 저장만 하고 계산은 rAF 로 미루는 원칙에 비하면 이벤트당 레이아웃 읽기 1회. clientX/Y 만 저장하고 rect 는 paint() 에서 읽으면 깔끔하다. 체감 문제는 없을 것 — 고치지 않아도 된다.

## Brief 와 다른 곳 (판정)
- B46-1 `.qa`→`.qa-frame`: 맞다. style.css:246 FAQ `.qa{margin-top:32px;border…;overflow:hidden}` 와 실제로 겹친다.
- B46-2 6초 안전장치를 `.in` 기준: 맞다. `.in` 이 안 오면 `.rise` 자체가 opacity 0 이라 로드 기준이 지켜 주는 것이 없다.
- B46-3 fill-mode `backwards`: 맞다. both 면 clip-path·filter 가 끝나도 남는다. 시작 전 첫 프레임 유지는 같다.
- B46-4 `.settled` 뒤 .15s: 맞다. `.in` 에 바로 걸면 22px 올라오는 .7s 동작이 .15s 로 잘린다.
- hm-reveal 의 clip 이 `inset(-1em …)` 로 좌우·위를 넓힌 것: 블러·.hl 밑줄이 안 잘리게 한 것. 무해.

## 확인한 것
- home.html diff: hunk 1개 `@@ -1167,0 +1168,122 @@`, `<script>`(1144~) 안. 마크업·글자 변경 0. 래핑은 textContent 대조 후 어긋나면 원복(1201-1202). innerHTML 원천은 자기 정적 HTML — 외부 입력 없음.
- reduce: JS 블록 둘 다 `!reduce` 가드, CSS 는 전부 `prefers-reduced-motion:no-preference` 안(밖은 keep-all 한 줄, 브리프대로). 단정 PASS.
- JS 끔: `.typing` 이 없어 코드 그대로, h1·sub·CTA 등장은 CSS 라 끝나면 보임. `.rise` opacity 0 은 기존 KG-46-1.
- transform: 등장·시차·스크롤은 전부 `translate`/`scale` 개별 속성. 에디터만 단일 transform(브리프 예외), `.hero .editor.rise`(0,3,0) 가 `.rise.in{transform:none}`(0,2,0) 을 이기고 `--rise:0px` 로 세로 0. `.btn:hover` transform 유지 단정 PASS. `.hl::after` 는 원래 transform 이 없어 scaleX 만으로 충돌 없음.
- 이중 실행: #nav 가 home.html 안(1행)이라 이동마다 새 DOM, data-live 가드 + `.ln` 가드.
- 리스너: pointermove/pointerleave/scroll 모두 passive, rAF 1회 합치기, IO 로 히어로 밖이면 계산 안 함. 타이핑 setTimeout 사슬은 줄 수만큼 돌고 끝난다. MutationObserver 는 `.in` 에서 disconnect.
- 캔버스 시차: 로봇 pointermove 가 `cv.getBoundingClientRect()`(1494) 기준이라 translate 가 반영된다 — B46-5 맞다.
- D121: paint() 의 opacity/scale/translate 가 `big`(≥921) 조건, 모바일 캔버스 이동도 0.
- 단정 로그 35 PASS · 0 FAIL, 콘솔·hydration 0. verify.mjs 는 다시 돌리지 않았다(로그·코드 대조로 충분).

## Escalate to Architect
없음.

## Cleared
Step 46 의 style.css 785-825·home.html 스크립트 hunk 를 브리프·D121·하드 규칙에 대조했고, 막을 것은 없다. Should Fix 1 은 2줄 — 배포 전에 넣거나 KG 로 적는다.
