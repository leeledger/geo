# Review Request — Step 58 착수 판정 (+ D273 고객에게 보낼 요약)
Date: 2026-10-17
Ready for Review: YES
Status: DONE_WITH_CONCERNS (B 계산을 브리프에서 한 군데 바꿈 — D274, 아래 Open Questions 1)

## Files Changed
- web/lib/feasibility-core.mjs:1-280 — 새 파일. 순수 함수 전부: 곳정보·브랜드문항·기준 상수(곱셈 비교), 업체이름들(56-78), 창고르기·최근창(81-93), 요인들 A~E(103-200), 종합(202-217), 지난기록·지난기록대상·판정저장할까(219-232), 고객요약(D273, 236-257), 레퍼런스줄(259-280)
- web/lib/feasibility-core.mjs:149-153 — B 의 k = 이름이 뽑힌 답 **또는 mentioned 답**(D274, 브리프와 다름)
- web/lib/feasibility-core.d.mts:1-38 — 타입
- web/lib/feasibility.ts:1-93 — 서버 읽기. 잰 날 목록 → 창 안 날의 행만(raw answer 앞 4000자, 약속 4곳, brand 뺌) · 지난 기록 count filter 한 번(자사 빼고) · 학원 레퍼런스 두 창. 실패마다 throw 대신 오류 말
- web/app/admin/clients/Feasibility.tsx:1-57 — 판. data-testid feasibility · data-verdict · data-stage, 요인 5줄, 이유, 못 잰 것, 지난 기록, 기준 안내, 고객에게 보낼 요약(textarea + 「보낼 글 복사」, 아직이면 안 그림), 레퍼런스 접힘
- web/app/admin/clients/[slug]/page.tsx:12-13,21,93-98,144 — getOnboard 한 번 → 할일순서·착수순서(intake 상태) → getFeasibility, TodoOrder 바로 아래. 코드 고객은 순서 null 이라 안 그림
- web/app/admin/clients/clients.css:104-128 — .fz-* (keep-all, 720 아래 2단)
- web/db/schema.sql:159-162 — geo.pilots verdict(check 성공·실패·판정 보류)·verdict_reason·verdict_on
- academy/scripts/pilot-report.mjs:7-8,25,234-241 — final 에서 판정저장할까(유료·리허설 아님·끝남)·!--dry 일 때만 alter 3줄 → update(덮어쓰기)
- academy/scripts/test-feasibility-core.mjs:1-180 — 새 시험 78개(브리프 시험 지도 전부 + 고객 요약)
- academy/scripts/test-client-copy.mjs:5,11,119-145 — 판 글 1,500여 개 원장금지말 0 · 고객 요약 고객금지말·원장금지말 0 · 「%」「성공률」「확률」「가능성」 0 · 불안 말·경쟁 이름 0

## 확인
- 시험: test-feasibility-core 78 · test-client-copy 19 · test-onboard-core 24 · test-client-core 265 · test-clients 110 · test-docttak 35 · test-ilog-loop 43 · test-auto-setup-core 156 — 전부 0 실패
- web tsc 0 · next build 통과 · pilot-report `--stage final --client robotncoding --dry` 그대로 돎(리허설이라 입금 전 안내에서 끝남, 안 씀)
- 이름 품질 관문: C:\Users\force\AppData\Local\Temp\claude\C--dev-AGO-GEO\4532bd60-6822-4139-9841-8e77d27995eb\scratchpad\names-sample-step58.txt (기준선 창은 고유 이름이 20개뿐이라 20개 전부 + 최근 창 14개 참고. 이름은 handoff 에 안 옮김)
- 스크린샷(scratchpad, 판만 / `-page` 붙은 것은 화면 전체):
  - id 18 → 「아직」: fz-id18-1440.png · fz-id18-390.png
  - 시험 고객(fz-test, 3일 잰 가짜 측정 60행 → 대강 3일 「시간이 걸림」, 고객 요약 보임): fz-test-1440.png · fz-test-390.png
  - 학원 레퍼런스 펼침: fz-test-ref-1440.png · fz-test-ref-390.png
  - 6장 모두 가로 넘침 없음(scrollWidth ≤ innerWidth)
- 시험 고객: 지우기() 로 지움 — ai_measurements 60행, geo·academy client_id 칸 남은 행 0, geo.clients 0행 확인. dev 서버 종료

## 학원 두 창 (이름 없이, Arch 탐침과 맞춰 볼 것)
첫 창 9/24~9/30 (시작 20일째부터) — **해볼 만함**
- A 좋음: ChatGPT 못 잼(잰 날 3일) · Perplexity 못 잼(2일) · Gemini 못 잼(3일) · Claude 119번 중 44번
- B 보통: 답 255개 중 업체 이름이 나온 답 99개
- C 보통: 다른 업체 이름 20곳 · 많이 나온 두 곳이 80번 중 44번
- D 좋음(구축 없음) · E 좋음(기본 정보 됨)
- 이유: A·D·E 좋음. 보통 2개라 규칙 3에 안 걸림

최근 창 10/11~10/17 — **시간이 걸림**
- A 좋음: ChatGPT 119번 중 39번 · Perplexity 못 잼(2일) · Gemini 119번 중 21번 · Claude 119번 중 56번
- B 보통: 답 381개 중 업체 이름이 나온 답 146개
- C 어려움: 다른 업체 이름 14곳 · 많이 나온 두 곳이 103번 중 70번
- D 좋음 · E 좋음
- 이유: C 어려움(두 곳이 답 자리를 거의 다 차지)

탐침과 맞춤: 첫 창 255개 중 학원 이름 69 — 같다. 최근 창은 381개 중 123(Arch 383 중 125). 차이 2행은 10/17 의 google-ai-overview-screen·naver-ai-tab-screen(약속 4곳 밖, 빈 답) — 판은 약속 4곳만 센다.

## Open Questions
1. **B 계산 바꿈(D274).** 브리프대로 낱말 뽑기만 쓰면 학원 최근 창 B 는 「381개 중 76개」 → **어려움** → 종합 **어려움**이었다. 그런데 같은 창에서 학원 이름이 나온 답이 123개고, 그중 70개에서 뽑힌 이름이 0개였다. 놓치는 꼴은 두 가지다. 「상호 업종」을 띄어 쓴 것(가장 많이 나온 경쟁 상호가 이 꼴로 64번 빠짐). 그리고 과목이 든 상호(학원 자기 이름이 이름흔함에 걸림). 그래서 k 에 mentioned 답을 더했다(고객 이름이 나온 답은 업체 이름이 나온 답이다). C 는 그대로 둬서 띄어 쓴 경쟁 상호를 못 센다(KG-58-5). Arch 가 셋 중 고른다: 이대로 둔다 / 브리프대로 되돌린다 / 이름뽑기켬=false.
2. 이름 품질 관문: 기준선 창 고유 20개 가운데 상호가 아닌 것으로 보이는 게 5개다(동·동네+업종 3, 언어+업종 1, 학년+업종 1). 25%라 30% 선 밑이지만 가깝다. 동 이름(지역동 표 밖)은 이름흔함이 못 거른다.
3. 원장금지말에 「파일럿」「착수」가 있다. 그래서 지난 기록·기준 안내 글은 「유료 고객」으로 바꿨다(D275). 판 제목 「착수 판정」은 브리프 글자 그대로 뒀다 — 바꿀지 Arch 가 정한다.
4. 운영 DB 에 verdict 칸이 없어 지금 판은 「지난 기록을 못 읽었습니다」를 보인다(스크린샷에 보임, KG-58-6). 브리프 실패 모드대로다. 다만 첫 유료 최종 보고 전까지 늘 이렇게 뜬다. schema.sql alter 3줄을 미리 돌릴지 Arch 가 정한다(나는 운영 DDL 을 안 돌렸다).
5. 기준선 창은 「첫 7 잰 날」을 곳 전체의 잰 날로 잡는다. 그래서 학원 첫 창에서는 ChatGPT·Gemini·Perplexity 가 4일 미만이라 못 잼이고, A 는 Claude 하나로 「좋음」이다. 브리프 D267 그대로다.
6. 고객 요약 첫 줄에는 판정을 움직인 요인이 아니어도 A 를 늘 넣는다(원장 예시 「AI 4곳에 … n번 이름이 나왔습니다」). 그다음 줄들이 판정을 움직인 요인이다.
7. D 는 할일순서의 추정 갈래(홈 없음 → build)를 쓰지 않는다. 그래서 값이 없으면 못 잼이다(D277).

## Out of Scope (logged in BUILD-LOG)
- KG-58-5 띄어 쓴 「상호 업종」 꼴 이름 뽑기
- KG-58-6 운영 verdict 칸 미리 만들기
- KG-58-1~4 (브리프)
