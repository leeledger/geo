# Review Feedback — Step 27
Date: 2026-09-30
Ready for Builder: YES

## Must Fix
없음.

## Should Fix
- web/lib/pilot-intake.ts:27-29 (confidence: 9) — 일반 문장의 조사가 받침을 안 본다. 치과·직장인으로 돌리면 `직장인가 이용할 강남구 치과 고르는 기준 알려줘`가 나온다. 상호가 모음으로 끝나면 `스마일치과은 어떤 곳이야?`도 나온다. 업종 칸에 「식당」을 넣으면 `식당를 이용해도…`가 된다. 원인은 `${audience}가` `${brand}은/을` `${category}를/가` 줄이다. 고치는 법: 작은 조사 도우미를 쓴다(끝 글자 (code-0xAC00)%28 로 받침을 보고 이/가·은/는·을/를). 일반 20문항에만 적용한다. 학원 20문항은 글자 그대로 두기로 했으니 건드리지 않는다. 승인 전에 관리 화면에서 고칠 수 있어서(updateQuestion) 단계를 막지는 않는다. 다만 매번 사람이 고치게 두면 안 된다.
- web/lib/pilot-intake.ts:28 (confidence: 7) — 사람이 검색창에 안 치는 문장이 둘 있다. `직장인에게 치과가 필요한지 판단하는 법은?`, `치과를 이용해도 만족 못 하는 경우는?`. 카페·식당이면 말이 안 된다. 학원 문장을 틀째 옮긴 흔적이다. 권고: 조사를 덜어 검색어처럼 쓴다. 예시 방향은 「치과 잘하는 곳 고르는 법」「치과 바꾸는 사람들 이유」다. 「오래 운영한 곳」「설명을 잘해주는 곳」「가격이 싼 곳과 비싼 곳 차이」「처음 방문할 때 확인할 것」은 자연스럽다. 금지 목록(빈 강조·흐린 끝맺음·과장 형용사)에 걸리는 것은 없다. 고객 정보도 등록 칸 값만 쓴다. 누출은 없다.
- academy/scripts/company.mjs:184-189 (confidence: 6, verify this) — `ensure()`에는 catch 가 없다. `main()` 첫 줄에서 await 한다(849행). 그래서 client_hours DDL 이 실패하면 그 시간 회사 루프 전체가 멈춘다(계획·근무·아침 보고). 가장 걸리기 쉬운 줄은 `alter table geo.client_hours enable row level security`다. 이 줄은 표 소유자여야 돈다. 이 표는 지금까지 web 이 첫 입력 때 만들었다. web 과 Actions 의 DATABASE_URL 역할이 다르면 매시 「must be owner」로 죽는다. 소유자는 확인하지 못했다(운영 DB 읽기가 권한에서 거부됨). 매시 ACCESS EXCLUSIVE 잠금도 잡는다. 고치는 법: 두 줄을 `.catch((e) => console.log("  ⚠ client_hours 준비 실패", e.message))`로 감싼다. 관리 화면용 표 때문에 루프가 멈추면 안 된다. 1분짜리다. 바로 고치기를 권한다.
- web/lib/pilot-actions.ts:43-44 (confidence: 5) — 별칭은 select 한 뒤 insert 한다. 두 건을 동시에 등록하면 같은 「고객 X」가 붙는다. alias 에 유일 제약도 없다. 관리자가 1인이라 실제로 일어날 일은 드물다. 권고: select 앞에 `select pg_advisory_xact_lock(27015)` 한 줄을 넣는다(이미 트랜잭션 안이다). 넣지 않으면 KG 로 남긴다.

## Escalate to Architect
- 「고객 A/B…」 순번은 고객 수와 등록 순서를 드러낸다. 「고객 C」가 보이면 적어도 세 곳이 있다는 뜻이다. 누구인지는 드러나지 않는다. 글자에는 지역·업종·규모 정보가 없다. 공개 케이스 리포트에 시작일과 함께 실리면 「첫 외부 고객」까지는 읽힌다. 괜찮은지는 영업 판단이다.
- 학원 판별이 업종 칸 글자(/학원|교습소|공부방/)에 달려 있다. 「로봇교실」「수학」은 일반 문장과 교육청 점검 없음으로 간다. 칸 안내를 바꿨으니 됐다고 볼지, 칸을 따로 둘지 정해야 한다.

## Cleared
확인 범위: 커밋 36b30c1 의 D13~D16 과 D12 건너뜀(KG-27-1). 결과:
- 학원 20문항: HEAD^ 의 makeQuestions 와 deepEqual 이다(수학학원·코딩학원·영어교습소·공부방으로 확인).
- 출처·칸 분기: 치과이면 교육청이 빠지고 「서비스·대상」이 된다.
- 별칭: 빈 글자를 채운다. null 이 섞여도 된다.
- submit-gsc: `--client`·CLIENT_ID 가 없으면 CLIENTS[0] 곧 robotncoding 이다. local-agent 는 CLIENT_ID 를 넘기지 않아 기본값이 그대로다.
- health: 두 고객 모두 llmsTxt: true 라 동작이 전과 같다.
- schema.sql 두 곳이 HOURS_DDL 과 같다.
- web tsc 0, node --check 3개 통과.
