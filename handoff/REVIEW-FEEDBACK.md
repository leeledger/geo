# Review Feedback — Step 49
Date: 2026-10-15
Ready for Builder: YES

PASS. 막는 문제(Must Fix) 없음.

## Must Fix
(없음)

## Should Fix
1. handoff/research/step49/verify.mjs:458-461 (confidence: 6/10) — 48:333 의 대체 단정이 「애니메이션 뒤 숫자 = 서버 HTML 숫자」만 본다. 48 은 히어로 칸 숫자를 DB 에서 직접 센 값과 대조했다(독립 근거). 지금은 #case 카드 1 의 `0 → N / M` 이 DB 와 맞는지 아무도 안 본다. 히어로 칸이 없어졌으니 브리프 범위에서는 허용되는 대체이지만 근거 대조가 한 단계 약해졌다 — 다음 검증 단계에서 ops.serp.rivalWon/rivalTotal 을 DB 로 다시 세어 카드 1 과 대조하는 단정을 하나 넣을 것. BUILD-LOG Known Gaps 에 적어 두면 된다.
2. verify.mjs:353 (confidence: 7/10) — 단정 7 의 낱말 목록에 「따로 적었습니다」는 있지만 「적었습니다」 단독이 없어 guides.ts:85 「계약 전에 확인할 수 있는 것만 적었습니다.」(랜딩 #guides 카드에 보임, page.tsx:646 `{g.short}`)가 통과했다. 아래 Escalate 1 과 같은 문장. 고칠 때 단정도 같이 넓힐 것.
3. web/app/llms.txt/route.ts:50 (confidence: 8/10) — 「블로그 글 이관」이 남았다. 브리프 용어표 「이관」 줄이 route.ts 를 안 짚어서 범위 밖이 맞다. 랜딩 화면이 아니라 기계용 문서라 해도 낱말이 갈라진다 — KG 로만 적을 것.
4. #start (390-start.png) — 「무료 진단」 카드 머리 「주소만 넣으면 됩니다.」 바로 아래 formnote 「주소만 넣으면 AI 가 …」가 같은 말을 되풀이한다. ScanForm formnote 를 히어로·#start 가 같이 쓰기 때문. 동작에는 문제 없음, 다음 문구 단계 몫.

## Escalate to Architect
1. guides.ts:85 short 「계약 전에 확인할 수 있는 것만 적었습니다.」 — 랜딩 #guides 카드에 렌더되는 메타 문장(R2). 「Bob 이 목록 밖 메타 문장을 찾으면 고친다」(브리프 5절)와 「guides.ts 는 Out of Scope」(KG-49-4)가 부딪힌다. 이 값은 /geo/geo-agency 의 meta description·JSON-LD description 으로도 나가서 랜딩만의 일이 아니다. Bob 은 KG-49-7 로 적고 손대지 않았다 — 이번 단계에 한 문장 고칠지, KG 로 둘지 Arch 결정.
2. 1440 히어로 폼 아래 빈 자리(1440-hero.png, 폼 아래끝 638px, 화면 900px) — 의도된 결과(.lp-proof 삭제)이고 깨진 곳은 없다. 보기 문제라 Arch·원장 판단.

## 확인한 것
- D150(Deviation 1): 환불 조항 바이트 일치 확인 — services.ts PILOT.refund 3줄·refundNote·noGuarantee·llms 가 9e63bbd 와 같음(코드로 비교). 신청서 환불 절은 9e63bbd 대비 diff 0줄. 신청서 ↔ services.ts: order·gives 6줄(번호 포함)·llms·noGuarantee·refund 3줄·refundNote·after 전부 글자 그대로 포함 확인. 신청서 8·15행 「구축·세팅」「사이트 구축」은 비교 대상 밖(KG-49-8)
- 새 숫자 0: 화면 숫자 44종 ⊆ 운영 44종(단정 8). 새 문장의 숫자(80점·49편)는 기존 #data·히어로 칸 값. 출처 문장(#case 부제·푸터)·표본 경고 유지
- FAQ ↔ JSON-LD: 같은 FAQ 배열에서 둘 다 생성, 단정 [49-10]·기존 169-170 PASS. FAQ 3 은 문구만 바뀜
- #film: page.tsx diff 에 FILM·#film 구간 변경 0. 기존 #film 단정 전부 PASS
- 풀이 5개: 첫 화면 노출 자리 = 풀이 자리, 각 1번(단정 6). FILM_LINES 의 같은 낱말은 접힌 details 안이라 브리프 정의대로 제외. #services 카드 02 「구조화 데이터를 붙입니다」는 #case TIMELINE 뒤라 문제 없음(스크린샷 확인)
- 메타 문구: 남은 것은 예외 4종(예시 화면·표본 경고 2곳·#film·메일 약속) + 위 Escalate 1
- 글 규칙: 새 문장 전부 짧고 숫자 회피·빈 강조·흐린 끝맺음 없음. 「AI가 읽게 손봄」 등 띄어쓰기는 브리프 문구 그대로
- 48→49 대응표: 94개 유지, 지운 단정 없음. nullops 「0 → 0·null」 단정 그대로 남음, 「일차 하나만」은 카드 3·「편입니다」 숨김으로 대체(카드 3 머리 「다녀간 AI·검색 봇」은 page.tsx:411 에 실제 있어 헛단정 아님). keep-all 21곳. DB 대조 약화는 Should Fix 1
- 스크린샷 15장 중 hero 2·case·services·price·start(390) 직접 봄: 겹침·잘림·null 없음, 환불 3줄·refundNote 렌더 확인

## Cleared
Step 49 diff 전체(page.tsx·HeroDemo·ScanForm·FlowSteps·PriceCalc·RecordTabs·llms route·services.ts·신청서)와 verify.mjs·결과·스크린샷을 보았고, 브리프 D142~D149·D150 대로 지어졌으며 환불 조항은 바이트 그대로다.
