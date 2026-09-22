# Review Feedback — Step 12 (삽화 담당) 2차
Date: 2026-09-22
Ready for Builder: YES
Commits reviewed: f9adfaf · 55f878c · ccd25e8

## Must Fix
없음. 1차 Must 둘 다 풀렸다.
- **걸러내기 → 허용 목록**(illustrate.mjs XML검사). 요소는 접두어 없는 그리기 요소 목록만 된다(script·foreignObject·image·a·animate·set·접두어 요소는 전부 밖). 접두어 속성은 `xmlns:xlink`(정확한 URI)와 `xlink:href="#…"` 만 된다. `xmlns` 는 SVG 네임스페이스만 된다(기본 네임스페이스를 XHTML 로 바꿔 끼우는 길도 막힌다). 속성값과 `<style>` 글은 엔티티를 푼 뒤 검사한다. `\`·`@`·CDATA·`#` 가 아닌 url() 은 버린다. `on*` 는 대소문자를 가리지 않고 막는다. 따옴표 속 `>` 로 태그를 쪼개면 속성 해석이 실패해 버려진다(fail-closed). --test 에 1차에 적은 우회가 모두 들어 있다.
- **svg-to-png.mjs**: `javaScriptEnabled: false` + `file:` 가 아닌 요청은 전부 abort. 증거: 스크립트·fetch·외부 이미지를 넣은 그림이 「SAFE」로 그려지고 요청 0.
- **하루 몫**: `ILLUSTRATE_MAX_PER_DAY`(기본 6, 빈 값은 기본값), KST 날짜로 센다. 넘으면 `하루몫` → 다음 KST 자정 00:01 에 다시(`내일()` 계산 확인). 세기가 실패하면 throw → 실패로 끝난다(fail-closed). 측정이 아닌 호출 몫 20 중 삽화는 6까지만 쓴다.

## Should Fix
- illustrate.mjs 막대모양 — 막대인데 data-value 를 안 단 그림을 잡는 추정은 `rect`(rx ≤ 6, 굵기 ≤ 40)만 본다. 막대를 `path` 로 그리거나 rx 7 로 그리면 빠진다. 이제 원장이 검토 화면에서 그림을 직접 보니 막을 일은 아니다. BUILD-LOG Known Gap 에 한 줄 적는다.
- `<style>` 과 속성값 검사는 `url(` 만 주소로 본다. CSS 의 `image-set("https://…")` 처럼 url() 없이 문자열로 주소를 쓰는 문법은 걸리지 않는다. 지금은 사이트 CSP(`default-src 'none'`·sandbox)와 svg-to-png 의 요청 차단이 둘 다 막고, `<img>` 로 그릴 때는 외부 요청이 없다. 한 줄로 더 막으려면 CSS·속성값 안의 `https?:` 문자열을 버린다(xmlns 값 제외).

## Escalate to Architect
없음.

## Cleared
- **route.ts**: 발행된 글의 그림만 내보낸다(join posts published). CSP 에 `sandbox` 가 더해졌고 캐시는 1시간이다(Arch).
- **검토 화면 미리보기**: 초안 그림은 서버가 DB 에서 읽어 `data:image/svg+xml;base64` `<img>` 로 보여 준다(스크립트 안 돎). 손으로 넣은 도해는 경로 꼴을 검사한 뒤 사이트 주소로 연다. alt 는 먼저 esc 를 거친 글이라 속성 밖으로 새지 않는다.
- **발행 막기**: `![` 가 있어야 하고, 본문이 가리키는 `/blog/img/<slug>/<name>.svg` 가 post_images 에 전부 있어야 한다(Postgres 정규식, 이스케이프 확인).
- **600자 미만 초안**: 그리지 않고, 화면이 이유를 알린다.
- **막대검사**: `data-orient="h|v"` 가 없으면 버린다. 한 차트에 방향이 섞여도 버린다. 눈금만 있고 data-value 가 없어도 버린다.
- **한글 수사**: 수천·수만·몇·석·넉 을 더했다. sales `--draft-test` 14/14 로 「중요한 점」은 통과, 「수만 명」「몇 배」는 버림이다. `--leak-test` 20/20.
- **1차 Cleared 항목**: 거래·updated_at 조건, 버리기 시 그림 삭제, guard() 는 그대로다.
