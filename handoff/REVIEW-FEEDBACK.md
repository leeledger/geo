# Review Feedback — Step 37
Date: 2026-10-05
Ready for Builder: YES (2차 — 아래)

## Must Fix
- academy/scripts/sales.mjs:80 + academy/clients.mjs:446-447 (confidence: 8) — 영업 자료 가림 말이 status active·test 고객만 본다.
  `loadClients(pool ? q : null, { includeTest: true, strict: Boolean(pool) })` → `where c.status = any($1::text[])` 에 `["active","test"]`.
  geo.clients status 는 `active · paused · ended`(web/scripts/setup-clients.mjs:42). 쉬는 고객·끝난 고객도 비밀유지 대상인데 DB 에만 있는 그들의 이름·도메인이 sales 공개본 검사에서 빠진다.
  illustrate.mjs:414-417 은 `select name, domain from geo.clients where id <> $1`(status 무관)로 이미 메운다 — sales 만 구멍. 브리프 Flow 「masks: loadClients 전부」 미충족.
  고칠 것: sales 가릴말에 illustrate 와 같은 `select name, domain from geo.clients`(status 무관, 실패하면 throw — fail-closed)를 더하거나, loadClients 에 「모든 status」 선택지를 만들어 sales·illustrate 둘 다 그걸 쓴다. test-clients 에 paused/ended 행이 고객사말에 들어가는 시험 한 줄.

## Should Fix
- academy/scripts/test-clients.mjs:193 (confidence: 8) — 가드 정규식이 `import { … } from` 과 `{ … } = await import(` 만 잡는다. `import * as C from "../clients.mjs"; C.CLIENTS` 와 `(await import("../clients.mjs")).CLIENTS` 는 통과한다(지금 저장소엔 0건 — grep 확인). 고칠 것: clients.mjs 를 import 하는 파일에서 `\bCLIENTS\b`(CODE_CLIENTS 제외)·`selectClients` 글자가 하나라도 있으면 걸리게 단순화하고, 가짜 글 시험에 두 꼴을 더한다.
- academy/masks.mjs:98-100 + academy/clients.mjs:281,324 (confidence: 7) — DB 고객 brandRe 는 lit 로 이스케이프된 원문이라 고객사말이 source 에서 특수 글자를 지우면 말이 바뀐다. brandWords 「C++코딩」 → source `C\+\+코딩` → 가림 말 「C코딩」(본문 「C++코딩」을 못 잡음). 이름·도메인은 그대로 들어가니 구멍은 brandWords 의 특수 글자 말만. 고칠 것: 고객설정이 `brandWords`(원문 말 배열)를 같이 돌려주고, 고객사말은 있으면 그것을 그대로 넣는다.
- academy/measure-targets.mjs:95-99 (confidence: 7) — 측정대상 고객행이 status 를 안 거른다. 'test' 는 이번 Step 이 들인 새 값인데 ai-measure·ai-web-measure 의 대상 고르기는 loadClients 가 아니라 이 쿼리다. E2E 는 measure_active false·취소된 파일럿으로 피했지만 구조로 막힌 게 아니다(돈 쓰는 길). 고칠 것: --client 로 콕 집지 않으면 `coalesce(c.status,'') <> 'test'`. 안 되면 KG 로.
- 회귀 범위 (confidence: 6, verify) — Actions 가 부르는 rescan(serp.yml:49)·growth-import(serp.yml:63)·company(company.yml)·ai-measure(optimize.yml:65)는 전후 dry 비교에 없다. 바뀐 줄은 기계적(고객고르기/loadClients·bySlug 목록 인자)이고 코드 3곳 덩어리는 펼쳐 그대로라 위험은 낮다. 배포 뒤 Acceptance 의 로그 확인 때 serp.yml 의 rescan·growth-import 도 3곳을 전과 같이 돌았는지 같이 본다.

## Escalate to Architect
- 없음. KG-37-1(DB 고객은 Claude 직전에 멈춤)은 세션 결정으로 받아들인 것으로 본다. 코드 고객 경로는 `부르기전멈춤 = 안부름 || c.출처 !== "코드"` 라 Actions 의 `--client docttak`(--no-claude 없음)은 예전 길 그대로다.

## Cleared
lit 이스케이프(.*+?^${}()|[]\ 전부, 말 정규식 i 만·g 없음, pages all lookahead), 고객설정 형 오류 칸별 기본값, loadClients 실패 시 코드 3곳 폴백·strict, 잠깐DB 연결(Pool·sslmode 삭제·rejectUnauthorized = DATABASE_SSL_INSECURE !== "true" — 기존 40여 곳과 같음), company·daily-agent·고객고르기 기본 목록의 'test' 제외, daily-agent brandHit null 분기, indexnow DB 고객 키 형식 검사와 키 파일 본문 확인, marketing-draft 코드 고객 경로 불변, local-agent·submit-gsc·bing-site 코드 3곳 값 동일을 확인했다.

---
# Review Feedback — Step 37 2차 (31a62f4 · 989e296)
Date: 2026-10-05
Ready for Builder: YES

## Must Fix
- 없음. 닫힘: masks.mjs `DB고객말` — `select name, domain from geo.clients where $1::int is null or id <> $1`(status 조건 없음, 실패하면 던짐). sales.mjs `if (pool) for (const x of await DB고객말(q)) 말.add(x);` · illustrate 도 같은 함수. sales --leak-test 가 운영 DB 로 이 쿼리를 지났다.

## Should Fix
- 닫힘 ② 고객설정이 brandWords 원문을 돌려주고, 고객사말은 brandWords 가 있으면 brandRe 원문을 안 꺼낸다. 코드 3곳(brandWords 없음)은 예전 길 그대로.
- 닫힘 ④ measure-targets 의 전체 대상 두 쿼리에 `where coalesce(c.status,'') <> 'test'`. slug 길(:136)은 콕 집기라 시험 고객도 잰다 — 의도대로.
- 닫힘 ⑥ 가드가 import 꼴과 상관없이 「clients.mjs 를 가져오는 파일 + CLIENTS/selectClients 글자」로 잡는다. 가짜 글 네 꼴 시험. 주석에 쓴 글자도 걸리는 대가는 받아들일 만하다.
- 닫힘 ① growth-import --dry 전후 차이 0. rescan·company·ai-measure 는 시험(앞 3곳 칸이 같은 객체)으로 덮었고, 실제 확인은 배포 뒤 로그로 한다(Acceptance).

## Cleared
2차 diff 전부를 읽었고 새로 깨진 곳은 없다. test-clients 를 다시 돌려 99 통과 · 0 실패. Step 37 is clear.
