# Architect Brief — Step 46 · 홈 히어로 모션 (몰입감)

## Goal
robotncoding.com 첫 화면이 열리면 제목이 차례로 드러나고 에디터 코드가 한 줄씩 타이핑된 뒤 「세 문장」이 앰버 테두리로 묶인다. 유튜브 모션(academy/public/youtube/motion/homepage.html)과 같은 결. **글자·태그 구조는 한 글자도 안 바뀐다.**

## Hard constraints (어기면 반려)
- `academy/content/home.html`: `<script>`(1144행~) 밖은 **한 바이트도 안 바뀐다**. `git diff` 의 모든 hunk 가 `<script>`~`</script>` 안. aria-hidden 장식 요소도 넣지 않는다 — 가상요소·canvas·런타임 래핑으로 끝낸다.
- 런타임 래핑(JS 가 span 으로 감싸기)은 허용. 단 감싼 뒤 `code.textContent`·`.hero` innerText 가 감싸기 전과 **완전히 같다**(줄바꿈 포함). 단정문으로 확인.
- "가르치지 않습니다"에 취소선·지우기 효과 금지(뜻이 뒤집혀 읽힌다).
- 새 모션 CSS 는 **전부** `@media (prefers-reduced-motion:no-preference){ … }` 안에. reduce 면 지금 화면 그대로(정적·전부 보임).
- `transform` 은 속성 하나다. `.rise`(style.css:53-55)와 `.btn:hover` 가 `transform` 을 쓴다. 이동은 개별 속성 `translate`/`scale` 로. 예외는 에디터 기울기 하나(3단계 결정).
- 새 텍스트 노드 0. 문구 추가 금지.

## 왜 h1 은 CSS 인가 (추측 금지)
홈 스크립트는 SSR HTML 파싱 때(새로고침) 또는 hydration 후 `components/HomeScript.tsx`(`new Function`)로(클라이언트 이동) 돈다. JS 로 h1 을 숨겼다 보이면 LCP 가 늦고 깜빡인다. 그래서:
- h1·eyebrow·sub·CTA 등장 = **순수 CSS 애니메이션**(첫 페인트에 시작, JS 무관).
- 에디터 타이핑 = JS. 에디터는 이미 `.rise`(opacity 0 → `.in`)라 JS 가 감싸는 순간 안 보인다 → 깜빡임 없음.

```
첫 페인트 -CSS-> eyebrow(0) · h1 clip 위→아래(0.05~0.75s) · .hl::after 쓸기(0.6~1.1s) · sub(0.8s) · CTA(0.95~1.3s)   1.6s 안에 끝
스크립트  -----> code 줄 래핑(+textContent 대조) + .typing --IO--> editor.in
                 -> 줄마다 .on (110ms 간격) -> 질문/답 6줄 .qa.framed(테두리 그려짐) -> +600ms 마지막 두 주석 .glow
                 -> 6s 안전장치 .typed (무조건 전부 보임)
pointermove(passive, rAF 1회) -> --rx/--ry 에디터 기울기 · 캔버스/글 칼럼 시차   [pointer:fine & >=921px 만]
scroll(passive, 히어로 보일 때만, rAF 1회) -> .hero .wrap opacity/scale/translate
```

## Build Order
1. **CSS 등장** — style.css 끝에 새 절 `/* ── 히어로 모션 (Step 46) ── */`, 머리 주석 3줄(유튜브 모션과 같은 결 · h1 은 LCP 때문에 CSS·opacity 금지).
   - `.hero h1`: `clip-path: inset(0 0 100% 0)` → `inset(0 0 -.2em 0)`(디센더·caret 그림자 안 잘리게, 끝나면 `none`) + `filter: blur(8px)`→0 + `translate: 0 .35em`→0. **opacity 애니 금지.** fill-mode both, 지연 ≤50ms. 클립이 위→아래로 열려 줄 단위로 읽힌다 — 줄 span 이 없으니 이게 정답.
   - `.hero h1 .hl::after`(135~136행 밑줄): `transform-origin:left` + `scaleX(0→1)`, 0.6s 시작. 그 규칙에 이미 transform 이 있으면 합쳐 한 값으로.
   - `.eyebrow`, `.hero .sub`, `.hero .cta .btn`(nth-child 60ms 계단): blur-up(`filter`+`translate`+opacity). LCP 후보 아님 — opacity 허용.
   - 밖(미디어쿼리 무관): `.hero h1, .hero .sub{word-break:keep-all}` (지금 hero 엔 없다).
2. **에디터 타이핑** — home.html `<script>` 안, rise 블록 뒤.
   - reduce 면 아무것도 안 한다.
   - `code = document.querySelector(".hero .editor code")`; 이미 `.ln` 있으면 건너뜀.
   - `before = code.textContent`, `html = code.innerHTML`. `"\n"` 로 쪼개 빈 줄은 그대로, 나머지는 `<span class="ln">…</span>`. 소스의 각 span 은 줄을 안 넘는다(40~54행 확인). 줄바꿈은 span **밖**에 남긴다. 질문/답 6줄("# 1." ~ "→ 10cm")은 `<span class="qa">` 로 한 번 더 묶는다(안의 줄바꿈 유지). 마지막 두 주석 줄에 `.end`.
   - `code.textContent !== before` 면 `code.innerHTML = html` 복구하고 끝.
   - `figure.editor` 에 `.typing`. `.in` 이 붙은 뒤(MutationObserver 로 class 감시) 타이핑 시작. 6s 안전장치 `.typed`.
   - CSS: `.editor.typing .ln{display:inline-block;opacity:0;translate:0 6px;filter:blur(4px);transition…}` → `.ln.on`, `.editor.typed .ln` 로 해제. `.qa{display:inline-block;position:relative}` + `::before` 앰버 1px 테두리·옅은 앰버 배경, `clip-path` 로 그려지듯. `.end.glow{color:var(--amber);text-shadow:0 0 18px rgba(245,166,35,.45)}`. 기존 `.caret`(motor.stop() 뒤)은 그대로.
   - JS 없으면 `.typing` 이 없으니 코드 그대로(.rise 기존 문제는 KG-46-1).
3. **깊이** — 같은 `<script>`.
   - 기울기·시차 조건: `!reduce && matchMedia("(pointer:fine) and (min-width:921px)").matches`. 아니면 없음.
   - pointermove 는 `.hero` 에 passive, 값만 저장 → rAF 1회 반영. 에디터 ±6deg 이하. 캔버스 `translate` ±8px, 글 칼럼(`.hero .wrap > div:first-child`) 반대로 ±4px. pointerleave 에 0 복귀(transition .6s).
   - **에디터 기울기 결정**: `.hero .editor.rise{transform:perspective(1000px) translateY(var(--rise,22px)) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg))}`, `.hero .editor.rise.in{--rise:0px}`. `.in` 이후 transform transition 은 `.15s linear`(opacity 는 기존 .7s 유지). 일반 `.rise` 규칙은 안 건드린다. 이 재정의는 reduce 에서도 결과가 같아야 한다(reduce 면 변수 0, rise 0 → 정적).
   - 기존 캔버스 로봇 코드(1170~1390행) pointermove 좌표가 `getBoundingClientRect` 기준인지 확인. 캔버스 translate 로 마우스 빛이 어긋나면 시차를 캔버스 대신 `.hero::after` 안개 층에 건다.
   - 스크롤 아웃: IO 로 히어로가 보일 때만 scroll 리스너 일함 → rAF. `p = clamp(scrollY / hero.offsetHeight, 0, 1)`. `.hero .wrap`: opacity `1-.6p`, scale `1-.05p`, translate `0 p*40px`. 캔버스 `translate: 0 p*-30px`. 921px 미만은 opacity 만. reduce 면 없음.

## Failure modes
| 경로 | 운영에서 날 일 | 처리 | 사용자 체감 |
|---|---|---|---|
| h1 CSS 애니 | 구형 브라우저 clip-path/개별 translate 미지원 | 속성 무시 → 정적 | 글 보임 |
| 줄 래핑 | 엔티티(`&gt;`) 등으로 글자 어긋남 | textContent 대조 실패 → 원복 | 정적 코드 |
| 타이핑 | IO 미발화·탭 숨김 | 6s `.typed` | 늦어도 다 보임 |
| 클라이언트 이동 재실행 | 이중 래핑 | `.ln` 가드 + 기존 #nav[data-live] | 없음 |
| hydration | dangerouslySetInnerHTML 안 DOM 변경 경고 | 콘솔 hydration 오류 0 단정 | 없음 |
| 기울기+rise | transform 덮어써 에디터가 22px 아래 멈춤 | 3단계 단일 transform | 단정으로 잡음 |
| 스크롤 | 계속 도는 rAF | 이벤트 때만 1회, 히어로 밖이면 무시 | 없음 |

## Test map (Playwright — tools/node_modules/playwright)
서버: `academy/` 에서 `node ./node_modules/next/dist/bin/next dev`(npx `&` 함정). DB 없어 죽으면 `next build && next start`, 그래도 안 되면 운영 HTML 을 받아 로컬 style.css·home 스크립트로 바꾼 정적 렌더. 어느 쪽인지 REVIEW-REQUEST 에 적는다. 결과물은 `handoff/research/step46/`.
- [GAP→추가] 스크린샷 1440x900·390x844 × t≈0.3s/1.5s/4s (6장) + reduce 1440 4s (1장)
- [GAP→추가] 텍스트 불변: 변경 전(운영 주소 또는 git stash)·후 4s 시점 `.hero` innerText, `.editor code` textContent 동일 단정
- [GAP→추가] `git diff --unified=0 academy/content/home.html` hunk 가 전부 `<script>` 범위 안 단정
- [GAP→추가] JS 끔: 4s 시점 h1·sub·CTA 보임, code 텍스트 DOM 그대로
- [GAP→추가] reduce: `.typing` 없음, h1 animation-name none
- [GAP→추가] 1.5s 시점 h1 clip 다 열림, 4s 시점 `.qa.framed`·`.end.glow` 존재, 모든 `.ln` opacity 1
- [GAP→추가] 데스크톱 pointer 이동 뒤 에디터 transform 에 회전 성분, `.in` 뒤 세로 이동 0 / 390 에선 회전 없음
- [GAP→추가] 콘솔 오류·hydration 경고 0
- [회귀] 다른 `.rise` 섹션 스크롤 뒤 opacity 1 · 캔버스 로봇 움직임(두 프레임 픽셀 차) · `.btn:hover` transform 유지
- `node ./node_modules/typescript/bin/tsc --noEmit` 통과

## Out of Scope (보이면 BUILD-LOG Known Gaps)
- `.rise` 가 JS 없으면 opacity 0 인 기존 문제(전 섹션) — KG-46-1
- 히어로 아래 섹션·네비·다른 페이지 모션, 영상 삽입
- 문구·마크업 개선 일체

## Acceptance
- Test map 전부 통과, 스크린샷 7장·단정 로그를 REVIEW-REQUEST 에 첨부
- 등장 1.6s 안에 끝, 0.3s 스크린샷에서 h1 이 이미 일부 보인다
- Richard 통과 → `academy/` 에서 `npx vercel --prod --yes`(git push 로 배포 안 됨) → 운영 robotncoding.com 에 같은 Playwright 1440/390 4s 스크린샷 + 텍스트 동일 단정 재실행 → 커밋·BUILD-LOG·체크포인트
