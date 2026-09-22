# Architect Brief — Step 12 · 초안에 도해를 붙이는 삽화 담당
*Arch 작성 2026-09-22. Step 9·10·11 은 끝났다(BUILD-LOG). 이 파일은 Step 12 만.*

---

## 왜

원장 지적(2026-09-21 오전): 「블로그 글에 왜 이미지 삽화가 하나도 없지」. 그날 세션에서 9장을 손으로 그렸다.
그런데 에이전트가 쓰는 초안(write.yml 주간 글·company question-draft)에는 도해 단계가 없다.
원장이 /admin/drafts 에서 「발행」 하면 글자만 공개되고, 네이버로도 QR 카드 한 장만 붙어 간다.
같은 문제가 자동 경로에서 매주 되풀이된다.

막힌 곳 하나: **학원 사이트는 git push 로 배포되지 않는다**(CLAUDE.md 함정 — `npx vercel --prod` 를 손으로). Actions 에는 Vercel 토큰도 없다.
그래서 서버 에이전트가 `academy/public/blog/<slug>/*.svg` 를 만들어도 사이트에 못 올린다. 글은 DB 에서 읽어 배포 없이 반영된다 — 그림도 같은 길로 간다.

## 결정

1. **그림은 DB 에 둔다.** 새 표 `academy.post_images (slug text, name text, svg text not null, alt text not null, created_at, unique(slug,name))` (additive).
2. **사이트가 DB 에서 내보낸다.** 새 경로 `academy/app/blog/img/[slug]/[name]/route.ts` → `image/svg+xml`, 캐시 1일. 본문 참조는 `/blog/img/<slug>/<name>.svg`.
   - 이 경로를 넣는 배포 한 번만 사람이(또는 이 세션이) `npx vercel --prod` 로 한다. 그 뒤로는 배포 없이 그림이 붙는다.
   - 기존 `public/blog/<slug>/*.svg` 는 그대로 둔다. 경로가 다르니 겹치지 않는다.
   - 응답에 `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'` — SVG 안 스크립트를 막는다. 저장 전에도 `<script`·`on*=`·`href="javascript:`·외부 `href`/`xlink:href` 가 있으면 버린다.
3. **삽화 담당 `academy/scripts/illustrate.mjs`** (Actions 에서 돈다)
   - 대상: `published=false` 이고 본문에 `![` 가 없고 `review_notes.삽화` 가 없는 초안. 한 번에 1편.
   - Claude Code(구독, `claude-code.mjs`, purpose `illustrate`, capRequired, 도구 없음, 빈 임시 폴더)에 본문을 주고 **도해 1~2장** 의 SVG 와 넣을 자리를 JSON 으로 받는다: `[{name, alt, before, svg}]`.
     - 프롬프트에 CLAUDE.md 글 규칙·`.claude/skills/post/SKILL.md` 의 도해 규칙(팔레트 `#0B0F16`·`#F5A623`·`#3DD6C4`, 960 폭, `&`→`&amp;`, aria-label 에 내용)과 **본문에 없는 숫자·사실을 그림에 넣지 마라** 를 준다.
     - 참고 예시로 `academy/public/blog/koding-kurikyulleom-sunseo/grading-shift.svg` 한 장을 통째로 준다.
   - **검사(스크립트가 한다, 모델 말을 믿지 않는다)**
     - SVG 가 XML 로 파싱되는가(간단 파서 또는 Playwright 로 렌더해 오류 없는지). 파싱 오류면 버린다 — 빨간 오류 화면이 PNG 로 구워진 전례(CLAUDE.md)
     - 금지 요소(위 2번)
     - **숫자 검사**: SVG 글자(`<text>`·aria-label) 속 숫자 토큰이 본문에 통째로 있는가. 없으면 버린다 (sales.mjs 의 통째 토큰 검사를 옮겨 쓴다)
     - 고객사 가림: `academy/masks.mjs` 로 client 1 이 아닌 고객사 이름·지역이 들어가면 버린다
     - 크기 ≤ 60KB, 폭 960
   - 통과한 것만 `post_images` 에 넣고, 본문의 `before` 문구 앞에 `![alt](/blog/img/<slug>/<name>.svg)` 를 끼운다(`insert-diagrams.mjs` 와 같은 규칙: 문구를 못 찾으면 첫 `##` 뒤). 본문 수정은 `updated_at` 조건으로 — 원장이 그사이 고쳤으면 덮어쓰지 않는다(company.mjs 다듬기와 같은 방식).
   - `review_notes.삽화 = {장수, 버린것:[이유], 쓴날}` 을 남긴다. 검토 화면이 이미 `![` 를 「도해: alt」로 보여 준다 — 원장이 사실 확인 때 같이 본다.
   - 다 버려졌으면 초안은 그대로 두고 `review_notes.삽화` 에 이유를 적는다. 사람 대기로 올리지 않는다(발행은 어차피 사람이 한다).
4. **언제 도나**: `company.mjs` 에 일감 종류 `illustrate` — 초안 검토(review) 일감이 생길 때 같이 만든다. 매시 루프가 1편씩. Claude 호출 하루 상한 안에서.
   - Actions 에 Playwright 가 없으면 파싱 검사는 가벼운 XML 검사로 한다(`fast-xml-parser` 같은 새 패키지는 넣지 않는다 — 태그 균형·엔티티만 보는 작은 검사를 직접 쓴다).
5. **네이버 이관** (`tools/naver-blog-post.mjs`, 원장 PC): 본문 이미지가 `/blog/img/...` 면 DB 의 SVG 를 받아 임시 폴더에서 `svg-to-png.mjs` 로 구워 올린다. 지금처럼 `public/blog` 에 PNG 가 있으면 그것을 쓴다.
6. **사이트 og:image**: `app/blog/[slug]/page.tsx` 는 첫 이미지를 PNG 로 바꿔 쓴다. `/blog/img/...svg` 는 PNG 가 없다 — 이 경우 og:image 를 **넣지 않는다**(SVG 를 주면 네이버 카드 글자가 네모로 깨진다, 2026-09-21).

## Bob 이 할 것 (순서)
1. 표 + 경로(route.ts, CSP) + og:image 예외 → `tsc` → **이 세션에서 academy `npx vercel --prod --yes` 한 번** → 운영 주소에서 시험 그림 한 장(DB 에 넣고 열어 보고 지운다) 확인
2. `illustrate.mjs` + company 일감 → 로컬 `--dry`(Claude 부르지 않고 대상만), 로컬 1편 실제(CLAUDE_CODE_LOCAL=1) → 검사 시험 `--test`(파싱 오류·스크립트·숫자·가림 위반을 일부러 넣어 다 버리는지)
3. Actions 에서 company 한 번 돌려 실제 초안 1편에 도해가 붙는지 → 운영 주소에서 그 초안은 비공개라 안 보이니, 그림 경로만 열어 확인
4. naver-blog-post.mjs 의 DB 그림 경로 → `--dry` 로 하단 스크린샷 확인
5. BUILD-LOG · REVIEW-REQUEST

## 인수 시험
- [ ] `/blog/img/<slug>/<name>.svg` 가 운영에서 열린다, 응답 헤더에 CSP
- [ ] `--test` 에서 파싱 오류·`<script>`·외부 href·본문에 없는 숫자·다른 고객사 이름 SVG 를 모두 버린다
- [ ] 실제 초안 1편에 도해 1~2장이 붙고, 검토 화면에 「도해: …」로 보인다
- [ ] 원장이 그사이 고친 본문을 덮어쓰지 않는다(updated_at 조건)
- [ ] 네이버 `--dry` 하단 스크린샷에 도해가 PNG 로 들어간다
- [ ] Claude 호출이 purpose `illustrate` 로 세어지고 하루 상한을 지킨다

## 하지 않는 것
- 사진·생성형 이미지 모델 — 도해(SVG)만. 지어낸 장면이 들어갈 틈을 안 연다
- 이미 발행된 글에 소급 적용 — 발행본은 사람이 본 것이다
