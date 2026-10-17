# Review Request — Step 55
Date: 2026-10-17
Ready for Review: YES
Status: DONE — Arch 결정 반영(D237 modoo = 홈페이지 없음 · KG-55-10 은 Step 56 · KG-55-11 그대로 · Bob 결정 받아들임)

## Files Changed
- D237 반영: web/lib/platform-hosts.mjs(+d.mts) — BUILDER_HOSTS 에서 modoo 뺌 · ENDED_HOSTS·endedOf · 호스트갈래 「없음」 / web/lib/auto-setup-core.mjs 입력나누기 — modoo → 갈래 없음·domain null·원문 남김 / web/lib/client-core.mjs 입력검사 — modoo 거부(「2025-06-26 에 끝난 서비스」) / 시험 test-auto-setup-core·test-client-core 에 modoo 단언 6개
- web/lib/platform-hosts.mjs (새, +.d.mts) — PLATFORMS·SMARTPLACE·platformOf·classifyTarget 를 platform-check.ts 에서 옮김 + BUILDER_HOSTS(modoo·wixsite·imweb)·builderOf·호스트갈래
- web/lib/platform-check.ts:8-31 — 옮긴 것을 import 해 그대로 다시 내보냄(바깥 모양 같음). 옮기기 전/후 platformOf 26호스트·classifyTarget 11입력 차이 0
- web/lib/auto-setup-words.mjs (새, +.d.mts) — 업종표·시도표·지역짧게·이름흔함(D224). client-core·auto-setup-core 가 서로 부르지 않게 따로 둔 표 파일(브리프에 없는 파일 하나)
- web/lib/auto-setup-core.mjs (새, +.d.mts) — 입력나누기·slug고르기·로마자·판별말·사실뽑기·씨앗·자동완성·거르기·패널만들기·두칸칸·다음단계·임대·자동한걸음·재시도·사실저장·자동이어하기
- web/lib/client-core.mjs:98-135 입력검사 — domain 빈칸 허용 · 플랫폼 호스트 거부 · 경쟁 0개 허용
- web/lib/client-core.mjs:150-170 오류말 facts·channel-taken·name-dup · 고객금지말·금지말찾기(D233)
- web/lib/client-core.mjs:180 새크롤키 · 172 고객칸준비 crawl_key 칸
- web/lib/client-core.mjs:196-257 채널정리 · 등록() — domain null(IndexNow 「안 씀」·wantGsc false) · crawl_key · channels · auto · channel-taken · name-dup(「그래도 등록」) · 시험 고객은 시험끼리만 중복
- web/lib/client-core.mjs:260-285 고치기 — domain null 견줌 고침 · config.auto 출처 「원장」(경쟁은 넣었을 때만, D229)
- web/lib/client-core.mjs:505-509 열기() 가 헤더를 돌려줌(빌더 판별용, derived 에는 안 남음) · 648-655 홈열기 export
- web/lib/client-core.mjs:700-735 자동단계·사이트줄칸·갈래·채널이름들·빌더이름·보낼글말
- web/lib/client-core.mjs:740-890 체크리스트 — 플랫폼·없음 → 8줄 해당없음 · send 보낼글/고칠것 · dns 우리 → 기다림 · gsc 할일 · measure 자동 질문 문구 · auto·name 줄
- web/lib/client-core.mjs:892-918 일감계획 — auto·name 제목 · send detail = 보낼글 · dns 우리 send 는 닫힘
- web/lib/client-core.mjs:965-972 재점검고르기 — domain null·플랫폼 뺌
- web/lib/client-core.d.mts — 위 새 export·칸 타입
- web/lib/onboard-core.mjs:9-11,54-55 import·dns물음·블로그물음 · 68-74 자동 리허설 = 파일럿 없음 순서 · 145-150 intake 문구(홈페이지 관리자 아이디 / 플랫폼·없음이면 뺌) · 200-214 blog 보낼글 · 232-244 send 는 보낼글만·해당없음 통과·dns 우리는 고칠것 근거 · 274-275 자동 질문 문구
- web/lib/auto-setup-actions.ts (새) — registerAuto·autoStep·retryAutoStep·saveAutoFacts, 같은 guard
- web/lib/client-actions.ts — registerClient 지움, 고치기 뒤 점검은 domain 있을 때만
- web/lib/pilot-actions.ts:43-66 — 리허설·입금 전·외부 파일럿은 update 로 진행(0행이면 pilot-exists) · 질문이 있으면 makeQuestions 안 넣고 없을 때만 on conflict do nothing
- web/app/admin/clients/NewClientForm.tsx (새) — 두 칸 + 접힌 「시험용」 + 겹칠 때만 「그래도 등록」
- web/app/admin/clients/[slug]/AutoSetupPanel.tsx (새) — 단계 5줄 · 한 단계씩 autoStep → refresh · 실패·원장 「다시 시도」 · 업종지역 원장 두 칸 폼 · 남이 도는 중이면 5초마다 다시 봄
- web/app/admin/clients/[slug]/page.tsx:52-70,104-112,121-165 — 판 맨 위 · 보낼글만 복사 칸 · 할일 글 · 고칠것 접힘(복사 없음) · 「다시 점검」은 홈페이지 있을 때만 · 고치기 → 「자세히」 · 파일럿 폼 기본값·리허설 안내
- web/app/admin/clients/page.tsx — 새 등록 = NewClientForm
- web/app/admin/clients/ClientForm.tsx — 고치기 전용(mode·registerClient·slug·test 칸 지움)
- web/app/admin/clients/[slug]/onboard/page.tsx — 자동 세팅 요약 한 줄(판은 복제 안 함)
- web/app/admin/clients/clients.css — .as-* 판 · .todo-t · .fix
- academy/scripts/company.mjs:42,1036-1038 — 세팅재점검 뒤 자동이어하기 한 줄
- academy/scripts/migrate-platform-domain.mjs (새) — 기본 dry, --apply 는 Arch. 출력 id·별칭만
- academy/scripts/setup-multiclient.mjs — randomBytes → 새크롤키
- academy/scripts/who-wins.mjs:51-52 — domain 빈 글자면 건너뜀(url.includes("") 가 전부 「우리」로 셌다)
- academy/scripts/test-auto-setup-core.mjs (새) · test-client-copy.mjs (새) · test-auto-setup-live.mjs (새)
- academy/scripts/test-client-core.mjs — mock 새 SQL · 바뀐 단언(도메인 빈 값·send 고칠것/보낼글·gsc 할일·재점검 fixture domain) + Step 55 블록 29개
- academy/scripts/test-onboard-core.mjs — 바뀐 단언 4개(5번: send 보낼글·dns 우리 근거·dns물음 문구, fixture send 모양). 개수 18 그대로
- academy/scripts/test-client-screen.mjs · test-onboard-screen.mjs — 지운 긴 폼 대신 두 칸 폼, 시험 주소 cited.kr(옛 geo-rose-nine.vercel.app 은 이제 cited.kr 로 308)
- handoff/research/step50/verify.mjs:109-110 — TS 로더가 .mjs import 를 file: 주소로(55a 옮기기 때문)

## 결과
- D237 뒤 다시: test-auto-setup-core 128/0 · test-client-core 229/0 · test-client-copy 11/0 · test-onboard-core 18/0 · test-clients 99/0 · tsc 0
- (D237 전) test-client-core 227/0 · test-auto-setup-core 124/0 · test-client-copy 11/0(768조합·고객 글 2140개 금지어 0) · test-clients 99/0 · test-client-status 14/0 · test-onboard-core 18/0 · test-seed-panel 통과 · test-login 56/0
- tsc 0 · next build 통과 · step50 verify ALL PASS 183
- test-client-screen --live 38/0 · test-onboard-screen --live 28/0 · test-auto-setup-live --live 32/0
- --live A·B·C: A(시험치과 송파점 + cited.kr) slug cited-2 · 판별 말 [이름, cited.kr] · crawl_key 36 hex · 사이트 상태 none(세팅점검과 같음) · 업종 치과(이름) · 지역 모름 → 원장 → 판 두 칸(치과·송파구) → 이어짐 · 파일럿 리허설·paid_on null·payment_ref null · keyword 후보 5개 → 검색어 원장 · 질문 0 · compete 5개 원문. B(빈칸) 없음·domain null·build·사이트 줄 해당없음. C(naver_diary) 플랫폼·채널 blog·derived.platform 200·site/send/gsc 해당없음. 같은 홈페이지 거부 · 같은 이름 name-dup. 지운 뒤 client_id·pilot_id 30칸·agent_tasks·agent_activity 0
- 네이버 자동완성 상태 원문(로컬 PC): 「송파 치과」 200·4 · 「송파구 치과」 200·1 · 「송파 치과 추천」 200·1 · 2차 「송파 치과의원」 200·1 · 「송파 치과병원」 200·1 · 「송파치과」 200·4
- 이행 dry: 대상 1곳(id 18 · 고객 A) — domain → null · IndexNow → 안 씀 · wantGsc → false · derived 7키 → 0 · 사이트 단계 원장 · 사이트 8줄 해당없음. **--apply 는 안 돌림**
- 스크린샷(저장소 밖): C:\Users\force\AppData\Local\Temp\claude\C--dev-AGO-GEO\4532bd60-6822-4139-9841-8e77d27995eb\scratchpad\step55-client-A-1440.png · step55-client-A-390.png · step55-onboard-A-1440.png · step55-onboard-A-390.png · onboard-test-1440/390.png · onboard-cited-1440/390.png

## domain null · 경쟁 0개를 쓰는 곳 (55c 표)
| 곳 | domain null | 경쟁 0개 | 이번에 |
|---|---|---|---|
| clients.mjs 고객설정 | 「domain 없음」 빠짐 · 색인 검색어 없음 · brandWords [] | 「queries.compete 없음」 빠짐 | 그대로 |
| measure-targets 측정설정 | answerRe·domain 둘 다 있어야 → null(측정 안 함) | 상관없음 | 그대로 — KG-55-10 |
| ai-measure 적재 cited | 위에서 빠져 안 탐 | — | 그대로 — KG-55-13 |
| check-index | `!c.domain` 건너뜀 | 브랜드만 돎 | 그대로 |
| who-wins | url.includes("") 가 전부 「우리」 | 건너뜀 | **domain 없으면 건너뜀** |
| indexnow.mjs | 건너뜀 | — | 그대로 |
| tools/submit-gsc | --client 면 「domain 없음」 오류로 멈춤 · 기본은 학원 | — | 그대로(config.gsc false 라 안 불림) |
| health.mjs | 걸러 냄 | — | 그대로 |
| daily-agent | 승인 질문 있는 고객만 · 홈 fetch 실패 → fetched false | — | 그대로 |
| masks 고객사말 | 빈 글자는 filter(Boolean) | — | 그대로 |

## Open Questions
- **시험 고객 중복 범위** — 브리프 55h 가 cited.kr 로 시험 A(slug cited-2)를 요구해서, 시험 고객 등록은 도메인·채널·이름 중복을 시험 고객끼리만 본다. 진짜 고객 등록은 전부와 견준다. 맞는지
- **IndexNow 「없음」→「안 씀」** — clients.mjs 고객설정이 「우리·고객 배포·안 씀」만 받아서 기존 말을 썼다
- **자동완성 403·429** — 그 씨앗만이 아니라 남은 씨앗도 안 두드린다(막힌 곳을 계속 치지 않게). D228 문구와 다르면 되돌림
- **매시 고리의 플랫폼 단계** — checkPlatform 은 TS(scan.ts·robots.ts 의존)라 Node 22 company.mjs 가 못 부른다. 매시 고리는 플랫폼 고객 사이트 단계를 「건너뜀」, 판이 연다
- **자동 리허설 = 파일럿 없음(onboard-core)** — 외부·리허설·입금 전 파일럿이면 계약 뒤 순서를 파일럿 없음 순서로 편다(안 그러면 「리허설이라 계약이 없습니다」로 파일럿 시작 줄이 사라진다). 브리프에 없던 갈래
- **사이트 단계 none/setup/null** — 네 칸이 다 확인돼 됨이면 none, 확인된 빠짐이 하나라도 있으면 setup, 못 연 칸만 있으면 정하지 않고 실패(재시도). none·setup 을 지어내지 않으려고
- ~~KG-55-9~~ 닫음 — D237
- KG-55-10 — Step 56 으로(Arch)
- KG-55-11 그대로(Arch) — D224 그대로면 id 18 판별 말 3개 중 1개만 흔함(name 줄은 사람으로 열린다 — Acceptance 는 충족). 나머지 둘은 단지 이름이 낀 말 · 나머지 한글이 딱 2자인 말
- **자동완성 결과가 적다** — 실측에서 2차 씨앗이 1개씩만 돌아와 「송파 치과」도 후보 5개. 지역·업종 고객 대부분이 17 미만 → 원장 몫이 될 것 같다(KG-55-6)
- Richard 에게: 임대 SQL(auto-setup-core 임대) — 「도는중」 지난 임대도 시도<3 일 때만 잡고, 시도 3 에서 또 끊기면 자동한걸음이 원장으로 돌린다

## Out of Scope (logged in BUILD-LOG)
- KG-55-9 ~ KG-55-13 (Step 55 빌드 Known Gaps)
- Arch 몫: 운영(sin1) 자동완성 1회 실측 · 다음 매시 로그 자동이어하기 줄 · migrate-platform-domain.mjs --apply
