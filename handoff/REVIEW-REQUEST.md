# Review Request — Step 43 재검수 반영 (711f56c)
Date: 2026-10-10
Ready for Review: YES

## Must Fix
- academy/app/api/posts/route.ts — PATCH 는 revalidateAuthed(): ACADEMY_REVALIDATE_SECRET 를 헤더 `x-revalidate-secret` 와 timingSafeEqual(길이 다르면 거절), slug `^[\w가-힣-]{1,100}$`, 실패는 기존 deny(401+700ms). GET·POST·DELETE 는 그대로 authed()(이 비밀 안 받음)
- web/lib/draft-actions.ts 학원목록새로 — ACADEMY_REVALIDATE_SECRET 만 씀. ACADEMY_ADMIN_PASSWORD·ACADEMY_ADMIN_ID 사용 제거
- web/lib/post-auto-core.mjs 학원표지 — 제가(앞이 한글이면 아님: 「문제가」)·상담해 보면·가르치다/면서/며/는/던·가르쳐 보면/본·수강생·우리 원·수업 시간에(학교·정보·교과·정규·교실·온라인 수업은 아님). 시험: 리뷰어 재현 3문장 → 라벨 없으면 지움
- web/lib/post-auto-core.mjs 다듬기검사 — 학원표지 문장 수가 늘면 「학원 경험 문장이 늘어남」으로 버림 · 말모음은 중복을 세는 정렬 목록. 시험 2(「저희 반 아이들이 붙었습니다」 · 국민대 한 번 더)

## Should Fix
- academy/scripts/fact-check.mjs — pdf() 를 Promise.race 20초(PDF상한.파싱초), 넘으면 「못 읽음 · PDF 읽기 20초 넘음」. 자식 프로세스 분리는 안 함
- academy/package.json·package-lock.json — pdfjs-dist "6.4.299" 정확 고정
- 기존 GET/POST/DELETE 의 `!==` 비교는 KG-43-10

## 비밀값 — 만들지도 넣지도 않음. 세션이 넣을 곳
- 이름: `ACADEMY_REVALIDATE_SECRET` (같은 값 하나, 새로 만든 무작위 문자열)
- 넣을 곳 1: 학원 사이트 Vercel 프로젝트(academy/, robotncoding.com) — Production env. 넣은 뒤 `cd academy && npx vercel --prod --yes`(PATCH 라우트도 이 배포로 나감)
- 넣을 곳 2: 사이티드 web Vercel 프로젝트(geo-rose-nine) — Production env
- 선택: web 의 `ACADEMY_SITE_URL`(기본 https://robotncoding.com)
- 값은 파일로 넘기고 env pull 로 길이 확인(CLAUDE.md 함정 — PowerShell 파이프가 BOM·줄바꿈을 붙인다)
- 없거나 틀리면: 내리기는 그대로 되고, 목록은 15분 안에 저절로 빠지며 활동에 「내린 글 목록 새로 고침 실패」가 남는다

## 시험
test-post-auto 35 ✓ · ops-words 551 · todo-words 17 · client-status 14 · repair-core 27 · marketing 51 · tsc web·academy 0

---

# (이전) Review Request — Step 43 검수 반영 (3798699)
Date: 2026-10-10
Ready for Review: YES
Status: DONE_WITH_CONCERNS — academy 배포(PATCH 라우트)·web env ACADEMY_ADMIN_PASSWORD·운영 표 적용·러너 dry 는 세션 몫. 발행·DB 쓰기 안 함.

## Must Fix 반영
- web/lib/post-auto-core.mjs 다듬기검사 — 주장뽑기 이름·제도어 모음(정렬 join)이 다르면 「기관 이름이나 제도어가 바뀜」으로 버림. 시험: 신설→폐지 · 국민대→서울대
- web/lib/post-auto-core.mjs 학원표지 + academy/scripts/fact-check.mjs 출처대조 — 표지 든 문장은 notes.주장 과 상관없이 종류 「학원」, 창은 그 문장에 단 라벨 재료뿐 → 없으면 지움. 표지: 우리 학원·저희·우리 반·원생·우리 수업·상담에서·상담 온/오는/오신/와서/하다 보면·가르쳐 보면·「수업에서」(앞이 학교·정보·교과·정규·교실·온라인이면 아님). 시험: 라벨 없는 「저희 반…」「상담에서…」 지움 · 「정보 수업에서」는 대상 아님 · 라벨 있으면 맞음

## Should Fix 반영
- 판정읽기 → `못읽음` 표시, 출처대조는 미룸(회차 안 셈) + `답원문` 500자 → auto-post 가 활동 「자동 감수 판정 답 못 읽음」에 남김(dry 는 화면만)
- 근거 하한 15자(「근거가 너무 짧음」)
- 내리기: academy/app/api/posts/route.ts PATCH ?slug → /·/blog·글·/sitemap.xml·/rss.xml revalidatePath. web takedownPost 가 ACADEMY_ADMIN_PASSWORD(·ACADEMY_ADMIN_ID·ACADEMY_SITE_URL)로 부름, 없거나 실패면 활동에 남기고 목록은 15분 안에 저절로. 카드 문구 갱신
- 글기록말 3번째 인자 — 「초안이 N일째 감수가 안 됨(마지막 M/D) — 14일이면 놓아줌」/「초안 N일째 감수 중」. 글기록읽기가 가장 오래된 감수 중 초안과 마지막 감수 시각을 읽는다
- 발행(자동) update WHERE 에 `review_notes->'감수'->>'통과' = 'true'`
- 다시 쓰기 프롬프트에 「숫자 문장에는 기관·전형 이름을 같은 문장에」

## 세션 결정 반영 (D95~D98, BUILD-LOG)
- D96 PDF: fact-check.mjs PDF글()·출처가져오기 — pdfjs-dist 6.4.299(academy devDependency, company·write 워크플로 --no-save 설치), 5MB·50쪽·30초, octet-stream 도 %PDF 머리로 알아봄, 글자층 200자 미만 = 「못 읽음(스캔본)」, 창·근거 규칙 그대로
- D97 묵은 초안: 묵은초안SQL(감수기한일 14) → company weekly-draft 맨 앞 버리기(이유 「감수 기한 지남」), 주당 2주제 셈에서 뺌, 이번주글SQL 도 14일 넘은 초안을 안 셈

## 국민대 --review --dry (로컬, PDF 읽은 뒤)
- 출처 9곳: 읽음 8(PDF 1 — 59쪽 중 앞 50쪽) · 못 읽음 1(입학처 첫 화면)
- 처음 글 (a): 대조 21문장 중 **9 맞음**(PDF 전 20문장 중 8), 12곳 지움 → 통과
- (b) 제목 질문형 아님 → 다듬기 버림(숫자 바뀜) → 다시 씀(제목 「2027학년도 국민대 알고리즘우수자 전형이 10명 신설됐다는데, 코딩으로 대학 갈 수 있나요?」)
- 다시 쓴 글 (a): 대조 11문장 중 **7 맞음**, 4곳 지움. PDF 에서 「알고리즘우수자 전형은 국제인재 전형 15명과 함께 신설됐습니다」 맞음 → (b) 통과
- (c) 원장 관점 걸림: 일반론 3곳(「전국 규모와 나란히 놓으면…매우 좁습니다」 외 2), 말리기 문장은 있음 → 1회차 실패(내일다시). (d) 안 돌림

## 시험
test-post-auto 32 ✓ · ops-words 551 · todo-words 17 · client-status 14 · repair-core 27 · marketing 51 · tsc web·academy 0

---

# (이전) Review Request — Step 43 (학원 주 1편: 주제·재료 관문·자동 감수 4관문·발행·내리기)
Date: 2026-10-10
Ready for Review: YES
Status: DONE_WITH_CONCERNS — 운영 표 적용(setup-post-reviews)과 Actions 러너 dry 는 안 함(오케스트레이터 지시: DB 쓰기·푸시 금지). 스위치 post_auto_publish 는 기본 'off', 켜지 않음.

Commits: 43a a2d532b · 43b 62de684 · 43c 1d8162c (푸시 안 함)

## Files Changed
- academy/scripts/setup-post-reviews.mjs:1-48 — academy.post_reviews(if not exists) + 인덱스 2 + `post_auto_publish='off'` on conflict do nothing. **운영에 안 돌림**
- web/lib/post-auto-core.mjs:32-120 — 주제키 · 학원사실필요(교육과정 제외, 「반」은 낱말 끝만) · 철 · 후보모으기(A/B/C/D, 못 읽은 신호는 못읽음[])
- web/lib/post-auto-core.mjs:120-180 — 낱말·거르기(발행 영구·버림 8주·재료부족 4주·제목 같음·**기간 무관 제목 낱말 3개 = 같은 질문**·28일 낱말 2개)
- web/lib/post-auto-core.mjs:182-232 — 재료모으기(m·i·p, 비공개이유 SQL+코드 두 번 거름) · 재료판정 · 이번주글SQL
- web/lib/post-auto-core.mjs:235-420 — 접기 · 본문문장 · 주장뽑기(숫자만 있는 문장은 같은 문단 앞 문장의 이름·제도어를 빌림, 띄어 쓴 「X 전형」을 붙임) · 창찾기(단서가 많이 모인 자리부터 3개) · 판정읽기(근거 창 밖 → 없음, JSON 깨짐 → 전부 없음)
- web/lib/post-auto-core.mjs:421-530 — 문장지우기 · 본문해시 · 다듬기검사 · 다음행동 · 관점읽기 · 글기록말/글기록읽기
- web/lib/post-auto-core.mjs:541-690 — 기록하기 · 자동발행켜짐(못 읽으면 false) · 발행가능 · 발행(publishDraft 에서 옮김) · 내리기 · 버리기
- academy/scripts/auto-post.mjs:56-160 — --pick [--dry]: 이번주 확인 → 후보 → 거르기 → 재료 관문(3후보) → 고름 기록 → write-news/write-draft --topic-json → AUTOPOST=
- academy/scripts/auto-post.mjs:163-375 — --review [--dry]: 하루 1회차, 2회차부터 지난 고침으로 먼저 다시 쓰기, a→b(다듬기 1·다시 쓰기 1, 다시 쓰면 a부터)→c→d, 낙관 잠금 저장, '감수' 기록, 3회차 버림
- academy/scripts/fact-check.mjs:20-195 — 출처가져오기(15초·2MB·리다이렉트·PDF/비HTML=못 읽음·DNS/타임아웃=네트워크·euc-kr) · 출처주소들 · 출처대조(학원 주장은 라벨 재료 원문이 창, 출처 전체에서 단서 많은 창 3개) · CLI 는 main 가드 안에 그대로
- academy/scripts/review-gates.mjs:1-110 — 티찾기(b) · 가림찾기(d, 내부 /blog/ 링크 걸림 제외) · 원장규칙/AI티줄(CLAUDE.md 에서 읽음, 못 읽으면 null) · 관점프롬프트(c)
- academy/scripts/slop-rules.mjs:104-126,352-356 — 결론반복(n=20)·목록남발(출처 절 제외) 추가, 검사에는 **경고로만**(기존 게이트·slop-check 기본 출력 그대로)
- academy/scripts/write-news.mjs:40-47,58-66,114-140,195-200,329-360 — --topic-json(정해진 주제·라벨 재료·주장 목록), 재료표 있으면 「학원 경험 문장은 라벨 재료에만·p# 연도」, notes.주제/주장/재료표
- academy/scripts/write-draft.mjs — 주 1편 확인 = 이번주글SQL · --topic-json(재료 글 강제, i#·p# 덧재료, 주장) · 머리 주석
- academy/scripts/company.mjs:49,610-650 — 내일아침 · 자동발행(감수 기록 있는 글만, 발행가능 자동) · 자동감수(AUTOPOST 행동 → 일감 상태, 버림이면 weekly-draft 내일)
- academy/scripts/company.mjs:775-815 — weekly-draft → auto-post --pick(이번 주 발행=다음 월요일, 감수 중=내일, 버림 2=못냄) · question-draft(학원) → 관찰 「주제 후보로 넘김」
- academy/scripts/company.mjs:830-833,895-900,918-925 — review 맨 앞 스위치+주제 분기 · illustrate 붙임 뒤 자동발행 · announce-removal 실행기
- academy/scripts/pm-report.mjs:27,190-193 — 산출물에 글기록말 한 줄(표 없으면 안 붙음)
- web/lib/draft-actions.ts:57-80 — publishDraft → core 발행(누가 원장) · takedownPost(guard → core 내리기, NAVER_BLOG_ID||force11)
- web/lib/drafts.ts:30-80 — TAKEDOWN_REASONS · listAutoPosts(감수 중 + 30일 자동 발행)
- web/app/admin/drafts/page.tsx:104-175,181-196 — 「자동 글」 절·카드(고른 이유·쓴 재료·감수 4줄·회차·대조한 출처/못 읽은 곳/지운 문장·[내리기])
- web/lib/agents.ts:4,541-552 — 콘텐츠 줄 reason 에 글기록말
- academy/scripts/test-post-auto.mjs — 30개(Test map 전부 + 출처 대조 fixture 3 · 규칙표 · 가림)
- academy/scripts/test-ops-words.mjs·test-todo-words.mjs — agents.ts 깎기에 post-auto-core 경로 · 글기록말 금지어 검사
- .github/workflows/write.yml — auto 모드 → auto-post --pick · mode=review-dry(+slug) 디스패치 · 머리 주석
- CLAUDE.md:139 — D94 문구 그대로 교체 · .claude/skills/post/SKILL.md 4절 앞 auto-post --review

## dry 결과 (운영 DB 읽기만, 쓰기 0)
`node scripts/auto-post.mjs --pick --dry`
```
후보 20개 · 남은 것 17개 · 뺀 것 3개
  34점 [A] 초등학교 몇 학년부터 코딩 배우는 게 좋아?   AI 답 4곳 중 0곳이 우리를 안 부름(10/10 잼)
  25점 [B] 송파구에서 아이 코딩학원 찾는데 어떤 곳이 신뢰가 갈까요?   경쟁 쪽 3곳이 대신 인용됨(…)
  20점 [C] 송파 초등 코딩학원 추천 · 15점 [D] 수행평가에 AI… (지금 철 학기중) · 15점 [D] 영재원 준비… (영재원모집)
뺀 것: AI 시대에 아이한테 뭘 가르쳐야 할까? — 9/22 「2028년 3월 AI 교과서 16…」 글과 겹침(AI·아이한테)
       바이브 코딩이 뭐야? 아이도 배울 수 있어? — 이미 쓴 글 「바이브 코딩이 뭐야? 아이도 배울…」과 같은 질문
       AI 시대에 우리 아이는 어떤 진로를 봐야 하나요? — 이미 쓴 글 「AI 시대, 우리 아이의 미래를 …」과 같은 질문
재료: 재료표 0 · 상담 말 0 · 원장 글 문단 8
재료 관문: 초등학교 몇 학년부터 코딩 배우는 게 좋아? → 사실 → write-news
```
국민대·68시간과 겹치는 후보는 지금 신호에 없다. 28일 겹침 제외는 test-post-auto 「국민대 알고리즘우수자 전형 준비는 언제부터?」 fixture 로 확인(→ 「10/5 「코딩으로 대학 가나요? 2027학…」 글과 겹침(국민대·알고리즘우수자·전형)」).

`CLAUDE_CODE_LOCAL=1 node scripts/auto-post.mjs --review 2027-algorithm-talent-admission-kookmin --dry` (로컬)
- 출처 9곳: 읽음 7(kyobit 2308·5781, edu-lab, kcue, eduplus 20064·20077, etoday) · PDF 1(admission.kookmin.ac.kr file_download — 국민대 모집요강) · 못 읽음 1(admission.kookmin.ac.kr 첫 화면 — 본문 거의 없음)
- 처음 글 (a): 대조 20문장 중 8 맞음, 12곳 지움 → 통과. 지운 것 예: 「국민대가 2027학년도 수시에 알고리즘우수자 전형을 새로 만들었습니다」(창에 신설 근거 없음) · 「국제인재 전형 15명과 함께 신설」(15명은 PDF 에만) · 「네 전형을 더하면 146명」(계산) · 「2028학년도 이후 유지되는지는 아직 안 정해졌습니다」·「2030년대」 같은 판단 문장
- (b): 제목 질문형 아님(「…10명 신설됐습니다」) · 소제목 6개 → 다듬기 → 다시 쓰기 → 다시 쓴 글 (a): 「첫 문단이 지워짐」으로 실패(대조 9문장, 맞음 6, 지움 3: 「모집인원은 10명입니다」·「1단계에서 서류 100%…」·「지원 자격은…」)
- 결과: 1회차 실패 → (dry) 내일다시. (c)(d) 안 돌림. (d) 를 원문에 따로 돌리면 걸림 0
- 첫 dry 실행 한 번은 판정 답을 못 읽어 전부 「없음」(fail-closed)으로 떨어졌다. 같은 입력 두 번째부터는 정상. 답 원문을 안 남긴 실행이라 원인 미확인
- 이 실행 전 출력은 (b) 를 「안 돌림」으로 잘못 찍었다(다시 쓴 뒤 (a) 가 실패하면 b 기록을 건너뜀) — 43c 커밋에서 처음 글 (a)·다시 쓴 제목·(b) 를 같이 남기게 고침. 그 뒤 Claude 재실행은 안 함(호출 절약)

Acceptance fixture (test-post-auto, DB·Claude 없음): 같은 본문 「10명」→「12명」 → (a) 그 문장 「없음 · 원문에서 창을 못 찾음」 → 지움 ✓ · 끝에 「우리 학원으로 오세요」 → (b) 「학원 홍보로 닫기」 ✓

## Open Questions
- 국민대 글(원장이 발행한 글)도 (a) 에서 12문장이 지워지고 (b) 에서 제목·소제목으로 걸린다. 기준이 원장 실제 글보다 엄하다 — 브리프 「느슨하게 만들지 않는다」대로 둠. 스위치를 켜기 전에 Arch 가 이 엄격도를 받아들일지 정해야 한다(켜면 첫 몇 주는 「못 냄」이 잦을 수 있다)
- 다시 쓰기가 출처에 붙어 있던 이름(국민대·알고리즘우수자)을 문장에서 빼면 (a) 가 그 문장을 못 찾아 지운다 — 다시 쓰기 프롬프트에 「숫자 문장에는 무엇의 숫자인지 이름을 같이」를 넣을지
- 주장뽑기의 「앞 문장 이름 빌리기」·「숫자 없는 주장은 이름(있으면)+제도어(있으면)」는 브리프 문구보다 넓다(BUILD-LOG 결정). 안 그러면 사실 문장이 대부분 지워진다
- 거르기의 「기간 무관 제목 낱말 3개 = 같은 질문」은 브리프에 없는 추가 규칙
- write.yml auto 모드를 auto-post 로 바꾼 것(브리프는 주석만) — 두 길이면 같은 주 두 편
- 판정·관점 호출이 한도 아닌 이유(인증·시간 초과)로 실패해도 미룸(회차 안 셈)으로 둠

## Out of Scope (logged in BUILD-LOG)
- 운영 적용: `node scripts/setup-post-reviews.mjs` → select 확인(표 0행 · post_auto_publish=off) — 세션 몫
- 러너 dry: write.yml workflow_dispatch mode=review-dry slug=2027-algorithm-talent-admission-kookmin — 세션 몫(D86 미확인 그대로)
- /admin/drafts 자동 글 절 운영 화면 확인 — 배포 뒤
- KG-43-5 daily-agent write-draft --question 길 남음 · KG-43-6 write.yml·company 동시 실행 경쟁 · KG-43-7 company 예산 안 review 35분 · KG-43-8 아래 초안 목록에도 자동 초안 · KG-43-9 국민대 글이 (b) 규칙에 걸림
