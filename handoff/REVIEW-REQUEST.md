# Review Request — Step 57 (round 2: D257–D260)
Date: 2026-10-17
Ready for Review: YES

## Round 2 — Richard's feedback, Arch decisions D257–D260
- **D257 (Must Fix)** — web/lib/client-core.mjs 이름말들 / 이름판별고침: auto-rebuilt terms are now only the full name and the no-space name, plus the domain for site/builder clients. When a fix applies, the whole term list is replaced with that set.
  - 업종떼기 is removed from auto-setup-words.mjs and its d.mts.
  - test-client-core adds the five negative names (행복한공부방, 맛있는카페, 우리동네학원, 대치수학학원, 잠실미술학원). None produces a stem term.
  - If the full name itself is 흔함, the client still gets an owner task, as before.
- **D258** — 강제 mode (fix-name-terms --client-id) replaces all terms, including 원장-entered generic ones, with the name-only set. It ignores the source and whether any term is 흔함. Output is still ids and counts only, and --dry is still the default.
  - id 18 --dry: `id 18: 판별 말 3개(흔함 1) → 2개(흔함 0) · 뺄 말 3 · 더할 말 2`.
- **D259** — web/lib/onboard-core.mjs: the meta sentence is removed from the build row. 「홈페이지 열기」 now takes its date from the site-launch task due date, the same source as 「자세히」 and 다음 고비. test-onboard-core 57-2 asserts both show 10/20.
- **D260** — web/lib/auto-setup-core.mjs:
  - The 업종·지역 출처 hints are rewritten in plain words.
  - The 사이트 step's "done" message no longer lists robots/llms/JSON-LD; it says 「손볼 곳 n군데」.
  - The done messages that mentioned 파일럿 or 씨앗, and 「자동 세팅이 없는 고객」, are rewritten too.
  - test-client-copy now checks every `말:` / `출처:` string in auto-setup-core.mjs, plus the 출처 values that 사실뽑기 returns, against 원장금지말: 40 auto-setup strings, 7,649 owner strings in total, 0 hits.
  - test-auto-setup-core now checks for 「적힌 주소」 / 「홈페이지 글」 instead of the old wording.
- Tests: test-client-core 265 · test-auto-setup-core 156 · test-client-copy 15 · test-onboard-core 24 · test-clients 110 · test-docttak 35 · test-ilog-loop 43 · test-todo-words 17 · test-client-status 14. All 0 failures. tsc 0, next build OK. The --live screen test was not re-run in round 2.
- New gap: KG-57-4. The autocomplete question 출처 strings (「씨앗」, auto-setup-core 337/565) still contain banned words. They show up in the pilot question panel and in config, not in the auto-setup panel.

## Round 1
Status: DONE_WITH_CONCERNS. Every brief test passes with 0 failures, tsc is 0, next build passes, and test-onboard-screen --live is 39/0. One concern: D254 asks to lower the contract task to a "기회/낮은 칸" grade, but no such grade exists on the 현황판 (Open Question 1).

## Files Changed
- web/lib/client-core.mjs:171-180 — 원장금지말 / 원장금지말찾기 (D255), plus 계약말 (D254 title and 할일).
- web/lib/client-core.mjs:705-706 — 자동단계말: 「리허설 파일럿」 → 「연습 측정 준비」.
- web/lib/client-core.mjs:818,857 — keyfile and gsc 할일 rewritten in plain words (no 키 파일, IndexNow or 서치콘솔).
- web/lib/client-core.mjs:860-866 — measure: before a contract (no pilot or an auto rehearsal) the row is 기다림, not 사람 (D254).
- web/lib/client-core.mjs:889-900 — name row: when the term can be fixed from the client name it is 기다림. Otherwise it is 사람, with 할일 in plain words.
- web/lib/client-core.mjs:913-981 — 이름말들 · 이름판별고침 (does not overwrite a 원장 source or an old client without auto; 강제 overrides) · 판별말저장 (writes only if answerTerms is unchanged since it was read) · 판별말고치고맞추기 (hourly: fix, then checklist, then 사람일감맞추기, for every active screen-registered client, with no site fetch).
- web/lib/client-core.mjs:983-1010 — 일감제목 exported and rewritten without 금지어. A measure row in 기다림 closes setup-measure.
- web/lib/auto-setup-words.mjs:135-155 — 업종떼기: reuses the 업종표 table plus 어학원, never cuts through the middle of a subject word, keeps the result only if it is 3+ chars and not 흔함.
- web/lib/auto-setup-core.mjs:447-453,502,592,595 — the step messages (사람말, now exported) that become 원장 할일 when a step stops, rewritten without 금지어. The raw cause stays only in the 오류 field.
- web/lib/onboard-core.mjs:249-253 — build draft: start building right away. Only the open date waits for the baseline (setup still does the baseline first).
- web/lib/onboard-core.mjs:415-520 — 할일순서(): build 7 rows / setup 6 rows / none 4 rows, each with 누가 and 상태 (됨 / 지금 할 차례 / 아직), and 「n일째 기다림」 only when a date was recorded.
- web/app/admin/clients/TodoOrder.tsx (new) + clients.css:86-103 — the numbered list.
- web/app/admin/clients/[slug]/page.tsx:136-145,233 — 할 일 순서 at the top; the checklist is folded into #checks; the summary is renamed to 「계약 칸」; the dead measure button is removed.
- web/app/admin/clients/[slug]/onboard/page.tsx:87-100 — 할 일 순서 at the top; the stage rows are folded into #ob-detail.
- web/lib/todo-text.ts — the setup.measure `why` line is removed (measure no longer opens).
- academy/scripts/scout.mjs:150-185 — notracker and crawl are skipped for clients with no site or a platform-only site (D253), with the new wording.
- academy/scripts/company.mjs:41,1041-1042 — calls 판별말고치고맞추기 after 자동이어하기.
- academy/scripts/fix-name-terms.mjs (new) — defaults to --dry. --client-id means 원장 instruction (source is ignored). Output shows only ids and counts.
- *.d.mts — the new exports.
- Tests: test-client-core (D252 pure functions, fake-q save and loop, D254 measure), test-auto-setup-core (업종떼기), test-client-copy (원장 금지어 check over all combos, 7,621 strings), test-onboard-core (57-1 to 57-6), test-onboard-screen (할 일 순서 assertions plus client-page shots at 2 widths), test-client-screen (assertions only, not run).

## Verification
- test-client-core 258 · test-auto-setup-core 162 · test-client-copy 15 · test-onboard-core 24 · test-clients 110 · test-docttak 35 · test-ilog-loop 43 · test-todo-words 17 · test-client-status 14: all 0 failures. web tsc 0. next build OK.
- fix-name-terms --client-id 18 (--dry): `id 18: 판별 말 3개(흔함 1) → 5개(흔함 0) · 뺄 말 1 · 더할 말 3`. Run without an id: id 18 is left alone (원장 source); id 15 has nothing 흔함.
- scout --json (read only): 0 notracker/crawl keys. id 18's open notracker task will close as 「신호 사라짐」.
- Dry plan for id 18 (read only): after the hourly loop runs, only setup-name opens and setup-measure closes. setup-name becomes 완료 after Arch runs --apply.
- test-onboard-screen --live: 39/0. Test client id 28 deleted; 0 rows left across all 30 client_id/pilot_id columns. Screenshots are in the scratchpad, not the repo. The .to-row padding (11px) was adjusted after the shots were taken.

## Open Questions
1. D254 grade: on the 현황판, scout's 기회 grade becomes 사람 대기 priority 60, which still shows in 「오늘 할 일」, so there is no existing 「기회/낮은 칸」 grade to move the task into. I chose not to open a contract task before a contract exists (measure = 기다림, and the old setup-measure is closed). The contract step lives in line 1 of the client page's 할 일 순서. If Arch wants it kept as a task in a lower tier, that needs a new tier in Todo.tsx.
2. id 18's name terms: the source is 원장, so the hourly loop leaves them alone. Arch's `fix-name-terms --client-id 18 --apply` is needed.
3. Whether to keep both the spaced and unspaced forms of the name. answer_pattern already allows an optional space, so they overlap. That is harmless and matches the brief.

## Out of Scope (logged in BUILD-LOG)
- KG-57-1 rescan and nomeasure jobs are still created for clients with no domain.
- KG-57-2 the panel and checklist field names in the 「자세히」 screen keep their technical words.
- KG-57-3 retake the screenshots after the CSS padding tweak.
