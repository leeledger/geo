# Review Feedback — Step 16 (현황판 문구 · 밀린 예약) 2차
Date: 2026-09-24
Ready for Builder: YES
Reviewed: working tree (uncommitted) — agents.ts · company.mjs, plus the BUILD-LOG KG-16-1 entry

## Must Fix
(none)

## Should Fix
- web/lib/agents.ts:321 — The `gaveUp` check runs before the repair/sales exclusion. company.mjs:428 sends repair.yml and sales.yml straight to 사람 대기 without re-running them. A repair or sales failure would therefore read 「다시 돌려도 실패해 오늘 하실 일에 올렸습니다」, but it was never re-run. — Fix in one line: for repair/sales say 「오늘 하실 일에 올렸습니다」. Keep 「다시 돌려도 실패해」 for the retried workflows only. Fix inline.
- handoff/BUILD-LOG.md:1013 — `KG-16-1` sits next to an older, unrelated `KG-16` (line 355, 아이로그 기출 분석, Step 7). Someone searching "KG-16" will find both. Not a code issue; rename it if convenient.

## Escalate to Architect
(none — the scope and DB edits are now logged in BUILD-LOG. 439 and 319 close after the push, which Arch should confirm on the next audit run.)

## Round-1 items — verified
- Must 1 (agents.ts:319-324, 428-433): readAgents collects `payload->>'file'` from workflow-failed tasks in 사람 대기, strips `.yml`, and matches that against the mirror's captured workflow name (same form). The query sits in its own try/catch, so a failure only loses the "gave up" wording, not the whole strip. Stale state cannot show: when the workflow later succeeds, company.mjs:404-412 closes the non-sticky `wf-%` task (the 'gh' bucket).
- agents.ts:329 — the claimed cause is removed. It now reads 「매시 점검이 2시간 넘게 안 돌았습니다」.
- agents.ts:343 — now 「2시간이 지나도 안 뜨면 매시 점검이 대신 돌립니다」. This is conditional, and true whichever way it goes.
- company.mjs:297-300 — the failed-dispatch activity is written at most once per 24h per workflow. The `summary like '<이름> —%'` dedupe matches the summary format written on line 300, and `at` is a real column (company.mjs:248). The console line still prints every hour, which is fine.
- company.mjs:290 — `t >= slot`, so a run started before the slot no longer counts.
- company.mjs:556-559 — the evidence now says what actually happens. The comment points to KG-16-1, and the gap is logged.

## Cleared
Step 16 round 2: the stuck-row retry promise now matches company.mjs behaviour, and all round-1 Should items are resolved. One small wording fix for repair/sales remains as a Should. Step 16 is clear.
