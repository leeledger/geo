# Review Request — Step 49 (사이티드 랜딩 쉬운 말 · 메타 문구)
Date: 2026-10-15
Ready for Review: YES
Status: DONE — 104 PASS · 0 FAIL, nullops 2 PASS, tsc 0, `NEXT_PUBLIC_ALLOW_INDEX=true` build 성공. 커밋·푸시·배포 안 함

## Files Changed
- web/app/page.tsx:50 — FAQ 3 「구축 250만원」→「홈페이지 제작 250만원」 (JSON-LD 같은 배열)
- web/app/page.tsx:176-177 — TIMELINE: 홈페이지 제작 · 주소 연결 / AI 봇 · 구조화 데이터(AI가 읽는 이름표) · llms.txt 삭제 / 블로그 글 32편 옮김
- web/app/page.tsx:183,213 (삭제) — ENGINE_NAME · heroWeb · heroWebSrc
- web/app/page.tsx:231-235 — 히어로는 HeroDemo + ScanForm 만. herohint·herolinks·.lp-proof 블록 삭제
- web/app/page.tsx:317 — #geo note 「바로 아래가 … 기록입니다.」 삭제
- web/app/page.tsx:366 — #data 「AI 봇(자동 방문 프로그램) 접근이 0점인 곳도」
- web/app/page.tsx:379 — #case 부제 「숫자는 서버와 검색 기록에서 매일 다시 가져옵니다.」
- web/app/page.tsx:386 — 카드 1 머리 「이름 없이 찾는 검색어 · 착수 때 → 지금」
- web/app/page.tsx:417 — 카드 3 끝 `{posts !== null && …「지금 AI 가 읽을 수 있는 글은 N편입니다.」}` (카드는 기존 crawled 가드 안)
- web/app/page.tsx:423,427,448 — 「착수 때 처음 물은 결과」·「웹 검색을 켠 AI」·「실제 방문 기록」
- web/app/page.tsx:502-503 — #services 부제(브리프 문장 그대로, 파일럿·기술 세팅 풀이 첫 자리)
- web/app/page.tsx:508-510 — 서비스 카드 `.tag` 렌더 삭제 (services.ts tag 필드는 유지)
- web/app/page.tsx:530 — #how 부제 첫 문장
- web/app/page.tsx:546 — #why 부제 「몇 번 물어 몇 번 나왔는지, 답이 참고한 비교 글, 고친 것과 고친 이유가 들어갑니다. 회사 이름은 가렸습니다.」
- web/app/page.tsx:559 — #price 「홈페이지 제작·기술 세팅은」 (603 환불 문장 그대로)
- web/app/page.tsx:571-590 — #diff 라벨 「보고서가 다른 점」, 둘째 문장 삭제, 「점수 화면만」, 「AI 이름」, 「사이트 점수가 가장 높았던 80점 회사의 실제 진단 결론입니다.」
- web/app/page.tsx:640 — #guides 부제 두 문장 교체
- web/app/page.tsx:663-665 — #start 부제(자가 확인 「○○구 치과 추천해줘」 옮겨 옴, 「아래에」 없음)
- web/app/page.tsx:708 — 푸터 「시장 숫자(…)는 사이티드가 직접 잰 값입니다.」
- web/app/HeroDemo.tsx:84-85 — lede 2문장 (166 「예시 화면입니다.」 그대로)
- web/app/ScanForm.tsx:92,96 — 진행 중·기본 안내 문구 (10~30초·llms.txt·7가지 삭제)
- web/app/FlowSteps.tsx:16,22-23,29,34 — 「구축·세팅」「기준선(단독)」→ 홈페이지 제작·기술 세팅·첫 숫자, 칩 3개, 「전부」, 「보고서 39만원」
- web/app/PriceCalc.tsx:17,26-27,40,72-73,116 — 홈페이지 제작 · 보고서 · 전부 · 블로그 글 옮기기 · AI 봇 / 91행 `PILOT.llms` 렌더 삭제
- web/app/RecordTabs.tsx:61 — 「진단 보고서」
- web/app/llms.txt/route.ts:23,50-51 — 「홈페이지 제작」 (「사이트 구축」 0)
- web/lib/services.ts:51 — PILOT.order 브리프 문장 그대로
- web/lib/services.ts:55,56,58 — PILOT.gives 「틀린 정보 고칠 목록」「AI 가 인용할 글 1편」「문의 경로 기록표」 (아래 Deviation 1)
- web/lib/services.ts:68 — PILOT.after 「보고서 39만원」 → FAQ 3·llms.txt 자동
- web/lib/services.ts:119 — 카드 01 조건 k 「기준선 보고(시작 때 숫자)」
- web/lib/services.ts:142 — 「AI 에게도 글이 보이게 합니다」
- web/lib/services.ts:227,269 — name 「홈페이지 제작」(slug build 유지) · 「글 옮기기 +80만원」
- research/paid-pilot-order-form.md:21,27,28,30,62 — PILOT.order·gives·after 와 글자 맞춤 (services.ts:43 규칙)
- handoff/research/step49/verify.mjs — 새 검증 (48 복사 + 대응 + 새 10)

## 48 → 49 대응표 (94개 유지)
| 48 | 49 |
|---|---|
| 60 nullops 「히어로 칸 일차 하나만」 | nullops: #case 카드 3·「편입니다」 숨김 · .lp-proof 0 |
| 62 nullops 0 → 0 / null | 그대로 |
| 81 「기준선 보고 전」 정규식 | 그대로 (D148) |
| 255 herohint 에 「○○구 치과 추천해줘」 | `#start .lp-sub` 에 「○○구 치과 추천해줘」 |
| 256 히어로 링크 두 개 | 히어로 안 `a[href^="#"]` 0개 |
| 257 증거 줄 머리 | `.lp-proof` 0 · #case 라벨에 「첫 적용 · 사이티드 대표가 운영하는」 |
| 258 증거 칸 | #case 라벨 「{caseDay}일차」 · 카드 3 「AI 가 읽을 수 있는 글은 N편입니다」 |
| 278 D133 칸 라벨 = DB 엔진·측정일 | 화면에 「· 빙\|네이버 웹문서\|네이버 통합 · M/D 측정」 꼴 0 |
| 279 D133 칸 분모 = 엔진 하나 | #case 카드 1 정의문 「검색엔진 한 곳 이상에서」 유지 (D134) |
| 333 히어로 칸 숫자(애니메이션 뒤) = DB | #case 카드 1 숫자(애니메이션 뒤) = 서버 HTML 숫자 (0 → 3 / 6) |
| 289 keep-all 선택자 | `.lp-herohint`·`.lp-proof-h` 빼고 `.lp-hero .formnote` 추가 · `#film .lp-sub`(D140 이후 없음) → `#film h2` |
| 나머지 83개 | 글자 그대로 |
DB 직접 조회 블록(260-281)은 대응 단정이 DB 를 안 써서 뺐다. 새 단정 [49-1]~[49-10] 은 assertions.txt 에 번호로 찍힌다.

## 용어표·메타 문구표 반영
- 풀이 5개 첫 자리(단정 6, 화면 글자 위치): 봇@#data · 구조화 데이터@#case TIMELINE · 30일 파일럿·기술 세팅@#services 부제 · 기준선 보고@#services 카드 01 — 각 1번
- 메타 문구표 8줄 전부 처리, 예외 4줄 그대로. 단정 7(14개 구절) 0
- 업계 말(단정 5): 화면 + FAQ JSON-LD 답에 리포트·크롤러·이관·정합성·근거 콘텐츠·대시보드·구축·7가지를 자동으로·점수 제외·10~30초 0
- 히어로 글자 377(1440) / 343(390) ≤ 400 · submit 1개 · 아래끝 638px
- 숫자 보존(단정 8): 로컬 44종 ⊆ 운영 cited.kr 44종. 살아 있는 값(.lp-proof · #case 카드 머리 b · 방문 기록 마지막 줄 · N일차 · M/D 측정 · 검색 N개 · 글은 N편)은 양쪽에서 비우고 비교

## Deviations
1. PILOT.gives 3·4·6번을 바꿨다 — 브리프 용어표에 없지만 #price PriceCalc 에 그대로 보여 단정 5 가 「근거 콘텐츠」로 걸린다. services.ts:43 「신청서와 한 글자도 어긋나면 안 된다 — 고치면 둘 다」에 따라 research/paid-pilot-order-form.md 도 order·gives·after 를 같이 고쳤다(브리프의 order·after 변경도 신청서에 반영돼야 해서). 환불 조항은 손대지 않음
2. 단정 4 「.lp-svc 라틴 문자 0」 → 「AI」를 뺀 라틴 낱말 0. 모든 카드 질문에 「AI」가 있다
3. keep-all `#film .lp-sub` → `#film h2` (위 대응표)

## Screenshots (handoff/research/step49/)
1440/390 × hero · case · services · how · why · price · start (14장) + nullops-1440-hero.png

## Open Questions
- #guides 카드의 guides.ts:85 short 「계약 전에 확인할 수 있는 것만 적었습니다.」 — 메타성 문장. guides.ts 는 Out of Scope 라 KG-49-7 로만 적었다
- 1440 히어로 아래 여백: .lp-proof 를 빼서 폼 아래가 비어 보인다(1440-hero.png). 의도대로인지 눈으로 봐 주길
- 신청서(order-form) 문구를 바꾼 것이 계약 문서 쪽에서 괜찮은지 — 입금 전 서면으로 드리는 문서다

## Out of Scope (logged in BUILD-LOG)
- KG-49-7 guides.ts:85 메타성 short
- KG-49-8 pilot-plan.ts:19·25 관리 화면 제목 「상담 유입 기록표」「근거 콘텐츠」 · order-form 8행 「구축·세팅이 있는 곳은」
- KG-49-1~6 (Arch 브리프 그대로)
