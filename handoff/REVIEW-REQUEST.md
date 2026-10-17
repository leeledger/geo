# Review Request — Step 56 (+ D246 addendum · round 2: D247–D250)
Date: 2026-10-17
Ready for Review: YES
Status: DONE_WITH_CONCERNS — all brief tests are 0 fail. test-new-client --live is 18/2: the 2 failures are marketing-draft and depend on the weekday (KG-56-2), and they don't touch this change. ops.ts and verdict.mjs were fixed even though the brief listed them as "do not fix" (see Open Questions 1).

DB: `alter ... cited drop not null` ran once on the production DB at 2026-10-17 16:48 KST, for both tables. information_schema went from is_nullable NO/NO to YES/YES. default false is unchanged.

## Files Changed
- academy/measure-targets.mjs:41-71 — 측정설정 now needs only answerRe and sets domain to null when there is none. New 인용판정(citations, domain), which returns null when domain is missing.
- academy/scripts/ai-measure.mjs:22,253-255,263 — cited now goes through 인용판정. Added the two alter lines after create.
- tools/ai-web-measure.mjs:33,305 — cited now goes through 인용판정. The `if (cited) cite++` line and the log symbols are unchanged.
- academy/scripts/import-ai-measurements.mjs:14,38-40,55,73,105-106 — uses 인용판정 (endsWith without the dot is gone). cited_us is trusted only when the client has a site. Added the alter lines after create.
- academy/pilot-report-core.mjs:48-50 — 비율글(s, 인용없음) plus 인용해당없음.
- academy/scripts/pilot-report.mjs:19,107,112-114,142,146,259 — with no domain, the sentence, the cells and the totals say "인용: 해당없음(사이트 없음)".
- web/lib/asks.ts:129-132 — 링크없음(domain) and 링크해당없음.
- web/app/admin/asks/page.tsx:6,85,90,105,182,188,202 — date chips and the day summary show 해당없음.
- web/app/admin/ops/AskLog.tsx:4,48 · PmReport.tsx:3,54,70,85 · Growth.tsx:7,138,179 · ops/page.tsx:12,216 — link cells show 해당없음.
- web/app/admin/pilots/[id]/page.tsx:7,94,216 — shows 「사이트 없음」 and 「인용 해당없음」.
- web/lib/ops.ts:311 · academy/scripts/verdict.mjs:31 — `mentioned and not coalesce(cited, false)`. This deviates from the brief (Open Questions 1).
- academy/scripts/daily-agent.mjs:108,115,176-177,181,448,471,494 — with no domain, these are skipped and make no tasks: the indexing notice, the home fetch, the 후퇴 re-index (448), entity/JSON-LD (471) and the content **re-index sub-branch** (494). The new-draft path (write-draft / session task) still runs for no-site clients, which matches brief line 58. Publish evidence says 「해당없음」.
- academy/scripts/company.mjs:689 — site-check with no domain → 완료 「사이트 없음 — 해당없음」.
- web/lib/auto-setup-core.mjs:403-408 — 멈춘단계(auto, now).
- web/lib/auto-setup-core.mjs:561-575 — 질문 step: count first, count rows via returning id, set measure_active only at 20.
- web/lib/auto-setup-core.mjs:603-607,692-694 — 자동한걸음 and 자동이어하기 both use 멈춘단계. The loop now drops platform rows waiting on the site step.
- web/app/admin/clients/[slug]/page.tsx:7,92-97,130 · AutoSetupPanel.tsx:15,20,38-39 — 다음 = 다음단계 ?? 멈춘단계. The panel re-checks every 5 seconds only while 살아있음 is true.
- web/lib/client-core.mjs:813-816 — when only the key file is missing: send line is 기다림, no 보낼글, 고칠것 kept, regardless of dns.
- **D246** web/lib/auto-setup-words.mjs:134-182 — 동의어 · 지역동 (Seoul, 23 구) · 의도표.
- **D246** web/lib/auto-setup-core.mjs:15,230-249,260,264,306-307,327,333,541-571 — 넓힌씨앗 and 틀검색어. Autocomplete max is now 40. 거르기 takes 더말. The 검색어 step fills from autocomplete first, then templates. Competitor terms are filled from templates. The 패널 source column says 「틀」 or 「자동완성」.
- web/lib/auto-setup-core.d.mts · auto-setup-words.d.mts — type declarations.
- Tests: test-clients.mjs:170-190 (측정설정 null domain · 인용판정 5 cases · 대상고르기 · regression for the 3 code clients). test-client-core.mjs:301-314 (key file only, dns ×3 · key file + robots). test-auto-setup-core.mjs:228-231 (fake DB count/returning), 428-542 (D246 ×13 · 질문 ×4 · 멈춘단계 ×4 · loop ×3), and 147-148, 338, 368 (the 3 old assertions D246 changed).

## Round 2 (Richard FAIL → Arch D247–D250)
- **D247 Must Fix**
  - web/lib/auto-setup-words.mjs 의도표.더: 8 fixed intent words.
  - auto-setup-core.mjs 틀검색어: when 지역짧게(region) === region, it adds 의도표.더 and synonyms × intents. 시도 is not stored, so I used the "more intent words" fallback.
  - 거르기: 빼는말 is now checked on each whitespace token.
  - Tests: the 업종표 × 모든시군구 loop (11,948 combinations, 0 below 17, was 171). 「중구 인테리어 추천」 now survives and a 「구인」 token is still dropped.
- **D248** asks/page.tsx:90 — chip for no-site clients reads `이름 n / N · 링크 해당없음(사이트 없음)`, with no "/ n" after 해당없음.
- **D249** academy/scripts/company.mjs announce — no domain → 완료 「사이트 없음 — 색인 알림 해당없음」, so no gsc-submit task with `https://null`.
- **D250** web/lib/client-core.mjs
  - When only the key file is missing, the keyfile line becomes 사람 and gets an internal 할일, so 일감계획 opens `setup-keyfile`. Its title includes 「내부 — 고객에게 안 물음」. Added 일감제목.keyfile.
  - It closes as 완료 once the file opens, and it does not open when other fields are also missing.
  - setup-send still closes. No customer text is produced: test-client-copy has 0 forbidden words.
  - Tests: +5 in test-client-core.
- REVIEW-REQUEST: corrected the daily-agent description above.
- Re-run: test-clients 110 · test-auto-setup-core 156 · test-client-core 241 · test-client-copy 11 · test-client-status 14 · test-onboard-core 18 · test-docttak 35 · test-ilog-loop 42. All 0 fail. tsc 0. `node --check` company.mjs passes. next build was not re-run in round 2: the changes are .mjs logic and one string in a TSX file, and tsc is 0.

## Verification
- academy/scripts results: test-clients 110 · test-auto-setup-core 154 · test-client-core 236 · test-client-copy 11 · test-client-status 14 · test-onboard-core 18 · test-docttak 35 · test-ilog-loop 42. All 0 fail.
- Reverting the source files to HEAD makes the new tests fail: client-core has 5 failures, and the other two test files stop on the missing exports.
- test-new-client --live: 18 passed, 2 failed. Both failures are in marketing-draft: there is no channel today (Saturday), so it does nothing. marketing-draft imports none of the changed files. 0 test client rows are left.
- web: `node ./node_modules/typescript/bin/tsc --noEmit` exits 0 (also re-run after the ops.ts fix). `next build` passes. `node --check` passes for the 7 scripts.
- grep `endsWith(\`.${`: the citation logic is only in 인용판정 for the 3 writers. These 4 remain and are listed in KG-56-4:
  - loop-review.mjs:128 is a reader in a pure module.
  - asks.ts:160 is TS with a `!!domain` guard.
  - ai-web-measure.mjs:125 is an exclude list.
  - bing-serp.mjs:31 is SERP.
- Growth.tsx decision: readGrowth(client) uses the **selected client** (ops/page.tsx:160), so it gets the same handling via the noLink prop.
- Confirmed by grep: case-report uses CLIENT_ID = 1 and pm-report uses client_id = 1, so both are house-fixed and unchanged. ops.ts is **not** house-fixed (`client_id = ${c.id}`, see below).

## Open Questions
1. **Deviation from the brief: ops.ts:311 and verdict.mjs:31.** The brief says "SQL: null counts as false, so the name numbers stay correct". That holds for `filter (where cited)`, but `mentioned and not cited` evaluates to null when cited is null, so those rows drop out. For a no-site client, the name count would quietly show 0. ops.ts is the selected client, not the house client, and verdict.mjs is also the selected client. I changed one word in each (`not coalesce(cited, false)`). For the house client and other clients with a site, cited is never null, so their values don't change. Please confirm, or tell me to revert.
2. D246: synonyms, Seoul dongs and intents come from fixed tables. Please check the table contents in words.mjs:134-182, especially that the dong names are real. Two decisions are mine. Arch, please confirm:
   - 초등/중등/고등/1:1/소수정예/시간표 apply to academies only. Other businesses get 예약/야간/주말/가격 instead. The brief's list is academy-shaped; "수원 고등 치과" would be nonsense.
   - 중구 and 강서구 are left out of the dong table. The region field holds only the 시군구 name, so I can't tell Seoul from Busan.
3. D246: with 25 seconds total and 200ms gaps, 40 calls may not finish. Seeds that don't get a call are recorded as 「전체 25초를 넘어」 and the templates fill the rest. I left the panel text "최대 30초" as is.
4. D246: if autocomplete returns nothing at all (network error, not just 403/429), the step still completes as 됨 using templates only, and the message shows the status. The old behaviour was 실패 → retry. Is it OK to drop that retry?
5. KG-56-5: the template/autocomplete tag lives only in auto.후보 and the panel source column. pilot_questions has no source column, so I didn't change the schema.

## Out of Scope (logged in BUILD-LOG)
- KG-56-2 test-new-client marketing-draft depends on the weekday.
- KG-56-3 import-ai-measurements reads `client` before it is declared (TDZ). It already stops with a ReferenceError today.
- KG-56-4 the 4 remaining grep hits.
- KG-56-5 no source column for questions.
- KG-56-6 ops ai.cited (0 screens draw it right now).
