# Review Feedback — Bing SERP via real browser (bing-serp.mjs) — re-check
Date: 2026-10-12
Ready for Builder: YES

## Must Fix
- None. The growth.ts finding from round 1 is resolved. `rivalAll` now filters `engine <> 'bing'`, so days the PC skips no longer blank the 경쟁 series. Bing still shows in the latest-day `byEngine` query, which is unfiltered.

## Should Fix
- None outstanding. Round 1 items, all verified:
  - brief-core.mjs: firsts now drop a hit when its KST day equals that client+engine's first measured day. The window `min(min(checked_at)) over (partition by client_id, engine)` is valid on the grouped rows.
  - bing-serp.mjs:27-31: `내주소` takes the host, strips scheme and www, then requires an exact match or a `.domain` suffix. That rules out `mydocttak.com` and cites with the domain in the path.
  - bing-serp.mjs:71,82: the control query runs before and after each client, and a failure drops only that client. Exit code 1 if any client failed.
  - bing-serp.mjs:22: PROFILE resolves from import.meta.url to tools/.browser-profile, the same profile local-agent used before.
  - bing-serp.mjs:84: rows are saved per client, so a timeout no longer loses the whole day.

## Escalate to Architect
- None.

## Cleared
Re-checked the diffs of growth.ts, brief-core.mjs and the rewritten tools/bing-serp.mjs. Every round 1 finding is fixed, and the fixes add no new issues.
