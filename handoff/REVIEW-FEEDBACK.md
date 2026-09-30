# Review Feedback — Step 29 (고객사 사이트 사람 방문 추이 D29~D33)
Date: 2026-09-30
Ready for Builder: YES

검토 범위: AGO&GEO e8873b0 (13 파일) · 자동피드백생성기 d30c9c0 (2 파일).
직접 돌림: `node --experimental-strip-types academy/scripts/test-visit.mjs` → 72 통과 · 0 실패.
tsc --noEmit academy 0 · web 0 · 아이로그 0. visit.ts 세 사본 diff → 같음.

## Must Fix
없음.

## Should Fix
- academy/app/api/visit/route.ts:44-46 (confidence: 7) — `if (key && req.headers.get("x-crawl-key") !== key)` — CRAWL_KEY 가 비면 누구나 넣는다(KG-29-2). 지금은 막는 항목이 아니다: academy/.env.local 에 CRAWL_KEY 가 비지 않은 값으로 있다(값은 안 봄). 그래도 새 라우트이고 proxy 는 늘 키를 보내니 닫힌 쪽이 공짜다 — `if (!key || header !== key) return 401`. 키가 빠지면 조용히 0 이 되지 스팸이 영업 숫자로 들어가지는 않는다. 배포 전 Arch 가 `vercel env ls`(academy) 로 운영에 CRAWL_KEY 가 있는지 한 번 본다.
- web/lib/visits.ts:42-46 · academy/app/api/visit/route.ts:62-66 (confidence: 6) — DDL 세 줄과 insert 가 한 try 안이다. DDL 중 하나가 실패하면(`alter table … enable row level security` 는 소유자만 된다) 표가 있어도 insert 까지 안 가고, 인스턴스마다 다시 실패한다. 지금 DB 사용자가 neondb_owner 라 실제로는 안 터진다 — 확인. 또 `alter table … enable rls` 는 이미 켜져 있어도 콜드 스타트마다 표에 AccessExclusive 잠금을 잠깐 건다. 권장: DDL 을 따로 try 로 감싸 실패해도 insert 는 시도하거나, `select to_regclass('geo.site_visits')` 가 있으면 DDL 을 건너뛴다.
- academy/lib/visit.ts:51 (세 사본 같은 줄) (confidence: 7) — `SNS_UTM.some((w) => host.indexOf(w) >= 0)` 는 부분 일치다. utm_source=broadband·fbx·weblog 류가 sns 로 간다. `w === host || host.startsWith(w + ".")` 정도로 좁힌다. 세 사본 함께, 시험 한 줄 추가.
- 기록 대상 (confidence: 5, verify) — proxy 는 응답 코드를 모른다. 브라우저 UA·Accept text/html 로 오는 스캐너(`/wp-admin/`, `/.git/`는 FILE 로 빠지지만 확장자 없는 경로는 들어온다)와 404 경로가 방문자·「많이 본 페이지」에 들어간다. 지금 고칠 일은 아니고 BUILD-LOG Known Gaps 에 「404·탐침 경로 포함」으로 적고, 카드 숫자를 영업 자료로 쓸 때 많이 본 페이지 표에 이상한 경로가 있는지 본다.

## Escalate to Architect
- 아이로그 LANDING 에 `/` 가 들어 있다. 로그인한 학원 사람이 홈을 거쳐 대시보드로 가면 그 한 번이 랜딩 방문으로 잡힌다. 공개 랜딩만 세는 것은 이미 승인됐으니 이 정도 섞임을 받아들일지만 정해 달라 — 코드로는 로그인 여부를 proxy 에서 판단해야 해 범위가 커진다.

## Cleared
개인정보(IP·원 UA 는 해시 입력으로만 쓰고 저장·전송·로그 없음, 소금 없으면 readVisit null, 쿠키 없음), proxy(waitUntil·실패 삼킴·봇 분기 불변·아이로그 matcher 불변·리다이렉트 없음), 받는 곳(clientForKey 인증·2KB·cleanVisit 모양 검사·1분 중복 억제·client_id 분리), 현황판 카드(기록 시작일 표시, 시작 전 안 그림, 0 은 0, 비교는 두 주가 다 찼을 때만, AI 곳별)를 보고 통과시켰다.
