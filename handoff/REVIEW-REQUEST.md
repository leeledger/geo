# Review Request — Step 19 · AI 직원 팀 (직원 파일 · 근거표 · 숫자 게이트 · 아침 보고 · 5회 실패 확인 필요)
Date: 2026-09-24
Ready for Review: YES (2차 — Richard 1차 반영)

## 2차 — Richard 1차 반영

### Must 1 — 프로필을 system 칸에서 빼고 표준입력 프롬프트 앞으로
- academy/scripts/illustrate.mjs:447-448 — `클로드코드(\`${프로필("illustrate")}\n\n---\n\n${프롬프트(post)}\`, …)`. system(450) 은 원래 한 줄
- academy/scripts/sales.mjs:223-224 — `prompt` 앞에. system(226) 원래 한 줄
- academy/scripts/audit.mjs:365 — `조사관` 원래 한 줄. 457-463 진단 프롬프트 배열 맨 앞에 `프로필("audit")`. 권한 점검(--sandbox-test) 프롬프트에는 안 붙임
- academy/scripts/repair.mjs:240 — 수리칸 system 원래 한 줄. 316(검토)·493(수리) 프롬프트 앞에 `프로필("repair")`
- HEAD 대비 확인: `git diff HEAD -- illustrate sales audit repair | grep -E "^[-+].*(system|tools|allow|deny|envDrop|capRequired|maxTurns|permission)"` → 바뀐 줄은 주석 3줄과 sales 의 `클로드코드(` 줄(첫 인자만 바뀜, 옵션 글자 그대로)뿐. system·도구·권한 줄 변경 없음
- 지금 system 문자열(모두 한 줄, `\n` 없음):
```
illustrate.mjs:450  system: "너는 한국어 교육 블로그의 도해(SVG)를 그리는 디자이너다. 요청한 JSON 객체 하나만 답한다.",
sales.mjs:226       system: "너는 한국어로 짧고 정직한 영업 초안을 쓰는 도우미다. 규칙과 출력 형식은 사용자 메시지에 있다." });
repair.mjs:240      system: "너는 사이티드 수리공이다. 가장 작은 수정으로 원인을 고친다. 규칙과 출력 형식은 사용자 메시지 앞머리에 있다.",
repair.mjs:245      system: "너는 사이티드 코드 검토자다. 고치지 않는다. 체크리스트로 판정한다. 규칙과 출력 형식은 사용자 메시지 앞머리에 있다.",
audit.mjs:365       const 조사관 = "너는 사이티드 운영 조사관이다. 고치지 않는다. 원인을 좁힌다. 규칙과 출력 형식은 사용자 메시지 앞머리에 있다.";
```

### Must 2 — 근거 글의 주소
- academy/scripts/slop-rules.mjs:272-273 — `검사()` 1-4 가 근거 글에서 `https?://\S+` 를 지운 뒤 맞춘다(모델 근거 목록 속 주소도 같이)
- academy/scripts/write-news.mjs:259-268 — `검색근거글` 에 출처 **제목만** 넘김
```
본문: 학생 34명, 90분 수업입니다.
근거 = 주소뿐 (…AUZIYQ34xk90Q)          → 걸림 2 — 34명, 90
근거 = 모델 근거 목록 속 주소            → 걸림 2 — 34명, 90
근거 = 제목에 34명·90분이 실제로 있음     → 통과
```
1차 시험 13건도 그대로(걸림 6 · 통과 7 · 근거 없으면 안 봄).

### Should
- 게이트 근거 저장 — write-draft.mjs:440-452,533 · write-news.mjs:268,284,322 가 `review_notes.게이트근거` 에 게이트가 본 글 그대로. slop-check.mjs:51,68-70 은 그걸 먼저 읽고, 없을 때만 옛 방식으로 다시 만든다
- pm-report.mjs:139-140 「N번 시도했고 아직 안 끝났습니다」, 166 「5번 이상 시도하고도 안 끝났습니다」, 머리 주석 (a) 도 「5번 이상」
- pm-report.mjs:103-104 — 「원장 확인 필요로 올림」 활동은 셈에서 뺌(성공도 실패도 아님. 그 일은 확인 필요 목록에 뜬다)
- agents/research/MEMORY.md — 그날의 수치·날짜 삭제, 규칙만. 같은 이유로 deliver/MEMORY.md 의 「2026-09-10 에 45쪽 중 7쪽」도 뺌
- agents/content/AGENTS.md — 「write-draft 가 쓰기 전에 재료·측정·기존 글로 근거표를 만든다. 모델을 부르지 않는다」. 넘기기: 게이트 두 번 탈락은 78(건너뜀)이라 확인 필요로 **안** 올라간다고 바로잡고, 오류 실패만 5번 이상에서 올라간다고 씀(weekly-draft 가 1 로 끝나면 attempt 를 올림 — company.mjs weekly-draft)
- agents/research/AGENTS.md — 근거표는 write-draft 가 만든다, 게이트는 숫자·날짜만 막는다, 추정 칸은 아직 채우는 곳 없음, 측정(날짜·엔진)→측정(날짜)
- 나머지 직원 AGENTS·pm/SOUL 의 「5번 넘게 실패」→「5번 이상 시도하고도 안 끝나면」. repair 는 「회사 루프는 다시 띄우지 않고 다음 06:50 예약」, audit 는 「감사 작업(audit.yml)」으로 대상 명시
- BUILD-LOG Known Gaps: KG-S19-2 고쳐 적음(주소 빠짐), KG-S19-6 게이트 느슨함 추가

### 다시 돌린 것
```
node --check: profile · pm-report · slop-rules · slop-check · write-draft · write-news · illustrate · sales · audit · repair · company — 전부 ok
web tsc --noEmit -p . — 오류 없음
프로필 길이: pm 2083 · research 2073 · content 2268 · illustrate 1742 · deliver 1967 · sales 1720 · audit 1884 · repair 1791
pm-report --dry — 1차와 같은 「정상 · 어제 9시부터 일 28건을 했고 실패는 없습니다」
```

---

## 1차

원장(9/24): 「youtu.be/CmHhhT_Xt8M 참고해서 적용 끝날 때까지 묻지 말고 알아서 해」. 브리프 D1~D5 대로. 커밋·배포는 안 함.

## Files Changed
- academy/agents/USER.md + {pm,research,content,illustrate,deliver,sales,audit,repair}/{SOUL,AGENTS,MEMORY}.md (새 파일 25개) — 직원 정체성·일하는 법·씨앗 기억. 내용은 CLAUDE.md·코드 주석·메모리 폴더에서만 옮김
- academy/scripts/profile.mjs:1-49 (새) — `프로필(id)` USER+SOUL+AGENTS+MEMORY, 6,000자 넘으면 MEMORY 를 줄 단위로 덜어냄
- academy/scripts/pm-report.mjs:1-253 (새) — 아침 보고 짓기(`보고짓기`)·저장(`PM보고`)·CLI(`--dry`·`--force`). 표 `geo.pm_reports` 도 여기서 만듦
- academy/scripts/slop-rules.mjs:102-181 — 숫자 뽑기·날짜 키·근거 글 모양(`근거표글`·`검색근거글`)·근거 대조
- academy/scripts/slop-rules.mjs:191-198, 270-284 — `검사()` 에 `근거` 인자와 치명 「근거 없는 숫자」(근거가 비면 안 봄)
- academy/scripts/slop-check.mjs:21, 50-69 — --strict 가 review_notes 의 근거표/근거·출처로 숫자 게이트까지 다시 봄
- academy/scripts/write-draft.mjs:37-39 — import
- academy/scripts/write-draft.mjs:134 — 측정에 measured_on 추가(근거표 날짜)
- academy/scripts/write-draft.mjs:241-258 — 근거표 만들기(모델 호출 없음)
- academy/scripts/write-draft.mjs:268-273, 322-326 — 프롬프트 앞에 content 프로필, 「근거표에 없는 숫자·날짜·고유명사는 쓰지 않는다」
- academy/scripts/write-draft.mjs:366 — --dry 가 근거표도 찍음
- academy/scripts/write-draft.mjs:440-450, 527-529 — 게이트에 근거표 전체 글, 통과한 표(확인필요 채움)를 review_notes.근거표 에
- academy/scripts/write-news.mjs:27-29, 91-96, 258-264 — content 프로필, 모델 근거 목록 + 검색 출처 제목·주소를 근거로 게이트
- academy/scripts/illustrate.mjs:27,449 · sales.mjs:33,225 · audit.mjs:24,365 · repair.mjs:28,240 — Claude Code system 칸 앞에 각 프로필
- academy/scripts/company.mjs:35-36, 84-86 — import, 물어보기 프롬프트 앞에 pm 프로필
- academy/scripts/company.mjs:195-201 — 일감 upsert: 닫힘/쿨다운 지난 완료에서 다시 열 때 payload.escalated 를 지움
- academy/scripts/company.mjs:735-757 — 5번째 실패에 escalated=true + 활동 「원장 확인 필요로 올림」 한 번. 재시도는 그대로
- academy/scripts/company.mjs:776-781 — main 끝에서 PM보고(q) (--plan 이면 안 부름, 실패해도 루프는 실패 아님)
- web/lib/pm-report.ts:1-44 (새) — 가장 최근 보고 1장 읽기. 표 없음 = 「아직 없음」, 그 밖 오류 = ok:false
- web/app/admin/ops/PmReport.tsx:1-79 (새) — 「오늘 아침 보고 · 9/24」(어제 것이면 「9/23 보고」), 상태 배지·결론·확인 필요(있을 때만)·직원별 한 줄 접힘
- web/app/admin/ops/page.tsx:8,14,135-147,151,174 — 카드를 할 일 위에
- web/lib/drafts.ts:20-22 · web/app/admin/drafts/page.tsx:147-160 — 근거표 접힘 칸(있을 때만)

## 확인 출력

### node --check / tsc
```
ok profile · ok pm-report · ok slop-rules · ok slop-check · ok write-draft · ok write-news
ok illustrate · ok sales · ok audit · ok repair · ok company
web: node ./node_modules/typescript/bin/tsc --noEmit -p .  →  (오류 없음) TSC-OK
```

### node scripts/pm-report.mjs --dry (운영 DB, 2026-09-24 09:58 KST)
```
2026-09-24 정상 (저장 안 함)

[정상] 2026-09-24 아침 보고
어제 9시부터 일 28건을 했고 실패는 없습니다.

직원
  총괄　　 매시 점검 19번 · 일 9건 · 실패 0건 | 열린 일이 없습니다
  근거　　 일 3건 · 실패 0건 | 열린 일 1건
  집필　　 일 5건 · 실패 0건 | 열린 일 4건
  삽화　　 일 1건 · 실패 0건 | 열린 일이 없습니다
  유통　　 일 7건 · 실패 0건 | 열린 일 4건 · 그중 1건은 원장님 손을 기다립니다
  영업　　 어제 9시부터 한 일이 없습니다 | 열린 일 2건 · 그중 2건은 원장님 손을 기다립니다
  감사　　 일 2건 · 실패 0건 | 열린 일이 없습니다
  수리공　 일 1건 · 실패 0건 | 스위치가 꺼져 있습니다 (1일째) · 열린 일이 없습니다

원장 할 일 3건 · 산출물 새 초안 0편 · 발행 0편 · 색인 알림 7건
다음
  · 「오늘 하실 일」 3건
  · 다음 주간 초안: 9/28(월) 06:07

body = {"status":"정상","conclusion":"어제 9시부터 일 28건을 했고 실패는 없습니다.","직원":[{"id":"pm","이름":"총괄","한일":"매시 점검 19번 · 일 9건 · 실패 0건","성공":9,"실패":0,"지금":"열린 일이 없습니다"},{"id":"research","이름":"근거","한일":"일 3건 · 실패 0건","성공":3,"실패":0,"지금":"열린 일 1건"},{"id":"content","이름":"집필","한일":"일 5건 · 실패 0건","성공":5,"실패":0,"지금":"열린 일 4건"},{"id":"illustrate","이름":"삽화","한일":"일 1건 · 실패 0건","성공":1,"실패":0,"지금":"열린 일이 없습니다"},{"id":"deliver","이름":"유통","한일":"일 7건 · 실패 0건","성공":7,"실패":0,"지금":"열린 일 4건 · 그중 1건은 원장님 손을 기다립니다"},{"id":"sales","이름":"영업","한일":"어제 9시부터 한 일이 없습니다","성공":0,"실패":0,"지금":"열린 일 2건 · 그중 2건은 원장님 손을 기다립니다"},{"id":"audit","이름":"감사","한일":"일 2건 · 실패 0건","성공":2,"실패":0,"지금":"열린 일이 없습니다"},{"id":"repair","이름":"수리공","한일":"일 1건 · 실패 0건","성공":1,"실패":0,"지금":"스위치가 꺼져 있습니다 (1일째) · 열린 일이 없습니다"}],"확인필요":[],"원장할일":3,"산출물":["새 초안 0편","발행 0편","색인 알림 7건"],"다음":["「오늘 하실 일」 3건","다음 주간 초안: 9/28(월) 06:07"],"기간":{"시작":"2026-09-23T00:00:00.000Z","끝":"2026-09-24T00:58:19.093Z"}}
```
막힘 갈래 확인 — 같은 DB 를 읽기만 하고 「지금 + 8일」로 `보고짓기()` (저장 안 함):
```
막힘 | 멈춘 일이 9건 있습니다. 확인 필요부터 봐 주세요.
  · 사이트 점검이 195시간째 안 돌았습니다 (마지막 9/24 06:27)
  · 감사가 193시간째 안 돌았습니다 (마지막 9/24 08:55)
  ... (정해진 작업 9개 전부)
  · 수리공이 9일째 꺼져 있습니다. 켜는 건 원장님 몫입니다
```

### 숫자 게이트 (근거표 = 재료 2026-09-20 상담 · 기존 글 「초등 34시간·중등 68시간」 · 측정 20문항 · 「교육부 2026년 9월 22일 발표, 정보 수업 1,500개 학교」, 재료 「한 반에 6명이면 괜찮을까요?」)
```
── 걸려야 하는 것
  지어낸 인원           걸림 1 — 8명
  지어낸 비율           걸림 1 — 40%
  근거에 없는 날짜        걸림 1 — 10월 3일
  근거에 없는 시수        걸림 1 — 51
  지어낸 누적 수         걸림 2 — 43, 659회
  한 자리+단위가 근거에 없음  걸림 1 — 3곳
── 통과해야 하는 것
  근거표의 시수          통과
  근거표의 날짜          통과
  재료의 인원           통과
  연도·운영 숫자         통과      (2025년 · 주 1편 · 주 1회)
  목록·소제목 번호·영문 교구  통과  (## 1. · 1. 스크래치 · EV3 · Python3)
  쉼표 숫자·그림 경로      통과      (1500개 ↔ 근거 1,500개 · ![](/blog/x/timeline-2026-09.png) · 링크 주소)
  한 자리 단위 없음       통과
── 근거를 안 주면 안 본다
  근거 없이 8명     안 봄
```
`node scripts/slop-check.mjs --strict ai-textbook-16-subjects-2028` → 치명 없음(옛 글이라 근거표 없음 → 숫자 검사 건너뜀).

### 프로필("content")
```
2155
# 원장

모든 직원이 같은 사람에게 보고한다. 1인 기업 사이티드의 대표이고, 로봇&코딩학원 원장이다.

- 부를 때는 「원장님」.
- 결론을 먼저 쓴다. 이유는 그다음 한두 줄.
- 확인 안 된 것은 「확인 필요」라고 쓴다. 짐작으로 채우지 않는다.
- 원장이 직접 손댈 수 있는 일만 원장 몫으로 올린다. 재시도·코드 수정은 직원이 한다.

## 어기면 안 되는 것

- 지어내지 않는다. 숫자는 DB·저장소·측정에서 나온 것만. 근거가 없으면 「모른다」고 쓴다.
- 고객사는 가린다. 회사명·지점명·업종·규모까지. 조합되면 특정된
```
직원별 길이: pm 2076 · research 2137 · content 2155 · illustrate 1742 · deliver 1970 · sales 1714 · audit 1848 · repair 1755 (상한 6000).
write-news --dry 프롬프트 첫 줄이 「# 원장」 — 프로필이 앞에 붙는 것 확인.

## Open Questions
- 「실패」로 세는 기준(company.mjs:738): 실행기가 「실패」를 줬거나, `attempt:true` 인데 완료·닫힘·사람 대기가 아닌 것. workflow-failed 의 「관찰 + 다시 띄움」과 도해 「다 버림」이 여기에 든다. brand-defense·crawl-push 는 3회에 사람 대기로 가서 5회까지 안 온다. 기준이 너무 넓은지 봐 주세요
- 확인필요 (a) 에서 「사람 대기」 일감은 뺐다 — 할 일 목록과 두 번 뜨지 않게. 브리프 문구(「attempts ≥ 5 인 열린 일감」)보다 좁다
- 한 자리 숫자는 단위까지 근거에 있어야 하고, 두 자리 이상은 숫자만 맞으면 통과한다. 「34명」이 근거의 「34시간」으로 통과하는 느슨함을 받아들였다. 멀쩡한 글을 막는 쪽이 더 비싸다고 봄
- 날짜 「1/3」 같은 분수도 날짜로 읽는다(드묾)
- 재료 모드 근거표는 운영 DB 에 안 쓴 재료가 0건이라 실제 생성까지 못 돌렸다(KG-S19-5). 근거표만들기 줄은 코드로 봐 주세요(write-draft.mjs:247-258)

## Out of Scope (logged in BUILD-LOG)
- KG-S19-1 슬랙·텔레그램 보고 창구 (D1)
- KG-S19-2 write-news 근거가 모델이 적은 목록 + 출처 제목·주소뿐이다(검색 본문 없음)
- KG-S19-3 수리공이 profile.mjs 를 고칠 수 있다(금지 목록 밖). agents/*.md 는 못 고친다
- KG-S19-4 정해진 작업 표가 세 벌(company 예약 · agents.ts ROLES · pm-report)
- KG-S19-5 재료 모드 근거표 경로를 끝까지 못 돌려 봄
