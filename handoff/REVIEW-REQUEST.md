# Review Request — Step 17 · 랜딩 문구 · 실패 자동 재시작 · 초안은 주 1편·없으면 건너뜀
Date: 2026-09-24
Ready for Review: YES

원장(9/24): 「랜딩페이지 ai슬롭도 해결하고 에이전트가 일을 실패해도 스스로 다시 시작하게 하고 초안 작성이 필수는 아니고 없으면 패스하고 포스팅 글 작성은 주당 1회」.

## 1. 실패해도 스스로 다시 (academy/scripts/company.mjs)
- `근무()` — 실패 3번이면 「사람 대기」로 넘기던 것을 없앴다. 간격 `다시해봄(n)`: 1·3·6·12시간, 그 뒤 하루 한 번. 계속 대기로 돈다. 되풀이 실패는 감사 R1 이 조사로 올린다(그 경로는 안 건드림)
- `workflow-failed` — 두 번째부터도 사람 대기 대신 간격을 늘려 새로 띄운다(실패 단계는 근거에 남김). 이미 돌고 있는 실행이 있으면 안 띄움.
  수리(repair.yml)는 여전히 안 띄운다(Richard 9/22 — 봇 실행이 사람 실행으로 읽힘) — 대신 사람 대기가 아니라 관찰 24h(다음 날 예약이 다시 돈다).
  영업(sales.yml)은 이제 띄운다 — `inputs.mode=run` 을 준다. sales.mjs 는 actor 를 안 본다(grep 확인). 봐 주세요: 영업이 두 번 돌면 해가 있나(통화문 묶음 중복?)
- `web/lib/agents.ts` 실패 문장: 수리 「내일 06:50 에 다시 돕니다」, GitHub 작업 「매시 점검이 간격을 늘려 다시 돌립니다」, 그 밖 「다음 차례에 다시 해 봅니다」. Step 16 의 gaveUp 은 이제 쓸 데가 없어 뺐다

## 2. 초안은 필수 아님 — 없으면 건너뜀
- `material-task.mjs` — 「초안 재료가 필요합니다」「발행이 멈췄습니다」 사람 대기 일감을 더 안 만든다. 대신 `geo.agent_activity` 에 「주간 초안 건너뜀」 한 줄. 빈손 카운터 없앰. `다시돎()` 은 옛 material-need·material-stopped 를 닫는다
- `company.mjs` 계획 — material-need 신호 생성 삭제(읽음 표시만 남겨 옛 일감이 「신호 사라짐」으로 닫힘)
- `write-draft.mjs`·`write-news.mjs` — 건너뛸 때 활동 한 줄만. 사실 모드에서 두 줄 적히지 않게 write-draft 쪽 기록 삭제
- DB: 530(material-need) 닫음

## 3. 주 1편
- `write-draft.mjs` 맨 앞 — 이번 주(월 0시 KST~)에 client 1 초안(academy.posts.created_at)이 있으면 `모드=이번주있음` 찍고 78. 못 읽으면 1(고장). 세 길(write.yml·weekly-draft·question-draft·daily-agent)이 다 write-draft 를 거친다
  - 운영 DB 로 실행해 봄: `모드=이번주있음 … (/blog/ai-textbook-16-subjects-2028)` 종료 78. 이번 주 월요일 경계 `2026-09-20T15:00Z` 확인
  - 버린 초안(삭제됨)은 안 센다 — 버리면 그 주에 다시 쓸 수 있다. 의도
- `company.mjs` weekly-draft·question-draft 는 78 을 실패로 안 치고 `다음월요일()` 07:00 KST 까지 대기
- `daily-agent.mjs` — 78 이면 agent_runs 에 「완료 · 이번 주 글이 이미 있어…」. 전에는 실패 + exitCode 1 로 optimize 가 빨갛게 됐다
- `write.yml` 78 안내 문구

## 4. 랜딩 문구 (fork 에이전트가 고침, 글자만)
web/app/page.tsx · HeroDemo.tsx · ScanForm.tsx · services/page.tsx · web/lib/services.ts · web/lib/guides.ts.
근거 못 찾은 숫자 삭제: 「사이트 점수 몫 20%」「홈페이지 효과 전체의 20%」「월 4만원짜리 측정 도구」. 「대부분은 측정부터」(고객이 없는데 「대부분」) 등.
남긴 의심 숫자(출처 미확인): 28%·「약 4분의 1」, 「출처 중 회사 홈페이지는 다섯에 하나가 안 됐다」, Interval.tsx P_HAT=0.62 — Known Gap 으로 적을 것.

## 확인
`node --check` 7개 파일 통과 · web `tsc --noEmit` 통과.

## Files
.github/workflows/write.yml · academy/scripts/{company,daily-agent,material-task,write-draft,write-news}.mjs · web/lib/agents.ts ·
web/app/{page,HeroDemo,ScanForm}.tsx · web/app/services/page.tsx · web/lib/{services,guides}.ts
