# Review Request — Step 25 (여러 고객 측정 · D1~D4 + D17 토큰 기록)
Date: 2026-09-30
Ready for Review: YES
Status: DONE — 가짜 행·가짜 DB 로 확인. 실측정·DB 쓰기·푸시·배포 안 함

## Files Changed
- academy/measure-targets.mjs (새 파일, 1-106) — 대상 목록. `측정설정준비`(컬럼 2개 add if not exists + 덩어리 정규식 원문으로 빈 answer_pattern 채움) · `측정설정`(DB 원문 먼저, 없으면 clients.mjs) · `대상고르기`(순수 함수: 유료 → 학원 → 측정 켠 고객) · `측정대상`(DB 읽기, --client 면 하나) · `예산부족알림/닫기`
- academy/clients.mjs:105-109 — 안 쓰게 된 `measureConf` 삭제, DB 가 먼저라는 설명으로 대체
- academy/scripts/ai-measure.mjs:15-33, 226-507 — 대상 목록을 돈다. 고객마다 기존 엔진 루프 그대로(들여쓰기만 한 칸). Claude 몫 나눔(고객 둘 이상일 때만), 탐침은 학원 승인 질문 바로 뒤·유료 고객 있는 날 끔, 설정 없는 고객은 그 고객만 멈추고 끝에 종료코드 1
- tools/ai-web-measure.mjs:10-20, 32, 60-70, 188-314 — 같은 대상 목록. 상한 `WEB_MEASURE_DAILY_MAX`(기본 60). 고객 둘 이상이면 엔진 단위로 남은 상한 확인, 모자라면 사람 일감. `멈추고알림`의 `coalesce(…,1)` 제거
- web/lib/answer-pattern.ts (새 파일, 1-16) — 쉼표 말 → escape 한 정규식 원문
- web/lib/pilot-actions.ts:7, 28-30, 35-37 — createPilot 이 `answer_terms` 를 받아(필수) answer_pattern 저장, 컬럼 add if not exists
- web/app/admin/pilots/page.tsx:46-49 — 등록 폼에 「답에서 찾을 이름」 칸 (관리 화면만, 공개 문구 아님)
- web/db/schema.sql:88-90 — 두 컬럼 alter
- .github/workflows/optimize.yml:54-56, 83-84 — 측정·루프 단계에 `vars.CLAUDE_MEASURE_RESERVE`·`vars.CLAUDE_DAILY_MAX` 전달(비면 기본 22·40)
- academy/scripts/claude-code.mjs:16-17, 57-66, 92-100, 106-128, 176, 188, 212 — D17 토큰 칸 5개 add if not exists, result 줄에서 읽어 기록
- web/lib/agents.ts:43-49, 435-447 — 오늘 토큰 합(기록된 호출만) 읽기
- web/app/admin/ops/AgentStrip.tsx:85-91, 158-161 — 「오늘 Claude 사용 n번 · 토큰 입력 12만 · 출력 1.5만 (토큰이 기록된 k번 기준)」

## D1~D4 · D17 한 일
- **D1** geo.clients 에 `answer_pattern text`, `measure_active boolean default false`. 칸을 더하는 곳은 측정 실행기 둘(`측정설정준비`)·createPilot·schema.sql, 모두 if not exists. 학원·아이로그는 answer_pattern 이 비었을 때만 지금 정규식 원문으로 채운다. 채운 값이 지금 정규식과 source·flags 가 같고, 표본 7개(「똑똑한 로봇&코딩학원」 포함) 판정도 같다. 등록 화면은 정규식 원문을 받지 않는다. 쉼표로 나눈 말을 escape 하고, 빈칸은 `\s*`, `&` 는 `(?:&|&amp;)` 로 바꾼다. 두 글자 이상, 말 10개·한 말 40자까지
- **D2** 실행기 둘 다 `--client` 가 없으면 `측정대상()` 을 돈다. 대상은 진행 중 파일럿(시작일~종료일+7일), measure_active 고객, 학원(늘 포함). 순서는 유료 파일럿(가격>0, 시작일 순) → 학원 → 탐침 → 측정 켠 고객·0원 파일럿. `--client` 를 주면 그 고객 하나만 잰다(지금처럼 나누지 않음). pc-runner·optimize.yml 은 인자 없이 부르므로 호출부는 안 고쳤다
- **D3** Claude 는 `CLAUDE_MEASURE_RESERVE`(기본 22)를 순서대로 나눈다. 앞 고객이 몫을 써서 남은 문항을 다 못 재면, 그 고객은 절반만 재지 않고 통째로 건너뛴다. 화면 측정은 하루 상한(`WEB_MEASURE_DAILY_MAX`, 기본 60)을 엔진 단위로 같은 방식으로 나눈다. 못 잰 고객은 사람 대기 일감(sticky)으로 올린다: 「오늘 측정 예산이 모자라 ○○ 를 못 쟀습니다 — 상한을 올릴지 정해 주세요」. 올리는 방법(저장소 변수 / .env.local 한 줄)도 일감 본문에 적었다. 그 실행기로 다 잰 날 근거(evidence)를 남기고 닫는다. 유료 고객이 있는 날은 탐침을 끈다
- **D4** ai-web-measure `멈추고알림` 이 그 고객 id 에 붙는다. geo.clients 에 없는 슬러그면 기록만 하고 학원에 붙이지 않는다(KG-24-2 뒷절 해소)
- **D17** 필드 이름은 추측하지 않고 설치된 CLI(2.1.284) 바이너리 안의 result 스키마에서 확인했다: `modelUsage[모델].inputTokens·outputTokens·cacheReadInputTokens·cacheCreationInputTokens`, 없으면 `usage.input_tokens…`. modelUsage 를 먼저 읽는다(하위 모델까지 합산). 숫자가 아닌 칸은 null 이다. 모델 이름은 modelUsage 열쇠에서, 없으면 init 줄에서 가져온다. ALTER 가 실패해도 호출 수는 계속 센다. INSERT 는 새 칸으로 실패하면 예전 모양으로 한 번 더 넣는다. 상한이 이 수로 돌기 때문이다. 현황판은 토큰이 기록된 행만 더한다. 기록이 0건이면 줄을 안 쓰고, 일부만 기록됐으면 「기록된 k번 기준」을 붙인다. 입력 합에는 캐시 읽기·쓰기를 넣었다

## 확인 출력
하네스 위치: scratchpad `harness/run.mjs`·`unit.mjs`·`tokens.mjs`. 옛 파일은 HEAD 사본, 새 파일은 작업 트리 사본이다. `pg`·`playwright`·`claude-code.mjs`·`writer-common.mjs` 를 로더로 가짜로 바꿔 DB·네트워크에 닿지 않는다.

**학원만 있을 때 — 옛(HEAD)·새 실행기가 묻는 질문 순서·적재 행·종료코드 비교**
```
[claude]                       옛·새 같음   c1×20(q1…q20) → probe×2   종료 0
[claude · 오늘 이미 측정 19번]   옛·새 같음   c1×20 · 「탐침: 몫 22회를 승인 질문이 39회로 다 써서 건너뜀」  종료 0
[web]                          옛·새 같음   c1×60 (chatgpt·perplexity·gemini × 20)   종료 0
[--client ilog]                옛·새 같음   c2×20 → probe×2
학원만 있을 때 옛·새 같음: 예
```
새 쪽에만 있는 차이: 다 잰 날 `measure-budget-robotncoding-claude/-web` 닫기 update 가 한 번씩 더 나간다. 열린 일감이 없으면 아무것도 안 바뀐다.

**여러 고객 (가짜 유료 고객 id 3, 390,000원, 진행 중)**
```
B  기본 몫        claude: c3×20 · 학원 「몫 22회 가운데 20회를 앞 순서가 써서 남은 20문항을 못 잼」 → insert 일감 client=1 measure-budget-robotncoding-claude
                  web:    c3×60 · 학원 3엔진 「하루 상한 60질의 가운데 0질의만 남아 20문항을 안 엶」 → insert 일감 client=1 measure-budget-robotncoding-web
B' 몫 올림(42/60·web 120)  claude: c3×20 → c1×20 · 「탐침: 유료 파일럿 고객이 있는 날이라 끔」   web: c3×60 → c1×60
C  + 측정 켠 아이로그       claude: c3×20 → c1×20 → c2×20
```
**순수 함수 18개 통과**(unit.mjs): 종료+7일 경계, 시작 전 제외, 0원 파일럿은 학원 뒤, 학원 정규식 동치, DB 에 `https://www.` 가 있어도 학원 도메인 그대로, 깨진 원문 → 외부 고객 null·학원은 덩어리, `(a+)+$` 가 글자로 escape 됨(50,000자 입력 200ms 미만), 한 글자·빈 말 제거, 10개 상한.
**토큰읽기 4개 통과**(tokens.mjs): 두 모델 합산 · usage 만 · 둘 다 없음 → 전부 null · 숫자 아닌 칸만 null.
**tsc**: `web` 에서 `node ./node_modules/typescript/bin/tsc --noEmit -p .` 종료 0. `.mjs` 는 전부 `node --check` 통과.
**tok 표기**: 830 · 1.5만 · 12만 · 123.5만 · 2.5억.

## 판단한 곳 (Arch 확인 필요한 것은 ★)
1. ★ **나눔은 고객이 둘 이상일 때만.** 학원 혼자면 지금처럼 claude-code.mjs 상한(측정은 하루 전체 40)과 화면 측정의 문항별 상한만 본다. 「학원만 있을 때 같다」를 구조로 지키려는 것이다. 새 몫 검사를 늘 켜면, 실패 호출이 쌓인 날 다시 돌렸을 때 학원이 22회에서 멈춘다. 지금은 40회까지 간다
2. ★ **dedupe 키를 `measure-budget-<slug>-claude` / `-web` 로 나눴다.** 설계서는 `measure-budget-<client>` 하나다. 한 키로 두면 화면 측정이 다 잰 날 Claude 쪽 부족 일감까지 닫혀 부족이 가려진다
3. ★ **절반은 재지 않는다.** Claude 는 고객 단위, 화면은 엔진 단위다. 남은 몫이 그 고객(엔진)의 남은 문항 수보다 적으면 통째로 건너뛰고 일감을 올린다. 기존 주석에 「질문마다 잰 날이 다르면 적중률을 비교할 수 없다」는 원칙이 있어서 그렇게 했다
4. **탐침 자리**: 학원 승인 질문 바로 뒤에 둔다(기존 위치와 같다). measure_active 고객과 0원 진행 중 파일럿은 탐침 뒤로 보냈다. 기본 몫에서는 어느 순서든 결과가 같다(22 = 20 + 2)
5. **도메인은 clients.mjs 덩어리가 먼저**이고, 덩어리가 없는 외부 고객만 geo.clients.domain 을 정리해서 쓴다. 학원 DB 의 domain 값을 확인하려던 읽기 전용 조회가 권한 분류기에 거절됐다. 그래서 값을 모르는 채로도 학원 인용 판정이 안 바뀌게 했다
6. **answer_pattern 채움은 학원·아이로그 둘 다**(덩어리에 answerRe 가 있는 곳). 설계서는 학원만 적었다. 대체값과 같은 값이라 동작은 안 바뀐다
7. **「유료」 = 창 안 · price > 0 · 학원 아님.** status(취소·환불)는 보지 않는다 → KG-25-2
8. createPilot 은 `measure_active` 를 켜지 않는다. 파일럿 창(종료+7일)이 측정을 덮고, 창이 끝나면 저절로 빠진다
9. ai-measure 에서 한 고객이 설정·질문 없음이면, 전에는 throw 로 전부 멈췄다. 이제는 다른 고객을 다 재고 끝에 종료코드 1 을 낸다(빨간불은 그대로다)
10. `openrouter-credits` 일감은 회사 전체 일이라 학원 id 에 그대로 둔다
11. D17 현황판 「입력」에는 캐시 읽기·쓰기를 더했다. 캐시를 빼면 입력이 수백 단위로 나와 사용량을 잘못 읽게 된다

## Open Questions
- 판단 1·2·3 (★)
- 실행기는 DB 쓰기(ALTER·UPDATE 채움)를 첫 실행 때 스스로 한다. 준비가 실패해도 경고만 찍고 계속 간다. 다만 칸이 끝내 없으면 대상 select 가 실패해 측정 전체가 멈춘다. 배포 전에 schema.sql 두 줄을 먼저 적용할지 Arch 가 정해 주면 좋다. createPilot 의 ALTER 는 트랜잭션 안에 있어서, 실패하면 등록 자체가 안 된다

## Out of Scope (BUILD-LOG Known Gaps)
- KG-25-1 createPilot 의 `current_date`·`current_date+30` 이 DB UTC 날짜다. 00~09시(KST)에 등록하면 시작일이 하루 앞당겨지고, 측정 창도 하루 당겨진다
- KG-25-2 파일럿 status(취소·환불)를 대상 목록이 안 본다 → Step 26 생애주기
- KG-25-3 company·write 등 다른 워크플로는 `CLAUDE_MEASURE_RESERVE` 를 안 넘긴다. repair·sales 는 `CLAUDE_DAILY_MAX` 만 넘긴다. 원장이 두 변수를 올리면 이 둘은 「새 상한 − 22」를 자기 몫으로 쓴다
- KG-25-4 API 엔진(openrouter·anthropic-web)은 몫을 나누지 않고 고객마다 다 잰다. 비용은 고객 수에 비례한다. 지금 MEASURE_ENGINES 가 Claude 만이면 영향 없다
- KG-25-5 몫을 올리면 optimize.yml 50분 제한이 모자랄 수 있다. 35분 가드는 탐침에만 걸려 있다(60문항 × 문항당 최대 3분)
- KG-25-6 ai-measure 쪽 「설정 없음·질문 없음」은 일감을 안 올린다(종료 1·요약만). 화면 측정 쪽이 같은 일감을 올린다
