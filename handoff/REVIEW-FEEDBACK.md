# Review Feedback — Step 57 (Round 2)
Date: 2026-10-17
Ready for Builder: YES

Re-ran: test-client-core 265/0 · test-auto-setup-core 156/0 · test-client-copy 15/0 · test-onboard-core 24/0 · test-clients 110/0 · test-docttak 35/0 · test-ilog-loop 43/0 · test-todo-words 17/0 · test-client-status 14/0 · web tsc 0. No --live runs.

## Must Fix
None.

Round 1's Must Fix is resolved by D257. The generic stems are gone:
- 업종떼기 is removed, and nothing references it anymore.
- `이름말들` (client-core.mjs:920-923) now returns only the full name and the no-space name, both still filtered by 이름흔함 and the Korean-text check.
- The five negative names are covered in test-client-core.

## Should Fix
None open.
- D259: the meta sentence is gone. The 홈페이지 열기 date now comes from the site-launch due date (onboard-core 열날), the same source as 「자세히」 and 다음 고비.
- D260: the 업종·지역 출처 hints in auto-setup-core.mjs:192-215 are in plain words. test-client-copy now checks every 말/출처 string in that file.
- KG-57-4 (the 씨앗 출처 at auto-setup-core 565) is logged correctly as out of scope.

## Escalate to Architect
None.

## id 18 --apply
Safe to apply. Re-verified dry run: `id 18: 판별 말 3개(흔함 1) → 2개(흔함 0) · 뺄 말 3 · 더할 말 2`.
- The two new terms are the client's full registered name and its no-space form. Both are distinctive.
- The generic 원장 phrase from round 1 is dropped. No domain is added, because this client has no site.
- Trade-off: answers that shorten the name will no longer count. That loses some recall but creates no false hits, which is the honest side of the 「지어내지 않는다」 rule.
- The write uses compare-and-set, so it is skipped if 원장 edits the terms first.
- A run without an id still leaves id 18 alone (원장 source) and id 15 alone (nothing 흔함).
- The output shows only ids and counts.

## Cleared
Round 2 (D257–D260) was reviewed against the round 1 findings. All are resolved, the tests and tsc are green, and the id 18 apply is safe. Step 57 is clear.
