@.claude/skills/token-optimization.md

# 이 저장소에서 일하는 법

1인 기업이다. 사람 손이 적으니 자동화된 것과 사람이 해야 하는 것을 늘 갈라 둔다.

## 무엇을 하는 회사인가

**사이티드(Cited)** — AI 답변에 고객사 이름이 불리게 만드는 마케팅 대행사.
`web/` 이 그 랜딩이고 `geo-rose-nine.vercel.app` 에 올라간다.

**로봇&코딩학원** — 원장 본인이 운영하는 학원. `academy/`, `robotncoding.com`.
사이티드의 **첫 레퍼런스**다. 여기서 나온 숫자가 영업 자료가 된다.
그래서 이 사이트에 지어낸 숫자가 하나라도 들어가면 사업 전체가 무너진다.

## 목표 (일의 우선순위는 여기서 나온다)

1. **레퍼런스 완성** — 학원이 증거가 되게. 노출·크롤러·인용을 날짜와 함께 기록
2. **꾸준한 발행** — 주 1편. 끊기면 크롤러도 뜸해지고 레퍼런스가 늙는다
3. **첫 고객 유치** — 1·2가 되어야 할 수 있다

## 절대 규칙

- **지어내지 않는다.** 숫자는 DB·저장소·측정에서 나온 것만. 근거가 없으면 "모른다"고 쓴다
- **고객사는 가린다.** 회사명뿐 아니라 지점명·업종·규모도. 조합되면 특정된다
- **번역체를 쓰지 않는다.** 문장을 짧게 끊고 조사를 덜어낸다. 사람이 말하듯 쓴다
- **"우리 학원으로 오세요"로 닫지 않는다.** 판단 기준을 주고 끝낸다
- **불안을 팔지 않는다.** "지금 안 하면 늦습니다" 류는 조회수는 되고 신뢰는 깎인다
- **하지 말아야 할 것을 한 번은 말한다.** 다 좋다고 하면 소개꾼이 된다

## AI 가 쓴 티 (전부 금지)

읽는 사람은 안다. 아래가 하나라도 있으면 그 글은 광고로 분류된다.

**구조**
- "오늘은 ~에 대해 알아보겠습니다" 같은 서론. 첫 문장부터 본론으로 들어간다
- "먼저 / 다음으로 / 마지막으로" 로 이어붙이기
- 앞에서 한 말을 결론에서 그대로 다시 하기
- 목록 남발. 목록은 진짜 나열일 때만

**문장**
- "정말 중요합니다" "매우 유익합니다" 같은 빈 강조
- "~라고 할 수 있습니다" "~인 것 같습니다" 로 흐리게 끝내기
- "다양한" "여러 가지" "많은" 처럼 숫자를 피하는 말. 숫자를 안다면 숫자를 쓴다
- 과장된 형용사. "놀라운" "혁신적인" "필수적인"

**내용**
- 양쪽 다 맞다는 식의 양비론. 어느 쪽인지 말한다
- 구체가 없는 일반론. 사례·숫자·상황이 없으면 안 쓴다
- 검색해서 아무나 쓸 수 있는 말. 이 사람만 쓸 수 있는 것을 쓴다

**대신 이렇게**
- 상담에서 실제로 들은 말로 연다
- 안 겹치는 것·안 되는 것을 먼저 말한다
- 숫자는 잰 것만. 못 쟀으면 "안 쟀다"고 쓴다
- 문장을 짧게 끊는다. 긴 문장 하나보다 짧은 두 개가 낫다

## 글 쓰는 규칙

- 제목은 **질문형**. 학부모가 검색창에 치는 말 그대로
- 문단 80~400자. 잘라 인용하기 좋은 길이다
- 소제목은 `##`. 굵게는 `**`
- 도해 1~3장. SVG 로 그리고 PNG 로 굽는다 (`tools/svg-to-png.mjs`)
- **SVG 안의 `&` 는 반드시 `&amp;`.** 안 그러면 XML 이 깨져 빨간 오류 화면이 PNG 로 저장된다

## 자주 쓰는 도구

```
academy/scripts/
  briefing.mjs        오늘 뭐가 밀렸는지  ← 세션 시작할 때 먼저
  check-index.mjs     노출 측정 (Bing·네이버)
  indexnow.mjs        색인 알림. 주소를 직접 줄 수도 있다
  case-report.mjs     영업용 케이스 리포트 생성

tools/
  submit-gsc.mjs        구글 색인 요청 (하루 약 10건, gsc-done.json 에 기록)
  naver-blog-post.mjs   사이트 글을 네이버로. 서식·태그 자동
  naver-place-check.mjs 플레이스 순위
  svg-to-png.mjs        SVG → PNG
  motion-record.mjs     도해에 움직임 붙여 영상으로
  open-session.mjs      로그인 세션 열기 (사람이 직접 로그인)

probe/
  workbench.html      API 키 없이 AI 인용률 수집

관리 화면 (사이티드 랜딩)
  /admin/ops       운영 현황 · 에이전트 망 · 자리별 성과
  /admin/inquiry   문의 기록 — 어떻게 알고 오셨는지
  /admin           리드 큐
```

## 함정 (다 한 번씩 당했다)

- **Bash 히어독이 백슬래시를 먹는다.** 정규식·이스케이프가 든 파일은 Write 로 쓴다
- **`grep -c` 는 0건일 때 종료코드 1.** `&&` 로 이으면 뒤가 통째로 안 돈다
- **CSS `transform` 은 속성 하나.** 애니메이션이 `translateX(-50%)` 를 덮어쓴다
- **한글은 `word-break: keep-all`** 이 없으면 단어 중간에서 끊긴다
- **파일을 넘긴 것과 저장된 것은 다르다.** 업로드 후 화면을 다시 읽어 확인한다
- **PowerShell 파이프가 BOM 과 줄바꿈을 값에 붙인다.** `"admin" | vercel env add` 하면
  `﻿admin
` 이 저장된다. `vercel env add` 는 그래도 "Added" 라고 답한다.
  값은 파일로 넘기고(`vercel env add X production < file`), 넣은 뒤 `env pull` 로 길이를 확인한다
- **gh 계정이 `codeis8520-ctrl` 로 되돌아간다.** 푸시 전 `gh auth switch --user leeledger`
- 네이버 에디터에서 고쳐 쓸 때 본문 컴포넌트를 누르고 `Ctrl+A` **두 번**
- **`node_modules` 를 정션(junction)으로 걸어 두고 그 폴더를 지우면 원본이 날아간다.**
  git worktree 를 만들어 `mklink /J node_modules` 로 연결했다가 `git worktree remove --force` 를 했더니
  본 저장소의 `node_modules` 가 통째로 지워졌다(2026-09-12, 아이로그). 병렬 작업 트리는 의존성을 따로 설치하거나,
  Turbopack 이 정션을 거부하니 아예 한 트리에서 차례로 한다
- **네이버 서치어드바이저의 소유확인·RSS 제출은 캡차가 뜬다.** 우회하지 않는다 — 사람이 10초 안에 끝낸다
- **DB 시각은 UTC 로 나온다.** `toISOString()`·`toLocaleString()` 에 `timeZone: "Asia/Seoul"` 을 안 주면
  GitHub Actions 러너에서 UTC 로 찍힌다. 첫 크롤러 방문 00:49(KST)가 「오후 3시 49분」으로 랜딩·리포트에 나가 있었다
- **고객사를 추가하면 `academy/clients.mjs` 에 한 덩어리 넣는다.** 표에 client_id 만 만들고 스크립트를 안 고치면
  아무도 안 잰다 — 아이로그가 하루 넘게 그랬다

## Three Man Team (v1.3.0 · manifest.md)

Available agents: Arch (Architect), Bob (Builder), Richard (Reviewer)

- 세션 시작: `handoff/SESSION-CHECKPOINT.md` → `ARCHITECT.md`. 체크포인트가 없으면 `handoff/BUILD-LOG.md` + `handoff/ARCHITECT-BRIEF.md`
- 한 줄 수정·오타가 아닌 작업은 Arch 가 `handoff/ARCHITECT-BRIEF.md` 를 쓰고 → Bob(`builder`) 이 짓고 `REVIEW-REQUEST.md` → Richard(`reviewer`) 가 `REVIEW-FEEDBACK.md`
- 한 번에 한 단계. 단계 밖에서 발견한 문제는 고치지 말고 BUILD-LOG Known Gaps 에 적는다
- 배포 게이트는 상시 승인(원장 결정) — Richard 통과 + 운영 주소 확인이면 묻지 않고 배포하고 결과를 보고한다
- 결정은 내리는 즉시 BUILD-LOG 에 적는다. 세션 끝에는 SESSION-CHECKPOINT 를 갱신한다

## 사람만 할 수 있는 일

- 네이버·구글 로그인 (`open-session.mjs` 로 창을 열어 주면 사람이 로그인)
- 영상 촬영과 목소리
- 상담에서 "어떻게 알고 오셨어요" 묻기 ← 매출 검증의 유일한 고리
  (기록 화면은 만들어져 있다: /admin/inquiry?key=... · 30초면 입력된다)
- 발행 전 사실 확인
