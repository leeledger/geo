# Review Feedback — Step 55
Date: 2026-10-17
Ready for Builder: YES

## Must Fix
(none)

## Should Fix
- web/lib/auto-setup-core.mjs:555-569 (confidence: 9/10) — The 질문 step reports a result it did not produce. If a pilot already has questions, the inserts hit `on conflict (pilot_id, position) do nothing` and add 0 rows. The step still returns 「질문 20개(검색어 17 · 이름 3)를 넣었습니다」 and sets measure_active = true. Two ways to get there: (a) the owner runs createPilot before auto reaches 질문 (makeQuestions inserts 20, then the 파일럿 step says 「이미 있습니다」 됨); (b) the owner upgrades the 리허설 pilot (D231) while 질문 is still 대기, so makeQuestions fills the empty pilot. Fix: count the pilot's existing questions first. If any exist, return 됨 with 「질문이 이미 n개 있습니다 — 넣지 않았습니다」 and leave measure_active alone. Otherwise insert with `returning` and report the real count.
- web/lib/auto-setup-core.mjs:651-657 with :595 (confidence: 8/10) — The hourly loop can starve. company.mjs passes no checkPlatform, so a platform client whose 사이트 step is 대기 comes back as 「건너뜀」 every hour. 다음단계 still selects it, and 자동이어하기 sorts by oldest auto.at. Three such clients would fill max=3 every hour, and no other client would move forward in the loop. Fix: in 자동이어하기, when deps.checkPlatform is missing, skip rows whose next step is 사이트 and whose 단계갈래 is 플랫폼 before the slice.
- web/app/admin/clients/[slug]/page.tsx:124 + AutoSetupPanel.tsx:39-44 (confidence: 7/10) — A step can stay 도는중 with 시도 3 after its lease expires. The page computes 다음 = null, so the panel never calls autoStep, which is the only thing that turns it into 원장. 남이도는 stays true and the page refreshes every 5 seconds for as long as it is open. Real clients get fixed by the hourly loop. Test clients (status test) are excluded from that loop, so they stay stuck permanently. Fix: give the panel a 「멈춤」 flag that triggers one autoStep, or only poll while the lease is younger than 90 seconds.

## Escalate to Architect
- Open Questions in REVIEW-REQUEST (test-only duplicate scope, IndexNow 「안 씀」, stop all seeds on 403/429, the hourly loop skipping platform 사이트, 자동 리허설 = no-pilot order, 사이트 none/setup/null). I reviewed each one and none breaks safety or the no-invention rule. They are Arch's to confirm.
- Client A screenshot: 사이트 상태 says 「빠진 것이 없습니다 — 제안: 구축 없음」 (needs_build none), but the checklist still sends the client a 보낼글 asking for the homepage admin ID. The only gap is the IndexNow key file, which D226's four checks don't count. Should a key-file-only gap ask the client for anything at all? That is a product call. (The screenshot also shows 「필요한 준비 제안: none」. The current code maps it through 준비말 → 「구축 없음」, so the screenshot is older than the code.)

## Cleared
I reviewed auto-setup-core, auto-setup-actions, client-core (입력검사 · 등록 · 고치기 · 체크리스트 · 일감계획), pilot-actions, the company/who-wins/setup-multiclient diffs and migrate-platform-domain, plus the screenshots.
- Security: all four new actions call guard(). Homepage fetches resolve DNS, block private ranges, recheck every redirect hop (same host, https only), time out at 8 s per address and 20 s total, and cap bodies at 2 MB. The autocomplete host is fixed, the UA is honest, and nothing retries around 403/429. SQL is parameterized. The lease is one atomic UPDATE … WHERE … RETURNING.
- No invented data: facts come only from the fixed tables, otherwise 모름. Questions are raw autocomplete; fewer than 17 becomes an owner task, with no filler. 원장 sources are not overwritten (사실쓰기 guard; compete SQL has `not like '원장%'`).
- Other checks: registerClient has no remaining references. The D231 upgrade only applies to rows that are 리허설 · paid_on null · 외부, and 0 rows → pilot-exists.
- id 18, checked read-only: active · no pilot · 0 questions · its answer_pattern and terms don't contain the platform host. The migration is idempotent (`where domain = $3`) and prints id and alias only. It is safe to --apply.
- who-wins now skips clients with no domain.
- Tests: test-auto-setup-core 128/0 · test-client-core 229/0 · test-client-copy 11/0 · test-clients 99/0 · test-client-status 14/0 · test-onboard-core 18/0 · tsc 0.
